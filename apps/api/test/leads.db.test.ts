/**
 * Leads (Phase K-1, docs/admin-leads.md; approved §13): the public intake (origin, CSRF header,
 * validation by field name, size and rate limits, spam), encryption at rest and the blind index,
 * the outbox and its e-mail, the admin (list, search, status, assignee, notes, duplicates, bin,
 * export with step-up and formula-safe CSV), anonymization, and the canary test: personal data of
 * a lead never reaches the logs, the audit log, the outbox or lead events in plain text. Phase K-2:
 * attribution (validated, stored only while switched on, shown in the detail and CSV, anonymized).
 */
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { desc, eq, sql } from 'drizzle-orm';
import * as s from '../src/db/schema.ts';
import { connect } from '../src/db/client.ts';
import { STEP_UP_WINDOW_MS } from '../src/auth/sessions.ts';
import { anonymizeDue, processNextOutbox } from '../src/leads/service.ts';
import { FakeEmailProvider } from '../src/notify/email.ts';
import { closeTestDb, DB_ENABLED, LogSink, makeApp, nextIp, nextTotpStep, signedIn, totpCode, type TestApp } from './helpers.ts';

type Json = Record<string, any>;
type Signed = Awaited<ReturnType<typeof signedIn>>;

const SITE = 'https://soltexglobal.co';
const CANARY = { name: 'Canaryname Qx7', email: 'canary.qx7@example.test', phone: '+7 701 555 77 07', message: 'canary-message-Qx7 about a pectin line', company: 'CanaryCo Qx7' };

async function truncateLeads() {
  const mig = connect(process.env.MIGRATION_DATABASE_URL!, 1);
  await mig.pool.query('TRUNCATE "lead_events", "outbox", "leads"');
  await mig.close();
}

