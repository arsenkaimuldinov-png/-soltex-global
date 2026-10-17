/**
 * Media library (Phase J-1), end to end against the real API + PostgreSQL in Chromium: «Медиатека»
 * (legacy files with previews, filters, upload with refusals and duplicates), upload from the picker
 * in an editor, «Где используется», «Заменить файл», and role limits.
 * Own users: a sixth editor and a sixth content manager.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, test } from 'node:test';
import sharp from 'sharp';
import { closeBrowser, ORIGIN, profile, saveRecoveryCodes, shot, sidebar, signInWithPassword, totp, user } from './harness.mjs';

const EDITOR = user('editor', 5);
const CM = user('content_manager', 5);
const RUN = Date.now();
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'soltex-e2e-files-'));

/** A unique image per run (duplicates are refused by content). */
async function image(name, width, height, seed) {
  const file = path.join(dir, name);
  await sharp({ create: { width, height, channels: 3, background: { r: (RUN + seed) % 256, g: 90 + (seed % 100), b: 60 } } })
    .composite([{ input: Buffer.from(`<svg width="${width}" height="${height}"><text x="20" y="60" font-size="48" fill="white">${RUN} ${seed}</text></svg>`), top: 0, left: 0 }])
    .jpeg()
    .toFile(file);
  return file;
}

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

