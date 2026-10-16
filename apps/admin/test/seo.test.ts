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

test('redirects: every path rule and refusal has a Russian message; address-change URLs in six languages', async () => {
  const { redirectErrorMessage, REDIRECT_SOURCE_LABELS, slugChangeUrls } = await import('../src/features/seo/model');
  const { describeAuditDetails, auditActionLabel } = await import('../src/features/audit/describe');
  for (const m of ['exists', 'self', 'empty', 'not_absolute', 'protocol_relative', 'backslash', 'scheme', 'control', 'encoded', 'dot_segment', 'too_long', 'query', 'trailing_slash', 'locale_prefix', 'reserved', 'redirect_target_missing', 'redirect_shadows_page', 'redirect_duplicate', 'redirect_loop']) {
    const text = redirectErrorMessage(m);
    assert.ok(/[а-я]/i.test(text) && !text.includes('_') && text !== 'Проверьте адрес.', m);
  }
  assert.deepEqual(Object.keys(REDIRECT_SOURCE_LABELS).sort(), ['import', 'manual', 'slug_change']);
  const urls = slugChangeUrls('/projects/', 'old', 'new');
  assert.equal(urls.length, 6);
  assert.deepEqual(urls[0], { locale: 'en', from: 'https://soltexglobal.co/projects/old', to: 'https://soltexglobal.co/projects/new' });
  assert.equal(urls.find((u) => u.locale === 'ar')!.to, 'https://soltexglobal.co/ar/projects/new');
  for (const a of ['content.slug_change', 'redirect.create', 'redirect.update', 'redirect.delete']) assert.notEqual(auditActionLabel(a), 'Действие в системе', a);
  assert.equal(describeAuditDetails({ action: 'content.slug_change', resourceType: 'project', result: 'success', summary: { slug: 'b', previous_slug: 'a', count: 1 } }), 'проект · a → b · редиректов затронуто: 1');
  assert.equal(describeAuditDetails({ action: 'redirect.create', result: 'success', summary: { from: '/old', to: '/new', count: 0 } }), '/old → /new');
});
