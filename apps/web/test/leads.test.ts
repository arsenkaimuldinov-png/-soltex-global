/**
 * Lead forms (Phase K-2): build switches, the HTTP lead service and UTM attribution (approved §13.3).
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { clearAttribution, currentAttribution, FIRST_TOUCH_KEY, LAST_TOUCH_KEY, recordVisit, touchOf, type AttributionStores } from '../src/services/leads/attribution.ts';
import { leadFlagsFromEnv } from '../src/services/leads/flags.ts';
import { createHttpLeadService } from '../src/services/leads/http.ts';
import type { LeadPayload } from '../src/services/leads/types.ts';

const mem = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), m };
};
const stores = () => {
  const local = mem();
  const session = mem();
  return { local, session, s: { local, session } as AttributionStores };
};
const T0 = new Date('2026-10-01T10:00:00Z');
const day = 86_400_000;

test('flags: off unless an absolute endpoint is set; attribution needs the endpoint', () => {
  assert.deepEqual(leadFlagsFromEnv({}), { endpoint: '', attribution: false });
  assert.deepEqual(leadFlagsFromEnv({ SOLTEX_ATTRIBUTION: 'true' }), { endpoint: '', attribution: false });
  assert.deepEqual(leadFlagsFromEnv({ SOLTEX_LEADS_ENDPOINT: 'https://soltexglobal.co/api/v1/public/leads', SOLTEX_ATTRIBUTION: 'true' }), { endpoint: 'https://soltexglobal.co/api/v1/public/leads', attribution: true });
  assert.throws(() => leadFlagsFromEnv({ SOLTEX_LEADS_ENDPOINT: '/api/v1/public/leads' }), /absolute/);
});

test('touch: allowlisted parameters, landing path without query, referrer origin only, ≤ 200 characters', () => {
  const t = touchOf(`https://soltexglobal.co/ru/projects?utm_source=google&utm_medium=cpc&utm_campaign=${'x'.repeat(300)}&email=a@b.c&gclid=G1`, 'https://www.google.com/search?q=pectin+plant', T0);
  assert.deepEqual(t, { at: T0.toISOString(), landing: '/ru/projects', referrer: 'https://www.google.com', utm_source: 'google', utm_medium: 'cpc', utm_campaign: 'x'.repeat(200), gclid: 'G1' });
  assert.equal(touchOf('https://soltexglobal.co/ru', 'https://soltexglobal.co/ru/contact', T0), null, 'internal navigation');
  assert.equal(touchOf('https://soltexglobal.co/', '', T0), null, 'direct');
  assert.equal(touchOf('https://soltexglobal.co/', 'android-app://com.slack/', T0), null, 'non-web referrer');
  assert.deepEqual(touchOf('https://soltexglobal.co/', 'https://linkedin.com/feed/', T0), { at: T0.toISOString(), landing: '/', referrer: 'https://linkedin.com' });
});

test('first touch: set once, kept 90 days, direct only when nothing is stored; last touch: last non-direct click', () => {
  const { local, session, s } = stores();
  recordVisit(s, 'https://soltexglobal.co/', '', T0);
  assert.deepEqual(currentAttribution(s, T0), { first: { at: T0.toISOString(), landing: '/', direct: true } });
  recordVisit(s, 'https://soltexglobal.co/?utm_source=newsletter', '', new Date(T0.getTime() + day));
  const a = currentAttribution(s, new Date(T0.getTime() + day))!;
  assert.equal(a.first?.direct, true, 'first touch is never overwritten before it expires');
  assert.equal(a.last?.utm_source, 'newsletter');
  recordVisit(s, 'https://soltexglobal.co/ru/contact', '', new Date(T0.getTime() + 2 * day));
  assert.equal(currentAttribution(s, new Date(T0.getTime() + 2 * day))!.last?.utm_source, 'newsletter', 'a direct visit keeps the last touch');
  recordVisit(s, 'https://soltexglobal.co/', 'https://bing.com/x', new Date(T0.getTime() + 3 * day));
  assert.deepEqual(currentAttribution(s, new Date(T0.getTime() + 3 * day))!.last, { at: new Date(T0.getTime() + 3 * day).toISOString(), landing: '/', referrer: 'https://bing.com' });
  // After 90 days the first touch is replaced by the next visit.
  const later = new Date(T0.getTime() + 91 * day);
  assert.equal(currentAttribution({ local, session: null }, later), null);
  recordVisit(s, 'https://soltexglobal.co/?utm_source=ads', '', later);
  assert.equal(currentAttribution(s, later)!.first?.utm_source, 'ads');
  clearAttribution(s);
  assert.equal(local.m.has(FIRST_TOUCH_KEY) || session.m.has(LAST_TOUCH_KEY), false);
});

test('blocked or broken storage never breaks the form', () => {
  const broken = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); }, removeItem: () => { throw new Error('denied'); } };
  const s = { local: broken, session: broken };
  recordVisit(s, 'https://soltexglobal.co/?utm_source=x', '', T0);
  assert.equal(currentAttribution(s, T0), null);
  clearAttribution(s);
  const garbage = mem();
  garbage.setItem(FIRST_TOUCH_KEY, '{not json');
  assert.equal(currentAttribution({ local: garbage, session: null }, T0), null);
});

const payload: LeadPayload = { formType: 'contact_page', fields: { name: 'Anna', phone: '+7 701 000 00 00', email: 'a@example.com', company: '', message: '' }, topic: null, locale: 'ru', pagePath: '/ru/contact', hp: undefined, fillMs: 8000 };

test('HTTP service: posts JSON with the site header to its own origin; maps answers', async () => {
  (globalThis as { location?: unknown }).location = { origin: 'https://soltexglobal.co' };
  const calls: { url: string; init: RequestInit }[] = [];
  let answer: () => Response = () => new Response(JSON.stringify({ reference: 'SOL-2026-000001' }), { status: 201 });
  const svc = createHttpLeadService('https://soltexglobal.co/api/v1/public/leads', (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return answer();
  }) as typeof fetch);
  assert.deepEqual(await svc.submitLead(payload), { ok: true, reference: 'SOL-2026-000001' });
  assert.equal(calls[0]!.url, 'https://soltexglobal.co/api/v1/public/leads');
  assert.equal((calls[0]!.init.headers as Record<string, string>)['x-requested-with'], 'soltex-site');
  assert.equal(calls[0]!.init.credentials, 'omit');
  assert.deepEqual(JSON.parse(calls[0]!.init.body as string), { formType: 'contact_page', fields: { name: 'Anna', phone: '+7 701 000 00 00', email: 'a@example.com' }, topic: null, locale: 'ru', pagePath: '/ru/contact', fillMs: 8000 });
  for (const [status, error] of [[400, 'validation'], [413, 'validation'], [429, 'rate_limited'], [403, 'server'], [500, 'server']] as const) {
    answer = () => new Response('{}', { status });
    assert.deepEqual(await svc.submitLead(payload), { ok: false, error });
  }
  answer = () => {
    throw new TypeError('offline');
  };
  assert.deepEqual(await svc.submitLead(payload), { ok: false, error: 'network' });
});

test('HTTP service: on another origin (release preview) nothing is sent', async () => {
  (globalThis as { location?: unknown }).location = { origin: 'https://preview.soltexglobal.co' };
  let called = false;
  const svc = createHttpLeadService('https://soltexglobal.co/api/v1/public/leads', (async () => {
    called = true;
    return new Response('{}');
  }) as typeof fetch);
  const r = await svc.submitLead(payload);
  assert.equal(r.ok, true);
  assert.equal(called, false);
});
