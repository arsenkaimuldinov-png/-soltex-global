/**
 * Site settings (Phase N-0, docs/admin-settings.md): read and save the contacts, headquarters,
 * footer texts, metrics and offices in all six languages; If-Match; step-up; audited by field
 * names; the change reaches the export (and so the next release); approvals stay current.
 */
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { desc, eq } from 'drizzle-orm';
import * as s from '../src/db/schema.ts';
import { STEP_UP_WINDOW_MS } from '../src/auth/sessions.ts';
import { exportStore } from '../src/content/export.ts';
import { legacySourceHash } from '../src/content/legacy-source-hash.ts';
import { closeTestDb, DB_ENABLED, makeApp, problem, signedIn, type TestApp } from './helpers.ts';
import { resetToSeed } from './release-helpers.ts';

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

describe('Site settings (Phase N-0)', { skip: !DB_ENABLED && 'DATABASE_URL not set' }, () => {
  let t: TestApp;
  let admin: Awaited<ReturnType<typeof signedIn>>;
  before(async () => {
    t = await makeApp();
    await resetToSeed(t);
    admin = await signedIn(t, 'admin');
  });
  after(async () => {
    await t.app.close();
    await closeTestDb();
  });

  const body = (v: Json) => structuredClone({ primaryEmail: v.primaryEmail, hqEmail: v.hqEmail, texts: v.texts, metrics: v.metrics.map(({ id, value, texts }: Json) => ({ id, value, texts })), offices: v.offices.map(({ id, phone, email, whatsapp, texts }: Json) => ({ id, phone, email, whatsapp, texts })) }) as Json;

  test('read: everything the site shows, in six languages, with a version', async () => {
    const res = await admin.c.req('GET', '/api/v1/settings');
    assert.equal(res.statusCode, 200, res.body);
    const v = res.json() as Json;
    assert.equal(res.headers.etag, `"${v.version}"`);
    assert.equal(v.siteName, 'Soltex Global');
    assert.deepEqual(Object.keys(v.texts).sort(), ['ar', 'en', 'es', 'ru', 'tr', 'zh']);
    assert.ok(v.offices.length >= 1 && v.metrics.length >= 1);
    assert.equal(v.offices[0].texts.ru.country.length > 0, true);
  });

  test('save: changes reach the export; audited by field names only; approvals stay current; If-Match', async () => {
    const v = (await admin.c.req('GET', '/api/v1/settings')).json() as Json;
    const next = body(v);
    next.offices[0].email = 'europe@soltexglobal.co';
    next.offices[0].phone = '+359 2 000 0000';
    next.texts.ru.hqHours = 'Вс — Чт: 08:30 — 17:30 (UTC+4)';
    next.texts.en.hqHours = 'Sun — Thu: 08:30 — 17:30 (UTC+4)';
    const res = await admin.c.req('PUT', '/api/v1/settings', next, { 'if-match': `"${v.version}"` });
    assert.equal(res.statusCode, 200, res.body);
    assert.equal(res.json().version, v.version + 1);

    const store = await exportStore(t.deps.db!);
    const office = store.settings.offices.find((o) => o.id === v.offices[0].key)!;
    assert.equal(office.email, 'europe@soltexglobal.co');
    assert.equal(office.phone, '+359 2 000 0000');
    assert.equal(store.settings.headquarters.hours.ru, 'Вс — Чт: 08:30 — 17:30 (UTC+4)');
    for (const l of ['ru', 'zh', 'tr', 'ar', 'es'] as const)
      if (store.settings.translationStatus[l].status === 'approved') assert.equal(store.settings.translationStatus[l].approvedSourceHash, legacySourceHash(store.settings), `${l} stays current`);

    const [audit] = await t.deps.db!.select().from(s.auditEvents).where(eq(s.auditEvents.action, 'settings.update')).orderBy(desc(s.auditEvents.at)).limit(1);
    assert.deepEqual((audit!.summary as Json).fields, ['texts.en', 'texts.ru', `office.${v.offices[0].key}`]);
    assert.ok(!JSON.stringify(audit!.summary).includes('europe@'), 'no values in the audit log');

    const stale = await admin.c.req('PUT', '/api/v1/settings', next, { 'if-match': `"${v.version}"` });
    assert.equal(problem(stale).body.code, 'edit_conflict');
    assert.equal(problem(await admin.c.req('PUT', '/api/v1/settings', next)).body.code, 'precondition_required');
  });

  test('validation: e-mails, required texts in every language, the same records only', async () => {
    const v = (await admin.c.req('GET', '/api/v1/settings')).json() as Json;
    const ifMatch = { 'if-match': `"${v.version}"` };
    const bad = body(v);
    bad.offices[0].email = 'not-an-email';
    bad.texts.zh.copyright = ' ';
    assert.equal((await admin.c.req('PUT', '/api/v1/settings', bad, ifMatch)).statusCode, 400);
    const fewer = body(v);
    fewer.offices = fewer.offices.slice(1);
    const r = problem(await admin.c.req('PUT', '/api/v1/settings', fewer, ifMatch));
    assert.equal(r.body.code, 'validation_failed');
    assert.deepEqual((r.body as Json).errors, [{ field: 'offices', message: 'records_mismatch' }]);
    const unchanged = await admin.c.req('PUT', '/api/v1/settings', body(v), ifMatch);
    assert.equal(unchanged.json().version, v.version, 'nothing changed → no new version');
  });

  test('a fresh second factor is required to save; editors cannot read', async () => {
    const v = (await admin.c.req('GET', '/api/v1/settings')).json() as Json;
    t.clock.advance(STEP_UP_WINDOW_MS + 1000);
    assert.equal(problem(await admin.c.req('PUT', '/api/v1/settings', body(v), { 'if-match': `"${v.version}"` })).body.code, 'step_up_required');
    const editor = await signedIn(t, 'content_manager');
    assert.equal(problem(await editor.c.req('GET', '/api/v1/settings')).body.code, 'forbidden');
  });
});
