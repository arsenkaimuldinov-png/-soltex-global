/**
 * SEO check (Phase I-1), end to end against the real API + PostgreSQL in Chromium: the SEO block
 * in the editor (snippet per language, checks, «Перейти к полю»), «SEO → Проверка SEO», and the
 * BLOCKING rule on «Отметить к публикации» and «Создать релиз».
 * Own users: a second SEO specialist and a fourth content manager (both enroll an authenticator app).
 */
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { closeBrowser, ORIGIN, profile, saveRecoveryCodes, shot, sidebar, signInWithPassword, totp, user } from './harness.mjs';

const SEO = user('seo_specialist', 1);
const CM = user('content_manager', 3);
const LONG = 'Soy protein isolate plant with enzymatic hydrolysis, membrane separation and spray drying, delivered turnkey under EPCM by Soltex';

const profiles = {};
const allProblems = () => Object.entries(profiles).flatMap(([k, p]) => p.problems.map((x) => `${k}: ${x}`));

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
}

async function openProject(page, search, title) {
  await page.goto(`${ORIGIN}/content/projects?q=${search}`);
  await page.getByRole('table', { name: 'Проекты' }).getByRole('link', { name: new RegExp(title) }).click();
  await page.locator('[data-seo-panel]').waitFor();
}

