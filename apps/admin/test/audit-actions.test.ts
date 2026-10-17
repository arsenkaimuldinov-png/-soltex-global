/**
 * Every audit action the API writes has Russian wording in «Журнал действий» (Phase M-1): the actions
 * are read from the API sources (`recordAudit({ action: … })`, both branches of a condition), so a new
 * action without a label fails here instead of showing «Действие в системе».
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { AUDIT_ACTION_LABELS } from '../src/i18n/ru';

const API = path.resolve(import.meta.dirname, '../../api/src');
const files = (dir: string): string[] => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? files(path.join(dir, e.name)) : /\.ts$/.test(e.name) && !/\.test\.ts$/.test(e.name) ? [path.join(dir, e.name)] : []));

test('every audit action of the API has a label', () => {
  const actions = new Set<string>();
  for (const f of files(API))
    for (const m of fs.readFileSync(f, 'utf8').matchAll(/action:\s*([^,]+?),\s*result/g)) for (const q of m[1]!.matchAll(/'([a-z_]+\.[a-z_.]+)'/g)) actions.add(q[1]!);
  assert.ok(actions.size >= 50, `found ${actions.size} actions`);
  assert.deepEqual([...actions].filter((a) => !AUDIT_ACTION_LABELS[a]).sort(), []);
});