describe('Media library (Phase J-1)', () => {
  let photo, second, replacement;
  let originalImage = '';
  before(async () => {
    profiles.editor = await profile({ ip: '198.51.100.31' });
    profiles.cm = await profile({ ip: '198.51.100.32' });
    photo = await image(`plant-${RUN}.jpg`, 1800, 1000, 1);
    second = await image(`picker-${RUN}.jpg`, 1200, 800, 2);
    replacement = await image(`replacement-${RUN}.jpg`, 2000, 1100, 3);
    fs.writeFileSync(path.join(dir, 'logo.svg'), '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
  });
  after(async () => {
    for (const p of Object.values(profiles)) await p.close();
    await closeBrowser();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  test('«Медиатека»: files of the site with previews; filters in the address', async () => {
    const { page } = profiles.editor;
    await signInWithPassword(page, EDITOR);
    await page.waitForURL(`${ORIGIN}/`);
    await sidebar(page).getByRole('link', { name: 'Медиатека' }).click();
    await page.getByRole('heading', { name: 'Медиатека', level: 1 }).waitFor();
    const grid = page.getByRole('list', { name: 'Файлы медиатеки' });
    await grid.getByRole('listitem').first().waitFor();
    assert.ok((await grid.getByRole('listitem').count()) >= 24);
    const firstImg = grid.locator('img').first();
    await page.waitForFunction((el) => el.complete && el.naturalWidth > 0, await firstImg.elementHandle());
    await page.getByLabel('Вид').selectOption('video');
    await page.waitForURL(/kind=video/);
    await page.waitForFunction(() => document.querySelectorAll('[aria-label="Файлы медиатеки"] > li').length === 2);
    await page.getByLabel('Вид').selectOption('');
    await shot(page, 'm01-library');
  });

  test('upload: a JPEG, the same file again, an SVG — each with its own result', async () => {
    const { page } = profiles.editor;
    await page.getByLabel('Файлы для загрузки').setInputFiles([photo, path.join(dir, 'logo.svg')]);
    const list = page.getByRole('list', { name: 'Загрузка файлов' });
    await list.locator('[data-upload-item="done"]').waitFor();
    await list.getByText(/SVG не загружается/).waitFor();
    await page.getByLabel('Файлы для загрузки').setInputFiles(photo);
    await list.getByText(/Такой файл уже есть в медиатеке/).waitFor();
    await list.getByRole('link', { name: 'Открыть существующий' }).click();
    await page.getByRole('heading', { name: `plant-${RUN}.jpg`, level: 1 }).waitFor();
    await page.getByText('Нигде не используется.').waitFor();
    await page.getByText('1800 × 1000 px').waitFor();
    await page.waitForFunction((el) => el.complete && el.naturalWidth > 0, await page.locator('[data-media-preview]').elementHandle());
    assert.equal(await page.getByRole('button', { name: 'Заменить файл' }).count(), 0, 'an editor cannot replace');
    assert.equal(await page.getByRole('button', { name: 'Удалить' }).count(), 0, 'an editor cannot delete');
    await shot(page, 'm02-detail');
  });

  test('picker in the editor: upload a new image there, it is picked; the file shows where it is used', async () => {
    const { page } = profiles.editor;
    await page.goto(`${ORIGIN}/content/projects?q=nebraska`);
    await page.getByRole('table', { name: 'Проекты' }).getByRole('link', { name: /NEBRASKA/ }).click();
    originalImage = (await page.locator('[data-field="image"] span.font-medium').first().textContent()).trim();
    assert.ok(originalImage, 'the project has an image');
    await page.getByRole('button', { name: 'Основное изображение: выбрать' }).click();
    const dialog = page.getByRole('dialog', { name: 'Выберите изображение' });
    await dialog.locator('img').first().waitFor();
    await dialog.getByLabel('Файлы для загрузки').setInputFiles(second);
    await dialog.waitFor({ state: 'detached' });
    await page.locator('[data-field="image"]').getByText(`picker-${RUN}.jpg`).waitFor();
    await page.getByRole('button', { name: 'Сохранить' }).click();
    await page.getByText(/^Сохранено \d/).waitFor();

    await page.goto(`${ORIGIN}/media?q=picker-${RUN}`);
    await page.getByRole('list', { name: 'Файлы медиатеки' }).getByText('Используется: 1').waitFor();
    await page.getByRole('list', { name: 'Файлы медиатеки' }).getByRole('link').first().click();
    const usages = page.getByRole('list', { name: 'Где используется' });
    await usages.getByRole('link', { name: /NEBRASKA/ }).waitFor();
    await usages.getByText('Проекты · основное изображение').waitFor();
    await shot(page, 'm03-usages');
  });

  test('content manager replaces the file: same id, new dimensions; delete is not offered', async () => {
    const { page } = profiles.cm;
    await signInWithNewTotp(profiles.cm, CM);
    await page.goto(`${ORIGIN}/media?q=picker-${RUN}`);
    await page.getByRole('list', { name: 'Файлы медиатеки' }).getByRole('link').first().click();
    await page.getByText('1200 × 800 px').waitFor();
    const url = page.url();
    await page.getByLabel('Новый файл для замены').setInputFiles(replacement);
    await page.getByText('Файл заменён').first().waitFor();
    await page.getByText('2000 × 1100 px').waitFor();
    await page.getByRole('heading', { name: `replacement-${RUN}.jpg`, level: 1 }).waitFor();
    assert.equal(page.url(), url, 'the same media id');
    await page.getByRole('list', { name: 'Где используется' }).getByRole('link', { name: /NEBRASKA/ }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Удалить' }).count(), 0, 'a content manager cannot delete');
    await shot(page, 'm04-replaced');
  });

  test('put the project back as the seed has it', async () => {
    const { page } = profiles.cm;
    await page.goto(`${ORIGIN}/content/projects?q=nebraska`);
    await page.getByRole('table', { name: 'Проекты' }).getByRole('link', { name: /NEBRASKA/ }).click();
    await page.getByRole('button', { name: 'Основное изображение: выбрать' }).click();
    const dialog = page.getByRole('dialog', { name: 'Выберите изображение' });
    await dialog.getByRole('searchbox').fill(originalImage);
    await dialog.getByRole('list', { name: 'Файлы' }).getByRole('button').filter({ hasText: originalImage }).first().click();
    await page.locator('[data-field="image"]').getByText(originalImage).waitFor();
    await page.getByRole('button', { name: 'Сохранить' }).click();
    await page.getByText(/^Сохранено \d/).waitFor();
  });

  test('mobile: the library fits a 390 px screen', async () => {
    const { page } = profiles.cm;
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${ORIGIN}/media`);
    await page.getByRole('list', { name: 'Файлы медиатеки' }).waitFor();
    await page.waitForLoadState('networkidle');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert.ok(overflow <= 0, `horizontal overflow ${overflow}px`);
    await shot(page, 'm05-mobile');
  });

  test('no page errors and no CSP violations', () => {
    assert.deepEqual(allProblems(), []);
  });
});
