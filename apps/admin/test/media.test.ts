/**
 * Media library in the admin (Phase J-1): sizes, the early check before an upload, usages in words
 * with editor links, and Russian texts for every refusal.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { ACCEPT, describeUsage, formatBytes, MEDIA_ERRORS, precheckFile, previewSrc, WARNING_LABELS } from '../src/features/media/model';

test('sizes in Russian units', () => {
  assert.equal(formatBytes(null), '—');
  assert.equal(formatBytes(512), '512 Б');
  assert.equal(formatBytes(3 * 1024 + 300), '3,3 КБ');
  assert.equal(formatBytes(276918), '270 КБ');
  assert.equal(formatBytes(77 * 1024 * 1024), '77,0 МБ');
});

test('early check: type by extension, SVG refused with the reason, limits per kind', () => {
  assert.equal(precheckFile({ name: 'Фото.JPG', size: 1000 }), null);
  assert.equal(precheckFile({ name: 'plant.jpeg', size: 1000 }), null);
  assert.equal(precheckFile({ name: 'clip.mp4', size: 150 * 1024 * 1024 }), null);
  assert.match(precheckFile({ name: 'logo.svg', size: 10 })!, /SVG/);
  assert.match(precheckFile({ name: 'doc.pdf', size: 10 })!, /не поддерживается/);
  assert.match(precheckFile({ name: 'big.png', size: 21 * 1024 * 1024 })!, /20 МБ/);
  assert.match(precheckFile({ name: 'big.mp4', size: 201 * 1024 * 1024 })!, /200 МБ/);
  assert.match(precheckFile({ name: 'e.png', size: 0 })!, /пустой/);
  assert.ok(ACCEPT.includes('image/webp') && ACCEPT.includes('.mp4') && !ACCEPT.includes('svg'));
});

test('usages in words, with links to the editors; texts for refusals and warnings', () => {
  assert.deepEqual(describeUsage({ type: 'projects', id: 'p1', key: 'project-x', title: 'SOLBAR ISRAEL', status: 'published', field: 'image' }), {
    section: 'Проекты',
    title: 'SOLBAR ISRAEL',
    field: 'основное изображение',
    to: '/content/projects/p1',
  });
  const page = describeUsage({ type: 'pages', id: 'g1', key: 'page-home', title: 'x', status: 'published', field: 'heroImage' });
  assert.deepEqual([page.section, page.field, page.to], ['Страница', 'первый экран', '/content/pages/g1']);
  assert.notEqual(page.title, 'page-home');
  assert.equal(describeUsage({ type: 'settings', id: null, key: 'settings', title: 'Общие настройки', status: null, field: 'footerBackground' }).to, null);
  assert.equal(describeUsage({ type: 'pages', id: 'g1', key: 'page-company', title: 'x', status: null, field: 'epcmImage' }).field, 'изображение блока');
  for (const k of ['media_type_rejected', 'media_invalid', 'media_duplicate', 'payload_too_large', 'kind_mismatch', 'unchanged']) assert.ok(/[а-я]/.test(MEDIA_ERRORS[k] ?? ''), k);
  for (const w of ['large_file', 'hero_too_narrow']) assert.ok(WARNING_LABELS[w]);
  assert.equal(previewSrc({ id: 'abc', version: 3 }, 1200), '/api/v1/media/abc/preview?w=1200&v=3');
});
