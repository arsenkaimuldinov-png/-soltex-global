/**
 * «Обзор», «Система» and ⌘K content search (Phase L), end to end as a Content Manager (content, SEO,
 * media and system, no leads): every number opens the list it counts with that list's filter; ⌘K
 * finds a technology by its Russian title and opens the editor; «Система» shows the database and
 * the running worker. Own user: the seventh Content Manager.
 */
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { closeBrowser, openCommandPalette, ORIGIN, profile, saveRecoveryCodes, shot, sidebar, signInWithPassword, totp, user } from './harness.mjs';

const CM = user('content_manager', 6);
const profiles = {};

describe('Dashboard and search (Phase L)', () => {
  before(async () => {
    profiles.cm = await profile({ ip: '198.51.100.80' });
  });
  after(async () => {
    for (const p of Object.values(profiles)) await p.close();
    await closeBrowser();
  });

  test('«Обзор»: the blocks of the role; no leads', async () => {
    const { page } = profiles.cm;
    await signInWithPassword(page, CM);
    await page.waitForURL(`${ORIGIN}/setup-mfa`);
    await page.getByRole('radio', { name: /Приложение-аутентификатор/ }).click();
    await page.getByRole('button', { name: 'Подключить приложение' }).click();
    const secret = (await page.getByLabel('Ключ для ручного ввода').textContent()).replace(/\s/g, '');
    await page.getByLabel('Код из приложения').fill(await totp(secret));
    await page.getByRole('button', { name: 'Подтвердить' }).click();
    await saveRecoveryCodes(page, 'Перейти в админку');
    await page.waitForURL(`${ORIGIN}/`);
    const dash = page.locator('[data-dashboard]');
    for (const title of ['SEO', 'Контент', 'Публикация сайта', 'Медиатека', 'Переводы', 'Недавно изменено', 'Безопасность входа']) await dash.getByRole('heading', { name: title, exact: true }).waitFor();
    assert.equal(await dash.getByRole('heading', { name: 'Заявки', exact: true }).count(), 0, 'no leads.read');
    await page.getByRole('table', { name: 'Переводы по языкам' }).getByRole('row').nth(5).waitFor();
    await shot(page, 'd01-overview');
  });

  test('every number opens its filtered list', async () => {
    const { page } = profiles.cm;
    await page.locator('[data-metric="seo-warning"]').click();
    await page.waitForURL(`${ORIGIN}/seo?severity=warning`);
    await page.getByRole('heading', { name: 'Проверка SEO', level: 1 }).waitFor();

    await sidebar(page).getByRole('link', { name: 'Обзор' }).first().click();
    await page.locator('[data-metric="tr-ru-outdated"]').click();
    await page.waitForURL(/\/translations\/all\?locale=ru&state=outdated$/);

    await sidebar(page).getByRole('link', { name: 'Обзор' }).first().click();
    const attention = Number(await page.locator('[data-metric="media-attention"] .tabular-nums').textContent());
    await page.locator('[data-metric="media-attention"]').click();
    await page.waitForURL(`${ORIGIN}/media?attention=true`);
    assert.equal(await page.getByLabel('Требуют внимания').isChecked(), true);
    if (attention === 0) await page.getByText('Файлов с такими условиями нет.').waitFor();

    await sidebar(page).getByRole('link', { name: 'Обзор' }).first().click();
    await page.locator('[data-metric="content-pending"]').click();
    await page.waitForURL(`${ORIGIN}/publishing`);
  });

  test('⌘K finds a technology by its Russian title and opens the editor', async () => {
    const { page } = profiles.cm;
    const input = await openCommandPalette(page);
    await input.fill('топинамбура');
    const option = page.getByRole('option', { name: /Jerusalem Artichoke/ });
    await option.waitFor();
    await option.getByText(/Технологии · .* · RU: Глубокая переработка топинамбура/).waitFor();
    await shot(page, 'd02-search');
    await option.click();
    await page.waitForURL(/\/content\/technologies\/[0-9a-f-]{36}$/);
    await page.getByRole('heading', { name: /Jerusalem Artichoke/, level: 1 }).waitFor();

    const again = await openCommandPalette(page);
    await again.fill(`SOL-${new Date().getUTCFullYear()}-`);
    await page.getByText('Ничего не найдено').waitFor();
    assert.equal(await page.getByRole('option').count(), 0, 'a Content Manager does not find leads');
    await page.keyboard.press('Escape');
  });

  test('«Система»: database, running worker, queues, disk, mail and backups', async () => {
    const { page } = profiles.cm;
    await page.goto(`${ORIGIN}/admin/system`);
    const card = (title) => page.getByRole('region', { name: title, exact: true });
    await card('База данных').getByText('Работает', { exact: true }).waitFor();
    await card('Обработчик задач').getByText('Работает', { exact: true }).waitFor();
    await card('Место на диске').getByText(/Свободно .* из /).first().waitFor();
    await card('Резервные копии').getByText('Не настроены', { exact: true }).waitFor();
    await card('Почта').getByText('Не настроена', { exact: true }).waitFor();
    await shot(page, 'd03-system');
  });

  test('mobile: «Обзор» fits a 390 px screen', async () => {
    const { page } = profiles.cm;
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${ORIGIN}/`);
    await page.locator('[data-dashboard]').getByRole('heading', { name: 'Переводы', exact: true }).waitFor();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert.ok(overflow <= 0, `horizontal overflow ${overflow}px`);
    await shot(page, 'd04-mobile');
  });

  test('no page errors and no CSP violations', () => {
    assert.deepEqual(Object.entries(profiles).flatMap(([k, p]) => p.problems.map((x) => `${k}: ${x}`)), []);
  });
});
