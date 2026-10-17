/** Admin logic without a browser: routing, navigation by role, search, errors, API client, texts. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { permissionsOf, ROLES, type Role } from '@soltex/core/domain';
import { allNavItems, NAV, visibleNav } from '../src/app/nav.ts';
import { matches } from '../src/app/search.ts';
import { readResetToken, routeFor, safeFrom } from '../src/features/auth/routing.ts';
import { describeAuditDetails } from '../src/features/audit/describe.ts';
import { api, ApiError, buildUrl, CSRF_HEADER, CSRF_VALUE, setFetch } from '../src/lib/api/client.ts';
import type { SessionView } from '../src/lib/api/schema.gen.ts';
import { describeError, fieldErrorsOf, retryText } from '../src/lib/errors.ts';
import { describeDevice, plural, shortId } from '../src/lib/format.ts';
import { generatePassword } from '../src/lib/password.ts';
import { AUDIT_ACTION_LABELS } from '../src/i18n/ru.ts';

const view = (next: SessionView['next']) => ({ next }) as SessionView;
const canFor = (role: Role) => (p: string) => (permissionsOf(role) as readonly string[]).includes(p);
const labels = (role: Role) => visibleNav(canFor(role)).flatMap((s) => s.items.map((i) => i.label));

test('routeFor: every sign-in step has its screen; `from` only after full sign-in', () => {
  assert.equal(routeFor(null), '/login');
  assert.equal(routeFor(view('mfa_required'), '/admin/users'), '/login/mfa');
  assert.equal(routeFor(view('mfa_enrollment_required'), '/admin/users'), '/setup-mfa');
  assert.equal(routeFor(view('password_change_required'), '/admin/users'), '/change-password', 'initial password first (Phase M-1)');
  assert.equal(routeFor(view('authenticated'), '/change-password'), '/', 'never back to the change page');
  assert.equal(routeFor(view('authenticated')), '/');
  assert.equal(routeFor(view('authenticated'), '/admin/audit?action=auth.login'), '/admin/audit?action=auth.login');
});

test('safeFrom: no open redirect, no loop back into sign-in pages', () => {
  for (const bad of ['https://evil.example', '//evil.example', '/\\evil.example', 'javascript:alert(1)', '', undefined, '/login', '/login/mfa', '/setup-mfa', '/reset-password?x', '/forgot-password'])
    assert.equal(safeFrom(bad), null, String(bad));
  assert.equal(safeFrom('/account'), '/account');
  assert.equal(safeFrom('/loginx'), '/loginx');
});

test('reset token: from the fragment (preferred) or the query; malformed tokens are ignored', () => {
  const t = 'A'.repeat(43);
  assert.equal(readResetToken({ hash: `#token=${t}`, search: '' }), t);
  assert.equal(readResetToken({ hash: '', search: `?token=${t}` }), t);
  assert.equal(readResetToken({ hash: '#token=short', search: '' }), null);
  assert.equal(readResetToken({ hash: '#token=<script>aaaaaaaaaaaaaaaaaaaaaa', search: '' }), null);
  assert.equal(readResetToken({ hash: '', search: '' }), null);
});

test('navigation per role follows the permission map (no role shortcut)', () => {
  const nav = (redirects: boolean, leads: boolean) => [
    'Страницы', 'Проекты', 'Технологии', 'Продукты', 'EPC / EPCM', 'Патенты', 'Видео', 'Медиатека',
    ...(leads ? ['Все заявки'] : []),
    'Обзор', 'Все переводы', 'Требуют внимания',
    'Проверка SEO', ...(redirects ? ['Редиректы'] : []), 'Обзор', 'Ревизии', 'Релизы',
  ];
  assert.deepEqual(labels('owner'), ['Обзор', ...nav(true, true), 'Пользователи', 'Журнал действий', 'Настройки сайта', 'Система']);
  assert.deepEqual(labels('admin'), ['Обзор', ...nav(true, true), 'Пользователи', 'Журнал действий', 'Настройки сайта', 'Система']);
  assert.deepEqual(labels('content_manager'), ['Обзор', ...nav(true, false), 'Система']);
  assert.deepEqual(labels('seo_specialist'), ['Обзор', ...nav(true, false), 'Система']);
  assert.deepEqual(labels('editor'), ['Обзор', ...nav(false, false)]);
  assert.deepEqual(labels('marketer'), ['Обзор', ...nav(false, true)]);
  // Every guarded item names a real permission; ids and paths are unique.
  const items = allNavItems(NAV);
  assert.equal(new Set(items.map((i) => i.id)).size, items.length);
  assert.equal(new Set(items.map((i) => i.to)).size, items.length);
  for (const role of ROLES) for (const i of visibleNav(canFor(role)).flatMap((s) => s.items)) assert.ok(!i.permission || canFor(role)(i.permission));
});

test('navigation sections (Phase K-1 adds «Заявки», Phase N-0 «Настройки сайта» under administration)', () => {
  assert.deepEqual(NAV.map((s) => s.label ?? ''), ['', 'Контент', 'Заявки', 'Переводы', 'SEO', 'Публикация', 'Администрирование']);
});

test('⌘K matching: every word, any order, case-insensitive, Russian', () => {
  const cmd = { label: 'Журнал действий', keywords: 'аудит история', hint: '' };
  assert.ok(matches(cmd, 'журнал'));
  assert.ok(matches(cmd, 'ИСТОРИЯ журн'));
  assert.ok(!matches(cmd, 'журнал пользователи'));
  assert.ok(matches(cmd, '   '));
});

test('API client: CSRF header on changes only, cookies only, URL building, RFC 9457 → ApiError', async () => {
  const calls: { url: string; init: RequestInit }[] = [];
  setFetch(async (url, init) => {
    calls.push({ url, init });
    if (url.endsWith('/users')) return new Response(JSON.stringify({ items: [] }), { status: 200, headers: { 'x-request-id': 'r1' } });
    if (url.includes('/revoke')) return new Response(null, { status: 204 });
    return new Response(
      JSON.stringify({ type: 'urn:soltex:problem:step_up_required', title: 'Подтвердите действие вторым фактором', status: 403, code: 'step_up_required', request_id: 'abc' }),
      { status: 403, headers: { 'content-type': 'application/problem+json' } }
    );
  });
  assert.deepEqual(await api('GET /api/v1/users'), { items: [] });
  assert.equal(await api('POST /api/v1/auth/sessions/{id}/revoke', { params: { id: 'a/b' } }), undefined);
  await assert.rejects(api('POST /api/v1/auth/mfa/totp/enroll'), (e: unknown) => e instanceof ApiError && e.code === 'step_up_required' && e.requestId === 'abc' && e.status === 403);
  const [get, post] = calls;
  assert.equal((get!.init.headers as Record<string, string>)[CSRF_HEADER], undefined);
  assert.equal((post!.init.headers as Record<string, string>)[CSRF_HEADER], CSRF_VALUE);
  assert.equal(post!.url, '/api/v1/auth/sessions/a%2Fb/revoke');
  for (const c of calls) assert.equal(c.init.credentials, 'same-origin');
  assert.equal(buildUrl('GET /api/v1/audit', undefined, { limit: 50, before: undefined, action: '' }), '/api/v1/audit?limit=50');

  setFetch(async () => {
    throw new TypeError('network');
  });
  await assert.rejects(api('GET /api/v1/health'), (e: unknown) => e instanceof ApiError && e.status === 0 && e.code === 'network_error');
  setFetch(async () => new Response('<html>Bad gateway</html>', { status: 502 }));
  await assert.rejects(api('GET /api/v1/health'), (e: unknown) => e instanceof ApiError && e.status === 502);
});

test('errors: expected problems without a request id; unexpected ones carry it for support', () => {
  const p = (status: number, code: string, extra: object = {}) => new ApiError(status, { code, title: 'T', ...extra }, 'req-1', null);
  assert.deepEqual(describeError(p(401, 'invalid_credentials')), { message: 'T', requestId: null, silent: false });
  assert.equal(describeError(p(500, 'internal_error')).requestId, 'req-1');
  const pw = describeError(p(422, 'password_rejected', { errors: [{ field: 'newPassword', message: 'too_common' }] }));
  assert.match(pw.message, /распространён/);
  assert.match(describeError(new ApiError(429, { code: 'login_throttled', title: 'Слишком много попыток.' }, null, 125)).message, /3 мин/);
  assert.equal(retryText(30), ' Повторите через 30 с.');
  assert.deepEqual(fieldErrorsOf(p(422, 'password_rejected', { errors: [{ field: 'body.password', message: 'too_short' }] })), { password: 'Пароль слишком короткий: нужно не меньше 12 символов.' });
  assert.equal(describeError(new Error('boom')).message, 'Не удалось выполнить действие. Повторите попытку.');
});

test('audit rows in plain words; every action the API writes has a Russian label', () => {
  assert.equal(describeAuditDetails({ action: 'auth.login', result: 'failure', summary: { reason: 'wrong_password', email_hash: 'x' } }), 'причина: неверный пароль');
  assert.equal(describeAuditDetails({ action: 'user.update', result: 'success', summary: { fields: ['role'], previous_role: 'editor', new_role: 'admin', revoked: '2' } }), 'роль: редактор → администратор · изменено: роль · завершено 2 сеанса');
  assert.equal(describeAuditDetails({ action: 'auth.mfa', result: 'success', summary: { factor: 'passkey', step_up: true } }), 'фактор: ключ доступа · повторное подтверждение');
  assert.equal(describeAuditDetails({ action: 'access.denied', result: 'denied', summary: { permission: 'users.manage' } }), 'нет нужного права');
  assert.equal(describeAuditDetails({ action: 'x', result: 'success', summary: { unknown_key: 'raw' } }), '');
  assert.equal(describeAuditDetails({ action: 'content.update', result: 'success', resourceType: 'project', summary: { fields: ['title', 'scope'] } }), 'проект · изменено полей: 2');
  assert.equal(describeAuditDetails({ action: 'content.update', result: 'denied', resourceType: 'page', summary: { fields: ['seoMetaTitle'] } }), 'страница · отказано в изменении полей: 1');
  assert.equal(describeAuditDetails({ action: 'content.archive', result: 'success', resourceType: 'video', summary: { status: 'archived' } }), 'видео · в архиве');
  assert.equal(
    describeAuditDetails({ action: 'translation.update', result: 'success', resourceType: 'project', summary: { locale: 'ar', fields: ['title'], previous_status: 'approved', status: 'in_progress', revision: 3 } }),
    'проект · арабский · изменено полей: 1 · утверждён → в работе'
  );
  assert.equal(describeAuditDetails({ action: 'translation.approve', result: 'success', resourceType: 'page', summary: { locale: 'ru', previous_status: 'outdated', status: 'approved', revision: 4 } }), 'страница · русский · устарел → утверждён');
  for (const a of ['translation.update', 'translation.approve', 'translation.reopen']) assert.ok(AUDIT_ACTION_LABELS[a], a);
  for (const a of ['content.publish', 'content.unpublish', 'revision.restore', 'release.create', 'release.build', 'release.activate', 'release.rollback', 'release.retry', 'preview.build', 'preview.grant', 'preview.revoke'])
    assert.ok(AUDIT_ACTION_LABELS[a], a);
  assert.equal(describeAuditDetails({ action: 'release.activate', result: 'success', resourceType: 'release', summary: { status: 'active', target: 'R-20261009-120000-abcdef' } }), 'R-20261009-120000-abcdef · на сайте');
  assert.equal(describeAuditDetails({ action: 'release.rollback', result: 'failure', resourceType: 'release', summary: { reason: 'artifact_checksum' } }), 'причина: файлы релиза изменены');
  assert.equal(describeAuditDetails({ action: 'revision.restore', result: 'success', resourceType: 'project', summary: { fields: ['title'], revision: 2 } }), 'проект · из версии 2 · полей: 1');
  assert.equal(describeAuditDetails({ action: 'preview.revoke', result: 'success', resourceType: 'user', summary: { count: 2 } }), 'закрыто: 2');
  for (const a of ['auth.login', 'auth.logout', 'auth.lockout', 'auth.mfa', 'auth.password.change', 'auth.password_reset.request', 'auth.password_reset.confirm', 'auth.session.revoke', 'auth.session.revoke_others', 'mfa.totp.enroll_start', 'mfa.totp.enroll', 'mfa.totp.disable', 'mfa.recovery.regenerate', 'mfa.passkey.register', 'mfa.passkey.remove', 'user.create', 'user.update', 'user.profile_update', 'user.mfa_reset', 'user.sessions_revoke', 'user.bootstrap_owner', 'access.denied', 'content.create', 'content.update', 'content.archive', 'content.restore'])
    assert.ok(AUDIT_ACTION_LABELS[a], a);
});

test('formatting: Russian plurals, devices in plain words, short request ids', () => {
  assert.deepEqual([1, 2, 5, 11, 21, 22, 25].map((n) => plural(n, 'код', 'кода', 'кодов')), ['код', 'кода', 'кодов', 'кодов', 'код', 'кода', 'кодов']);
  assert.equal(describeDevice('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15'), 'Safari на macOS');
  assert.equal(describeDevice('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36 Edg/124.0'), 'Edge на Windows');
  assert.equal(describeDevice(null), 'Неизвестное устройство');
  assert.equal(shortId('0192f0a5-7c3e-7d1a-9b2c-3d4e5f607182'), '0192f0a5');
});

test('generated initial password: long, unbiased alphabet, passes the API policy length', () => {
  const pw = generatePassword();
  assert.match(pw, /^([A-HJ-NP-Za-km-np-z2-9]{6}-){3}[A-HJ-NP-Za-km-np-z2-9]{6}$/);
  assert.notEqual(generatePassword(), pw);
  // Bytes ≥ 224 (= 4 × 56) are rejected, not folded onto the alphabet.
  const fixed = generatePassword(6, (n) => new Uint8Array(n).fill(255).map((_, i) => (i % 2 ? 255 : 0)));
  assert.equal(fixed, 'AAAAAA');
});
