#!/usr/bin/env node
/**
 * sql.raw() review gate (Phase M-1; review §Q A03 «sql.raw banned by a lint rule»). Drizzle's
 * sql.raw() splices text into SQL unescaped. The API uses it only for table / column names and
 * fixed expressions from code constants (content/review-tables.ts, checked at load time) — never
 * for request data. Every file that uses it is listed here with the number of uses and why; a new
 * file or a new use fails `npm run lint` until it is reviewed and added.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const REVIEWED = {
  'apps/api/src/content/translations/service.ts': [6, 'UNION over the seven REVIEW_TABLES; ORDER BY expressions built from the TRANSLATED_LOCALES constant'],
  'apps/api/src/content/reconcile.ts': [4, 'REVIEW_TABLES identifiers'],
  'apps/api/src/publishing/restore.ts': [7, 'REVIEW_TABLES identifiers'],
  'apps/api/src/publishing/revisions.ts': [2, 'REVIEW_TABLES identifiers'],
  'apps/api/src/publishing/entity-state.ts': [2, 'REVIEW_TABLES identifiers'],
  'apps/api/src/publishing/releases.ts': [1, 'REVIEW_TABLES identifiers'],
  'apps/api/src/seo/report.ts': [1, 'REVIEW_TABLES identifiers'],
  'apps/api/src/system/overview.ts': [12, 'REVIEW_TABLES identifiers and title expressions; the search text is a bound parameter'],
  'apps/api/src/routes/seo.ts': [1, 'REVIEW_TABLES identifiers'],
};

const files = [];
const walk = (d) => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.ts$/.test(e.name) && !/\.test\.ts$/.test(e.name)) files.push(p);
  }
};
walk(path.join(ROOT, 'apps/api/src'));
const problems = [];
for (const f of files) {
  const rel = path.relative(ROOT, f);
  const n = (fs.readFileSync(f, 'utf8').match(/sql\.raw\(/g) ?? []).length;
  if (!n) continue;
  const reviewed = REVIEWED[rel];
  if (!reviewed) problems.push(`${rel}: ${n} sql.raw() use(s) not reviewed`);
  else if (n > reviewed[0]) problems.push(`${rel}: ${n} sql.raw() uses, ${reviewed[0]} reviewed`);
}
if (problems.length) {
  console.error(`check-sql-raw: review these uses (identifiers from code constants only, never request data), then update scripts/check-sql-raw.mjs:\n  ${problems.join('\n  ')}`);
  process.exit(1);
}
console.log(`check-sql-raw: OK (${Object.keys(REVIEWED).length} reviewed files)`);
