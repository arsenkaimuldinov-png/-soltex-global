/**
 * Content management (Phase E), end to end against the real API + PostgreSQL in Chromium.
 * Uses its own users (second and third editor, an SEO specialist, a second admin), so the session
 * revocations of admin.e2e.mjs never interfere.
 */
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { closeBrowser, ORIGIN, profile, saveRecoveryCodes, shot, sidebar, signInWithPassword, totp, user } from './harness.mjs';

const EDITOR_A = user('editor', 1);
const EDITOR_B = user('editor', 2);
const SEO = user('seo_specialist');
const ADMIN = user('admin', 1);
const TITLE = `E2E Pilot Plant ${Date.now().toString(36)}`;

const profiles = {};
const allProblems = () => Object.entries(profiles).flatMap(([k, p]) => p.problems.map((x) => `${k}: ${x}`));

async function signIn(p, u) {
  await signInWithPassword(p.page, u);
  await p.page.waitForURL(`${ORIGIN}/`);
  await p.page.getByRole('heading', { name: 'Обзор' }).waitFor();
}

/** Open a project from the list by searching its title. */
async function openProject(page, title) {
  await page.goto(`${ORIGIN}/content/projects`);
  await page.getByPlaceholder('Поиск по названию или адресу').fill(title);
  await page.getByRole('link', { name: new RegExp(title) }).click();
  await page.getByRole('heading', { name: title }).waitFor();
}

