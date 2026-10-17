/**
 * Hourly cleanup of expired service rows (Phase N-0): only rows that can never be used again,
 * after a 30-day grace period; live rows and append-only history are untouched.
 */
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { eq, inArray } from 'drizzle-orm';
import * as s from '../src/db/schema.ts';
import { CLEANUP_GRACE_DAYS, cleanupExpired } from '../src/system/cleanup.ts';
import { closeTestDb, DB_ENABLED, makeApp, signedIn, type TestApp } from './helpers.ts';

const DAY = 86_400_000;

describe('Cleanup of expired service rows (Phase N-0)', { skip: !DB_ENABLED && 'DATABASE_URL not set' }, () => {
  let t: TestApp;
  before(async () => {
    t = await makeApp();
  });
  after(async () => {
    await t.app.close();
    await closeTestDb();
  });

  test('ended sessions, old challenges, expired devices and old sent mail go; everything recent stays', async () => {
    const db = t.deps.db!;
    const old = await signedIn(t, 'editor');
    const [oldSession] = await db.select({ id: s.sessions.id }).from(s.sessions).where(eq(s.sessions.userId, old.user.id));
    const now = t.clock.now();
    const [sent] = await db.insert(s.outbox).values({ kind: 'leads.exported', payload: { count: 1 }, createdAt: now, nextAttemptAt: now, sentAt: now }).returning({ id: s.outbox.id });
    const [pending] = await db.insert(s.outbox).values({ kind: 'leads.exported', payload: { count: 2 }, createdAt: now, nextAttemptAt: now }).returning({ id: s.outbox.id });

    t.clock.advance((CLEANUP_GRACE_DAYS + 1) * DAY);
    const fresh = await signedIn(t, 'editor');
    const r = await cleanupExpired(t.deps);
    assert.ok(r.sessions >= 1, `sessions deleted: ${r.sessions}`);
    assert.ok(r.outbox >= 1);

    const left = await db.select({ id: s.sessions.id, userId: s.sessions.userId }).from(s.sessions).where(inArray(s.sessions.userId, [old.user.id, fresh.user.id]));
    assert.ok(!left.some((x) => x.id === oldSession!.id), 'the ended session is gone');
    assert.ok(left.some((x) => x.userId === fresh.user.id), 'the live session stays');
    assert.equal((await fresh.c.req('GET', '/api/v1/auth/session')).statusCode, 200, 'and still works');

    const mail = await db.select({ id: s.outbox.id }).from(s.outbox).where(inArray(s.outbox.id, [sent!.id, pending!.id]));
    assert.deepEqual(mail.map((m) => m.id), [pending!.id], 'unsent mail is never deleted');

    const [audit] = await db.select().from(s.auditEvents).where(eq(s.auditEvents.action, 'system.cleanup'));
    assert.ok(audit, 'the cleanup is recorded');
  });

  test('a second run right after finds nothing and writes no audit entry', async () => {
    const before = (await t.deps.db!.select().from(s.auditEvents).where(eq(s.auditEvents.action, 'system.cleanup'))).length;
    const r = await cleanupExpired(t.deps);
    assert.deepEqual(r, { challenges: 0, passwordResets: 0, knownDevices: 0, sessions: 0, outbox: 0 });
    assert.equal((await t.deps.db!.select().from(s.auditEvents).where(eq(s.auditEvents.action, 'system.cleanup'))).length, before);
  });
});
