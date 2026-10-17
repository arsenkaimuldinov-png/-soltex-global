# Admin interface (Phase D)

**Architecture:** [`admin-architecture-approved.md`](admin-architecture-approved.md) §7, §8, §10, §16, §19; review §X (information architecture and UX).
**API contract:** [`admin-auth.md`](admin-auth.md), [`apps/api/openapi.json`](../apps/api/openapi.json).
**Code:** `apps/admin`.

Phase D delivers the admin shell and every screen that the Phase C API already serves. Content, media, translations, leads, SEO, settings, publishing and preview arrive with their own phases. Until then they do not appear in the interface: there are no placeholders and no empty sections.

---

## 1. Stack

| Concern | Choice (review §B) |
|---|---|
| UI | React 19, Vite 8, Tailwind CSS 4 (admin tokens only; the public site's CSS is untouched) |
| Routing | React Router 7 (data router: unsaved-changes blocker, lazy screens) |
| Server state | TanStack Query 5 |
| Tables | TanStack Table 9 (sorting; `/` focuses the search field) |
| Forms | react-hook-form + Zod 4 |
| Accessible primitives | Radix UI: Dialog, AlertDialog, DropdownMenu, Toast, Collapsible |
| Passkeys | `@simplewebauthn/browser` (counterpart of the API's `@simplewebauthn/server`) |
| TOTP QR code | `uqr`, rendered locally as SVG. The secret never goes to a third-party QR service |
| Icons | lucide-react (already used by the site) |

**Notes:**
- TipTap (restricted rich text) belongs to Phase E and is not installed.
- Fonts are system fonts, so the admin makes no external font requests.

---

## 2. Contract with the API

- **Typed client** (`src/lib/api/client.ts`). The types are generated from `apps/api/openapi.json` by `npm run api:types -w @soltex/admin`, into `src/lib/api/schema.gen.ts` (committed). CI fails when the file is out of date. The admin never imports API code.
- **Requests:**
  - only `credentials: 'same-origin'` (cookies); the SPA never sees or stores a token;
  - every POST, PATCH and DELETE sends `X-Requested-With: soltex-admin`, the CSRF header from `admin-auth.md` §6.
- **Errors:** RFC 9457 problems become an `ApiError`.
  - The API's Russian `title` is shown.
  - Password-policy codes are translated (`i18n/ru.ts`).
  - Unexpected errors (5xx, unknown codes) show the toast «Код ошибки: 7f3c9a1e, сообщите администратору» with the first 8 characters of the request id (approved §19).
  - Expected errors (wrong password, conflict, rate limit) never show a code.
- **Retries:** queries retry network and 5xx failures twice, never 4xx. Mutations are never retried.

---

## 3. Routes

| Path | Who | Screen |
|---|---|---|
| `/login` | signed-out visitors | E-mail and password |
| `/forgot-password` | signed-out visitors | Request a reset link. The answer is the same for any address |
| `/reset-password#token=…` | anyone with a link | New password. The token is in the URL fragment, so it never reaches server logs or Referer. It is removed from history after use |
| `/login/mfa` | session at the second-factor step | Passkey, authenticator code, or recovery code |
| `/setup-mfa` | session whose role requirement is not met | Mandatory enrollment: a passkey for Owner and Admin; passkey or app for other roles |
| `/` | signed in | Обзор |
| `/account` | signed in | Профиль и безопасность |
| `/admin/users` | `users.manage` | Пользователи |
| `/admin/audit` | `audit.read` | Журнал действий |
| `/admin/system` | `system.read` | Система |
| `/content/pages`, `/content/pages/:id` | `content.read` | Страницы: list and page editor (Phase E, [`admin-content.md`](admin-content.md)) |
| `/content/:collection`, `/content/:collection/:id` | `content.read` | Проекты, Технологии, Продукты, EPC / EPCM, Патенты, Видео: lists and typed editors. An unknown collection shows «Страница не найдена» |
| `/translations` | `content.read` | Переводы · Обзор: completion per language and section (Phase F, [`admin-translations.md`](admin-translations.md)) |
| `/translations/all`, `/translations/attention` | `content.read` | Все переводы / Требуют внимания: filters in the address (`locale`, `type`, `state`, `entity`, `q`, `sort`, `page`) |
| `/translations/:type/:id/:locale` | `content.read` | Translation editor: English source next to the target language; Arabic inputs right-to-left. Unknown type or language shows «Страница не найдена» |
| `/seo` | `seo.read` | SEO · Проверка SEO: every issue of the next release, filters `severity`, `locale`, `type` in the address (Phase I-1, [`admin-seo.md`](admin-seo.md)) |
| `/media`, `/media/:id` | `media.read` | Контент · Медиатека: library with previews, upload (media.upload), file page with usages, «Заменить файл» (media.replace), «Удалить» (media.delete) (Phase J-1, [`admin-media.md`](admin-media.md)) |
| `/leads`, `/leads/:id` | `leads.read` | Заявки: list with status chips, filters and search, bin, CSV export (`leads.export` + step-up); lead page with contacts, message, status / assignee / notes (`leads.manage`), history (Phase K-1, [`admin-leads.md`](admin-leads.md)) |
| `/seo/redirects` | `redirects.read` | SEO · Редиректы: rules with source, code, languages, hits and checks; add / change / delete with `redirects.manage` (Phase I-2, [`admin-seo.md`](admin-seo.md) §8) |
| `/publishing` | `content.read` | Публикация · Обзор: what is live, builds, unpublished changes, «Создать релиз», «Предпросмотр черновиков» (Phase G, [`admin-publishing.md`](admin-publishing.md)) |
| `/publishing/revisions`, `/publishing/revisions/:type/:id` | `content.read` | Ревизии: all versions (filters `type`, `kind`, `q`, `page` in the address); full history of one record |
| `/publishing/releases`, `/publishing/releases/:id` | `content.read` | Релизы (filters `kind`, `status`, `page`) and the release page (steps, changes, checks, translations, events; publish / rollback / retry / preview actions by permission) |
| anything else | signed in | «Страница не найдена» |

**Rules:**
- The session state comes only from `GET /auth/session`. Its `next` field decides the screen: `routeFor()` in `features/auth/routing.ts`.
- The page asked for before sign-in (`from`) is carried through every sign-in step and opened afterwards.
- `safeFrom()` accepts only internal paths. It refuses `//host`, `/\host`, schemes and the sign-in pages themselves, so there is no open redirect.
- A screen behind a permission shows «Недостаточно прав» on direct access. The API refuses the data anyway; the guard is presentation only.
- Screens behind the shell are loaded on demand.
- Navigation model: `src/app/nav.ts`, one list for the sidebar, ⌘K and the overview. Visibility = `session.permissions` from the API, the same permission map as `@soltex/core/domain`. No role names are checked anywhere except for «Дополнительно» (§5).

---

## 4. Sessions in the browser

- **Ending a session:** sign-out, expiry, a revoked session (another device, an admin, a password change) and MFA failures all lead to `/login` with a one-line reason:
  - «Сеанс завершён. Войдите снова.»;
  - «Вы вышли из системы.»;
  - «Пароль изменён. Войдите с новым паролем.»
- **Detection:**
  - any 401 from the API clears the cached session;
  - `mfa_required` or `mfa_enrollment_required` re-reads it;
  - the session is also re-checked every 5 minutes and when the window regains focus.
- **Several tabs:** they learn about sign-in and sign-out at once through `BroadcastChannel`.
- **Sign-out:** drops every cached response except the empty session.
- **Step-up** (`lib/step-up.tsx`):
  - a sensitive action runs; if the API answers `step_up_required`, the «Подтвердите действие» dialog asks for the passkey or an authenticator code (no recovery codes for step-up), then repeats the action once;
  - closing the dialog cancels quietly;
  - confirmation dialogs close before the step-up dialog opens.
- **Recovery codes:**
  - shown once, after the first factor and after regeneration;
  - the user must tick «Я сохранил коды в надёжном месте» before continuing;
  - copy and `.txt` download work locally;
  - they live only in memory, never in browser storage, and the enrollment page cannot be left by a redirect while they are on screen.

---

## 5. Screens

**Обзор:**
- the user's sign-in security (role requirement, passkeys, app, recovery codes left);
- a warning when no second factor is set or 3 or fewer codes remain;
- links to the sections the role can open.

The dashboard numbers of review §X (leads, SEO, translations, builds, backups) come with their phases. No placeholder numbers are shown.

**Профиль и безопасность:**
- name;
- passkeys: add, remove; the last required passkey cannot be removed;
- authenticator app: connect, disconnect;
- recovery codes: count, regenerate;
- password change: keeps this session, ends the others;
- active sessions: device in plain words («Chrome на macOS»), end one, end all others.

**Пользователи:**
- table with search, sorting, role and status;
- create with a generated initial password: 24 characters, Web Crypto, unbiased;
- edit name, role and status;
- end all sessions; reset the second factor (with the out-of-band identity reminder of approved §7).
- Options a role may not use are not offered (`canManageUser` from core): an Admin sees no Owner role and cannot change Owners; nobody changes their own role or status or resets their own MFA. The API enforces the same rules.
- Changing a role or status warns that the user will be signed out everywhere.

**Журнал действий:**
- newest first, 50 per page («Показать ещё», `before` cursor);
- server-side filters by person and action;
- actions and details in Russian words (`features/audit/describe.ts`); unknown keys are never shown in the main view;
- each row opens a dialog; technical values (record number, request id, action code, object, raw data) are in «Дополнительно».

**Система:** whether the API answers and how fast, checked every 30 s. Disk, backups and the queue (approved §19) come with Phases L and N; builds and releases are under «Публикация».

**SEO** (Phase I-1, [`admin-seo.md`](admin-seo.md) §5):
- «Проверка SEO» (`/seo`): totals by severity, filters, links to the editors;
- the editors' «Проверка SEO» block: search snippet per language, counters, checks with «Перейти к полю»;
- BLOCKING issues disable «Отметить к публикации» and «Создать релиз» with the reason.
- «Редиректы» (`/seo/redirects`, Phase I-2, §8): the list with each rule's checks; a dialog for add / change with the reasons next to the fields; delete with confirmation; a collapsed chain is reported.
- «Изменить адрес» (Phase I-2, §9): under the address of a published project, technology or product, for `redirects.manage`; the dialog shows the old and new address in six languages and the 301 option.

**Публикация** (Phase G, [`admin-publishing.md`](admin-publishing.md) §7):
- Обзор, Ревизии, Релизы in the sidebar section «Публикация»; a section overview is highlighted only on its own address (`hasChildRoute` in `nav.ts`);
- every action that changes the live site (publish, rollback) or the working copy (restore, mark for publication) asks for confirmation and states the consequences; rollback also asks for a fresh second factor (step-up);
- build progress is polled while a release builds; the preview opens in a new tab on the preview origin with a one-time link;
- ⌘K offers the screens only — no publish, rollback or restore commands.

**«Дополнительно»** (approved §16): technical details are collapsed and rendered only for Owner and Admin. The main UI shows no ids, codes, enum values or JSON.

---

## 6. Interaction rules (review §X)

| Rule | Implementation |
|---|---|
| Statuses as dot + text | `Status` component |
| Breadcrumbs | `PageHeader` |
| Empty state with next step | `EmptyState` |
| Destructive actions state their consequences | `ConfirmDialog` with a list of consequences (sessions, codes, notifications) |
| Unsaved changes | `useUnsavedChangesGuard`: in-app navigation asks; closing the tab triggers the browser prompt |
| ⌘K / Ctrl+K | Sections, harmless actions (add user, sign out) and people (for `users.manage`). **No publishing, rollback or other site-changing commands** (approved §16). Arrows and Enter navigate, Esc closes |
| `/` | Focuses the search field of a table |
| No single-key dangerous shortcuts | — |
| Devices | Desktop first; the sidebar becomes a drawer below 1024 px; tables scroll horizontally |

---

## 7. Accessibility (WCAG 2.2 AA)

- Radix primitives provide focus trap, Esc and ARIA for dialogs, menus and toasts.
- Every field has a `<label>`. Hints and errors are linked by `aria-describedby`, and each form has an error summary (`role="alert"`).
- A skip link «Перейти к содержимому» is provided; focus is visible (2 px accent outline).
- Contrast: every text token ≥ 4.5:1 on every admin background (weakest pair: ink-faint `#646a66` on subtle `#f1f1ec` ≈ 4.9:1; status colours on their soft backgrounds ≥ 4.7:1).
- The E2E suite drives every screen by role and accessible name (`getByRole`, `getByLabel`), so unlabeled controls fail the run.

---

## 8. Security headers for the admin host

The SPA works under a strict Content-Security-Policy. nginx must send it for `admin.soltexglobal.co` (Phase N); `vite preview` sends the same header, so E2E runs under it:

```
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline';
  img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none';
  base-uri 'none'; form-action 'self'; object-src 'none'
X-Content-Type-Options: nosniff
Referrer-Policy: no-referrer
X-Frame-Options: DENY
```

- `style-src 'unsafe-inline'` is needed for the inline `style` attributes that Radix sets for positioning. No inline scripts exist.
- `img-src data:` is for the locally rendered TOTP QR code.
- The source of truth is `ADMIN_CSP` in `apps/admin/vite.config.ts`.
- The bundle contains no secrets or server addresses; CI greps `apps/admin/dist`.

---

## 9. Tests

| Suite | Command | Covers |
|---|---|---|
| Unit (11 → 25 with Phases E–F) | `npm run test -w @soltex/admin` | `routeFor` / `safeFrom` (open redirect), reset token parsing, navigation per role from the core permission map, no later-phase sections, ⌘K matching, API client (CSRF header, cookies only, URL encoding, problems, network and proxy errors), error texts and when a request id is shown, audit wording and labels for every API action, plurals and devices, generated password; content editors (`test/content.test.ts`, Phase E); translation editor model, RTL, validation and permissions (`test/translations.test.ts`, Phase F) |
| E2E (23 → 45 with Phases E–F) | `npm run test:e2e:admin` (`scripts/admin-e2e.mjs`) | Built admin under its CSP + real API + PostgreSQL + Chromium with a virtual WebAuthn authenticator. Files: `admin.e2e.mjs` (shell, 23), `content.e2e.mjs` (Phase E, 12), `translations.e2e.mjs` (Phase F, 10) |

**What the E2E suite does:**
- **Sign-in and session:**
  - redirect to sign-in; generic wrong-password message;
  - Owner passkey enrollment; recovery codes shown once and not stored;
  - session cookie flags and no token in storage;
  - sign-out and passkey sign-in; return to the page asked for.
- **Users and step-up:**
  - user creation with allowed roles only, duplicate e-mail;
  - step-up after 10 minutes (session aged in the database), and step-up cancelled;
  - own role and status locked, «Дополнительно».
- **Roles:**
  - Admin cannot act on Owners;
  - Editor: no admin screens, «Недостаточно прав», 404, ⌘K without users;
  - a session revoked elsewhere → sign-in with the reason → back to the page.
- **Factors and password:**
  - Marketer: authenticator-app enrollment, recovery-code sign-in, reuse refused, next-step TOTP sign-in;
  - Content manager: TOTP enrollment, sees «Система» only;
  - password change ends the other session.
- **Screens:**
  - audit wording, filters, details;
  - ⌘K keyboard navigation without publishing commands;
  - unsaved-changes prompt;
  - mobile drawer;
  - forgot / reset password pages.
- **Hygiene:** no page errors and no CSP violations in any profile.

The E2E run creates users with unique e-mails and deletes nothing, so it needs a test database. Playwright is a QA tool here, not a project dependency, as in the site regression.
