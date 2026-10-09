/**
 * Restore a revision AS A NEW WORKING VERSION (Phase G, docs/admin-publishing.md §2.3).
 *
 * The restored content becomes the editor's working copy (all languages) and a new revision of
 * kind `restore` records it; history is never rewritten. The live site does not change: it
 * serves the active release until a new release with this content is published.
 *
 * Kept from the CURRENT state, never taken from the old revision:
 *  - the publication status (draft / published / archived are publishing actions);
 *  - the slug (a live address changes only with a redirect, Phase I).
 * Translations: an old approval stays valid only when the restored source text equals the current
 * one; otherwise the restored translation is reported as outdated (needs review again).
 */
import { sql } from 'drizzle-orm';
import { isLocalized, type ContentStore } from '@soltex/core/content';
import { TRANSLATED_LOCALES, deniedContentFields } from '@soltex/core/domain';
import type { Queryable } from '../db/client.ts';
import type { ClientInfo, Deps } from '../deps.ts';
import { requireDb } from '../deps.ts';
import { recordAudit } from '../audit/audit.ts';
import { Problem } from '../http/problem.ts';
import type { UserRow } from '../auth/sessions.ts';
import { exportStore } from '../content/export.ts';
import { importStore, ImportError } from '../content/import.ts';
import { REVIEW_TABLES, type TranslatableType } from '../content/review-tables.ts';
import { canonical, changedTopFields, getRevisionRow, recordRevision, recordsOf, type EntityRecord } from './revisions.ts';

/** English texts of a record (what a translation is made from), structure included. */
function englishProjection(value: unknown): unknown {
  if (isLocalized(value)) return value.en;
  if (Array.isArray(value)) return value.map(englishProjection);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) if (k !== 'translationStatus') out[k] = englishProjection(v);
    return out;
  }
  return null; // language-independent values do not make translations outdated
}

/** Store field → permission-carrying field name (SEO data needs seo.edit, as in Phase E). */
const permissionField = (field: string) => (field === 'seo' || field === 'slug' ? 'seoMetaTitle' : field);

class RestoreDenied extends Error {
  constructor(readonly fields: string[]) {
    super('restore denied');
  }
}

export interface RestoreResult {
  revision: number;
  entityVersion: number;
  fields: string[];
}

export async function restoreRevision(
  deps: Deps,
  type: TranslatableType,
  actor: UserRow,
  id: string,
  number: number,
  expectedVersion: number,
  client: ClientInfo
): Promise<RestoreResult> {
  const db = requireDb(deps);
  const r = REVIEW_TABLES[type];
  try {
    return await db.transaction(async (tx) => {
      const { rows } = await tx.execute(sql`SELECT id, key, status, version, source_revision FROM ${sql.raw(r.entity)} WHERE id = ${id} FOR UPDATE`);
      const head = rows[0] as { id: string; key: string; status: string; version: number; source_revision: number } | undefined;
      if (!head) throw new Problem('not_found');
      if (head.version !== expectedVersion) throw new Problem('edit_conflict');
      if (head.status === 'archived') throw new Problem('invalid_transition', 'Запись в архиве. Верните её из архива, чтобы восстановить версию.');
      const rev = await getRevisionRow(tx, type, id, number);
      if (!rev) throw new Problem('not_found', 'Такой версии нет.');

      const store = await exportStore(tx);
      const list = recordsOf(store, type);
      const current = list.find((x) => x.id === head.key)!;
      const target = JSON.parse(JSON.stringify(rev.data)) as EntityRecord;
      target.status = current.status;
      if ('slug' in current) target.slug = current.slug;
      const fields = changedTopFields(current, target).filter((f) => f !== 'translationStatus');
      if (!fields.length) throw new Problem('invalid_transition', 'Эта версия совпадает с текущей — восстанавливать нечего.');
      const denied = deniedContentFields(actor.role, fields.map(permissionField));
      if (denied.length) throw new RestoreDenied(fields.filter((f) => denied.includes(permissionField(f))));

      const restored = { ...store, [r.storeKey]: list.map((x) => (x.id === head.key ? target : x)) } as ContentStore;
      try {
        await importStore(tx, restored, { only: { collection: r.storeKey, key: head.key } });
      } catch (e) {
        if (e instanceof ImportError) throw new Problem('validation_failed', 'Версию нельзя восстановить: она ссылается на материалы или файлы, которых больше нет.', { errors: [{ field: 'revision', message: 'unknown_reference' }] });
        throw e;
      }

      const sourceChanged = canonical(englishProjection(current)) !== canonical(englishProjection(target));
      const sourceRevision = head.source_revision + (sourceChanged ? 1 : 0);
      const now = deps.now();
      await tx.execute(
        sql`UPDATE ${sql.raw(r.entity)} SET version = version + 1, source_revision = ${sourceRevision}, updated_at = ${now}, updated_by = ${actor.id} WHERE id = ${id}`
      );
      // Translation review state of the restored languages (Phase F rules), and new row versions.
      const statuses = (target.translationStatus ?? {}) as Record<string, { status: string }>;
      for (const locale of TRANSLATED_LOCALES) {
        const approved = statuses[locale]?.status === 'approved';
        await tx.execute(sql`
          UPDATE ${sql.raw(r.tr)} SET version = version + 1, updated_at = ${now}, updated_by = ${actor.id},
            approved_source_revision = ${approved && !sourceChanged ? sourceRevision : null}, edited_source_revision = NULL
          WHERE ${sql.raw(r.owner)} = ${id} AND locale = ${locale}`);
      }
      await tx.execute(sql`UPDATE ${sql.raw(r.tr)} SET version = version + 1 WHERE ${sql.raw(r.owner)} = ${id} AND locale = 'en'`);

      const revision = await recordRevision(tx, { type, id, kind: 'restore', actorId: actor.id, summary: { fields, restored_from: number } });
      await recordAudit(
        deps,
        client,
        { action: 'revision.restore', result: 'success', actorId: actor.id, resourceType: r.resourceType, resourceId: id, summary: { fields, revision: number } },
        tx
      );
      return { revision, entityVersion: head.version + 1, fields };
    });
  } catch (e) {
    if (e instanceof RestoreDenied) {
      await recordAudit(deps, client, { action: 'revision.restore', result: 'denied', actorId: actor.id, resourceType: r.resourceType, resourceId: id, summary: { fields: e.fields, revision: number } });
      throw new Problem('forbidden', 'Эта версия меняет поля, которые ваша роль изменять не может.', { errors: e.fields.map((field) => ({ field, message: 'not_allowed' })) });
    }
    if ((e as { cause?: { code?: string }; code?: string }).cause?.code === '23505') throw new Problem('slug_taken');
    throw e;
  }
}

/** Throws unless the entity exists (for read routes). */
export async function requireEntity(db: Queryable, type: TranslatableType, id: string): Promise<void> {
  const { rows } = await db.execute(sql`SELECT 1 FROM ${sql.raw(REVIEW_TABLES[type].entity)} WHERE id = ${id}`);
  if (!rows.length) throw new Problem('not_found');
}

