/**
 * «Обзор» and ⌘K search (Phase L): every number links to the list it counts, with that list's
 * filter; search results open the record; sizes and durations in Russian.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { contentMetrics, diskLow, formatBytes, formatDuration, hitHint, hitPath, leadMetrics, mediaMetrics, seoMetrics, translationMetrics } from '../src/features/overview/model';

test('dashboard numbers link to filtered lists', () => {
  assert.deepEqual(
    leadMetrics({ byStatus: { new: 3, in_progress: 1 }, notifyFailed: 2, formsLive: true }).map((m) => [m.label, m.value, m.to]),
    [
      ['Новые', 3, '/leads?status=new'],
      ['В работе', 1, '/leads?status=in_progress'],
      ['Уведомление не отправлено', 2, '/leads'],
    ]
  );
  assert.deepEqual(seoMetrics({ blocking: 0, warning: 5, info: 9 }).map((m) => m.to), ['/seo?severity=blocking', '/seo?severity=warning']);
  const ru = translationMetrics({ locales: [{ locale: 'ru', total: 40, missing: 4, inProgress: 0, outdated: 2, completion: 85 }] })[0]!;
  assert.equal(ru.name, 'Русский');
  assert.deepEqual(ru.metrics.map((m) => m.to), ['/translations/all?locale=ru&state=missing', '/translations/all?locale=ru&state=outdated']);
  assert.deepEqual(
    contentMetrics({ drafts: [{ type: 'projects', count: 2 }], pending: 1, recent: [] }).map((m) => [m.label, m.to]),
    [
      ['Не опубликованы изменения', '/publishing'],
      ['Черновики: проекты', '/content/projects?status=draft'],
    ]
  );
  assert.equal(mediaMetrics({ total: 10, attention: 1, pendingCopies: 0 })[0]!.to, '/media?attention=true');
});

test('search results open the record and say what they are', () => {
  const id = '01a1478f-8ea8-7160-9980-8a555c190389';
  assert.equal(hitPath({ kind: 'content', type: 'projects', id, title: 'X', status: 'draft', match: null }), `/content/projects/${id}`);
  assert.equal(hitPath({ kind: 'content', type: 'pages', id, title: 'X', status: 'published', match: null }), `/content/pages/${id}`);
  assert.equal(hitPath({ kind: 'media', id, title: 'a.jpg', mediaKind: 'image' }), `/media/${id}`);
  assert.equal(hitPath({ kind: 'lead', id, title: 'SOL-2026-000001', status: 'new' }), `/leads/${id}`);
  assert.equal(hitHint({ kind: 'content', type: 'projects', id, title: 'Solbar', status: 'published', match: 'RU: Солбар' }), 'Проекты · опубликовано · RU: Солбар');
  assert.equal(hitHint({ kind: 'lead', id, title: 'x', status: 'in_progress' }), 'Заявка · в работе');
});

test('sizes, durations, low disk', () => {
  assert.equal(formatBytes(512), '512 Б');
  assert.equal(formatBytes(1536), '1,5 КБ');
  assert.equal(formatBytes(25 * 1024 ** 3), '25 ГБ');
  assert.equal(formatDuration(26), '26 с');
  assert.equal(formatDuration(185), '3 мин 5 с');
  assert.equal(formatDuration(null), '—');
  assert.equal(diskLow({ totalBytes: 100, freeBytes: 5 }), true);
  assert.equal(diskLow({ totalBytes: 100, freeBytes: 50 }), false);
});
