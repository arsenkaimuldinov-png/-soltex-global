/**
 * Publishing, revisions and releases (Phase G), end to end against the real API, the publishing
 * worker, the preview server and PostgreSQL, in Chromium. Releases are written to the temporary
 * RELEASES_DIR of scripts/admin-e2e.mjs (never the repository's .releases or a real site).
 * Own users: a fifth editor, a third content manager (publisher) and a third admin (rollback).
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { after, before, describe, test } from 'node:test';
import { ageStepUp, closeBrowser, openCommandPalette, ORIGIN, profile, saveRecoveryCodes, shot, sidebar, signInWithPassword, totp, user } from './harness.mjs';

const EDITOR = user('editor', 4);
const PUBLISHER = user('content_manager', 2);
const ADMIN = user('admin', 2);
const RELEASES_DIR = process.env.E2E_RELEASES_DIR ?? '';
const PREVIEW_ORIGIN = process.env.E2E_PREVIEW_ORIGIN ?? 'http://localhost:4176';
const STAMP = Date.now().toString(36);
const BUILD_TIMEOUT = 240_000;

const profiles = {};
const allProblems = () => Object.entries(profiles).flatMap(([k, p]) => p.problems.map((x) => `${k}: ${x}`));
const current = () => {
  try {
    return path.basename(fs.readlinkSync(path.join(RELEASES_DIR, 'current')));
  } catch {
    return null;
  }
};

async function signIn(p, u) {
  await signInWithPassword(p.page, u);
  await p.page.waitForURL(`${ORIGIN}/`);
  await p.page.getByRole('heading', { name: 'Обзор' }).waitFor();
}

async function signInWithNewTotp(p, u) {
  await signInWithPassword(p.page, u);
  await p.page.waitForURL(`${ORIGIN}/setup-mfa`);
  await p.page.getByRole('radio', { name: /Приложение-аутентификатор/ }).click();
  await p.page.getByRole('button', { name: 'Подключить приложение' }).click();
  const secret = (await p.page.getByLabel('Ключ для ручного ввода').textContent()).replace(/\s/g, '');
  await p.page.getByLabel('Код из приложения').fill(await totp(secret));
  await p.page.getByRole('button', { name: 'Подтвердить' }).click();
  await saveRecoveryCodes(p.page, 'Перейти в админку');
  await p.page.waitForURL(`${ORIGIN}/`);
  return secret;
}

async function openNingbo(page) {
  await page.goto(`${ORIGIN}/content/projects?q=ningbo`);
  await page.getByRole('table', { name: 'Проекты' }).getByRole('link', { name: /NINGBO/ }).click();
  await page.getByRole('list', { name: 'Версии' }).waitFor();
}

/** «Создать релиз» on the overview → the release page; waits until the build is ready. */
async function createRelease(page) {
  await page.goto(`${ORIGIN}/publishing`);
  await page.getByRole('heading', { name: 'Публикация', level: 1 }).waitFor();
  await page.getByRole('button', { name: 'Создать релиз' }).click();
  const confirm = page.getByRole('alertdialog', { name: 'Создать релиз?' });
  await confirm.getByText('На сайт ничего не попадёт').waitFor();
  await confirm.getByRole('button', { name: 'Создать релиз' }).click();
  await page.waitForURL(/\/publishing\/releases\/[0-9a-f-]{36}$/);
  const heading = page.getByRole('heading', { level: 1 });
  await heading.waitFor();
  const key = (await heading.textContent()).replace('Релиз ', '').trim();
  assert.match(key, /^R-\d{8}-\d{6}-[0-9a-f]{6}$/);
  await page.getByRole('list', { name: 'Шаги сборки' }).waitFor();
  await page.getByRole('button', { name: 'Опубликовать' }).or(page.getByText(/Сборка не удалась/)).waitFor({ timeout: BUILD_TIMEOUT });
  assert.equal(await page.getByText(/Сборка не удалась/).count(), 0, 'the build succeeds');
  return { key, url: page.url() };
}

