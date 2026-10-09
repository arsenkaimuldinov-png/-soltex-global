/**
 * Translation management (Phase F), end to end against the real API + PostgreSQL in Chromium.
 * Own users: a fourth editor, a second content manager (reviewer, TOTP) and a second marketer.
 * The seed is imported before every run (scripts/admin-e2e.mjs), so translation states start from
 * the seed; counts are compared before and after, never as absolute numbers (other suites add drafts).
 */
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { closeBrowser, ORIGIN, profile, saveRecoveryCodes, shot, sidebar, signInWithPassword, totp, user } from './harness.mjs';

const EDITOR = user('editor', 3);
const REVIEWER = user('content_manager', 1);
const MARKETER = user('marketer', 1);
const AR_TITLE = `شروط الاستخدام ${Date.now().toString(36)}`;

const profiles = {};
const allProblems = () => Object.entries(profiles).flatMap(([k, p]) => p.problems.map((x) => `${k}: ${x}`));

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
}

/** Open a translation from «Все переводы» by language and search text. */
async function openTranslation(page, { locale, q, title }) {
  await page.goto(`${ORIGIN}/translations/all?locale=${locale}&q=${encodeURIComponent(q)}`);
  const table = page.getByRole('table', { name: 'Все переводы' });
  await table.getByRole('link', { name: new RegExp(title) }).first().click();
  await page.getByRole('heading', { name: title }).waitFor();
}

const completionOf = async (page, locale) => Number((await page.locator(`[data-locale="${locale}"] [data-completion]`).textContent()).replace('%', ''));

