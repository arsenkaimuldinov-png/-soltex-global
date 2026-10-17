/**
 * Настройки сайта (Phase N-0), end to end as an Admin: change an office phone and the English
 * opening hours; the Russian tab reminds to check its translation; saving asks for the second
 * factor (step-up) and the value is stored; the change is restored at the end, because the e2e
 * database is shared by runs. A Content Manager does not see the screen. Own user: the fourth Admin.
 */
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { ageStepUp, closeBrowser, ORIGIN, profile, saveRecoveryCodes, shot, sidebar, signInWithPassword, user } from './harness.mjs';

const ADMIN = user('admin', 3);
const PHONE = `+359 2 ${Date.now().toString().slice(-7)}`;
const profiles = {};

async function save(page) {
  ageStepUp(ADMIN.id);
  await page.getByRole('button', { name: 'Сохранить' }).first().click();
  const stepUp = page.getByRole('dialog', { name: 'Подтвердите действие' });
  await stepUp.waitFor();
  await stepUp.getByRole('button', { name: 'Подтвердить ключом доступа' }).click();
  await page.getByText('Настройки сохранены').first().waitFor();
}

describe('Site settings (Phase N-0)', () => {
  before(async () => {
    profiles.admin = await profile({ ip: '198.51.100.91' });
  });
  after(async () => {
    for (const p of Object.values(profiles)) {
      assert.deepEqual(p.problems, []);
      await p.close();
    }
    await closeBrowser();
  });

  test('edit an office phone and the English hours; the Russian tab asks to check the translation; save with step-up', async () => {
    const { page } = profiles.admin;
    await signInWithPassword(page, ADMIN);
    await page.waitForURL(`${ORIGIN}/setup-mfa`);
    await page.getByRole('button', { name: 'Добавить ключ доступа' }).click();
    await saveRecoveryCodes(page, 'Перейти в админку');
    await page.waitForURL(`${ORIGIN}/`);

    await sidebar(page).getByRole('link', { name: 'Настройки сайта' }).click();
    await page.getByRole('heading', { name: 'Настройки сайта', level: 1 }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Сохранить' }).first().isDisabled(), true, 'nothing to save yet');

    const office = page.getByRole('group').filter({ has: page.getByLabel('Телефон (необязательно)') }).first();
    const phone = office.getByLabel('Телефон (необязательно)');
    const oldPhone = await phone.inputValue();
    await phone.fill(PHONE);
    const hours = page.getByLabel('Часы работы');
    const oldHours = await hours.inputValue();
    await hours.fill(`${oldHours} (e2e)`);

    const ru = page.getByRole('tab', { name: /Русский/ });
    await ru.getByTitle('Английский текст изменён — проверьте перевод').waitFor();
    await ru.click();
    await page.getByText(/Английский текст изменён в 1 поле/).waitFor();
    await shot(page, 's01-settings-check-translation');
    await page.getByRole('tab', { name: /Английский/ }).click();

    await save(page);
    await page.reload();
    await page.getByRole('heading', { name: 'Настройки сайта', level: 1 }).waitFor();
    assert.equal(await page.getByRole('group').filter({ has: page.getByLabel('Телефон (необязательно)') }).first().getByLabel('Телефон (необязательно)').inputValue(), PHONE);
    await page.getByText(/Последнее изменение: .*/).waitFor();

    // Restore (shared e2e database).
    await page.getByRole('group').filter({ has: page.getByLabel('Телефон (необязательно)') }).first().getByLabel('Телефон (необязательно)').fill(oldPhone);
    await page.getByLabel('Часы работы').fill(oldHours);
    await save(page);
  });

  test('an invalid e-mail is shown at the field and nothing is saved', async () => {
    const { page } = profiles.admin;
    const email = page.getByLabel('Основной e-mail сайта');
    const old = await email.inputValue();
    await email.fill('info@');
    ageStepUp(ADMIN.id);
    await page.getByRole('button', { name: 'Сохранить' }).first().click();
    const stepUp = page.getByRole('dialog', { name: 'Подтвердите действие' });
    await stepUp.waitFor();
    await stepUp.getByRole('button', { name: 'Подтвердить ключом доступа' }).click();
    await page.getByText('Проверьте значение поля.').first().waitFor();
    await email.fill(old);
  });
});