async function publish(page, key) {
  await page.getByRole('button', { name: 'Опубликовать' }).click();
  const confirm = page.getByRole('alertdialog', { name: `Опубликовать релиз ${key}?` });
  await confirm.getByText('Предыдущий релиз останется доступным для отката').waitFor();
  await confirm.getByRole('button', { name: 'Опубликовать' }).click();
}

describe('publishing, revisions and releases (Phase G)', () => {
  before(async () => {
    assert.ok(RELEASES_DIR && fs.existsSync(RELEASES_DIR), 'the run uses a temporary RELEASES_DIR');
    profiles.editor = await profile();
    profiles.publisher = await profile();
    profiles.admin = await profile();
  });
  after(async () => {
    for (const p of Object.values(profiles)) await p.close();
    await closeBrowser();
  });

  let original = '';
  let first;
  let failedKey;
  let third;

  test('navigation: «Публикация» with Обзор, Ревизии, Релизы; an Editor cannot create or publish releases', async () => {
    const { page } = profiles.editor;
    await signIn(profiles.editor, EDITOR);
    const links = (await sidebar(page).getByRole('link').allTextContents()).map((s) => s.trim());
    assert.deepEqual(links.slice(-3), ['Обзор', 'Ревизии', 'Релизы']);
    await sidebar(page).getByRole('link', { name: 'Обзор' }).nth(2).click();
    await page.getByRole('heading', { name: 'Публикация', level: 1 }).waitFor();
    await page.getByText('Сейчас на сайте').waitFor();
    assert.equal(await page.getByRole('button', { name: 'Создать релиз' }).count(), 0);
    await page.getByRole('button', { name: 'Предпросмотр черновиков' }).waitFor();
    // ⌘K lists the screens only: no publish or rollback commands.
    const input = await openCommandPalette(page);
    await input.fill('опубликовать');
    assert.equal(await page.getByRole('option', { name: /Опубликовать|Вернуть|Откат/ }).count(), 0);
    await input.fill('релизы');
    await page.getByRole('option', { name: 'Публикация: релизы' }).waitFor();
    await page.keyboard.press('Escape');
    await shot(page, 'p01-overview-editor');
  });

  test('revisions: every save is a version; compare shows the field in words; restore creates a new version', async () => {
    const { page } = profiles.editor;
    await openNingbo(page);
    // No publish actions for an Editor (content.publish).
    assert.equal(await page.getByRole('button', { name: /Отметить к публикации|Снять с публикации/ }).count(), 0);
    const field = page.getByLabel('Обзор', { exact: true });
    original = await field.inputValue();
    await field.fill(`${original} E2E ${STAMP}`);
    await page.keyboard.press('Control+s');
    await page.getByText(/^Сохранено \d/).waitFor();
    const versions = page.getByRole('list', { name: 'Версии' }).getByRole('listitem');
    await versions.first().getByText('Текущая').waitFor();
    await versions.first().getByText('Изменено').waitFor();
    const saved = Number(await versions.first().getAttribute('data-revision'));
    assert.ok(saved >= 2);

    await versions.nth(1).getByRole('button', { name: 'Сравнить с текущей' }).click();
    const compare = page.getByRole('dialog', { name: `Версия ${saved - 1} → текущая` });
    const table = compare.getByRole('table', { name: 'Отличия версий' });
    await table.waitFor();
    await table.getByRole('rowheader', { name: 'Обзор' }).waitFor();
    await table.getByText(`E2E ${STAMP}`).waitFor();
    assert.ok(!(await compare.textContent()).includes('{"'), 'no raw JSON');
    await shot(page, 'p02-compare');
    await page.keyboard.press('Escape');
    await compare.waitFor({ state: 'detached' });

    await versions.nth(1).getByRole('button', { name: 'Восстановить' }).click();
    const confirm = page.getByRole('alertdialog', { name: `Восстановить версию ${saved - 1}?` });
    await confirm.getByText('Сайт не изменится, пока не будет опубликован новый релиз.').waitFor();
    await confirm.getByRole('button', { name: 'Восстановить' }).click();
    await page.getByText(`Версия ${saved - 1} восстановлена как новая версия`).first().waitFor();
    await versions.first().getByText(`Восстановлено из версии ${saved - 1}`).waitFor();
    assert.equal(Number(await versions.first().getAttribute('data-revision')), saved + 1);
    for (let i = 0; i < 50 && (await field.inputValue()) !== original; i++) await page.waitForTimeout(100);
    assert.equal(await field.inputValue(), original, 'the editor shows the restored text');
    await shot(page, 'p03-restored');
  });

  test('revisions list and the full history of one record', async () => {
    const { page } = profiles.editor;
    await sidebar(page).getByRole('link', { name: 'Ревизии' }).click();
    await page.getByRole('heading', { name: 'Ревизии', level: 1 }).waitFor();
    await page.getByLabel('Раздел').selectOption({ label: 'Проекты' });
    await page.waitForURL(/type=projects/);
    await page.getByPlaceholder('Поиск по названию').fill('ningbo');
    await page.waitForURL(/q=ningbo/);
    const table = page.getByRole('table', { name: 'Ревизии' });
    await table.getByText(/Восстановлено из версии/).first().waitFor();
    await table.getByRole('link', { name: /NINGBO/ }).first().click();
    await page.waitForURL(/\/publishing\/revisions\/projects\/[0-9a-f-]{36}$/);
    await page.getByRole('list', { name: 'Версии' }).waitFor();
    await page.getByRole('link', { name: 'Открыть в редакторе' }).waitFor();
  });

  test('a release candidate: snapshot → build → checks; preview link opens the build on the preview origin', async () => {
    const { page, context } = profiles.publisher;
    await signInWithNewTotp(profiles.publisher, PUBLISHER);
    // The admin signs in now, so the rollback later happens minutes after the second factor.
    // Admins enroll a passkey (approved §7: no TOTP choice for Owner / Admin).
    await signInWithPassword(profiles.admin.page, ADMIN);
    await profiles.admin.page.waitForURL(`${ORIGIN}/setup-mfa`);
    await profiles.admin.page.getByRole('button', { name: 'Добавить ключ доступа' }).click();
    await saveRecoveryCodes(profiles.admin.page, 'Перейти в админку');
    await profiles.admin.page.waitForURL(`${ORIGIN}/`);
    const before = current();
    first = await createRelease(page);
    assert.equal(current(), before, 'a built release does not change the site');
    await page.getByRole('heading', { name: 'Проверки' }).waitFor();
    await page.getByRole('table', { name: 'Переводы по языкам' }).waitFor();
    assert.equal(await page.getByRole('table', { name: 'Переводы по языкам' }).locator('tbody tr').count(), 5);
    await page.getByRole('list', { name: 'События' }).getByText('Проверка пройдена').waitFor();
    await shot(page, 'p04-release-ready');

    const [popup] = await Promise.all([context.waitForEvent('page'), page.getByRole('button', { name: 'Открыть предпросмотр' }).click()]);
    await popup.waitForURL(`${PREVIEW_ORIGIN}/`, { timeout: 30_000 });
    assert.ok(!popup.url().includes('#'), 'the one-time token leaves the address bar');
    const checks = await popup.evaluate(async () =>
      Promise.all(
        ['/', '/ru', '/zh', '/tr', '/ar', '/es', '/robots.txt'].map(async (p) => {
          const r = await fetch(p);
          return { p, status: r.status, robots: r.headers.get('x-robots-tag'), cache: r.headers.get('cache-control') };
        })
      )
    );
    for (const c of checks) {
      assert.equal(c.status, 200, c.p);
      assert.match(c.robots ?? '', /noindex/, c.p);
      assert.equal(c.cache, 'no-store', c.p);
    }
    await popup.close();
  });

  test('publish: confirmation, atomic switch of the served release', async () => {
    const { page } = profiles.publisher;
    await page.goto(first.url);
    await publish(page, first.key);
    await page.getByText(`Релиз ${first.key} опубликован.`).first().waitFor();
    await page.getByText('Этот релиз сейчас на сайте.').waitFor();
    assert.equal(current(), first.key);
    await page.goto(`${ORIGIN}/publishing`);
    await page.locator('[data-active-release]').getByText(first.key).waitFor();
    await shot(page, 'p05-published');
  });

  test('failed publish: tampered files are refused, the site stays on the previous release', async () => {
    const { page } = profiles.publisher;
    const second = await createRelease(page);
    failedKey = second.key;
    const dir = path.join(RELEASES_DIR, 'releases', second.key);
    fs.chmodSync(dir, 0o755);
    fs.writeFileSync(path.join(dir, 'tampered.txt'), 'x');
    await publish(page, second.key);
    await page.getByText(/Файлы релиза отсутствуют или изменены/).first().waitFor();
    await page.getByRole('list', { name: 'События' }).getByText('Публикация не удалась, сайт не изменился').waitFor();
    assert.equal(current(), first.key);
    await shot(page, 'p06-publish-failed');
  });

  test('a newer release replaces the live one; the failed candidate is superseded; no rollback for a Content Manager', async () => {
    const { page } = profiles.publisher;
    third = await createRelease(page);
    await publish(page, third.key);
    await page.getByText(`Релиз ${third.key} опубликован.`).first().waitFor();
    assert.equal(current(), third.key);
    await page.goto(first.url);
    await page.getByText('Был на сайте').first().waitFor();
    assert.equal(await page.getByRole('button', { name: 'Вернуть на сайт' }).count(), 0, 'system.rollback is Owner / Admin only');
    await page.goto(`${ORIGIN}/publishing/releases?status=superseded`);
    await page.getByRole('table', { name: 'Релизы' }).getByRole('link', { name: failedKey }).waitFor();
  });

  test('rollback: confirmation and a fresh second factor; the stored artifact is served again without a rebuild', async () => {
    const { page } = profiles.admin;
    ageStepUp(ADMIN.id);
    await page.goto(first.url);
    await page.getByRole('button', { name: 'Вернуть на сайт' }).click();
    const confirm = page.getByRole('alertdialog', { name: `Вернуть сайт к релизу ${first.key}?` });
    await confirm.getByText('пересборки не будет').waitFor();
    await confirm.getByRole('button', { name: 'Вернуть на сайт' }).click();
    const stepUp = page.getByRole('dialog', { name: 'Подтвердите действие' });
    await stepUp.waitFor();
    await stepUp.getByRole('button', { name: 'Подтвердить ключом доступа' }).click();
    await page.getByText(`Сайт возвращён к релизу ${first.key}.`).first().waitFor();
    await page.getByText('Этот релиз сейчас на сайте.').waitFor();
    assert.equal(current(), first.key);
    await page.getByRole('list', { name: 'События' }).getByText('Возвращён на сайт (откат)').waitFor();
    await shot(page, 'p07-rollback');
  });

  test('audit: publishing actions in plain words', async () => {
    const { page } = profiles.admin;
    await page.goto(`${ORIGIN}/admin/audit`);
    await page.getByRole('cell', { name: 'Откат сайта к релизу' }).first().waitFor();
    await page.getByRole('cell', { name: 'Релиз опубликован' }).first().waitFor();
    await page.getByRole('cell', { name: 'Восстановлена версия материала' }).first().waitFor();
  });

  test('mobile: release, overview and revisions fit a 390 px screen', async () => {
    const p = await profile({ width: 390, height: 844 });
    profiles.mobile = p;
    await signIn(p, EDITOR);
    for (const url of [first.url, `${ORIGIN}/publishing`, `${ORIGIN}/publishing/revisions`, `${ORIGIN}/publishing/releases`]) {
      await p.page.goto(url);
      await p.page.getByRole('heading', { level: 1 }).waitFor();
      await p.page.waitForLoadState('networkidle');
      const overflow = await p.page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      assert.ok(overflow <= 0, `${url}: horizontal overflow ${overflow}px`);
    }
    await shot(p.page, 'p08-mobile');
  });

  test('no page errors and no CSP violations', () => {
    assert.deepEqual(allProblems(), []);
  });
});