describe('Leads (Phase K-1)', { skip: !DB_ENABLED && 'DATABASE_URL not set' }, () => {
  let t: TestApp;
  let logs: LogSink;
  let marketer: Signed, editor: Signed, owner: Signed;
  const email = new FakeEmailProvider();
  const submit = (body: Json, opts: { ip?: string; headers?: Record<string, string> } = {}) =>
    t.app.inject({
      method: 'POST',
      url: '/api/v1/public/leads',
      remoteAddress: opts.ip ?? nextIp(),
      headers: { 'content-type': 'application/json', 'x-requested-with': 'soltex-site', origin: SITE, ...opts.headers },
      payload: JSON.stringify(body),
    });
  const contact = (fields: Json = {}, extra: Json = {}) => ({
    formType: 'contact_page',
    fields: { name: CANARY.name, phone: CANARY.phone, email: CANARY.email, company: CANARY.company, message: CANARY.message, ...fields },
    topic: null,
    locale: 'ru',
    pagePath: '/ru/contact',
    fillMs: 15_000,
    ...extra,
  });
  const leadRow = async (reference: string) => (await t.deps.db!.select().from(s.leads).where(eq(s.leads.reference, reference)))[0]!;

  before(async () => {
    logs = new LogSink();
    t = await makeApp({ PUBLIC_SITE_URL: SITE, LEAD_NOTIFY_TO: 'sales@soltex.test, director@soltex.test', API_LOG_LEVEL: 'debug' });
    // makeApp keeps its own sink; capture everything the app writes.
    logs = t.logs;
    await truncateLeads();
    [marketer, editor, owner] = [await signedIn(t, 'marketer'), await signedIn(t, 'editor'), await signedIn(t, 'owner')];
  });
  after(async () => {
    await truncateLeads();
    await t.app.close();
    await closeTestDb();
  });

  let first: Json;

  test('intake: 201 with SOL-<year>-<number>; contacts encrypted, blind index, notice-only consent, outbox event', async () => {
    const res = await submit(contact());
    assert.equal(res.statusCode, 201, res.body);
    first = res.json();
    assert.match(first.reference, new RegExp(`^SOL-${new Date(t.clock.t).getUTCFullYear()}-\\d{6}$`));
    const row = await leadRow(first.reference);
    assert.equal(row.status, 'new');
    assert.equal(row.name, CANARY.name, 'name stays plain for search (approved §13.1)');
    for (const col of [row.emailEnc, row.phoneEnc, row.messageEnc]) {
      assert.match(col!, /^v1\./);
      assert.ok(!col!.includes('canary') && !col!.includes('555'));
    }
    assert.match(row.emailBidx!, /^[0-9a-f]{32}$/);
    assert.equal(row.consentBasis, 'notice_only');
    assert.equal(row.consentAt, null);
    assert.match(row.ipHash!, /^[0-9a-f]{32}$/);
    const [ob] = await t.deps.db!.select().from(s.outbox);
    assert.deepEqual([ob!.kind, ob!.payload], ['lead.created', { leadId: row.id }]);
  });

  test('intake is refused without the site header or from another origin; validation names fields only', async () => {
    assert.equal((await submit(contact(), { headers: { 'x-requested-with': 'soltex-admin' } })).json().code, 'csrf_rejected');
    assert.equal((await submit(contact(), { headers: { origin: 'https://evil.example' } })).json().code, 'csrf_rejected');
    assert.equal((await submit(contact(), { headers: { origin: 'https://admin.soltex.test' } })).json().code, 'csrf_rejected');
    const noEmail = await submit(contact({ email: '' }));
    assert.equal(noEmail.statusCode, 400);
    assert.deepEqual(noEmail.json().errors, [{ field: 'fields.email', message: 'required' }]);
    const bad = await submit(contact({ email: 'canary.qx7-not-an-email' }));
    assert.deepEqual(bad.json().errors, [{ field: 'fields.email', message: 'invalid' }]);
    assert.ok(!bad.body.includes('canary'), 'the answer never echoes the values');
    const unknown = await submit({ ...contact(), secret: 1 });
    assert.equal(unknown.statusCode, 400);
    assert.ok(!unknown.body.includes(CANARY.name));
    assert.equal((await submit({ ...contact(), fields: { ...contact().fields, message: 'x'.repeat(30_000) } })).statusCode, 413, 'body over 20 KB');
    const cta = await submit({ formType: 'cta_section', fields: { name: 'Иван', phone: '+77011112233' }, topic: null, locale: 'en', pagePath: '/', fillMs: 9000 });
    assert.equal(cta.statusCode, 201, cta.body);
  });

  test('consent (Phase N-0): required once a privacy notice is published; stored as checkbox consent with its version and time', async () => {
    const leads = t.deps.config.leads as { privacyNoticeVersion: string | null };
    const before = leads.privacyNoticeVersion;
    leads.privacyNoticeVersion = '2026-10-19';
    try {
      const missing = await submit(contact({ phone: '+77015550101' }));
      assert.equal(missing.statusCode, 400);
      assert.deepEqual(missing.json().errors, [{ field: 'consent', message: 'required' }]);
      assert.equal((await submit(contact({ phone: '+77015550102' }, { consent: false }))).json().code, 'validation_failed', 'only true is consent');
      const ok = await submit(contact({ phone: '+77015550103' }, { consent: true }));
      assert.equal(ok.statusCode, 201, ok.body);
      const row = await leadRow(ok.json().reference);
      assert.deepEqual([row.consentBasis, row.privacyNoticeVersion, row.consentTextVersion, !!row.consentAt], ['checkbox', '2026-10-19', '2026-10-19', true]);
    } finally {
      leads.privacyNoticeVersion = before;
    }
    const noNotice = await submit(contact({ phone: '+77015550104' }));
    assert.equal(noNotice.statusCode, 201, 'no notice published: notice-only, as before');
    assert.equal((await leadRow(noNotice.json().reference)).consentBasis, 'notice_only');
  });

  test('rate limit: 5 forms per 10 minutes per address', async () => {
    const ip = nextIp();
    for (let i = 0; i < 5; i++) assert.equal((await submit(contact({ phone: `+7701000000${i}` }), { ip })).statusCode, 201);
    assert.equal((await submit(contact(), { ip })).statusCode, 429);
  });

  test('spam (honeypot, too fast) is stored as spam, answered like a lead, never e-mailed', async () => {
    const hp = await submit(contact({}, { hp: 'http://spam.example' }));
    assert.equal(hp.statusCode, 201);
    const row = await leadRow(hp.json().reference);
    assert.deepEqual([row.status, row.spamReasons], ['spam', ['honeypot']]);
    const fast = await leadRow((await submit(contact({ phone: '+77019998877' }, { fillMs: 800 }))).json().reference);
    assert.deepEqual([fast.status, fast.spamReasons], ['spam', ['too_fast']]);
    const queued = await t.deps.db!.execute(sql`SELECT count(*)::int AS n FROM outbox WHERE payload->>'leadId' IN (${row.id}, ${fast.id})`);
    assert.equal((queued.rows[0] as { n: number }).n, 0);
  });

  test('attribution (Phase K-2): validated; stored only while ATTRIBUTION_ENABLED; in the detail and the CSV', async () => {
    const touch = { at: '2026-10-01T10:00:00.000Z', landing: '/ru/projects', referrer: 'https://www.google.com', utm_source: 'google', utm_medium: 'cpc', utm_campaign: 'canary-campaign-Qx7' };
    const attribution = { first: { at: '2026-09-20T08:00:00.000Z', landing: '/', direct: true }, last: touch };
    const site = t.deps.config.site;
    assert.deepEqual((await marketer.c.req('GET', '/api/v1/leads?limit=1')).json().site, { formsLive: false, attribution: false });
    const off = await submit(contact({ phone: '+77015550001' }, { attribution }));
    assert.equal(off.statusCode, 201, off.body);
    assert.equal((await leadRow(off.json().reference)).attribution, null, 'switched off: ignored');
    for (const bad of [
      { last: { ...touch, email: 'x@y.z' } },
      { last: { ...touch, referrer: 'https://www.google.com/search?q=x' } },
      { last: { ...touch, landing: '/ru?utm_source=x' } },
      { last: { ...touch, utm_term: 'x'.repeat(201) } },
      { middle: touch },
    ])
      assert.equal((await submit(contact({ phone: '+77015550002' }, { attribution: bad }))).json().code, 'validation_failed', JSON.stringify(bad).slice(0, 80));
    site.leadsEnabled = true;
    site.attributionEnabled = true;
    try {
      assert.deepEqual((await marketer.c.req('GET', '/api/v1/leads?limit=1')).json().site, { formsLive: true, attribution: true });
      const on = await submit(contact({ phone: '+77015550003' }, { attribution }));
      assert.equal(on.statusCode, 201, on.body);
      const row = await leadRow(on.json().reference);
      assert.deepEqual(row.attribution, attribution);
      const detail = (await marketer.c.req('GET', `/api/v1/leads/${row.id}`)).json();
      assert.deepEqual(detail.attribution, attribution);
      assert.equal((await submit(contact({ phone: '+77015550004' }, { attribution: {} }))).statusCode, 201, 'an empty object is accepted and stored as nothing');
    } finally {
      site.leadsEnabled = false;
      site.attributionEnabled = false;
    }
  });

  test('outbox: the notice is sent with the decrypted lead; without SMTP it waits and is retried', async () => {
    email.failWith = 'mail_not_configured';
    while ((await processNextOutbox(t.deps, email)) === 'done');
    const pending = (await marketer.c.req('GET', `/api/v1/leads?q=${first.reference}`)).json().items[0];
    assert.equal(pending.notification, 'failed');
    const [ob] = await t.deps.db!.select().from(s.outbox).where(sql`${s.outbox.payload}->>'leadId' = ${pending.id}`);
    assert.deepEqual([ob!.attempts, ob!.lastError, ob!.sentAt], [1, 'mail_not_configured', null]);
    assert.ok(ob!.nextAttemptAt.getTime() - t.clock.t >= 14 * 60_000, 'retried in 15 minutes');

    email.failWith = null;
    assert.equal((await marketer.c.req('POST', `/api/v1/leads/${pending.id}/notify`)).statusCode, 200, '«Отправить ещё раз»');
    while ((await processNextOutbox(t.deps, email)) === 'done');
    const sent = email.sent.find((m) => m.subject.includes(first.reference))!;
    assert.deepEqual(sent.to, ['sales@soltex.test', 'director@soltex.test']);
    for (const v of [CANARY.name, CANARY.email, CANARY.phone, CANARY.message, CANARY.company]) assert.ok(sent.text.includes(v), v);
    assert.match(sent.text, /Открыть в админке: https:\/\/admin\.soltex\.test\/leads\//);
    const detail = (await marketer.c.req('GET', `/api/v1/leads/${pending.id}`)).json() as Json;
    assert.equal(detail.notification, 'sent');
    assert.deepEqual(detail.events.map((e: Json) => e.kind).reverse(), ['created', 'notify_failed', 'notified']);
    assert.ok(!email.sent.some((m) => m.text.includes('spam.example')), 'spam is not e-mailed');
  });

  test('admin: list and detail decrypted for leads.read; search by name, reference, exact e-mail and phone; no access without leads.read', async () => {
    assert.equal((await editor.c.req('GET', '/api/v1/leads')).statusCode, 403);
    const list = (await marketer.c.req('GET', '/api/v1/leads')).json() as Json;
    assert.ok(list.total >= 8);
    assert.ok(list.byStatus.spam >= 2);
    const byName = (await marketer.c.req('GET', `/api/v1/leads?q=${encodeURIComponent('canaryname')}&status=new`)).json() as Json;
    assert.ok(byName.items.every((i: Json) => i.name === CANARY.name));
    assert.equal(byName.items.find((i: Json) => i.reference === first.reference).email, CANARY.email);
    const byEmail = (await marketer.c.req('GET', `/api/v1/leads?q=${encodeURIComponent(' CANARY.QX7@example.TEST ')}`)).json() as Json;
    assert.ok(byEmail.items.some((i: Json) => i.reference === first.reference), 'e-mail search is exact and case-insensitive (blind index)');
    const byPhone = (await marketer.c.req('GET', `/api/v1/leads?q=${encodeURIComponent('+7 (701) 555-77-07')}`)).json() as Json;
    assert.ok(byPhone.items.some((i: Json) => i.reference === first.reference));
    assert.equal((await marketer.c.req('GET', `/api/v1/leads?q=${encodeURIComponent('canary.qx7')}`)).json().total, 0, 'no partial search in encrypted fields');
    const d = (await marketer.c.req('GET', `/api/v1/leads/${byEmail.items[0].id}`)).json() as Json;
    assert.equal(d.message, CANARY.message);
    assert.ok(d.duplicates >= 1, 'the same e-mail came in several times');
  });

  test('admin: status, assignee and notes (encrypted) with history and audit; If-Match', async () => {
    const id = (await marketer.c.req('GET', `/api/v1/leads?q=${first.reference}`)).json().items[0].id;
    const cur = await marketer.c.req('GET', `/api/v1/leads/${id}`);
    const people = (await marketer.c.req('GET', '/api/v1/leads/assignees')).json().items as Json[];
    assert.ok(people.some((p) => p.id === marketer.user.id) && !people.some((p) => p.id === editor.user.id), 'only roles that read leads');
    const bad = await marketer.c.req('PATCH', `/api/v1/leads/${id}`, { assigneeId: editor.user.id }, { 'if-match': String(cur.headers.etag) });
    assert.deepEqual(bad.json().errors, [{ field: 'assigneeId', message: 'not_allowed' }]);
    const res = await marketer.c.req('PATCH', `/api/v1/leads/${id}`, { status: 'in_progress', assigneeId: marketer.user.id }, { 'if-match': String(cur.headers.etag) });
    assert.equal(res.statusCode, 200, res.body);
    assert.deepEqual([res.json().status, res.json().assignee.id], ['in_progress', marketer.user.id]);
    assert.equal((await marketer.c.req('PATCH', `/api/v1/leads/${id}`, { status: 'won' }, { 'if-match': String(cur.headers.etag) })).json().code, 'edit_conflict');
    const note = await marketer.c.req('POST', `/api/v1/leads/${id}/notes`, { text: 'Перезвонить canary-note-Qx7 в понедельник' });
    assert.equal(note.statusCode, 200);
    assert.equal(note.json().events[0].note, 'Перезвонить canary-note-Qx7 в понедельник');
    const [ev] = await t.deps.db!.select().from(s.leadEvents).where(eq(s.leadEvents.kind, 'note'));
    assert.ok(ev!.noteEnc!.startsWith('v1.') && !ev!.noteEnc!.includes('canary'));
    const [audit] = await t.deps.db!.select().from(s.auditEvents).where(eq(s.auditEvents.action, 'lead.update')).orderBy(desc(s.auditEvents.at)).limit(1);
    assert.deepEqual((audit!.summary as Json).fields, ['status', 'assignee']);
  });

  test('export: needs a fresh second factor; CSV is formula-safe with a BOM; audited; the Owners get a notice', async () => {
    await submit({ formType: 'inquiry_modal', fields: { name: '=HYPERLINK("http://evil")', phone: '+77012223344' }, topic: 'Пектин', locale: 'en', pagePath: '/technologies/pectin', fillMs: 8000 });
    t.clock.advance(STEP_UP_WINDOW_MS + 1000);
    assert.equal((await marketer.c.req('GET', '/api/v1/leads/export')).json().code, 'step_up_required');
    nextTotpStep(t.clock);
    assert.equal((await marketer.c.req('POST', '/api/v1/auth/mfa/totp/verify', { code: await totpCode(marketer.totpSecret!, t.clock) })).statusCode, 200);
    const res = await marketer.c.req('GET', '/api/v1/leads/export?status=new');
    assert.equal(res.statusCode, 200, res.body);
    assert.match(String(res.headers['content-type']), /^text\/csv/);
    assert.match(String(res.headers['content-disposition']), /attachment; filename="soltex-leads-\d{4}-\d{2}-\d{2}\.csv"/);
    assert.ok(res.body.startsWith('﻿Номер;Дата (UTC);Статус'));
    assert.ok(res.body.split('\r\n')[0]!.endsWith(';Ответственный;Источник: первый визит;Источник: последний'));
    assert.ok(res.body.includes(';прямой заход;google / cpc / canary-campaign-Qx7'), 'attribution in words');
    assert.ok(res.body.includes(`"'=HYPERLINK(""http://evil"")"`), 'formula neutralised');
    assert.ok(res.body.includes("'+77012223344"), 'phone starting with + is not a formula');
    assert.ok(!res.body.includes(';Спам;'), 'filtered: status new only');
    const [audit] = await t.deps.db!.select().from(s.auditEvents).where(eq(s.auditEvents.action, 'lead.export')).orderBy(desc(s.auditEvents.at)).limit(1);
    assert.ok(Number((audit!.summary as Json).count) >= 1);
    assert.equal((audit!.summary as Json).reason, 'status=new');
    while ((await processNextOutbox(t.deps, email)) === 'done');
    const notice = email.sent.find((m) => m.subject === 'Выгрузка заявок из админки Soltex Global')!;
    assert.ok(notice.to.includes(owner.user.email));
    assert.ok(!/canary/i.test(notice.text), 'the notice names the person and the count only');
  });

  test('bin and anonymization: deleted leads after 30 days, all leads after the retention period', async () => {
    const id = (await marketer.c.req('GET', `/api/v1/leads?q=${first.reference}`)).json().items[0].id;
    const cur = await marketer.c.req('GET', `/api/v1/leads/${id}`);
    const del = await marketer.c.req('POST', `/api/v1/leads/${id}/delete`, undefined, { 'if-match': String(cur.headers.etag) });
    assert.equal(del.statusCode, 200, del.body);
    assert.ok(!(await marketer.c.req('GET', `/api/v1/leads?q=${first.reference}`)).json().items.length, 'not in the list');
    assert.equal((await marketer.c.req('GET', `/api/v1/leads?q=${first.reference}&deleted=true`)).json().items.length, 1, 'in the bin');
    assert.equal((await marketer.c.req('PATCH', `/api/v1/leads/${id}`, { status: 'won' }, { 'if-match': String(del.headers.etag) })).json().code, 'invalid_transition');

    assert.equal(await anonymizeDue(t.deps), 0, 'nothing before 30 days');
    t.clock.advance(31 * 86_400_000);
    assert.equal(await anonymizeDue(t.deps), 1);
    const row = await leadRow(first.reference);
    assert.deepEqual([row.name, row.company, row.emailEnc, row.phoneEnc, row.messageEnc, row.emailBidx, row.phoneBidx, row.ipHash], [null, null, null, null, null, null, null, null]);
    assert.ok(row.anonymizedAt && row.formType === 'contact_page' && row.locale === 'ru', 'date, form and language remain');
    const notes = await t.deps.db!.select().from(s.leadEvents).where(eq(s.leadEvents.leadId, row.id));
    assert.ok(notes.every((n) => n.noteEnc === null));
    assert.ok(notes.some((n) => n.kind === 'anonymized' && (n.data as Json).reason === 'deleted'));

    t.clock.advance(24 * 31 * 86_400_000);
    const n = await anonymizeDue(t.deps);
    assert.ok(n >= 7, `retention: ${n}`);
    const [{ left, attributed }] = (await t.deps.db!.execute(sql`SELECT count(*) FILTER (WHERE anonymized_at IS NULL)::int AS left, count(*) FILTER (WHERE attribution IS NOT NULL)::int AS attributed FROM leads`)).rows as [{ left: number; attributed: number }];
    assert.equal(left, 0);
    assert.equal(attributed, 0, 'attribution is removed with the personal data');
  });

  test('canary: no personal value of a lead in the logs, audit log, outbox or lead events', async () => {
    const all = logs.text;
    assert.ok(all.length > 1000, 'the app logged (debug level)');
    assert.ok(all.includes('lead received'), 'intake is logged — without its data');
    for (const v of [CANARY.name, CANARY.email, CANARY.phone, CANARY.message, CANARY.company, 'canary.qx7', 'canary-note-Qx7', 'Qx7']) assert.ok(!all.includes(v), `log contains ${v}`);
    const tables = await t.deps.db!.execute(sql`
      SELECT (SELECT coalesce(string_agg(summary::text, ' '), '') FROM audit_events) AS audit,
             (SELECT coalesce(string_agg(payload::text || coalesce(last_error, ''), ' '), '') FROM outbox) AS outbox,
             (SELECT coalesce(string_agg(data::text, ' '), '') FROM lead_events) AS events`);
    const row = tables.rows[0] as { audit: string; outbox: string; events: string };
    for (const [where, text] of Object.entries(row)) assert.ok(!/qx7|canary/i.test(text), `${where} contains a canary`);
    assert.ok(!all.includes('canary-campaign'), 'attribution values are not logged either');
  });
});
