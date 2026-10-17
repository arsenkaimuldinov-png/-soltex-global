/**
 * Leads (Phase K-1), end to end against the real API + PostgreSQL in Chromium: a form of the site
 * sends a lead (public endpoint), a marketer finds it in «Заявки», works on it (status, assignee,
 * note, history), sees that the e-mail notice is waiting (no SMTP in this run), exports CSV, moves
 * it to the bin and back; an editor has no access. Own user: a third marketer.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { after, before, describe, test } from 'node:test';
import { closeBrowser, ORIGIN, profile, saveRecoveryCodes, shot, sidebar, signInWithPassword, totp, user } from './harness.mjs';

const MARKETER = user('marketer', 2);
const EDITOR = user('editor', 5);
const RUN = Date.now().toString(36);
const NAME = `E2E Покупатель ${RUN}`;

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

/** What the site's contact form sends (Phase K-2 connects the real forms). */
async function sendLead(fields) {
  const res = await fetch(`${ORIGIN}/api/v1/public/leads`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-requested-with': 'soltex-site', 'x-forwarded-for': '198.51.100.41' },
    body: JSON.stringify({ formType: 'contact_page', fields, topic: 'Пектин', locale: 'ru', pagePath: '/ru/contact', fillMs: 12000 }),
  });
  assert.equal(res.status, 201, await res.clone().text());
  return (await res.json()).reference;
}

describe('Leads (Phase K-1)', () => {
  let reference;
  before(async () => {
    profiles.marketer = await profile({ ip: '198.51.100.42' });
    reference = await sendLead({ name: NAME, phone: '+7 701 555 12 34', email: `buyer.${RUN}@example.test`, company: 'ТОО «Агро»', message: 'Интересует линия по производству пектина.\nМощность 5 т/сутки.' });
  });
  after(async () => {
    for (const p of Object.values(profiles)) await p.close();
    await closeBrowser();
  });

  test('«Заявки»: the new lead is in the list with its contacts; the notice waits for SMTP', async () => {
    const { page } = profiles.marketer;
    await signInWithNewTotp(profiles.marketer, MARKETER);
    await sidebar(page).getByRole('link', { name: 'Все заявки' }).click();
    await page.getByRole('heading', { name: 'Заявки', level: 1 }).waitFor();
    const row = page.getByRole('table', { name: 'Заявки' }).getByRole('row').filter({ hasText: reference });
    await row.getByText(NAME).waitFor();
    await row.getByText('+7 701 555 12 34').waitFor();
    await row.getByText('Новый').waitFor();
    await shot(page, 'l01-list');
    await row.getByRole('link', { name: new RegExp(reference) }).click();
    await page.getByRole('heading', { name: reference, level: 1 }).waitFor();
    await page.locator('[data-lead-message]').getByText('Мощность 5 т/сутки.').waitFor();
    // The worker tries to send within seconds; without SMTP the lead shows the waiting notice.
    for (let i = 0; i < 20 && !(await page.getByText(/Уведомление на почту не отправлено/).count()); i++) {
      await page.waitForTimeout(1000);
      await page.reload();
    }
    await page.getByText(/Уведомление на почту не отправлено: почта сервера ещё не настроена/).waitFor();
    await page.getByText(/галочки согласия в формах пока нет/).waitFor();
    assert.equal(await page.getByRole('link', { name: '+7 701 555 12 34' }).getAttribute('href'), 'tel:+77015551234');
  });

  test('work on the lead: status, assignee, note; history in words', async () => {
    const { page } = profiles.marketer;
    await page.getByLabel('Статус').selectOption('in_progress');
    await page.getByText('Статус изменён').first().waitFor();
    await page.getByLabel('Ответственный').selectOption({ label: MARKETER.name });
    await page.getByText('Ответственный назначен').first().waitFor();
    await page.getByLabel('Новая заметка').fill('Перезвонить в понедельник');
    await page.getByRole('button', { name: 'Добавить заметку' }).click();
    await page.getByText('Заметка добавлена').first().waitFor();
    const history = page.getByRole('list', { name: 'История заявки' });
    await history.getByText('Перезвонить в понедельник').waitFor();
    await history.getByText('Статус: Новый → В работе').waitFor();
    await history.getByText(`Ответственный: ${MARKETER.name}`).waitFor();
    await history.getByText('Заявка получена с сайта').waitFor();
    await shot(page, 'l02-detail');
  });

  test('export: CSV download with the lead (fresh second factor after sign-in)', async () => {
    const { page } = profiles.marketer;
    await page.goto(`${ORIGIN}/leads?q=${encodeURIComponent(NAME)}`);
    await page.getByRole('table', { name: 'Заявки' }).getByText(reference).waitFor();
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Выгрузить CSV' }).click()]);
    assert.match(download.suggestedFilename(), /^soltex-leads-\d{4}-\d{2}-\d{2}\.csv$/);
    const text = fs.readFileSync(await download.path(), 'utf8');
    assert.ok(text.startsWith('﻿Номер;Дата (UTC);Статус'));
    assert.ok(text.includes(reference) && text.includes(`buyer.${RUN}@example.test`));
    assert.equal(text.trim().split('\r\n').length, 2, 'header + the one filtered lead');
    await page.getByText(/Выгрузка записана в журнал действий/).first().waitFor();
  });

  test('bin: move to the bin and restore', async () => {
    const { page } = profiles.marketer;
    await page.getByRole('table', { name: 'Заявки' }).getByRole('link', { name: new RegExp(reference) }).click();
    await page.getByRole('button', { name: 'В корзину' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'В корзину' }).click();
    await page.getByText(/Заявка в корзине с/).waitFor();
    await page.goto(`${ORIGIN}/leads?bin=1&q=${encodeURIComponent(NAME)}`);
    await page.getByRole('table', { name: 'Заявки' }).getByRole('link', { name: new RegExp(reference) }).click();
    await page.getByRole('button', { name: 'Восстановить' }).click();
    await page.getByText('Заявка восстановлена').first().waitFor();
    await page.getByRole('button', { name: 'В корзину' }).waitFor();
  });

  test('an editor has no access to leads', async () => {
    const p = await profile({ ip: '198.51.100.43' });
    profiles.editor = p;
    await signInWithPassword(p.page, EDITOR);
    await p.page.waitForURL(`${ORIGIN}/`);
    assert.equal(await sidebar(p.page).getByRole('link', { name: 'Все заявки' }).count(), 0);
    await p.page.goto(`${ORIGIN}/leads`);
    await p.page.getByRole('heading', { name: 'Недостаточно прав' }).waitFor();
  });

  test('mobile: list and lead fit a 390 px screen', async () => {
    const { page } = profiles.marketer;
    await page.setViewportSize({ width: 390, height: 844 });
    for (const url of [`${ORIGIN}/leads`, page.url()]) {
      await page.goto(url);
      await page.getByRole('heading', { level: 1 }).waitFor();
      await page.waitForLoadState('networkidle');
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      const wide = overflow > 0 ? await page.evaluate(() => [...document.querySelectorAll('body *')].filter((e) => e.getBoundingClientRect().right > innerWidth + 1 && !e.parentElement?.closest('.overflow-x-auto')).slice(0, 4).map((e) => `${e.tagName}.${String(e.className).slice(0, 60)}`)) : [];
      assert.ok(overflow <= 0, `${url}: horizontal overflow ${overflow}px: ${wide.join(' | ')}`);
    }
    await shot(page, 'l03-mobile');
  });

  test('no page errors and no CSP violations', () => {
    assert.deepEqual(allProblems(), []);
  });
});
