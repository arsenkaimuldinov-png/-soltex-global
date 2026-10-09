/**
 * Publishing in the admin (Phase G): labels for every state, kind and event, validation codes in
 * plain words, revision paths in Russian, build steps. Pure functions; the API decides everything.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { RELEASE_STATUSES, REVISION_KINDS } from '@soltex/core/domain';
import {
  BUILD_STEPS,
  describeValidation,
  IN_PROGRESS,
  pathLabel,
  PREVIEW_PERMISSIONS,
  PUBLISHING_PERMISSIONS,
  RELEASE_STATUS_LABELS,
  RELEASE_STATUS_TONES,
  REVISION_KIND_LABELS,
  showValue,
  stepIndex,
  editorPath,
  historyPath,
} from '../src/features/publishing/model';
import { revisionLine } from '../src/features/publishing/HistoryPanel';

test('every release status and revision kind has a Russian label', () => {
  for (const s of RELEASE_STATUSES) {
    assert.ok(RELEASE_STATUS_LABELS[s], s);
    assert.ok(RELEASE_STATUS_TONES[s], s);
  }
  for (const k of REVISION_KINDS) assert.ok(REVISION_KIND_LABELS[k], k);
  assert.deepEqual([...IN_PROGRESS], ['queued', 'building', 'validating']);
});

test('build steps: progress index per status', () => {
  assert.equal(BUILD_STEPS.length, 4);
  assert.equal(stepIndex('queued'), 0);
  assert.equal(stepIndex('validating'), 2);
  assert.equal(stepIndex('ready'), 3);
  assert.equal(stepIndex('active'), 4);
  assert.equal(stepIndex('failed'), -1);
});

test('validation codes in plain words; unknown codes stay visible', () => {
  assert.match(describeValidation('translation_outdated:ru:3'), /^RU: переводов устарело — 3\. .*ранее утверждённый/);
  assert.match(describeValidation('translation_fallback:zh:2'), /английский/);
  assert.equal(describeValidation('missing_file:sitemap.xml'), 'В сборке нет обязательного файла sitemap.xml.');
  assert.match(describeValidation('missing_page:/ru/projects/x/'), /\/ru\/projects\/x\//);
  assert.match(describeValidation('secret_like:assets/a.js'), /Публикация запрещена/);
  assert.equal(describeValidation('page_count:180→170'), 'Число страниц изменилось: было 180, стало 170.');
  assert.equal(describeValidation('something_new'), 'something_new');
});

test('revision paths in Russian, values shown plainly', () => {
  assert.equal(pathLabel('projects', 'seo.metaTitle'), 'SEO-заголовок');
  assert.equal(pathLabel('projects', 'slug'), 'Адрес страницы');
  assert.match(pathLabel('pages', 'header.title'), /Шапка/);
  assert.equal(showValue(null), '—');
  assert.equal(showValue(true), 'да');
  assert.equal(showValue(3), '3');
});

test('revision lines and paths', () => {
  assert.equal(revisionLine({ kind: 'restore', locale: null, restoredFrom: 4 }), 'Восстановлено из версии 4');
  assert.equal(revisionLine({ kind: 'translation', locale: 'ar', restoredFrom: null }), 'Изменён перевод · AR');
  assert.equal(revisionLine({ kind: 'update', locale: null, restoredFrom: null }), 'Изменено');
  assert.equal(editorPath('projects', 'x'), '/content/projects/x');
  assert.equal(historyPath('pages', 'y'), '/publishing/revisions/pages/y');
});

test('publishing permissions match the role matrix used by the API', () => {
  assert.equal(PUBLISHING_PERMISSIONS.activate, 'content.publish');
  assert.equal(PUBLISHING_PERMISSIONS.rollback, 'system.rollback');
  assert.equal(PUBLISHING_PERMISSIONS.retry, 'system.deploy');
  assert.deepEqual([...PREVIEW_PERMISSIONS], ['content.edit', 'seo.edit', 'content.publish']);
});
