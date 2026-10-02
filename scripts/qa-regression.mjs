#!/usr/bin/env node
/**
 * Public-site regression: compares a candidate build of apps/web with a baseline build.
 *
 *   node scripts/qa-regression.mjs --base <baseline-dist> [--new apps/web/dist] [--shots]
 *   node scripts/qa-regression.mjs --base-ref <git-ref>   [--new apps/web/dist] [--shots]
 *
 * --base-ref checks the ref out into .qa/base-src (git worktree), installs and builds it, and
 * uses its dist. Works for refs before the monorepo (site at the repository root) and after it
 * (apps/web).
 *
 * Steps (any failure → exit 1):
 *   1. byte comparison of the two dist trees (file list + SHA-256);
 *   2. page data, 29 routes × 6 languages × widths 1440/390 (head tags, texts, attributes) → compare.mjs;
 *   3. checks.mjs (JS disabled, motion, script-fail fallback, real 404s), on both builds, compared;
 *   4. interact.mjs (dialogs, inquiry topics, forms), on both builds, compared;
 *   5. navigation.mjs (language switch, stored-language redirect, client navigation, video lightbox,
 *      mobile menu, video URLs), on both builds, compared;
 *   6. inquiry-language.mjs on the candidate;
 *   7. with --shots: full-page screenshots, 4 widths × 6 languages × all routes → diff-shots.mjs.
 *
 * Needs Playwright + Chromium (not a project dependency): `npm i --no-save playwright@1` and
 * `npx playwright install chromium`, or CHROMIUM_PATH. Output goes to .qa/ (git-ignored).
 */
