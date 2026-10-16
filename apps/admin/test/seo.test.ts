/**
 * SEO in the admin (Phase I-1): every checker code has Russian wording, snippets are cut like a
 * search result, issues are ordered by severity.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { SEO_ISSUE_CODES, SEO_ISSUE_SEVERITY } from '@soltex/core/seo';
import { describeSeoIssue, SEVERITY_LABELS, snippetDescription, snippetTitle, snippetUrl, sortIssues, truncateForSnippet } from '../src/features/seo/model';
import { describeValidation } from '../src/features/publishing/model';

const issue = (code: string, params: Record<string, string | number> = {}) => ({ code, severity: 'warning' as const, type: 'projects', key: 'p', locale: null, field: null, params });

test('every SEO code has a Russian sentence (no codes or English in the UI)', () => {
  for (const code of SEO_ISSUE_CODES) {
    const text = describeSeoIssue({ ...issue(code, { problem: 'format', slug: 'x', href: '/x', length: 130, max: 120, min: 70, with: '/a', path: '/p', final: '/f', hops: 2 }), severity: SEO_ISSUE_SEVERITY[code] });
    assert.notEqual(text, code, code);
    assert.match(text, /[а-яё]/i, code);
    assert.ok(!/undefined/.test(text), code);
  }
  assert.equal(describeSeoIssue(issue('title_too_long', { length: 130, max: 120 })), 'SEO-заголовок длиннее 120 символов (130).');
  assert.equal(describeSeoIssue(issue('slug_invalid', { problem: 'reserved' })), 'Адрес страницы некорректен: адрес занят страницей сайта.');
  assert.deepEqual(Object.keys(SEVERITY_LABELS), ['blocking', 'warning', 'info']);
});

test('snippet: cut at a word boundary like a search result; URL as breadcrumbs', () => {
  assert.equal(truncateForSnippet('short', 60), 'short');
  const t = 'Industrial pectin plant with alcohol-free extraction and membrane ultrafiltration';
  const cut = snippetTitle(t);
  assert.ok(cut.endsWith('…') && cut.length <= 61, cut);
  assert.ok(!cut.includes('ultrafiltration'));
  assert.equal(snippetDescription('a'.repeat(170)).length, 161);
  assert.equal(snippetUrl('https://soltexglobal.co/ru/projects/solbar-israel'), 'soltexglobal.co › ru › projects › solbar-israel');
});

test('issues are ordered errors → warnings → hints; release warning in words', () => {
  const sorted = sortIssues([
    { ...issue('title_default'), severity: 'info' as const },
    { ...issue('title_missing'), severity: 'blocking' as const },
    issue('title_length'),
  ]);
  assert.deepEqual(sorted.map((i) => i.severity), ['blocking', 'warning', 'info']);
  assert.match(describeValidation('seo_warnings:12'), /Замечаний SEO: 12/);
});
