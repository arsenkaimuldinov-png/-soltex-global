// Compare two capture.mjs data files field by field.  node compare.mjs baseline.json candidate.json
import fs from 'fs';
const [a, b] = process.argv.slice(2).map((f) => JSON.parse(fs.readFileSync(f, 'utf8')));
const fields = ['title', 'description', 'robots', 'canonical', 'hreflang', 'og', 'lang', 'dir', 'h1', 'header', 'main', 'footer', 'headerAttrs', 'mainAttrs', 'footerAttrs'];
const diffs = {};
for (const k of Object.keys(a)) {
  if (k.includes('__errors')) continue;
  if (!(k in b)) { (diffs.missing ??= []).push(k); continue; }
  for (const f of fields) if (JSON.stringify(a[k][f]) !== JSON.stringify(b[k][f])) (diffs[f] ??= []).push(k);
}
const errs = Object.entries(b).filter(([k]) => k.includes('__errors'));
console.log(`pages compared: ${Object.keys(a).filter((k) => !k.includes('__errors')).length}`);
console.log(`runtime errors in candidate: ${errs.length ? JSON.stringify(errs) : 'none'}`);
if (!Object.keys(diffs).length) console.log('IDENTICAL: all fields of all pages match the baseline');
for (const [f, ks] of Object.entries(diffs)) console.log(`DIFF ${f}: ${ks.length} — ${ks.slice(0, 8).join(' | ')}`);
process.exit(Object.keys(diffs).length || errs.length ? 1 : 0);
