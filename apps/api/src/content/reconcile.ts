/**
 * Link existing approvals to the database source revision (Phase F, docs/admin-translations.md §2).
 *
 * An approval stored before Phase F (Phase B import, a Phase E database) or imported from the seed
 * has `approved_source_revision = NULL`: the database does not know which source text it reviewed.
 * The seed format does: `approvedSourceHash` is the hash of the English record at approval time.
 * So an approval is current exactly when that hash equals the hash of the current English record
 * (the same rule as the site build validator); such approvals get the current revision, every other
 * one stays NULL and is therefore reported as outdated. Idempotent; never touches other rows.
 *
 * Run by `db:import` (inside its transaction) and by `db:migrate` after the migrations.
 */
import { sql } from 'drizzle-orm';
import { TRANSLATED_LOCALES } from '@soltex/core/domain';
import type { TranslationStatus } from '@soltex/core/content';
import type { Queryable } from '../db/client.ts';
import { exportStore } from './export.ts';
import { legacySourceHash } from './legacy-source-hash.ts';
import { REVIEW_TABLES, TRANSLATABLE_TYPES } from './review-tables.ts';

export async function reconcileApprovals(db: Queryable): Promise<number> {
  const pending = TRANSLATABLE_TYPES.map((t) => {
    const r = REVIEW_TABLES[t];
    return `SELECT 1 FROM ${r.tr} WHERE tr_status = 'approved' AND approved_source_revision IS NULL`;
  }).join(' UNION ALL ');
  const { rows } = await db.execute(sql.raw(`SELECT count(*)::int AS n FROM (${pending}) x`));
  if (!Number((rows[0] as { n: number }).n)) return 0;

  const store = await exportStore(db);
  let linked = 0;
  const hashes = new Map<object, string>();
  const hashOf = (rec: object) => hashes.get(rec) ?? hashes.set(rec, legacySourceHash(rec)).get(rec)!;
  for (const type of TRANSLATABLE_TYPES) {
    const r = REVIEW_TABLES[type];
    const records = store[r.storeKey] as Array<{ id: string; translationStatus: TranslationStatus }>;
    for (const locale of TRANSLATED_LOCALES) {
      const keys = records
        .filter((rec) => {
          const e = rec.translationStatus[locale];
          return e.status === 'approved' && e.approvedSourceHash !== null && e.approvedSourceHash === hashOf(rec);
        })
        .map((rec) => rec.id);
      if (!keys.length) continue;
      const res = await db.execute(sql`
        UPDATE ${sql.raw(r.tr)} AS t SET approved_source_revision = e.source_revision
        FROM ${sql.raw(r.entity)} AS e
        WHERE t.${sql.raw(r.owner)} = e.id AND e.key = ANY(${sql.param(keys)}::text[]) AND t.locale = ${locale}
          AND t.tr_status = 'approved' AND t.approved_source_revision IS NULL`);
      linked += res.rowCount ?? 0;
    }
  }
  return linked;
}