import { spawn, spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const WEB = path.join(ROOT, 'apps/web');
const QA = path.join(WEB, 'scripts/qa');
const OUT = path.join(ROOT, '.qa');

const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const shots = args.includes('--shots');
const newDist = path.resolve(opt('--new') ?? path.join(WEB, 'dist'));
let baseDist = opt('--base') && path.resolve(opt('--base'));
const baseRef = opt('--base-ref');
if (!baseDist && !baseRef) {
  console.error('usage: qa-regression.mjs --base <dist> | --base-ref <git-ref> [--new <dist>] [--shots]');
  process.exit(2);
}

fs.mkdirSync(OUT, { recursive: true });
const results = [];
const record = (step, ok, detail = '') => { results.push({ step, ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${step}${detail ? ` — ${detail}` : ''}`); };
const run = (cmd, argv, cwd = ROOT, extraEnv = {}) => spawnSync(cmd, argv, { cwd, encoding: 'utf8', env: { ...process.env, ...extraEnv }, maxBuffer: 1 << 28 });

// 0. baseline from a git ref
if (baseRef) {
  const src = path.join(OUT, 'base-src');
  run('git', ['worktree', 'remove', '--force', src]);
  fs.rmSync(src, { recursive: true, force: true });
  const wt = run('git', ['worktree', 'add', '--detach', src, baseRef]);
  if (wt.status) { console.error(wt.stderr); process.exit(2); }
  const site = fs.existsSync(path.join(src, 'apps/web/package.json')) ? path.join(src, 'apps/web') : src;
  for (const [cmd, argv] of [['npm', ['ci', '--no-audit', '--no-fund']], ['npm', ['run', 'build']]]) {
    const r = run(cmd, argv, cmd === 'npm' && argv[0] === 'ci' ? src : site);
    if (r.status) { console.error(r.stdout.slice(-3000), r.stderr.slice(-3000)); process.exit(2); }
  }
  baseDist = path.join(site, 'dist');
  console.log(`baseline: ${baseRef} → ${path.relative(ROOT, baseDist)}`);
}

// 1. byte comparison
function tree(dir) {
  const out = new Map();
  const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else out.set(path.relative(dir, p), crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')); } };
  walk(dir);
  return out;
}
{
  const a = tree(baseDist), b = tree(newDist);
  const missing = [...a.keys()].filter((k) => !b.has(k));
  const added = [...b.keys()].filter((k) => !a.has(k));
  const changed = [...a.keys()].filter((k) => b.has(k) && a.get(k) !== b.get(k));
  const html = [...b.keys()].filter((k) => k.endsWith('.html')).length;
  fs.writeFileSync(path.join(OUT, 'dist-diff.json'), JSON.stringify({ missing, added, changed }, null, 1));
  record('dist byte comparison', !missing.length && !added.length && !changed.length,
    `${b.size} files (${html} HTML); missing ${missing.length}, added ${added.length}, changed ${changed.length}`);
}

// serve both builds the way a static host does (real 404s, no SPA fallback)
const servers = [];
const serve = (dir, port) => new Promise((resolve) => {
  const s = spawn(process.execPath, [path.join(WEB, 'scripts/serve-dist.mjs'), dir, String(port)], { stdio: 'ignore' });
  servers.push(s);
  setTimeout(resolve, 800);
});
await serve(baseDist, 4173);
await serve(newDist, 4174);
const A = 'http://localhost:4173', B = 'http://localhost:4174';
const strip = (s) => s.replaceAll(A, '<host>').replaceAll(B, '<host>');

try {
  // 2. page data
  for (const [url, dir] of [[A, 'base'], [B, 'new']]) run('node', [path.join(QA, 'capture.mjs'), url, path.join(OUT, dir), 'en,ru,zh,tr,ar,es', '1440,390', '0']);
  const dataFile = (dir) => path.join(OUT, dir, 'data-enruzhtrares-1440_390.json');
  const cmp = run('node', [path.join(QA, 'compare.mjs'), dataFile('base'), dataFile('new')]);
  record('page data (routes, head/SEO, texts, attributes)', cmp.status === 0, cmp.stdout.trim().split('\n').join(' · '));

  // 3–5. checks, interactions, navigation on both builds, compared
  for (const [name, script, extra] of [
    ['checks (no-JS, motion, script-fail, 404)', 'checks.mjs', (d) => [dataFile(d)]],
    ['interactions (dialogs, inquiry topics, forms)', 'interact.mjs', (d) => [path.join(OUT, `${d}-interact.json`)]],
    ['navigation (language switch, stored language, video lightbox, mobile menu, video URLs)', 'navigation.mjs', (d) => [path.join(OUT, `${d}-navigation.json`)]],
  ]) {
    const outs = [];
    for (const [url, d] of [[A, 'base'], [B, 'new']]) {
      const r = run('node', [path.join(QA, script), url, ...extra(d)]);
      const file = script === 'checks.mjs' ? null : extra(d)[0];
      outs.push(strip(file && fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : r.stdout) + (r.status ? `\nexit ${r.status}: ${r.stderr}` : ''));
    }
    fs.writeFileSync(path.join(OUT, `${script}.base.txt`), outs[0]);
    fs.writeFileSync(path.join(OUT, `${script}.new.txt`), outs[1]);
    record(name, outs[0] === outs[1] && !/\nexit \d/.test(outs[1]), outs[0] === outs[1] ? 'identical to baseline' : `differs, see .qa/${script}.{base,new}.txt`);
  }

  // 6. inquiry language switch on the candidate
  const inq = run('node', [path.join(QA, 'inquiry-language.mjs'), B, '.'], WEB);
  record('inquiry topic follows the language', inq.status === 0, inq.stdout.trim().split('\n').pop());

  // 7. screenshots
  if (shots) {
    for (const [url, d] of [[A, 'base-shots'], [B, 'new-shots']]) run('node', [path.join(QA, 'capture.mjs'), url, path.join(OUT, d), 'en,ru,zh,tr,ar,es', '390,768,1280,1440', '1']);
    const ds = run('node', [path.join(QA, 'diff-shots.mjs'), path.join(OUT, 'base-shots/shots'), path.join(OUT, 'new-shots/shots')]);
    record('screenshots', ds.status === 0, ds.stdout.trim().split('\n').slice(-1)[0]);
  }
} finally {
  for (const s of servers) s.kill();
}

const failed = results.filter((r) => !r.ok);
fs.writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify(results, null, 1));
console.log(failed.length ? `\nREGRESSION: ${failed.length} step(s) differ from the baseline` : '\nREGRESSION: IDENTICAL to the baseline');
process.exit(failed.length ? 1 : 0);
