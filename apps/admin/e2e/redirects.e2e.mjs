/**
 * Redirects and address changes (Phase I-2), end to end against the real API + PostgreSQL in
 * Chromium: «SEO → Редиректы» (add, normalization, refusals, chain collapsing, delete), «Изменить
 * адрес» of a published project with the 301 from the old address, and read-only access for a
 * content manager. Own users: a third SEO specialist and a fifth content manager.
 */
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { closeBrowser, ORIGIN, profile, saveRecoveryCodes, shot, sidebar, signInWithPassword, totp, user } from './harness.mjs';

const SEO = user('seo_specialist', 2);
const CM = user('content_manager', 4);

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

const table = (page) => page.getByRole('table', { name: 'Редиректы' });
const exact = (text) => new RegExp(`^${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`);
const row = (page, from) => table(page).getByRole('row').filter({ has: page.locator('[data-from]').filter({ hasText: exact(from) }) });

async function addRedirect(page, from, to) {
  await page.getByRole('button', { name: 'Добавить редирект' }).click();
  const dialog = page.getByRole('dialog', { name: 'Новый редирект' });
  await dialog.getByLabel('Старый адрес').fill(from);
  await dialog.getByLabel('Новый адрес').fill(to);
  await dialog.getByRole('button', { name: 'Добавить' }).click();
  return dialog;
}

async function openProject(page, search, title) {
  await page.goto(`${ORIGIN}/content/projects?q=${search}`);
  await page.getByRole('table', { name: 'Проекты' }).getByRole('link', { name: new RegExp(title) }).click();
  await page.locator('[data-seo-panel]').waitFor();
}

