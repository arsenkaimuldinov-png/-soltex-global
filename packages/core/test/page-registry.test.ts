import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { isLocalized, PAGE_KEYS, PAGE_REGISTRY, placeholdersMatch, placeholdersOf, type PageRecord } from '../src/content/index.ts';

const seed = JSON.parse(readFileSync(new URL('../../../apps/web/src/content/seed/pages.json', import.meta.url), 'utf8')) as PageRecord[];

test('the page registry describes exactly the pages, slots, lists and media of the seed', () => {
  assert.deepEqual([...PAGE_KEYS].sort(), seed.map((p) => p.key).sort());
  for (const page of seed) {
    const def = PAGE_REGISTRY[page.key];
    assert.equal(def.kind, page.kind, page.key);
    assert.equal(def.header, page.header !== null, `${page.key} header`);
    assert.equal(def.seo, page.seo !== null, `${page.key} seo`);
    assert.deepEqual(def.slots.map((s) => s.key), Object.keys(page.copy), `${page.key} slots (order matters)`);
    assert.deepEqual(Object.keys(def.lists), Object.keys(page.lists), `${page.key} lists`);
    for (const [listKey, items] of Object.entries(page.lists))
      for (const item of items)
        assert.deepEqual(Object.keys(item).filter((k) => isLocalized(item[k])), def.lists[listKey]!.texts, `${page.key}.${listKey} text fields`);
    assert.deepEqual(def.media, Object.keys(page.media), `${page.key} media`);
    for (const slot of def.slots) {
      const text = page.copy[slot.key]!.en;
      assert.ok(placeholdersMatch(slot, text), `${page.key}.${slot.key} placeholders`);
      if (text.includes('\n')) assert.ok(slot.multiline, `${page.key}.${slot.key} has line breaks, so it is multi-line`);
    }
  }
});

test('placeholders: exact set, order-independent, duplicates ignored', () => {
  const slot = { key: 'x', multiline: false, placeholders: ['title'] };
  assert.ok(placeholdersMatch(slot, 'About {title}'));
  assert.ok(!placeholdersMatch(slot, 'About'));
  assert.ok(!placeholdersMatch(slot, 'About {title} {extra}'));
  assert.ok(!placeholdersMatch(slot, 'About {Title}'));
  assert.deepEqual(placeholdersOf('{a} {b} {a}'), ['a', 'b']);
});
