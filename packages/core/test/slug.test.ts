import assert from 'node:assert/strict';
import { test } from 'node:test';
import { RESERVED_SLUGS, seoDescriptionNote, seoTitleNote, slugify, slugProblem, SLUG_MAX_LENGTH } from '../src/seo/index.ts';

test('slug rules: lowercase Latin, digits, single hyphens; reserved paths refused', () => {
  assert.equal(slugProblem('project', 'solbar-israel'), null);
  assert.equal(slugProblem('project', ''), 'empty');
  assert.equal(slugProblem('project', 'Solbar'), 'format');
  assert.equal(slugProblem('project', 'solbar--israel'), 'format');
  assert.equal(slugProblem('project', '-solbar'), 'format');
  assert.equal(slugProblem('project', 'проект'), 'format');
  assert.equal(slugProblem('project', 'a/b'), 'format');
  assert.equal(slugProblem('project', 'a'.repeat(SLUG_MAX_LENGTH + 1)), 'too_long');
  assert.equal(slugProblem('technology', 'patents'), 'reserved', '/technologies/patents is a page');
  assert.equal(slugProblem('project', 'patents'), null);
  assert.deepEqual(RESERVED_SLUGS.technology, ['patents']);
});

test('slugify: a valid slug from a title', () => {
  assert.equal(slugify('Pectin Plant — Ningbo, China'), 'pectin-plant-ningbo-china');
  assert.equal(slugify('  Ácido Málico  '), 'acido-malico');
  assert.equal(slugify('Завод'), '');
  for (const t of ['Pectin Plant — Ningbo', 'A'.repeat(200)]) assert.equal(slugProblem('project', slugify(t)), null);
});

test('SEO length notes follow review §J', () => {
  assert.equal(seoTitleNote('x'.repeat(60)), null);
  assert.equal(seoTitleNote('x'.repeat(61)), 'title_too_long');
  assert.equal(seoDescriptionNote('x'.repeat(69)), 'description_too_short');
  assert.equal(seoDescriptionNote('x'.repeat(160)), null);
  assert.equal(seoDescriptionNote('x'.repeat(161)), 'description_too_long');
  assert.equal(seoDescriptionNote(null), null);
});
