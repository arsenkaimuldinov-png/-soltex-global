/**
 * Create the first Owner account from the server console.
 *   npm run auth:bootstrap-owner                       (interactive; the password is not echoed)
 *   npm run auth:bootstrap-owner -- --email a@b.c --name "A B" --password-stdin < secret-file
 * Uses the API environment (DATABASE_URL, keys — see .env.example). There are no default users
 * and no default passwords. Refuses (exit 3) when an active Owner already exists.
 * The Owner then signs in to the admin and must register a passkey first.
 */
import { checkPasswordPolicy } from '../auth/passwords.ts';
import { loadConfig } from '../config.ts';
import { connect } from '../db/client.ts';
import { UnconfiguredNotifier } from '../notify/notifier.ts';
import { Problem } from '../http/problem.ts';
import { bootstrapOwner } from '../users/bootstrap.ts';
import { ask, askHidden, readStdinLine } from './prompt.ts';

function flag(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const fail = (message: string, code = 2): never => {
  console.error(`auth:bootstrap-owner: ${message}`);
  process.exit(code);
};

const config = loadConfig();
if (!config.databaseUrl) fail('DATABASE_URL is not set (see .env.example)');

const passwordFromStdin = process.argv.includes('--password-stdin');
if (!passwordFromStdin && !process.stdin.isTTY) fail('run interactively, or pass --email, --name and --password-stdin');

const email = flag('email') ?? (passwordFromStdin ? fail('--email is required with --password-stdin') : await ask('Owner e-mail: '));
const name = flag('name') ?? (passwordFromStdin ? fail('--name is required with --password-stdin') : await ask('Owner name: '));
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail('invalid e-mail address');
if (!name.trim() || name.length > 120) fail('name must be 1–120 characters');

let password: string;
if (passwordFromStdin) password = await readStdinLine();
else {
  password = await askHidden('Password (not shown): ');
  const policy = checkPasswordPolicy(password, email.toLowerCase());
  if (policy.length) fail(`password rejected: ${policy.join(', ')}`);
  if ((await askHidden('Repeat password: ')) !== password) fail('passwords do not match');
}

const { db, close } = connect(config.databaseUrl, 1);
try {
  const result = await bootstrapOwner({ config, db, now: () => new Date(), notifier: new UnconfiguredNotifier(console) }, { email, name, password });
  if (result.status === 'owner_exists') fail('an active Owner already exists — nothing was changed. Further users are created in the admin.', 3);
  else console.log(`auth:bootstrap-owner: Owner created (id ${result.user.id}). Sign in to the admin and register a passkey.`);
} catch (e) {
  if (e instanceof Problem) fail(e.extra.errors?.length ? `${e.code}: ${e.extra.errors.map((x) => x.message).join(', ')}` : e.detail ?? e.code);
  throw e;
} finally {
  password = '';
  await close();
}
