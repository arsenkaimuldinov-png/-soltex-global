/**
 * Admin Phase D, end to end (real API + PostgreSQL, built admin under its CSP, Chromium with a
 * virtual passkey). Tests run in order and share state: the Owner enrolls first.
 */
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import {
  ageStepUp,
  closeBrowser,
  openCommandPalette,
  ORIGIN,
  profile,
  saveRecoveryCodes,
  shot,
  sidebar,
  signInWithPassword,
  totp,
  user,
} from './harness.mjs';

const OWNER = user('owner');
const ADMIN = user('admin');
const CM = user('content_manager');
const EDITOR = user('editor');
const MARKETER = user('marketer');

const profiles = {};
const allProblems = () => Object.entries(profiles).flatMap(([k, p]) => p.problems.map((x) => `${k}: ${x}`));

describe('admin (Phase D)', () => {
  before(async () => {
    profiles.owner = await profile();
  });
  after(async () => {
    for (const p of Object.values(profiles)) await p.close();
    await closeBrowser();
  });

  test('anonymous visitors are sent to the sign-in page; the admin is never indexed', async () => {
    const { page } = profiles.owner;
    await page.goto(`${ORIGIN}/admin/users`);
    await page.waitForURL(`${ORIGIN}/login`);
    assert.equal(await page.locator('meta[name="robots"]').getAttribute('content'), 'noindex, nofollow, noarchive');
    assert.equal(await page.locator('html').getAttribute('lang'), 'ru');
    await shot(page, '01-login');
  });

  test('wrong password: one generic message, the password field is cleared', async () => {
    const { page } = profiles.owner;
    await signInWithPassword(page, OWNER, 'Definitely-Wrong-Password-1');
    await page.getByRole('alert').filter({ hasText: 'Неверный e-mail или пароль' }).waitFor();
    assert.equal(await page.getByLabel('Пароль', { exact: true }).inputValue(), '');
  });

  test('Owner: first sign-in requires a passkey, recovery codes are shown once, then the shell', async () => {
    const { page, credentials } = profiles.owner;
    await signInWithPassword(page, OWNER);
    await page.waitForURL(`${ORIGIN}/setup-mfa`);
    // Owners have no TOTP choice at enrollment (passkey required, approved §7).
    assert.equal(await page.getByRole('radio').count(), 0);
    // Nothing else is reachable before enrollment.
    await page.goto(`${ORIGIN}/admin/users`);
    await page.waitForURL(`${ORIGIN}/setup-mfa`);
    await shot(page, '02-setup-passkey');
    await page.getByRole('button', { name: 'Добавить ключ доступа' }).click();
    const codes = await saveRecoveryCodes(page, 'Перейти в админку');
    assert.equal(codes.length, 10);
    assert.ok(codes.every((c) => /^[0-9A-F]{8}(-[0-9A-F]{8}){3}$/.test(c)), 'recovery code format');
    assert.equal((await credentials()).length, 1, 'one passkey in the authenticator');
    // The page asked for during enrollment opens afterwards.
    await page.waitForURL(`${ORIGIN}/admin/users`);
    await page.getByRole('heading', { name: 'Пользователи' }).waitFor();
    await page.goto(`${ORIGIN}/`);
    await page.getByRole('heading', { name: 'Обзор' }).waitFor();
    // Codes are not kept in browser storage.
    const stored = await page.evaluate(() => JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage }));
    assert.ok(!codes.some((c) => stored.includes(c)));
    await shot(page, '03-overview-owner');
  });

  test('Owner: sidebar shows exactly the content and administration screens; no later-phase sections', async () => {
    const { page } = profiles.owner;
    const links = await sidebar(page).getByRole('link').allTextContents();
    assert.deepEqual(links.map((s) => s.trim()), ['Обзор', 'Страницы', 'Проекты', 'Технологии', 'Продукты', 'EPC / EPCM', 'Патенты', 'Видео', 'Обзор', 'Все переводы', 'Требуют внимания', 'Проверка SEO', 'Обзор', 'Ревизии', 'Релизы', 'Пользователи', 'Журнал действий', 'Система']);
  });

  test('session cookie is HttpOnly, SameSite=Strict, host-only; no token in storage', async () => {
    const { page, context } = profiles.owner;
    const cookie = (await context.cookies(ORIGIN)).find((c) => c.name.endsWith('soltex_session'));
    assert.ok(cookie, 'session cookie');
    assert.equal(cookie.httpOnly, true);
    assert.equal(cookie.sameSite, 'Strict');
    assert.equal(cookie.path, '/');
    const visible = await page.evaluate(() => document.cookie);
    assert.ok(!visible.includes('soltex_session'));
    const storage = await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }));
    assert.ok(!storage.includes(cookie.value));
  });

  test('sign out and back in with the passkey', async () => {
    const { page } = profiles.owner;
    await page.getByRole('button', { name: 'Меню пользователя' }).click();
    await page.getByRole('menuitem', { name: 'Выйти' }).click();
    await page.waitForURL(`${ORIGIN}/login`);
    await page.getByText('Вы вышли из системы.').waitFor();
    await signInWithPassword(page, OWNER);
    await page.waitForURL(`${ORIGIN}/login/mfa`);
    await shot(page, '04-mfa-passkey');
    await page.getByRole('button', { name: 'Подтвердить ключом доступа' }).click();
    await page.waitForURL(`${ORIGIN}/`);
  });

  test('a protected address survives sign-in (return to the page asked for)', async () => {
    const { page, context } = profiles.owner;
    await context.clearCookies({ name: /soltex_session/ });
    await page.goto(`${ORIGIN}/admin/audit?action=auth.login`);
    await page.waitForURL(`${ORIGIN}/login`);
    await signInWithPassword(page, OWNER);
    await page.getByRole('button', { name: 'Подтвердить ключом доступа' }).click();
    await page.waitForURL(`${ORIGIN}/admin/audit?action=auth.login`);
    await page.getByRole('heading', { name: 'Журнал действий' }).waitFor();
  });

  test('Owner creates users only with roles allowed; a generated password is accepted', async () => {
    const { page } = profiles.owner;
    await page.goto(`${ORIGIN}/admin/users`);
    await page.getByRole('button', { name: 'Добавить пользователя' }).click();
    const dialog = page.getByRole('dialog', { name: 'Новый пользователь' });
    await dialog.waitFor();
    const options = await dialog.getByLabel('Роль', { exact: true }).locator('option').allTextContents();
    assert.deepEqual(options, ['Владелец', 'Администратор', 'Контент-менеджер', 'Редактор', 'SEO-специалист', 'Маркетолог']);
    const email = `e2e.created.${Date.now()}@soltex.test`;
    await dialog.getByLabel('Имя').fill('Новый Редактор');
    await dialog.getByLabel('E-mail').fill(email);
    await dialog.getByLabel('Роль', { exact: true }).selectOption({ label: 'Редактор' });
    await dialog.getByRole('button', { name: 'Сгенерировать' }).click();
    await shot(page, '05-create-user');
    await dialog.getByRole('button', { name: 'Создать' }).click();
    await page.getByText('Пользователь Новый Редактор создан').first().waitFor();
    await page.getByRole('cell', { name: new RegExp(email.replace(/\./g, '\\.')) }).waitFor();

    // Duplicate e-mail → message at the field.
    await page.getByRole('button', { name: 'Добавить пользователя' }).click();
    await dialog.getByLabel('Имя').fill('Дубликат');
    await dialog.getByLabel('E-mail').fill(email);
    await dialog.getByRole('button', { name: 'Сгенерировать' }).click();
    await dialog.getByRole('button', { name: 'Создать' }).click();
    await dialog.getByText('Пользователь с таким e-mail уже есть.').waitFor();
    await dialog.getByRole('button', { name: 'Отмена' }).click();
    await shot(page, '06-users');
  });

  test('step-up: after 10 minutes a sensitive action asks for the second factor, then runs', async () => {
    const { page } = profiles.owner;
    ageStepUp(OWNER.id);
    await page.goto(`${ORIGIN}/admin/users`);
    await page.getByRole('button', { name: `Действия: ${EDITOR.name}` }).click();
    await page.getByRole('menuitem', { name: 'Завершить все сеансы' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Завершить сеансы' }).click();
    const stepUp = page.getByRole('dialog', { name: 'Подтвердите действие' });
    await stepUp.waitFor();
    await shot(page, '07-step-up');
    await stepUp.getByRole('button', { name: 'Подтвердить ключом доступа' }).click();
    await page.getByText(`Пользователь ${EDITOR.name} выведен из всех сеансов`).first().waitFor();
    assert.equal(await stepUp.count(), 0);
  });

  test('step-up cancelled: nothing happens and no error is shown', async () => {
    const { page } = profiles.owner;
    ageStepUp(OWNER.id);
    await page.getByRole('button', { name: `Действия: ${EDITOR.name}` }).click();
    await page.getByRole('menuitem', { name: 'Завершить все сеансы' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Завершить сеансы' }).click();
    const stepUp = page.getByRole('dialog', { name: 'Подтвердите действие' });
    await stepUp.waitFor();
    await page.keyboard.press('Escape');
    await stepUp.waitFor({ state: 'detached' });
    // Re-confirm for the following tests.
    await page.getByRole('button', { name: `Действия: ${EDITOR.name}` }).click();
    await page.getByRole('menuitem', { name: 'Завершить все сеансы' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Завершить сеансы' }).click();
    await stepUp.getByRole('button', { name: 'Подтвердить ключом доступа' }).click();
    await page.getByText(`Пользователь ${EDITOR.name} выведен из всех сеансов`).first().waitFor();
  });

  test('Owner cannot change their own role or status; the dialog explains why', async () => {
    const { page } = profiles.owner;
    await page.getByRole('button', { name: `Действия: ${OWNER.name}` }).click();
    await page.getByRole('menuitem', { name: 'Изменить' }).click();
    const dialog = page.getByRole('dialog', { name: OWNER.name });
    await dialog.getByText('Свою роль и статус изменить нельзя').waitFor();
    assert.equal(await dialog.getByLabel('Роль', { exact: true }).isDisabled(), true);
    assert.equal(await dialog.getByLabel('Статус').isDisabled(), true);
    // «Дополнительно» holds the technical id for Owner/Admin.
    await dialog.getByRole('button', { name: 'Дополнительно' }).click();
    await dialog.getByText(OWNER.id).waitFor();
    await page.keyboard.press('Escape');
    // Own MFA cannot be reset from user management.
    await page.getByRole('button', { name: `Действия: ${OWNER.name}` }).click();
    assert.equal(await page.getByRole('menuitem', { name: 'Сбросить второй фактор' }).count(), 0);
    await page.keyboard.press('Escape');
  });

  test('Admin: passkey enrollment, and Owners are read-only for an Admin', async () => {
    profiles.admin = await profile();
    const { page } = profiles.admin;
    await signInWithPassword(page, ADMIN);
    await page.waitForURL(`${ORIGIN}/setup-mfa`);
    await page.getByRole('button', { name: 'Добавить ключ доступа' }).click();
    await saveRecoveryCodes(page, 'Перейти в админку');
    await page.waitForURL(`${ORIGIN}/`);
    await page.goto(`${ORIGIN}/admin/users`);
    await page.getByRole('button', { name: 'Добавить пользователя' }).click();
    const options = await page.getByRole('dialog', { name: 'Новый пользователь' }).getByLabel('Роль', { exact: true }).locator('option').allTextContents();
    assert.ok(!options.includes('Владелец'), 'Admin cannot create an Owner');
    // Close with the button (an Escape sent before the dialog has focus was occasionally lost).
    await page.getByRole('dialog', { name: 'Новый пользователь' }).getByRole('button', { name: 'Отмена' }).click();
    await page.getByRole('dialog', { name: 'Новый пользователь' }).waitFor({ state: 'detached' });
    await page.getByRole('button', { name: `Действия: ${OWNER.name}` }).click();
    assert.equal(await page.getByRole('menuitem', { name: 'Сбросить второй фактор' }).count(), 0);
    assert.equal(await page.getByRole('menuitem', { name: 'Завершить все сеансы' }).count(), 0);
    await page.getByRole('menuitem', { name: 'Изменить' }).click();
    const dialog = page.getByRole('dialog', { name: OWNER.name });
    await dialog.getByText('Учётные записи владельцев может менять только владелец.').waitFor();
    assert.equal(await dialog.getByLabel('Имя').isDisabled(), true);
    await page.keyboard.press('Escape');
  });

  test('Editor: no second factor required; content but no administration screens; direct address → «Недостаточно прав»', async () => {
    profiles.editor = await profile();
    const { page } = profiles.editor;
    await signInWithPassword(page, EDITOR);
    await page.waitForURL(`${ORIGIN}/`);
    await page.getByText('Второй фактор не настроен').waitFor();
    const links = await sidebar(page).getByRole('link').allTextContents();
    assert.deepEqual(links.map((s) => s.trim()), ['Обзор', 'Страницы', 'Проекты', 'Технологии', 'Продукты', 'EPC / EPCM', 'Патенты', 'Видео', 'Обзор', 'Все переводы', 'Требуют внимания', 'Проверка SEO', 'Обзор', 'Ревизии', 'Релизы']);
    await page.goto(`${ORIGIN}/admin/users`);
    await page.getByRole('heading', { name: 'Недостаточно прав' }).waitFor();
    await page.goto(`${ORIGIN}/admin/audit`);
    await page.getByRole('heading', { name: 'Недостаточно прав' }).waitFor();
    await page.goto(`${ORIGIN}/does-not-exist`);
    await page.getByRole('heading', { name: 'Страница не найдена' }).waitFor();
    const input = await openCommandPalette(page);
    await input.fill('польз');
    const options = await page.getByRole('listbox', { name: 'Результаты' }).getByRole('option').allTextContents();
    assert.ok(!options.some((o) => o.includes('Пользователи') || o.includes('Добавить пользователя')), `⌘K: ${options.join(' | ')}`);
    await page.keyboard.press('Escape');
    await shot(page, '08-editor');
  });

  test('Editor: a session ended elsewhere sends the user to sign-in with an explanation', async () => {
    const { page } = profiles.editor;
    const owner = profiles.owner.page;
    await owner.goto(`${ORIGIN}/admin/users`);
    await owner.getByRole('button', { name: `Действия: ${EDITOR.name}` }).click();
    await owner.getByRole('menuitem', { name: 'Завершить все сеансы' }).click();
    await owner.getByRole('alertdialog').getByRole('button', { name: 'Завершить сеансы' }).click();
    await owner.getByText(`Пользователь ${EDITOR.name} выведен из всех сеансов`).first().waitFor();
    // The next request of the open admin gets 401: the SPA returns to sign-in and says why.
    await page.getByRole('button', { name: 'Меню пользователя' }).click();
    await page.getByRole('menuitem', { name: 'Профиль и безопасность' }).click();
    await page.waitForURL(`${ORIGIN}/login`);
    await page.getByText('Сеанс завершён. Войдите снова.').waitFor();
    // Signing in again returns to the page that was open.
    await page.getByLabel('E-mail').fill(EDITOR.email);
    await page.getByLabel('Пароль', { exact: true }).fill(EDITOR.password);
    await page.getByRole('button', { name: 'Войти' }).click();
    await page.waitForURL(`${ORIGIN}/account`);
  });

  test('Marketer: authenticator-app enrollment, then sign-in with a recovery code', async () => {
    profiles.marketer = await profile();
    const { page } = profiles.marketer;
    await signInWithPassword(page, MARKETER);
    await page.waitForURL(`${ORIGIN}/setup-mfa`);
    await page.getByRole('radio', { name: /Приложение-аутентификатор/ }).click();
    await page.getByRole('button', { name: 'Подключить приложение' }).click();
    const secret = (await page.getByLabel('Ключ для ручного ввода').textContent()).replace(/\s/g, '');
    assert.match(secret, /^[A-Z2-7]{16,}$/);
    await page.getByRole('img', { name: 'QR-код для приложения-аутентификатора' }).waitFor();
    await shot(page, '09-totp-setup');
    await page.getByLabel('Код из приложения').fill('000000');
    await page.getByRole('button', { name: 'Подтвердить' }).click();
    await page.getByRole('alert').waitFor();
    await page.getByLabel('Код из приложения').fill(await totp(secret));
    await page.getByRole('button', { name: 'Подтвердить' }).click();
    const codes = await saveRecoveryCodes(page, 'Перейти в админку');
    await page.waitForURL(`${ORIGIN}/`);
    await page.getByRole('heading', { name: 'Обзор' }).waitFor();
    const links = await sidebar(page).getByRole('link').allTextContents();
    assert.deepEqual(links.map((s) => s.trim()), ['Обзор', 'Страницы', 'Проекты', 'Технологии', 'Продукты', 'EPC / EPCM', 'Патенты', 'Видео', 'Обзор', 'Все переводы', 'Требуют внимания', 'Проверка SEO', 'Обзор', 'Ревизии', 'Релизы']);

    await page.getByRole('button', { name: 'Меню пользователя' }).click();
    await page.getByRole('menuitem', { name: 'Выйти' }).click();
    await signInWithPassword(page, MARKETER);
    await page.waitForURL(`${ORIGIN}/login/mfa`);
    await page.getByRole('button', { name: /резервный код/ }).click();
    await page.getByLabel('Резервный код').fill(codes[0].toLowerCase());
    await page.getByRole('button', { name: 'Войти', exact: true }).click();
    await page.waitForURL(`${ORIGIN}/`);
    await page.getByText('9 из 10').waitFor();

    // The same code never works twice.
    await page.getByRole('button', { name: 'Меню пользователя' }).click();
    await page.getByRole('menuitem', { name: 'Выйти' }).click();
    await signInWithPassword(page, MARKETER);
    await page.waitForURL(`${ORIGIN}/login/mfa`);
    await page.getByRole('button', { name: /резервный код/ }).click();
    await page.getByLabel('Резервный код').fill(codes[0]);
    await page.getByRole('button', { name: 'Войти', exact: true }).click();
    await page.getByRole('alert').filter({ hasText: 'Неверный код' }).waitFor();
    // An authenticator code of the next step works.
    await page.getByRole('button', { name: 'Ввести код из приложения' }).click();
    await page.getByLabel('Код из приложения-аутентификатора').fill(await totp(secret, 30));
    await page.getByRole('button', { name: 'Войти', exact: true }).click();
    await page.waitForURL(`${ORIGIN}/`);
  });

  test('Content manager: TOTP enrollment; sees «Система» but not users or the audit log', async () => {
    profiles.cm = await profile();
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
    await page.getByRole('heading', { name: 'Обзор' }).waitFor();
    const links = await sidebar(page).getByRole('link').allTextContents();
    assert.deepEqual(links.map((s) => s.trim()), ['Обзор', 'Страницы', 'Проекты', 'Технологии', 'Продукты', 'EPC / EPCM', 'Патенты', 'Видео', 'Обзор', 'Все переводы', 'Требуют внимания', 'Проверка SEO', 'Обзор', 'Ревизии', 'Релизы', 'Система']);
    await page.goto(`${ORIGIN}/admin/system`);
    await page.getByText('Работает').waitFor();
    await shot(page, '10-system');
  });

  test('Content manager: password change keeps this session and ends the others', async () => {
    const { page } = profiles.cm;
    const second = await profile();
    profiles.cm2 = second;
    await signInWithPassword(second.page, CM);
    await second.page.waitForURL(`${ORIGIN}/login/mfa`);

    await page.goto(`${ORIGIN}/account`);
    const card = page.getByRole('region', { name: 'Пароль' });
    await card.getByLabel('Текущий пароль').fill(CM.password);
    await card.getByLabel('Новый пароль', { exact: true }).fill('short');
    await card.getByLabel('Повторите новый пароль').fill('short');
    await card.getByRole('button', { name: 'Сменить пароль' }).click();
    await card.getByText('Не меньше 12 символов.').waitFor();
    const next = `${CM.password}-New-2026`;
    await card.getByLabel('Новый пароль', { exact: true }).fill(next);
    await card.getByLabel('Повторите новый пароль').fill(next);
    await card.getByRole('button', { name: 'Сменить пароль' }).click();
    await page.getByText('Пароль изменён. Все другие сеансы завершены.').first().waitFor();
    await page.goto(`${ORIGIN}/`);
    await page.getByRole('heading', { name: 'Обзор' }).waitFor();
    CM.password = next;

    await second.page.reload();
    await second.page.waitForURL(`${ORIGIN}/login`);
  });

  test('Owner: the audit log shows the session in plain words; filter by action; details behind «Дополнительно»', async () => {
    const { page } = profiles.owner;
    await page.goto(`${ORIGIN}/admin/audit`);
    await page.getByRole('heading', { name: 'Журнал действий' }).waitFor();
    await page.getByRole('cell', { name: 'Смена пароля' }).first().waitFor();
    await page.getByRole('cell', { name: 'Добавлен ключ доступа' }).first().waitFor();
    // No raw action codes in the main table.
    const table = await page.getByRole('table', { name: 'Журнал действий' }).textContent();
    assert.ok(!/auth\.|mfa\.|user\./.test(table), 'no technical action names in the table');
    // This run's Owner has never changed the password (the test database keeps earlier runs).
    await page.getByLabel('Кто', { exact: true }).selectOption({ label: OWNER.name });
    await page.getByLabel('Действие', { exact: true }).selectOption({ label: 'Смена пароля' });
    await page.getByText('Нет записей по выбранным фильтрам.').waitFor();
    await page.getByLabel('Действие', { exact: true }).selectOption({ label: 'Вход в систему' });
    await page.getByRole('cell', { name: 'Вход в систему' }).first().waitFor();
    assert.equal(await page.getByRole('cell', { name: 'Смена пароля' }).count(), 0);
    await page.getByRole('button', { name: /^Подробнее/ }).first().click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: 'Дополнительно' }).click();
    await dialog.getByText('Код запроса').waitFor();
    await shot(page, '11-audit');
    await page.keyboard.press('Escape');
  });

  test('⌘K: keyboard navigation to a screen; no publishing commands', async () => {
    const { page } = profiles.owner;
    const input = await openCommandPalette(page);
    const all = await page.getByRole('listbox', { name: 'Результаты' }).getByRole('option').allTextContents();
    // Phase G: the «Публикация» screens are listed, but never publish / rollback / restore actions.
    assert.ok(all.some((o) => /Публикация: релизы/.test(o)));
    assert.ok(!all.some((o) => /Опубликовать|Откатить|Вернуть на сайт|Создать релиз|Восстановить/.test(o)));
    await input.fill('систем');
    await page.keyboard.press('Enter');
    await page.waitForURL(`${ORIGIN}/admin/system`);
  });

  test('unsaved changes: leaving the profile form asks first', async () => {
    const { page } = profiles.owner;
    await page.goto(`${ORIGIN}/account`);
    await page.getByLabel('Имя', { exact: true }).fill(`${OWNER.name} (изменено)`);
    await sidebar(page).getByRole('link', { name: 'Пользователи' }).click();
    // The admin's own dialog (not the browser's confirm()).
    const dialog = page.getByRole('alertdialog', { name: 'Уйти без сохранения?' });
    await dialog.waitFor();
    await dialog.getByRole('button', { name: 'Отмена' }).click();
    await dialog.waitFor({ state: 'detached' });
    assert.equal(new URL(page.url()).pathname, '/account');
    await page.getByLabel('Имя', { exact: true }).fill(OWNER.name);
  });

  test('narrow screen: the menu opens as a drawer and navigates', async () => {
    const p = await profile({ width: 390, height: 844 });
    profiles.mobile = p;
    await signInWithPassword(p.page, EDITOR);
    await p.page.waitForURL(`${ORIGIN}/`);
    await p.page.getByRole('button', { name: 'Открыть меню' }).click();
    const drawer = p.page.getByRole('dialog', { name: 'Меню' });
    await drawer.waitFor();
    await shot(p.page, '12-mobile-menu');
    await drawer.getByRole('link', { name: 'Обзор' }).first().waitFor();
    await p.page.keyboard.press('Escape');
    await drawer.waitFor({ state: 'detached' });
  });

  test('forgot password: the same answer for any address; a reset link without a token is refused', async () => {
    const p = profiles.mobile;
    await p.context.clearCookies();
    await p.page.goto(`${ORIGIN}/forgot-password`);
    await p.page.getByLabel('E-mail').fill('nobody.at.all@soltex.test');
    await p.page.getByRole('button', { name: 'Отправить ссылку' }).click();
    await p.page.getByText('Если такая учётная запись существует').waitFor();
    await p.page.goto(`${ORIGIN}/reset-password`);
    await p.page.getByRole('heading', { name: 'Ссылка недействительна' }).waitFor();
    await p.page.goto('about:blank');
    await p.page.goto(`${ORIGIN}/reset-password#token=${'a'.repeat(43)}`);
    await p.page.getByLabel('Новый пароль', { exact: true }).fill('Some-Long-Passphrase-2026');
    await p.page.getByLabel('Повторите пароль').fill('Some-Long-Passphrase-2026');
    await p.page.getByRole('button', { name: 'Сменить пароль' }).click();
    await p.page.getByRole('alert').waitFor();
  });

  test('no page errors, no CSP violations, nothing unexpected in the console', () => {
    assert.deepEqual(allProblems(), []);
  });
});
