/**
 * Helpers for the admin end-to-end tests (run by scripts/admin-e2e.mjs). Playwright is a QA tool
 * here, not a project dependency.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { chromium } from 'playwright';
import { generate } from 'otplib';

export const ORIGIN = process.env.E2E_ORIGIN ?? 'http://localhost:4175';
export const USERS = JSON.parse(process.env.E2E_USERS ?? '[]');
const SHOTS = process.env.E2E_SHOTS ?? '';
const ROOT = path.resolve(import.meta.dirname, '../../..');

/** The n-th seeded user of a role (several suites use their own users, so sessions never interfere). */
export const user = (role, n = 0) => {
  const u = USERS.filter((x) => x.role === role)[n];
  if (!u) throw new Error(`no e2e user #${n} for ${role}`);
  return u;
};

let browser;
export async function launch() {
  // site.e2e.test: the public site of the run (scripts/e2e-site-server.mjs, Phase K-2).
  browser ??= await chromium.launch({ args: ['--host-resolver-rules=MAP site.e2e.test 127.0.0.1'], ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}) });
  return browser;
}
export async function closeBrowser() {
  await browser?.close();
  browser = undefined;
}

/**
 * A browser profile with its own cookies and a virtual platform authenticator (Touch ID-like:
 * resident keys, user verification). Collects page errors and CSP violations.
 */
export async function profile({ width = 1280, height = 800, ip } = {}) {
  const b = await launch();
  // `ip`: the client address the API sees (through the preview proxy), so a suite's sign-ins do not
  // count against the per-IP sign-in limit of the others.
  const context = await b.newContext({ viewport: { width, height }, locale: 'ru-RU', ...(ip ? { extraHTTPHeaders: { 'x-forwarded-for': ip } } : {}) });
  const page = await context.newPage();
  const problems = [];
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    const t = m.text();
    // Chromium logs every non-2xx response ("Failed to load resource"); the tests provoke 401/403/
    // 409/400 answers on purpose and check the UI reaction instead. Any other error is a defect.
    if (m.type() === 'error' && !/^Failed to load resource: the server responded with a status of (400|401|403|409)\b/.test(t)) problems.push(`console: ${t}`);
    if (/Content Security Policy|Refused to/.test(t)) problems.push(`csp: ${t}`);
  });
  const cdp = await context.newCDPSession(page);
  await cdp.send('WebAuthn.enable');
  const { authenticatorId } = await cdp.send('WebAuthn.addVirtualAuthenticator', {
    options: { protocol: 'ctap2', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true },
  });
  return {
    context,
    page,
    problems,
    credentials: async () => (await cdp.send('WebAuthn.getCredentials', { authenticatorId })).credentials,
    close: () => context.close(),
  };
}

export async function shot(page, name) {
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: true });
}

export async function signInWithPassword(page, u, password = u.password) {
  await page.goto(`${ORIGIN}/login`);
  await page.getByLabel('E-mail').fill(u.email);
  await page.getByLabel('Пароль', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Войти' }).click();
}

/** Six digits for `secret`, `offsetSeconds` from now (the API accepts ±1 step, each step once). */
export const totp = (secret, offsetSeconds = 0) => generate({ secret, epoch: Math.floor(Date.now() / 1000) + offsetSeconds });

/** Date the user's second factor back by 11 minutes, so the next sensitive action asks for step-up. */
export function ageStepUp(userId) {
  const r = spawnSync(process.execPath, ['--import', 'tsx', 'apps/api/test/e2e-seed.ts', 'age-step-up', userId], { cwd: ROOT, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`age-step-up failed: ${r.stderr}`);
}

/** Saves the recovery codes panel (checkbox + continue) and returns the codes. */
export async function saveRecoveryCodes(page, continueLabel) {
  const list = page.getByRole('list', { name: 'Резервные коды' });
  await list.waitFor();
  const codes = (await list.getByRole('listitem').allTextContents()).map((s) => s.trim());
  await page.getByLabel('Я сохранил коды в надёжном месте').check();
  await page.getByRole('button', { name: continueLabel }).click();
  return codes;
}

export async function openCommandPalette(page) {
  await page.keyboard.press('Control+k');
  const input = page.getByRole('combobox', { name: 'Поиск и команды' });
  await input.waitFor();
  return input;
}

export const sidebar = (page) => page.getByRole('navigation', { name: 'Основная навигация' });
