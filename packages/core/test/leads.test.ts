/**
 * Lead rules (Phase K): spam heuristics, normalization for the blind index, references and CSV cells.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { csvCell, LEAD_REQUIRED_FIELDS, leadReference, normalizeEmail, normalizePhone, spamVerdict } from '../src/domain/index.ts';

test('spam: honeypot and too-fast submissions decide alone; links, markup and keywords add up', () => {
  const human = { honeypot: '', fillMs: 12_000, name: 'Иван Петров', message: 'Интересует линия по производству пектина на 5 т/сутки.' };
  assert.deepEqual(spamVerdict(human), { score: 0, reasons: [], spam: false });
  assert.equal(spamVerdict({ ...human, honeypot: 'http://x' }).spam, true);
  assert.deepEqual(spamVerdict({ ...human, fillMs: 900 }).reasons, ['too_fast']);
  assert.equal(spamVerdict({ ...human, fillMs: null }).spam, false, 'unknown fill time is not held against the visitor');
  assert.equal(spamVerdict({ ...human, message: 'see https://a.example and https://b.example' }).spam, false, 'two links alone are not enough');
  assert.equal(spamVerdict({ ...human, message: 'https://a.example https://b.example <a href="x">cheap</a>' }).spam, true);
  assert.deepEqual(spamVerdict({ ...human, message: 'Best SEO services and backlinks' }).reasons, ['keywords']);
});

test('normalization, references, required fields', () => {
  assert.equal(normalizeEmail('  Ivan.Petrov@Example.KZ '), 'ivan.petrov@example.kz');
  assert.equal(normalizePhone('+7 (701) 123-45-67'), '77011234567');
  assert.equal(leadReference(2026, 123), 'SOL-2026-000123');
  assert.deepEqual(LEAD_REQUIRED_FIELDS.contact_page, ['name', 'phone', 'email']);
});

test('CSV cells: formula injection neutralised, quotes and separators escaped', () => {
  assert.equal(csvCell('=HYPERLINK("http://x")'), `"'=HYPERLINK(""http://x"")"`);
  assert.equal(csvCell('+77011234567'), "'+77011234567");
  assert.equal(csvCell('-1'), "'-1");
  assert.equal(csvCell('@SUM(A1)'), "'@SUM(A1)");
  assert.equal(csvCell('ООО «Ромашка»; цех 2'), '"ООО «Ромашка»; цех 2"');
  assert.equal(csvCell('line1\nline2'), '"line1\nline2"');
  assert.equal(csvCell(null), '');
  assert.equal(csvCell(42), '42');
});
