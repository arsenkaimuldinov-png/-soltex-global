/**
 * Test-only helper for the admin end-to-end run (scripts/admin-e2e.mjs). Never used by the API.
 *
 *   node --import tsx apps/api/test/e2e-seed.ts users <role,role,…>   → JSON [{role,email,name,password,id}]
 *   node --import tsx apps/api/test/e2e-seed.ts age-step-up <userId>  → second factor of the user's
 *        live sessions dated 11 minutes back, so the next sensitive action needs step-up
 *   node --import tsx apps/api/test/e2e-seed.ts reset-run             → remove what earlier runs left that
 *        cannot work in this one: media uploads and image copies (their files lived in that run's
 *        MEDIA_DIR) and leads (encrypted with that run's random keys); run after the seed import
 *
 * Users get unique e-mails (`e2e.<role>.<random>@soltex.test`) and random passwords, so runs never
 * collide and nothing has to be deleted. Uses DATABASE_URL (role soltex_app).
 */
import crypto from 'node:crypto';
import { and, eq, isNull } from 'drizzle-orm';
import { ROLES, type Role } from '@soltex/core/domain';
import { loadConfig } from '../src/config.ts';
import { connect } from '../src/db/client.ts';
import { leads, media, outbox, sessions } from '../src/db/schema.ts';
import { UnconfiguredNotifier } from '../src/notify/notifier.ts';
import { insertUser } from '../src/users/users.ts';
import { STEP_UP_WINDOW_MS } from '../src/auth/sessions.ts';

const [command, arg] = process.argv.slice(2);
const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is not set');
const { db, close } = connect(url, 1);
const deps = { config: loadConfig({ NODE_ENV: 'test', DATABASE_URL: url }), db, now: () => new Date(), notifier: new UnconfiguredNotifier(console) };

try {
  if (command === 'reset-run') {
    const removed = await db.delete(media).where(eq(media.source, 'upload')).returning({ id: media.id });
    await db.update(media).set({ variants: null });
    await db.delete(outbox);
    const leadsRemoved = await db.delete(leads).returning({ id: leads.id });
    process.stdout.write(`${removed.length} ${leadsRemoved.length}\n`);
  } else if (command === 'users') {
    const roles = (arg ?? '').split(',').filter(Boolean) as Role[];
    for (const r of roles) if (!ROLES.includes(r)) throw new Error(`unknown role ${r}`);
    const out = [];
    for (const role of roles) {
      const tag = crypto.randomUUID().slice(0, 8);
      const email = `e2e.${role.replace('_', '-')}.${tag}@soltex.test`;
      const name = `E2E ${role} ${tag}`;
      const password = `E2e-${crypto.randomBytes(12).toString('base64url')}`;
      const user = await insertUser(deps, { email, name, role, password, createdBy: null });
      out.push({ role, email, name, password, id: user.id });
    }
    process.stdout.write(`${JSON.stringify(out)}\n`);
  } else if (command === 'age-step-up' && arg) {
    const past = new Date(Date.now() - STEP_UP_WINDOW_MS - 60_000);
    await db.update(sessions).set({ mfaVerifiedAt: past }).where(and(eq(sessions.userId, arg), isNull(sessions.revokedAt), eq(sessions.aal, 2)));
    process.stdout.write('ok\n');
  } else {
    throw new Error('usage: e2e-seed.ts users <roles> | age-step-up <userId>');
  }
} finally {
  await close();
}