describe('Redirects and address changes (Phase I-2)', () => {
  before(async () => {
    profiles.seo = await profile({ ip: '198.51.100.21' });
    profiles.cm = await profile({ ip: '198.51.100.22' });
  });
  after(async () => {
    for (const p of Object.values(profiles)) await p.close();
    await closeBrowser();
  });

  test('«SEO → Редиректы»: add with a pasted address; normalized; checks shown as «В порядке»', async () => {
    const { page } = profiles.seo;
    await signInWithNewTotp(profiles.seo, SEO);
    await sidebar(page).getByRole('link', { name: 'Редиректы' }).click();
    await page.getByRole('heading', { name: 'Редиректы', level: 1 }).waitFor();
    const dialog = await addRedirect(page, 'https://soltexglobal.co/old-company/', '/company');
    await dialog.waitFor({ state: 'detached' });
    await page.getByText('Редирект добавлен').first().waitFor();
    const r = row(page, '/old-company');
    await r.getByText('/company', { exact: true }).waitFor();
    await r.getByText('и на всех языках').waitFor();
    await r.getByText('В порядке').waitFor();
    await r.getByText('Вручную').waitFor();
    await shot(page, 'r01-list');
  });

  test('refused with the reason next to the field: external target, missing page, live page as source', async () => {
    const { page } = profiles.seo;
    let dialog = await addRedirect(page, '/a', 'https://evil.example/x');
    await dialog.getByText('Внешние адреса недопустимы.').waitFor();
    await dialog.getByLabel('Новый адрес').fill('/nowhere');
    await dialog.getByRole('button', { name: 'Добавить' }).click();
    await dialog.getByText(/Такой страницы нет среди опубликованных/).waitFor();
    await dialog.getByLabel('Старый адрес').fill('/contact');
    await dialog.getByLabel('Новый адрес').fill('/company');
    await dialog.getByRole('button', { name: 'Добавить' }).click();
    await dialog.getByText(/открывается страница сайта/).waitFor();
    await shot(page, 'r02-refused');
    await dialog.getByRole('button', { name: 'Отмена' }).click();
    // a chain is collapsed on save
    dialog = await addRedirect(page, '/older-company', '/old-company');
    await dialog.waitFor({ state: 'detached' });
    await page.getByText('Цепочка сокращена: редирект ведёт сразу на /company').first().waitFor();
    await row(page, '/older-company').getByText('/company', { exact: true }).waitFor();
  });

  test('«Изменить адрес» of a published project: six languages, 301 from the old address', async () => {
    const { page } = profiles.seo;
    await openProject(page, 'israel', 'ISRAEL');
    const field = page.locator('[data-field="slug"]');
    assert.equal(await field.getByRole('textbox').isDisabled(), true, 'the slug of a published record is not edited in the form');
    await field.getByText(/меняется кнопкой «Изменить адрес»/).waitFor();
    await field.getByRole('button', { name: 'Изменить адрес' }).click();
    const dialog = page.getByRole('dialog', { name: 'Изменить адрес' });
    await dialog.getByRole('textbox', { name: 'Новый адрес' }).fill('solbar-israel-plant');
    const rows = dialog.locator('[data-slug-row]');
    assert.equal(await rows.count(), 6);
    await dialog.locator('[data-slug-row="ru"]').getByText('https://soltexglobal.co/ru/projects/solbar-israel-plant').waitFor();
    assert.equal(await dialog.getByRole('checkbox', { name: /Создать 301-редирект/ }).isChecked(), true);
    await dialog.getByRole('checkbox', { name: /Создать 301-редирект/ }).uncheck();
    await dialog.getByText(/Без редиректа старые ссылки/).waitFor();
    await dialog.getByRole('checkbox', { name: /Создать 301-редирект/ }).check();
    await shot(page, 'r03-slug-dialog');
    await dialog.getByRole('button', { name: 'Изменить адрес' }).click();
    await page.getByText('Адрес изменён, редирект со старого адреса создан').first().waitFor();
    await field.getByText('/projects/solbar-israel-plant').waitFor();
    await page.locator('[data-seo-panel]').getByText('soltexglobal.co › projects › solbar-israel-plant').waitFor();

    await sidebar(page).getByRole('link', { name: 'Редиректы' }).click();
    const r = row(page, '/projects/solbar-israel');
    await r.getByText('/projects/solbar-israel-plant', { exact: true }).waitFor();
    await r.getByText('Смена адреса').waitFor();
    await shot(page, 'r04-after-slug-change');
  });

  test('content manager: redirects read-only, no «Изменить адрес»', async () => {
    const { page } = profiles.cm;
    await signInWithNewTotp(profiles.cm, CM);
    await page.goto(`${ORIGIN}/seo/redirects`);
    await page.getByText('Ваша роль может только просматривать редиректы.').waitFor();
    assert.equal(await page.getByRole('button', { name: 'Добавить редирект' }).count(), 0);
    assert.equal(await page.getByRole('button', { name: /^Удалить редирект/ }).count(), 0);
    await openProject(page, 'israel', 'ISRAEL');
    await page.locator('[data-field="slug"]').getByText(/меняют роли с правом на редиректы/).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Изменить адрес' }).count(), 0);
  });

  test('going back to the old address removes the reverse rule; delete with confirmation', async () => {
    const { page } = profiles.seo;
    await openProject(page, 'israel', 'ISRAEL');
    await page.locator('[data-field="slug"]').getByRole('button', { name: 'Изменить адрес' }).click();
    const dialog = page.getByRole('dialog', { name: 'Изменить адрес' });
    await dialog.getByRole('textbox', { name: 'Новый адрес' }).fill('solbar-israel');
    await dialog.getByRole('button', { name: 'Изменить адрес' }).click();
    await page.getByText('Адрес изменён, редирект со старого адреса создан').first().waitFor();

    await page.goto(`${ORIGIN}/seo/redirects`);
    await row(page, '/projects/solbar-israel-plant').getByText('/projects/solbar-israel', { exact: true }).waitFor();
    assert.equal(await row(page, '/projects/solbar-israel').count(), 0, 'no rule from the address the page lives at');

    await page.getByRole('button', { name: 'Удалить редирект /older-company' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Удалить' }).click();
    await page.getByText('Редирект удалён').first().waitFor();
    await row(page, '/older-company').waitFor({ state: 'detached' });
    // leave the database as the seed has it (other E2E files and reruns)
    for (const from of ['/old-company', '/projects/solbar-israel-plant']) {
      await page.getByRole('button', { name: `Удалить редирект ${from}` }).click();
      await page.getByRole('alertdialog').getByRole('button', { name: 'Удалить' }).click();
      await row(page, from).waitFor({ state: 'detached' });
    }
    // The old-site addresses of the seed stay (Phase N-0).
    for (const from of ['/about', '/services', '/tech']) await row(page, from).waitFor();
  });

  test('mobile: the redirects list fits a 390 px screen', async () => {
    const { page } = profiles.cm;
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${ORIGIN}/seo/redirects`);
    await table(page).waitFor();
    await page.waitForLoadState('networkidle');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert.ok(overflow <= 0, `horizontal overflow ${overflow}px`);
    await shot(page, 'r05-mobile');
  });

  test('no page errors and no CSP violations', () => {
    assert.deepEqual(allProblems(), []);
  });
});