describe('content management (Phase E)', () => {
  before(async () => {
    profiles.a = await profile();
    profiles.b = await profile();
  });
  after(async () => {
    for (const p of Object.values(profiles)) await p.close();
    await closeBrowser();
  });

  test('1–2. sign in; «Контент» in the sidebar; the projects list is a table with search, filters and paging', async () => {
    const { page } = profiles.a;
    await signIn(profiles.a, EDITOR_A);
    const links = (await sidebar(page).getByRole('link').allTextContents()).map((s) => s.trim());
    assert.deepEqual(links, ['Обзор', 'Страницы', 'Проекты', 'Технологии', 'Продукты', 'EPC / EPCM', 'Патенты', 'Видео', 'Обзор', 'Все переводы', 'Требуют внимания', 'Обзор', 'Ревизии', 'Релизы']);
    await sidebar(page).getByRole('link', { name: 'Проекты' }).click();
    await page.getByRole('heading', { name: 'Проекты' }).waitFor();
    const table = page.getByRole('table', { name: 'Проекты' });
    await table.waitFor();
    assert.ok((await table.getByRole('row').count()) >= 9, 'header + 8 seed projects');
    assert.ok(!(await table.textContent()).match(/[0-9a-f]{8}-[0-9a-f]{4}-/), 'no technical ids in the table');
    await page.getByPlaceholder('Поиск по названию или адресу').fill('ningbo');
    await page.waitForURL(/q=ningbo/);
    await table.getByRole('link', { name: /NINGBO/ }).waitFor();
    await table.getByRole('link', { name: /ISRAEL/ }).waitFor({ state: 'detached' });
    assert.equal(await table.getByRole('row').count(), 2);
    await page.getByLabel('Статус').selectOption({ label: 'Черновик' });
    await page.waitForURL(/status=draft/);
    await shot(page, 'c01-projects-list');
  });

  test('3. create a draft: title, image from the media library, technology', async () => {
    const { page } = profiles.a;
    await page.goto(`${ORIGIN}/content/projects`);
    await page.getByRole('button', { name: 'Создать проект' }).click();
    const dialog = page.getByRole('dialog', { name: 'Новый проект' });
    await dialog.getByLabel('Название', { exact: true }).fill(TITLE);
    // An Editor has no SEO right: no slug field, the address is proposed from the title.
    assert.equal(await dialog.getByLabel('Адрес страницы (slug)').count(), 0);
    await dialog.getByRole('button', { name: 'Основное изображение: выбрать' }).click();
    const picker = page.getByRole('dialog', { name: 'Выберите изображение' });
    await picker.getByRole('list', { name: 'Файлы' }).getByRole('button').first().click();
    await dialog.getByLabel('Технология').selectOption({ index: 1 });
    await shot(page, 'c02-create');
    await dialog.getByRole('button', { name: 'Создать черновик' }).click();
    await page.getByRole('heading', { name: TITLE }).waitFor();
    await page.getByText('Черновик', { exact: true }).first().waitFor();
    assert.match(page.url(), /\/content\/projects\/[0-9a-f-]{36}$/);
  });

  test('4–6. open the draft from the list, change typed fields, save; the values persist', async () => {
    const { page } = profiles.a;
    await openProject(page, TITLE);
    await page.getByLabel('Страна / регион').fill('Kazakhstan');
    await page.getByLabel('Обзор', { exact: true }).fill('A pilot line for apple pectin.');
    await page.getByRole('button', { name: 'Добавить: пункт' }).click();
    await page.getByLabel('Пункт 1', { exact: true }).fill('Basic engineering');
    await page.getByRole('button', { name: 'Добавить: характеристика' }).click();
    await page.getByLabel('Характеристика 1: название').fill('Capacity');
    await page.getByLabel('Характеристика 1: значение').fill('2 t/day');
    await page.getByText('Есть несохранённые изменения').waitFor();
    await page.keyboard.press('Control+s');
    await page.getByText('Сохранено', { exact: true }).first().waitFor();
    await page.getByText(/^Сохранено \d/).waitFor();
    await shot(page, 'c03-editor-saved');
    await page.reload();
    await page.getByRole('heading', { name: TITLE }).waitFor();
    assert.equal(await page.getByLabel('Страна / регион').inputValue(), 'Kazakhstan');
    assert.equal(await page.getByLabel('Пункт 1', { exact: true }).inputValue(), 'Basic engineering');
    assert.equal(await page.getByLabel('Характеристика 1: значение').inputValue(), '2 t/day');
    // The SEO fields are read-only for an Editor (the API refuses them too, see the API tests).
    assert.equal(await page.getByLabel('Адрес страницы (slug)').isDisabled(), true);
    assert.equal(await page.getByLabel('SEO-заголовок (title)').isDisabled(), true);
    await page.getByText('Эти поля меняют роли с правом на SEO').waitFor();
  });

  test('unsaved changes: leaving the editor asks first (admin dialog)', async () => {
    const { page } = profiles.a;
    await page.getByLabel('Годы').fill('2026');
    await sidebar(page).getByRole('link', { name: 'Технологии' }).click();
    const dialog = page.getByRole('alertdialog', { name: 'Уйти без сохранения?' });
    await dialog.waitFor();
    await dialog.getByRole('button', { name: 'Отмена' }).click();
    assert.match(page.url(), /\/content\/projects\//);
    await page.getByRole('button', { name: 'Отменить изменения' }).click();
    assert.equal(await page.getByLabel('Годы').inputValue(), '');
  });

  test('10. optimistic locking: B saves first, A gets the conflict message and nothing is overwritten', async () => {
    const a = profiles.a.page;
    await signIn(profiles.b, EDITOR_B);
    const b = profiles.b.page;
    await openProject(b, TITLE);
    // A edits the version both opened…
    await a.getByLabel('Тип проекта').fill('Pilot line (A)');
    // …B saves first.
    await b.getByLabel('Тип проекта').fill('Pilot line (B)');
    await b.getByRole('button', { name: 'Сохранить' }).click();
    await b.getByText(/^Сохранено \d/).waitFor();
    await a.getByRole('button', { name: 'Сохранить' }).click();
    await a.getByText('Запись была изменена другим пользователем. Обновите страницу перед сохранением.').waitFor();
    await shot(a, 'c04-conflict');
    await a.getByRole('button', { name: 'Обновить' }).click();
    await a.getByText(/^Сохранено \d/).waitFor();
    assert.equal(await a.getByLabel('Тип проекта').inputValue(), 'Pilot line (B)', 'B’s change is kept');
  });

  test('8–9. SEO specialist: content fields read-only, SEO saves; a taken address is refused in Russian', async () => {
    const p = await profile();
    profiles.seo = p;
    await signInWithPassword(p.page, SEO);
    await p.page.waitForURL(`${ORIGIN}/setup-mfa`);
    await p.page.getByRole('radio', { name: /Приложение-аутентификатор/ }).click();
    await p.page.getByRole('button', { name: 'Подключить приложение' }).click();
    const secret = (await p.page.getByLabel('Ключ для ручного ввода').textContent()).replace(/\s/g, '');
    await p.page.getByLabel('Код из приложения').fill(await totp(secret));
    await p.page.getByRole('button', { name: 'Подтвердить' }).click();
    await saveRecoveryCodes(p.page, 'Перейти в админку');
    await p.page.waitForURL(`${ORIGIN}/`);
    const page = p.page;
    await page.goto(`${ORIGIN}/content/projects`);
    assert.equal(await page.getByRole('button', { name: 'Создать проект' }).count(), 0, 'no create without content.edit');
    await openProject(page, TITLE);
    assert.equal(await page.getByLabel('Название', { exact: true }).isDisabled(), true);
    await page.getByText('Эти поля меняют роли с правом на редактирование контента.').first().waitFor();
    await page.getByLabel('Адрес страницы (slug)').fill('solbar-israel');
    await page.getByRole('button', { name: 'Сохранить' }).click();
    await page.getByText('Такой адрес уже занят другой записью.').waitFor();
    await shot(page, 'c05-slug-taken');
    const slug = `e2e-pilot-${Date.now().toString(36)}`;
    await page.getByLabel('Адрес страницы (slug)').fill(slug);
    await page.getByLabel('SEO-заголовок (title)').fill('Pilot pectin line | Soltex Global');
    await page.getByRole('button', { name: 'Сохранить' }).click();
    await page.getByText(/^Сохранено \d/).waitFor();
    await page.getByText(`/projects/${slug}`).waitFor();
  });

  test('8. permission denial: no administration screens for content roles', async () => {
    const page = profiles.a.page;
    await page.goto(`${ORIGIN}/admin/audit`);
    await page.getByRole('heading', { name: 'Недостаточно прав' }).waitFor();
  });

  test('11. archive: a confirmation states the consequences; archived drafts are read-only and can be restored', async () => {
    const page = profiles.a.page;
    await openProject(page, TITLE);
    await page.getByRole('button', { name: 'В архив' }).click();
    const dialog = page.getByRole('alertdialog', { name: `Перенести «${TITLE}» в архив?` });
    await dialog.getByText('На сайт это не влияет').waitFor();
    await shot(page, 'c06-archive-confirm');
    await dialog.getByRole('button', { name: 'Перенести в архив' }).click();
    await page.getByText('В архиве', { exact: true }).first().waitFor();
    assert.equal(await page.getByLabel('Название', { exact: true }).isDisabled(), true);
    await page.getByRole('button', { name: 'Вернуть в черновики' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Вернуть в черновики' }).click();
    await page.getByText('Запись возвращена в черновики').first().waitFor();
    assert.equal(await page.getByLabel('Название', { exact: true }).isDisabled(), false);
    // Published records cannot be archived here (unpublishing is the publishing system, Phase G).
    await openProject(page, 'SOLBAR ISRAEL');
    assert.equal(await page.getByRole('button', { name: 'В архив' }).count(), 0);
    await page.getByText('Запись отмечена к публикации.').waitFor();
  });

  test('pages: fixed slots from the registry; placeholders guarded; header text saved', async () => {
    const page = profiles.a.page;
    await sidebar(page).getByRole('link', { name: 'Страницы' }).click();
    await page.getByRole('link', { name: /Шаблон страницы проекта/ }).click();
    await page.getByRole('heading', { name: 'Шаблон страницы проекта' }).waitFor();
    const cta = page.getByLabel('Призыв к действию · заголовок');
    const original = await cta.inputValue();
    assert.match(original, /\{title\}/);
    await cta.fill('Inquire about this plant');
    await page.getByRole('button', { name: 'Сохранить' }).click();
    await page.getByText(/Сохраните подстановки \{title\}/).first().waitFor();
    await cta.fill(original);
    await sidebar(page).getByRole('link', { name: 'Страницы' }).click();
    await page.getByRole('link', { name: /О компании/ }).click();
    await page.getByRole('heading', { name: 'О компании' }).waitFor();
    const h1 = page.getByLabel('Заголовок (H1)');
    const before = await h1.inputValue();
    await h1.fill(`${before} `);
    await h1.fill(before.replace(/\s+$/, '') + '.');
    await page.getByRole('button', { name: 'Сохранить' }).click();
    await page.getByText(/^Сохранено \d/).waitFor();
    await shot(page, 'c07-page-editor');
    await h1.fill(before);
    await page.getByRole('button', { name: 'Сохранить' }).click();
    await page.getByText(/^Сохранено \d/).waitFor();
  });

  test('7. the audit log shows the content changes in plain words', async () => {
    const p = await profile();
    profiles.admin = p;
    await signInWithPassword(p.page, ADMIN);
    await p.page.waitForURL(`${ORIGIN}/setup-mfa`);
    await p.page.getByRole('button', { name: 'Добавить ключ доступа' }).click();
    await saveRecoveryCodes(p.page, 'Перейти в админку');
    await p.page.waitForURL(`${ORIGIN}/`);
    const page = p.page;
    await page.goto(`${ORIGIN}/admin/audit`);
    await page.getByLabel('Кто', { exact: true }).selectOption({ label: EDITOR_A.name });
    await page.getByLabel('Действие', { exact: true }).selectOption({ label: 'Изменён материал' });
    await page.getByRole('cell', { name: /проект · изменено полей/ }).first().waitFor();
    await page.getByLabel('Действие', { exact: true }).selectOption({ label: 'Материал перенесён в архив' });
    await page.getByRole('cell', { name: 'проект · в архиве' }).first().waitFor();
    await page.getByLabel('Кто', { exact: true }).selectOption({ label: SEO.name });
    await page.getByLabel('Действие', { exact: true }).selectOption({ label: 'Изменён материал' });
    await page.getByRole('cell', { name: /проект · изменено полей/ }).first().waitFor();
    await shot(page, 'c08-audit');
  });

  test('12. mobile: list and editor work on a phone', async () => {
    const p = await profile({ width: 390, height: 844 });
    profiles.mobile = p;
    await signIn(p, EDITOR_B);
    const page = p.page;
    await page.getByRole('button', { name: 'Открыть меню' }).click();
    await page.getByRole('dialog', { name: 'Меню' }).getByRole('link', { name: 'Проекты' }).click();
    await page.getByRole('heading', { name: 'Проекты' }).waitFor();
    await shot(page, 'c09-mobile-list');
    await openProject(page, TITLE);
    await page.getByLabel('Годы').fill('2026–2027');
    await page.getByRole('button', { name: 'Сохранить' }).click();
    await page.getByText(/^Сохранено \d/).waitFor();
    await shot(page, 'c10-mobile-editor');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert.ok(overflow <= 1, `no horizontal page scroll (${overflow}px)`);
  });

  test('no page errors, no CSP violations', () => {
    assert.deepEqual(allProblems(), []);
  });
});
