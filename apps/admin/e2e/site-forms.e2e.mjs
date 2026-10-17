/**
 * Site forms (Phase K-2), end to end: the release published by publishing.e2e (built with
 * SITE_LEADS_ENABLED and ATTRIBUTION_ENABLED, see scripts/admin-e2e.mjs) is served as the public
 * site; a visitor arrives from a campaign, sends the CTA form, the inquiry dialog and the contact
 * form; a marketer finds the three leads in «Заявки» with their source. Also: the honeypot is
 * invisible, attribution is cleared after sending, an error keeps the entered values.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { after, before, describe, test } from 'node:test';
import { closeBrowser, ORIGIN, profile, saveRecoveryCodes, shot, sidebar, signInWithPassword, totp, user } from './harness.mjs';

const SITE = process.env.E2E_SITE_ORIGIN ?? 'http://site.e2e.test:4177';
const RELEASES_DIR = process.env.E2E_RELEASES_DIR;
const MARKETER = user('marketer', 3);
const RUN = Date.now().toString(36);
const CAMPAIGN = `k2-${RUN}`;
const NAME = (form) => `E2E Сайт ${form} ${RUN}`;
const FILL_PAUSE_MS = 3200; // the server marks forms sent faster than 3 s as spam

const profiles = {};
// Pages of the site load images from /media, which this test server does not serve: only script
// errors and other console errors count.
const problems = () => Object.entries(profiles).flatMap(([k, p]) => p.problems.filter((x) => !/Failed to load resource/.test(x)).map((x) => `${k}: ${x}`));

describe('Site forms (Phase K-2)', () => {
  before(async () => {
    assert.ok(RELEASES_DIR && fs.existsSync(path.join(RELEASES_DIR, 'current')), 'needs the release published by publishing.e2e (run the full suite)');
    profiles.visitor = await profile({ ip: '198.51.100.70' });
  });
  after(async () => {
    for (const p of Object.values(profiles)) await p.close();
    await closeBrowser();
  });

  test('the published site has live forms: honeypot hidden from people and assistive technology', async () => {
    const { page } = profiles.visitor;
    await page.goto(`${SITE}/ru/epcm?utm_source=e2e&utm_medium=cpc&utm_campaign=${CAMPAIGN}&email=leak@example.test`, { referer: 'https://www.google.com/search?q=pectin' });
    const trap = page.locator('input[name="soltex_ref"]');
    assert.equal(await trap.count(), 1);
    const box = await trap.locator('xpath=ancestor::div[@aria-hidden="true"][1]').boundingBox();
    assert.ok(box && box.width <= 1 && box.height <= 1, `honeypot takes no space: ${JSON.stringify(box)}`);
    assert.equal(await trap.getAttribute('tabindex'), '-1');
    assert.equal(await page.getByRole('textbox', { name: /Leave this field empty/ }).count(), 0, 'not in the accessibility tree');
    const first = await page.evaluate(() => JSON.parse(localStorage.getItem('soltex.attribution.first')));
    assert.equal(first.touch.utm_campaign, CAMPAIGN);
    assert.equal(first.touch.referrer, 'https://www.google.com', 'referrer origin only');
    assert.equal(first.touch.landing, '/ru/epcm', 'landing path without query');
    assert.ok(!JSON.stringify(first).includes('leak@example.test'), 'only allowlisted parameters');
  });

  test('an error keeps the entered values and says what to do', async () => {
    const { page } = profiles.visitor;
    await page.route('**/api/v1/public/leads', (r) => r.fulfill({ status: 429, contentType: 'application/problem+json', body: '{"code":"rate_limited"}' }));
    const form = page.locator('form').filter({ has: page.getByLabel('ВАШЕ ИМЯ', { exact: true }) }).first();
    await form.getByLabel('ВАШЕ ИМЯ', { exact: true }).fill(NAME('cta'));
    await form.getByLabel('НОМЕР ТЕЛЕФОНА', { exact: true }).fill('+7 701 700 00 01');
    await page.waitForTimeout(FILL_PAUSE_MS);
    await form.getByRole('button', { name: 'НАЧАТЬ ПРОЕКТ' }).click();
    await form.getByRole('alert').getByText(/слишком много запросов/).waitFor();
    assert.equal(await form.getByLabel('ВАШЕ ИМЯ', { exact: true }).inputValue(), NAME('cta'));
    await page.unroute('**/api/v1/public/leads');
  });

  test('CTA block: the lead is sent; attribution is cleared afterwards', async () => {
    const { page } = profiles.visitor;
    const form = page.locator('form').filter({ has: page.getByLabel('ВАШЕ ИМЯ', { exact: true }) }).first();
    await form.getByRole('button', { name: 'НАЧАТЬ ПРОЕКТ' }).click();
    await page.getByText('Заявка успешно отправлена').waitFor();
    assert.equal(await page.evaluate(() => localStorage.getItem('soltex.attribution.first')), null);
    await shot(page, 's01-cta-sent');
  });

  test('inquiry dialog: the server reference is shown', async () => {
    const { page } = profiles.visitor;
    // A new campaign visit: the first touch starts again after the previous lead cleared it.
    await page.goto(`${SITE}/ru/epcm?utm_source=e2e&utm_medium=email&utm_campaign=${CAMPAIGN}`);
    await page.getByRole('button', { name: 'Запрос по этому этапу' }).first().click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('ВАШЕ ИМЯ', { exact: true }).fill(NAME('dialog'));
    await dialog.getByLabel('НОМЕР ТЕЛЕФОНА', { exact: true }).fill('+7 701 700 00 02');
    await page.waitForTimeout(FILL_PAUSE_MS);
    await dialog.getByRole('button', { name: 'НАЧАТЬ ПРОЕКТ' }).click();
    await dialog.getByText('Запрос получен').waitFor();
    await dialog.getByText(new RegExp(`SOL-${new Date().getUTCFullYear()}-\\d{6}`)).waitFor();
    await shot(page, 's02-dialog-sent');
  });

  test('contact page: all fields are sent', async () => {
    const { page } = profiles.visitor;
    await page.goto(`${SITE}/ru/contact`);
    await page.getByLabel(/^ИМЯ/).fill(NAME('contact'));
    await page.getByLabel(/^ТЕЛЕФОН/).fill('+7 701 700 00 03');
    await page.getByLabel(/^ЭЛ\. ПОЧТА/).fill(`site.${RUN}@example.test`);
    await page.getByLabel(/^КОМПАНИЯ/).fill('ТОО «Сайт E2E»');
    await page.getByLabel(/^КРАТКОЕ ОПИСАНИЕ/).fill('Линия по производству пектина, 5 т/сутки.');
    await page.waitForTimeout(FILL_PAUSE_MS);
    await page.getByRole('button', { name: 'ОТПРАВИТЬ ЗАПРОС' }).click();
    await page.getByText('Запрос успешно отправлен').waitFor();
  });

  test('«Заявки»: the three leads with their form, page and source', async () => {
    profiles.marketer = await profile({ ip: '198.51.100.71' });
    const { page } = profiles.marketer;
    await signInWithPassword(page, MARKETER);
    await page.waitForURL(`${ORIGIN}/setup-mfa`);
    await page.getByRole('radio', { name: /Приложение-аутентификатор/ }).click();
    await page.getByRole('button', { name: 'Подключить приложение' }).click();
    const secret = (await page.getByLabel('Ключ для ручного ввода').textContent()).replace(/\s/g, '');
    await page.getByLabel('Код из приложения').fill(await totp(secret));
    await page.getByRole('button', { name: 'Подтвердить' }).click();
    await saveRecoveryCodes(page, 'Перейти в админку');
    await page.waitForURL(`${ORIGIN}/`);
    await sidebar(page).getByRole('link', { name: 'Все заявки' }).click();
    await page.getByRole('heading', { name: 'Заявки', level: 1 }).waitFor();
    assert.equal(await page.getByText(/демонстрационном режиме/).count(), 0, 'forms are live in this run');
    await page.goto(`${ORIGIN}/leads?q=${encodeURIComponent(RUN)}`);
    const table = page.getByRole('table', { name: 'Заявки' });
    for (const [form, label] of [['cta', 'Блок «Связаться»'], ['dialog', 'Окно запроса'], ['contact', 'Страница «Контакты»']]) {
      const row = table.getByRole('row').filter({ hasText: NAME(form) });
      await row.getByText(label).waitFor();
      await row.getByText('Новый').waitFor();
    }
    await table.getByRole('row').filter({ hasText: NAME('cta') }).getByText(`Источник: e2e / cpc / ${CAMPAIGN}`).waitFor();
    await shot(page, 's03-leads');

    await table.getByRole('row').filter({ hasText: NAME('dialog') }).getByRole('link').first().click();
    const first = page.locator('[data-attribution="first"]');
    await first.getByText(`e2e / email / ${CAMPAIGN}`).waitFor();
    await first.getByText(/страница входа \/ru\/epcm/).waitFor();
    await page.getByText('/epcm', { exact: true }).waitFor(); // the route; the language is stored separately
    await shot(page, 's04-lead-source');

    await page.goto(`${ORIGIN}/leads?q=${encodeURIComponent(NAME('contact'))}`);
    await table.getByRole('row').filter({ hasText: NAME('contact') }).getByRole('link').first().click();
    await page.locator('[data-lead-message]').getByText('Линия по производству пектина, 5 т/сутки.').waitFor();
    // After the previous lead cleared attribution, this visit came from inside the site: «прямой заход».
    await page.locator('[data-attribution="first"]').getByText('прямой заход').waitFor();
    assert.equal(await page.locator('[data-attribution="last"]').count(), 0, 'no campaign or external referrer: no last touch');
  });

  test('no script errors on the site or in the admin', () => {
    assert.deepEqual(problems(), []);
  });
});
