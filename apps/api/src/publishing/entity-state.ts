/**
 * Publish / unpublish ONE record in the working copy (Phase G, docs/admin-publishing.md §4).
 *
 * This changes only the record's status in the CMS (draft ⇄ published) — what the NEXT release will
 * contain. The live site changes only when a release containing it is published. Requires
 * content.publish (route). Before a record is marked published, the same blocking rules the build
 * applies to it are checked here, so an editor sees the problem at once instead of in a failed
 * build: every English text filled in, related records published.
 */
import { sql } from 'drizzle-orm';
import { isLocalized, type ContentStore } from '@soltex/core/content';
import type { ClientInfo, Deps } from '../deps.ts';
import { requireDb } from '../deps.ts';
import { recordAudit } from '../audit/audit.ts';
import { Problem, type FieldError } from '../http/problem.ts';
import type { UserRow } from '../auth/sessions.ts';
import { exportStore } from '../content/export.ts';
import { REVIEW_TABLES, type TranslatableType } from '../content/review-tables.ts';
import { recordRevision, recordsOf, type EntityRecord } from './revisions.ts';

/** Paths of empty English texts in a record (the build's "empty English text" rule). */
export function emptyEnglish(value: unknown, where = ''): string[] {
  if (isLocalized(value)) return value.en.trim() ? [] : [where];
  if (Array.isArray(value)) return value.flatMap((v, i) => emptyEnglish(v, `${where}.${i}`));
  if (value && typeof value === 'object')
    return Object.entries(value).flatMap(([k, v]) => (k === 'translationStatus' ? [] : emptyEnglish(v, where ? `${where}.${k}` : k)));
  return [];
}

/** Related records that would not be on the site (the build's relation rule). */
function unpublishedRelations(store: ContentStore, type: TranslatableType, rec: EntityRecord): FieldError[] {
  const published = (list: Array<{ id: string; status: string }>, id: string) => list.some((x) => x.id === id && x.status === 'published');
  const out: FieldError[] = [];
  const r = rec as Record<string, unknown>;
  if ((type === 'projects' || type === 'products') && !published(store.technologies, r.relatedTechnologyId as string))
    out.push({ field: 'relatedTechnology', message: 'unpublished_reference' });
  if (type === 'products' && !published(store.projects, r.relatedProjectId as string)) out.push({ field: 'relatedProject', message: 'unpublished_reference' });
  if (type === 'technologies')
    for (const id of (r.relatedProjectIds as string[]) ?? []) if (!published(store.projects, id)) out.push({ field: 'relatedProjects', message: 'unpublished_reference' });
  return out;
}

export async function setPublished(deps: Deps, type: TranslatableType, actor: UserRow, id: string, expectedVersion: number, publish: boolean, client: ClientInfo) {
  const db = requireDb(deps);
  const r = REVIEW_TABLES[type];
  return db.transaction(async (tx) => {
    const { rows } = await tx.execute(sql`SELECT id, key, status, version FROM ${sql.raw(r.entity)} WHERE id = ${id} FOR UPDATE`);
    const head = rows[0] as { id: string; key: string; status: string; version: number } | undefined;
    if (!head) throw new Problem('not_found');
    if (head.version !== expectedVersion) throw new Problem('edit_conflict');
    if (publish && head.status !== 'draft')
      throw new Problem('invalid_transition', head.status === 'published' ? 'Запись уже отмечена к публикации.' : 'Запись в архиве. Верните её из архива.');
    if (!publish && head.status !== 'published') throw new Problem('invalid_transition', 'Запись не опубликована.');
    if (publish) {
      const store = await exportStore(tx);
      const rec = recordsOf(store, type).find((x) => x.id === head.key)!;
      const errors: FieldError[] = [
        ...emptyEnglish(rec).map((field) => ({ field, message: 'required' })),
        ...unpublishedRelations(store, type, rec),
      ];
      if (errors.length) throw new Problem('validation_failed', 'Запись нельзя опубликовать: заполните пустые поля и опубликуйте связанные материалы.', { errors: errors.slice(0, 50) });
    }
    const now = deps.now();
    await tx.execute(
      sql`UPDATE ${sql.raw(r.entity)} SET status = ${publish ? 'published' : 'draft'}, published_at = ${publish ? now : null}, version = version + 1, updated_at = ${now}, updated_by = ${actor.id} WHERE id = ${id}`
    );
    await recordRevision(tx, { type, id, kind: publish ? 'publish' : 'unpublish', actorId: actor.id });
    await recordAudit(
      deps,
      client,
      { action: publish ? 'content.publish' : 'content.unpublish', result: 'success', actorId: actor.id, resourceType: r.resourceType, resourceId: id, summary: { status: publish ? 'published' : 'draft' } },
      tx
    );
    return { status: publish ? ('published' as const) : ('draft' as const), version: head.version + 1 };
  });
}
