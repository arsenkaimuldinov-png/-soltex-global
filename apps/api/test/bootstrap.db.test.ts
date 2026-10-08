/** First Owner from the console: no default users, safe to repeat, audited, password never echoed. */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import path from 'node:path';
import { after, before, describe, test } from 'node:test';
import { and, eq } from 'drizzle-orm';
import { auditEvents, users } from '../src/db/schema.ts';
import { verifyPassword } from '../src/auth/passwords.ts';
import { bootstrapOwner } from '../src/users/bootstrap.ts';
import { Client, closeTestDb, createUser, DB_ENABLED, login, makeApp, STRONG_PASSWORD, type TestApp } from './helpers.ts';

class Rollback extends Error {}

describe('auth:bootstrap-owner', { skip: !DB_ENABLED && 'DATABASE_URL not set' }, () => {
  let t: TestApp;
  before(async () => {
    t = await makeApp();
  });
  after(async () => {
    await t.app.close();
    await closeTestDb();
  });

  test('creates the first Owner once; a second run changes nothing; the event is audited', async () => {
    const email = `first.owner.${crypto.randomUUID().slice(0, 8)}@soltex.test`;
    await assert.rejects(
      t.deps.db!.transaction(async (tx) => {
        // Simulate an empty installation inside a transaction that is rolled back afterwards.
        await tx.update(users).set({ status: 'disabled' }).where(eq(users.role, 'owner'));
        const first = await bootstrapOwner(t.deps, { email, name: 'First Owner', password: STRONG_PASSWORD }, tx);
        assert.equal(first.status, 'created');
        const user = (first as { user: typeof users.$inferSelect }).user;
        assert.equal(user.role, 'owner');
        assert.equal(user.status, 'active');
        assert.ok(user.passwordHash.startsWith('$argon2id$'));
        assert.ok(await verifyPassword(user.passwordHash, STRONG_PASSWORD));

        const again = await bootstrapOwner(t.deps, { email: `x.${email}`, name: 'Second', password: STRONG_PASSWORD }, tx);
        assert.equal(again.status, 'owner_exists');
        assert.equal((await tx.select().from(users).where(and(eq(users.role, 'owner'), eq(users.status, 'active')))).length, 1);

        const [event] = await tx.select().from(auditEvents).where(and(eq(auditEvents.action, 'user.bootstrap_owner'), eq(auditEvents.resourceId, user.id)));
        assert.deepEqual(event!.summary, { method: 'cli', role: 'owner' });
        assert.ok(!JSON.stringify(event).includes(email));
        throw new Rollback();
      }),
      Rollback
    );
  });

  test('a weak password is refused', async () => {
    await assert.rejects(
      t.deps.db!.transaction(async (tx) => {
        await tx.update(users).set({ status: 'disabled' }).where(eq(users.role, 'owner'));
        await bootstrapOwner(t.deps, { email: 'weak.owner@soltex.test', name: 'Weak', password: 'password' }, tx);
      }),
      (e: Error) => e.message === 'password_rejected'
    );
  });

  test('the bootstrapped Owner must register a passkey before anything else', async () => {
    const owner = await createUser(t, 'owner'); // same insert path as bootstrapOwner
    const c = new Client(t);
    const res = await login(c, owner.email);
    assert.equal(res.json().next, 'mfa_enrollment_required');
    assert.equal(res.json().mfa.requirement, 'passkey');
  });

  test('CLI: refuses when an active Owner exists (exit 3) and never prints the password', () => {
    const secret = `Cli-Secret-${crypto.randomUUID()}`;
    const run = spawnSync(
      process.execPath,
      ['--import', 'tsx', path.resolve(import.meta.dirname, '../src/cli/auth-bootstrap-owner.ts'), '--email', 'cli.owner@soltex.test', '--name', 'CLI Owner', '--password-stdin'],
      {
        input: `${secret}\n`,
        encoding: 'utf8',
        env: {
          ...process.env,
          NODE_ENV: 'development',
          DATA_ENCRYPTION_KEYS: `k1:${crypto.randomBytes(32).toString('base64')}`,
          DATA_ENCRYPTION_KEY_ID: 'k1',
          HASH_SECRET: crypto.randomBytes(32).toString('base64'),
        },
      }
    );
    assert.equal(run.status, 3, run.stderr);
    assert.match(run.stderr, /active Owner already exists/);
    assert.ok(!(run.stdout + run.stderr).includes(secret));
  });

  test('CLI: without a terminal it requires the explicit non-interactive flags', () => {
    const run = spawnSync(process.execPath, ['--import', 'tsx', path.resolve(import.meta.dirname, '../src/cli/auth-bootstrap-owner.ts')], {
      input: '',
      encoding: 'utf8',
      env: { ...process.env, NODE_ENV: 'development', DATA_ENCRYPTION_KEYS: `k1:${crypto.randomBytes(32).toString('base64')}`, HASH_SECRET: crypto.randomBytes(32).toString('base64') },
    });
    assert.equal(run.status, 2);
    assert.match(run.stderr, /run interactively/);
  });
});