describe('translation management (Phase F)', () => {
  before(async () => {
    profiles.editor = await profile();
    profiles.reviewer = await profile();
  });
  after(async () => {
    for (const p of Object.values(profiles)) await p.close();
    await closeBrowser();
  });

  let arBefore = 0;

  test('overview: «Переводы» in the sidebar; completeness per language; English is the source', async () => {
    const { page } = profiles.editor;
    await signIn(profiles.editor, EDITOR);
    const links = (await sidebar(page).getByRole('link').allTextContents()).map((s) => s.trim());
    assert.deepEqual(links.slice(-6, -3), ['Обзор', 'Все переводы', 'Требуют внимания']);
    await sidebar(page).getByRole('link', { name: 'Обзор' }).nth(1).click();
    await page.getByRole('heading', { name: 'Переводы' }).waitFor();
    await page.getByText('Исходный язык — английский').waitFor();
    await page.getByRole('list', { name: 'Готовность языков' }).waitFor();
    const cards = page.getByRole('list', { name: 'Готовность языков' }).getByRole('listitem');
    assert.equal(await cards.count(), 5, 'five translated languages, no English backlog');
    arBefore = await completionOf(page, 'ar');
    assert.ok(arBefore > 0 && arBefore < 100, `AR completion ${arBefore}% (privacy and terms are not translated)`);
    await page.getByRole('table', { name: 'Готовность переводов по разделам и языкам' }).waitFor();
    await shot(page, 't01-overview');
  });

  test('list: language and state filters, kept in the address', async () => {
    const { page } = profiles.editor;
    await sidebar(page).getByRole('link', { name: 'Все переводы' }).click();
    const table = page.getByRole('table', { name: 'Все переводы' });
    await table.waitFor();
    await page.getByLabel('Язык').selectOption('ar');
    await page.waitForURL(/locale=ar/);
    await page.getByLabel('Состояние').selectOption('missing');
    await page.waitForURL(/state=missing/);
    await table.getByRole('link', { name: /Terms of Use/ }).waitFor();
    const rows = table.getByRole('row');
    const n = await rows.count();
    assert.ok(n >= 3, 'header + privacy + terms');
    for (let i = 1; i < n; i++) {
      const text = await rows.nth(i).textContent();
      assert.match(text, /AR/);
      assert.match(text, /Нет перевода/);
    }
    assert.ok(!(await table.textContent()).match(/[0-9a-f]{8}-[0-9a-f]{4}-/), 'no technical ids');
    await shot(page, 't02-list-filtered');
    await page.reload();
    assert.equal(await page.getByLabel('Язык').inputValue(), 'ar');
    assert.equal(await page.getByLabel('Состояние').inputValue(), 'missing');
  });

  let sourceTitle = '';

  test('missing translation: the Arabic editor is right-to-left; saving makes it «В работе»; English unchanged', async () => {
    const { page } = profiles.editor;
    await openTranslation(page, { locale: 'ar', q: 'Terms', title: 'Terms of Use' });
    await page.getByRole('alert').or(page.getByRole('status')).filter({ hasText: 'Нет перевода' }).first().waitFor();
    const field = page.locator('[data-field="header.title"]');
    const target = field.getByRole('textbox', { name: /Шапка · заголовок \(H1\) — перевод/ });
    assert.equal(await target.getAttribute('dir'), 'rtl');
    assert.equal(await target.getAttribute('lang'), 'ar');
    const source = field.locator('[lang="en"]');
    assert.equal(await source.getAttribute('dir'), 'ltr');
    sourceTitle = (await source.textContent()).trim();
    assert.equal(sourceTitle, 'Terms of Use');
    assert.equal(await page.locator('html').getAttribute('dir'), null, 'the admin itself stays left-to-right');
    await target.fill(AR_TITLE);
    await page.getByText('Есть несохранённые изменения').waitFor();
    await shot(page, 't03-arabic-rtl');
    await page.keyboard.press('Control+s');
    await page.getByText('Перевод сохранён', { exact: true }).waitFor();
    await page.getByRole('heading', { name: 'Terms of Use' }).waitFor();
    await page.getByText('В работе', { exact: true }).first().waitFor();
    assert.equal(await target.inputValue(), AR_TITLE);
    assert.equal((await source.textContent()).trim(), 'Terms of Use', 'the English source is untouched');
    // No review actions for an Editor.
    assert.equal(await page.getByRole('button', { name: 'Утвердить перевод' }).count(), 0);
    // The English page editor still shows the English title.
    await page.getByRole('link', { name: /Исходный текст/ }).click();
    await page.getByRole('heading', { name: 'Условия использования' }).waitFor();
    assert.equal(await page.getByLabel('Заголовок (H1)', { exact: true }).inputValue(), 'Terms of Use');
  });

  test('review: a content manager approves; the language completion goes up', async () => {
    const p = profiles.reviewer;
    await signInWithNewTotp(p, REVIEWER);
    const { page } = p;
    await openTranslation(page, { locale: 'ar', q: 'Terms', title: 'Terms of Use' });
    await page.getByText('В работе', { exact: true }).first().waitFor();
    await page.getByRole('button', { name: 'Утвердить перевод' }).click();
    await page.getByText('Перевод утверждён', { exact: true }).waitFor();
    await page.getByText('Утверждён', { exact: true }).first().waitFor();
    await shot(page, 't04-approved');
    await page.goto(`${ORIGIN}/translations`);
    await page.getByRole('heading', { name: 'Переводы' }).waitFor();
    assert.ok((await completionOf(page, 'ar')) >= arBefore, 'AR completion did not go down');
  });

  test('outdated: an English change marks the approved translation «Устарел», visibly', async () => {
    const { page } = profiles.reviewer;
    await page.goto(`${ORIGIN}/content/pages`);
    await page.getByRole('link', { name: /Условия использования/ }).click();
    await page.getByRole('heading', { name: 'Условия использования' }).waitFor();
    await page.getByLabel('Заголовок (H1)', { exact: true }).fill('Terms of Use and Conditions');
    await page.getByRole('button', { name: 'Сохранить' }).click();
    await page.getByText(/^Сохранено \d/).waitFor();
    // The content editor shows the language state…
    await page.getByRole('list', { name: 'Состояние переводов' }).getByRole('link', { name: /AR.*Устарел/ }).waitFor();
    // …and «Требуют внимания» lists it as outdated.
    await page.goto(`${ORIGIN}/translations/attention?locale=ar&q=Terms`);
    const row = page.getByRole('table', { name: 'Требуют внимания' }).getByRole('row', { name: /Terms of Use and Conditions/ });
    await row.getByText('Устарел').waitFor();
    await row.getByText('Исходный текст изменился').waitFor();
    await shot(page, 't05-outdated-list');
    await row.getByRole('link').click();
    await page.getByText('Английский текст изменился после утверждения перевода', { exact: false }).waitFor();
    const field = page.locator('[data-field="header.title"]');
    assert.equal((await field.locator('[lang="en"]').textContent()).trim(), 'Terms of Use and Conditions');
    assert.equal(await field.getByRole('textbox').inputValue(), AR_TITLE, 'the translation itself is kept');
    await shot(page, 't06-outdated-editor');
    // Restore the English title (keeps the seed text for the other suites in this run).
    await page.getByRole('link', { name: /Исходный текст/ }).click();
    await page.getByRole('heading', { name: 'Условия использования' }).waitFor();
    await page.getByLabel('Заголовок (H1)', { exact: true }).fill(sourceTitle);
    await page.getByRole('button', { name: 'Сохранить' }).click();
    await page.getByText(/^Сохранено \d/).waitFor();
  });

  test('concurrent editing: the second save gets the conflict message, nothing is overwritten', async () => {
    const a = profiles.editor.page;
    const b = profiles.reviewer.page;
    await openTranslation(a, { locale: 'es', q: 'ningbo', title: 'SOLBAR NINGBO' });
    await openTranslation(b, { locale: 'es', q: 'ningbo', title: 'SOLBAR NINGBO' });
    const box = (page) => page.locator('[data-field="country"]').getByRole('textbox');
    await box(a).fill('China (A)');
    await box(b).fill('China (B)');
    await b.getByRole('button', { name: 'Сохранить' }).click();
    await b.getByText('Перевод сохранён', { exact: true }).waitFor();
    await a.getByRole('button', { name: 'Сохранить' }).click();
    await a.getByText('Запись была изменена другим пользователем. Обновите страницу перед сохранением.').waitFor();
    await shot(a, 't07-conflict');
    await a.getByRole('button', { name: 'Обновить' }).click();
    await a.getByRole('heading', { name: 'SOLBAR NINGBO' }).waitFor();
    assert.equal(await box(a).inputValue(), 'China (B)', 'B’s translation is kept');
  });

  test('unsaved changes: switching the language asks first', async () => {
    const { page } = profiles.editor;
    await page.locator('[data-field="country"]').getByRole('textbox').fill('China (draft)');
    await page.getByRole('navigation', { name: 'Языки' }).getByRole('link', { name: /Русский/ }).click();
    const dialog = page.getByRole('alertdialog', { name: 'Уйти без сохранения?' });
    await dialog.waitFor();
    await dialog.getByRole('button', { name: 'Отмена' }).click();
    assert.match(page.url(), /\/es$/);
    await page.getByRole('button', { name: 'Отменить изменения' }).click();
  });

  test('marketer: read-only translations; the API refuses changes anyway', async () => {
    const p = await profile();
    profiles.marketer = p;
    await signInWithNewTotp(p, MARKETER);
    const { page } = p;
    await openTranslation(page, { locale: 'ru', q: 'ningbo', title: 'SOLBAR NINGBO' });
    await page.getByText('Ваша роль может только просматривать переводы.').waitFor();
    assert.equal(await page.locator('[data-field="title"]').getByRole('textbox').isDisabled(), true);
    assert.equal(await page.getByRole('button', { name: 'Сохранить' }).count(), 0);
    const status = await page.evaluate(async (url) => {
      const r = await fetch(url, { method: 'PATCH', headers: { 'content-type': 'application/json', 'x-requested-with': 'soltex-admin', 'if-match': '"1.1"' }, body: JSON.stringify({ fields: { title: 'x' } }) });
      return r.status;
    }, `${ORIGIN}/api/v1/content/projects/${page.url().split('/').at(-2)}/translations/ru`);
    assert.equal(status, 403);
  });

  test('mobile: list and editor without horizontal scroll', async () => {
    const p = await profile({ width: 390, height: 844 });
    profiles.mobile = p;
    await signIn(p, EDITOR);
    const { page } = p;
    await page.goto(`${ORIGIN}/translations/all?locale=ar`);
    await page.getByRole('table', { name: 'Все переводы' }).waitFor();
    await shot(page, 't08-mobile-list');
    let overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert.ok(overflow <= 1, `list: no horizontal page scroll (${overflow}px)`);
    await openTranslation(page, { locale: 'ar', q: 'ningbo', title: 'SOLBAR NINGBO' });
    await shot(page, 't09-mobile-editor');
    overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert.ok(overflow <= 1, `editor: no horizontal page scroll (${overflow}px)`);
    await page.goto(`${ORIGIN}/translations`);
    await page.getByRole('heading', { name: 'Переводы' }).waitFor();
    overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert.ok(overflow <= 1, `overview: no horizontal page scroll (${overflow}px)`);
  });

  test('no page errors, no CSP violations', () => {
    assert.deepEqual(allProblems(), []);
  });
});