async function saveSeoTitle(page, value) {
  const field = page.getByLabel('SEO-заголовок (title)');
  await field.fill(value);
  const [res] = await Promise.all([
    page.waitForResponse((r) => r.request().method() === 'PATCH' && /\/api\/v1\/content\//.test(r.url())),
    page.getByRole('button', { name: 'Сохранить' }).click(),
  ]);
  assert.equal(res.status(), 200, await res.text());
  await page.getByText(/^Сохранено \d/).waitFor();
}

describe('SEO check (Phase I-1)', () => {
  before(async () => {
    profiles.seo = await profile();
    profiles.cm = await profile();
  });
  after(async () => {
    for (const p of Object.values(profiles)) await p.close();
    await closeBrowser();
  });

  let blockingBefore = 0;

  test('«SEO → Проверка SEO»: totals by severity, filters in the address, links to the records', async () => {
    const { page } = profiles.seo;
    await signInWithNewTotp(profiles.seo, SEO);
    await sidebar(page).getByRole('link', { name: 'Проверка SEO' }).click();
    await page.getByRole('heading', { name: 'Проверка SEO', level: 1 }).waitFor();
    const blocking = page.locator('[data-summary="blocking"] span').first();
    await blocking.waitFor();
    blockingBefore = Number(await blocking.textContent());
    assert.ok(Number(await page.locator('[data-summary="warning"] span').first().textContent()) > 0, 'the seed has length warnings');
    await page.getByLabel('Язык').selectOption('ru');
    await page.waitForURL(/locale=ru/);
    const table = page.getByRole('table', { name: 'Замечания SEO' });
    await table.getByRole('cell', { name: 'RU' }).first().waitFor();
    assert.ok(!(await table.textContent()).match(/title_length|description_length|[0-9a-f]{8}-[0-9a-f]{4}-/), 'no codes or ids in the table');
    await shot(page, 's01-report');
  });

  test('editor SEO block: the search snippet per language, counters and the template in use', async () => {
    const { page } = profiles.seo;
    await openProject(page, 'ningbo', 'NINGBO');
    const panel = page.locator('[data-seo-panel]');
    await panel.locator('[data-snippet-title]').getByText('SOLBAR NINGBO | Soltex Global').waitFor();
    await panel.getByText('шаблон по умолчанию').waitFor();
    await panel.getByText('soltexglobal.co › projects › solbar-ningbo').waitFor();
    await panel.getByRole('radio', { name: /^RU/ }).click();
    await panel.getByText('soltexglobal.co › ru › projects › solbar-ningbo').waitFor();
    await panel.getByText('Блокирующих ошибок нет.').waitFor();
    await shot(page, 's02-snippet');
  });

  test('a title over 120 characters: an error in the block, «Перейти к полю», the release is blocked', async () => {
    const { page } = profiles.seo;
    await saveSeoTitle(page, LONG);
    const panel = page.locator('[data-seo-panel]');
    await panel.getByRole('radio', { name: /^EN/ }).click();
    const item = panel.locator('[data-seo-issue="title_too_long"]');
    await item.waitFor();
    await item.getByText('SEO-заголовок длиннее 120 символов').waitFor();
    await panel.getByText(/^Ошибок: \d+\./).waitFor();
    await page.getByLabel('SEO-заголовок (title)').evaluate((el) => el.blur());
    await item.getByRole('button', { name: 'Перейти к полю' }).click();
    await page.waitForFunction(() => document.activeElement?.closest('[data-field="seoMetaTitle"]'));
    await shot(page, 's03-blocking');

    const cm = profiles.cm;
    await signInWithNewTotp(cm, CM);
    await cm.page.goto(`${ORIGIN}/publishing`);
    await cm.page.getByText(/Релиз нельзя создать: блокирующих ошибок SEO/).waitFor();
    assert.equal(await cm.page.getByRole('button', { name: 'Создать релиз' }).isDisabled(), true);
    await cm.page.goto(`${ORIGIN}/seo?severity=blocking`);
    await cm.page.getByRole('table', { name: 'Замечания SEO' }).getByRole('link', { name: /SOLBAR NINGBO/ }).first().waitFor();
    await shot(cm.page, 's04-release-blocked');
  });

  test('«Отметить к публикации» is disabled with the reason while the record has errors', async () => {
    const cm = profiles.cm.page;
    await openProject(cm, 'nebraska', 'NEBRASKA');
    await cm.getByRole('button', { name: 'Снять с публикации' }).click();
    await cm.getByRole('alertdialog').getByRole('button', { name: 'Снять с публикации' }).click();
    await cm.getByRole('button', { name: 'Отметить к публикации' }).waitFor();
    // The editor reloads the record after the status change; start editing from a settled form.
    await cm.reload();
    await cm.locator('[data-seo-panel]').waitFor();
    await saveSeoTitle(cm, LONG);
    const publish = cm.getByRole('button', { name: 'Отметить к публикации' });
    await cm.locator('[data-seo-blocked]').waitFor();
    assert.equal(await publish.isDisabled(), true);
    assert.match(await cm.locator('[data-seo-blocked]').textContent(), /Ошибок SEO: \d+/);
    await saveSeoTitle(cm, '');
    await cm.locator('[data-seo-blocked]').waitFor({ state: 'detached' });
    await publish.click();
    await cm.getByRole('alertdialog').getByRole('button', { name: 'Отметить к публикации' }).click();
    await cm.getByRole('button', { name: 'Снять с публикации' }).waitFor();
  });

  test('fixing the title clears the error and unblocks the release', async () => {
    const { page } = profiles.seo;
    await saveSeoTitle(page, '');
    await page.locator('[data-seo-panel]').getByText('Блокирующих ошибок нет.').waitFor();
    await page.goto(`${ORIGIN}/seo`);
    await page.locator('[data-summary="blocking"] span').first().getByText(String(blockingBefore), { exact: true }).waitFor();
    if (blockingBefore === 0) {
      await profiles.cm.page.goto(`${ORIGIN}/publishing`);
      await profiles.cm.page.getByRole('heading', { name: 'Публикация', level: 1 }).waitFor();
      await profiles.cm.page.getByText('Сейчас на сайте').waitFor();
      assert.equal(await profiles.cm.page.getByRole('button', { name: 'Создать релиз' }).isDisabled(), false);
    }
  });

  test('mobile: the SEO block and the report fit a 390 px screen', async () => {
    const p = await profile({ width: 390, height: 844 });
    profiles.mobile = p;
    await signInWithPassword(p.page, user('editor', 1));
    await p.page.waitForURL(`${ORIGIN}/`);
    for (const url of [`${ORIGIN}/seo`, `${ORIGIN}/content/projects?q=israel`]) {
      await p.page.goto(url);
      await p.page.getByRole('heading', { level: 1 }).waitFor();
      await p.page.waitForLoadState('networkidle');
      const overflow = await p.page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      assert.ok(overflow <= 0, `${url}: horizontal overflow ${overflow}px`);
    }
    await p.page.getByRole('table', { name: 'Проекты' }).getByRole('link', { name: /ISRAEL/ }).click();
    await p.page.locator('[data-seo-panel]').waitFor();
    await p.page.waitForLoadState('networkidle');
    const overflow = await p.page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert.ok(overflow <= 0, `editor: horizontal overflow ${overflow}px`);
    await shot(p.page, 's05-mobile');
  });

  test('no page errors and no CSP violations', () => {
    assert.deepEqual(allProblems(), []);
  });
});
