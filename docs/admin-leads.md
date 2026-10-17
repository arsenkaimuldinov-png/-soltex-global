# Leads (Phase K)

Status: **Phase K-1** implemented (2026-10-17): the server intake, protection, notifications, the
«Заявки» section, export and anonymization. **Phase K-2** (next): the forms of the site send to the
server instead of the demo service, and UTM attribution. Both are behind flags that stay **off**
until the client confirms the legal texts. Implements approved §13 and §19 (e-mail), and review §K.

**Client decisions still open** (approved §21–§22), handled with safe defaults:

| Decision | Until it is made |
|---|---|
| B3 privacy policy / consent text | `consent_basis = notice_only`, `consent_at` empty; `PRIVACY_NOTICE_VERSION` unset |
| B4 consent checkbox in the forms | The forms are not changed |
| B5 SMTP sender and recipients | `SMTP_URL` / `LEAD_NOTIFY_TO` unset: notices wait in the outbox (nothing is lost) and the admin says why |
| §22.4 retention period | `LEAD_RETENTION_MONTHS=24` (the architecture's proposal) |
| §22.6 attribution | Not collected (K-2, `ATTRIBUTION_ENABLED=false`) |

## 1. Data model (migration `0009`)

**`leads`:**
- `reference` `SOL-<year>-<number>` (one sequence; numbers never repeat);
- form, language, page, topic;
- `name` and `company` in plain text (for search, approved §13.1);
- `email_enc`, `phone_enc`, `message_enc`: AES-256-GCM per column. Format `v1.<key id>.<iv>.<tag>.<ciphertext>`, with the lead id and field name as associated data, so a value cannot be moved to another row or column;
- keys come from `DATA_ENCRYPTION_KEYS`, with key ids for rotation;
- `email_bidx`, `phone_bidx`: HMAC blind indexes of the normalized e-mail (trimmed, lower case) and phone (digits only), for exact search and duplicate hints;
- `ip_hash`: keyed hash only;
- status, assignee, spam score and reasons;
- consent record (`consent_basis`, `privacy_notice_version`, `consent_text_version`, `consent_at`);
- `attribution` (K-2);
- `notified_at`, `version`, bin (`deleted_at` / `deleted_by`), `anonymized_at`.

**`lead_events`** — the history:
- created, status, assignee, note, notified, notify_failed, deleted, restored, anonymized;
- `data` holds facts without personal data;
- notes are encrypted (`note_enc`, the event id is part of the associated data).

**`outbox`** — domain events written in the same transaction as their cause (`lead.created`, `leads.exported`):
- the payload holds **ids only**;
- the mail is built from the database when it is sent;
- attempts, next attempt and the last error **code** are recorded.

## 2. Intake: `POST /api/v1/public/leads`

**Access:**
- no session;
- header `X-Requested-With: soltex-site`;
- `Origin`, when sent, must be `PUBLIC_SITE_URL`. Admin and other origins are refused (`csrf_rejected`);
- on the site host nginx proxies only this one API path (`deploy/nginx/soltexglobal.conf`: 10 per minute per IP, 32 KB). Health, sessions and admin routes answer 404 there.

**Limits:**
- body ≤ 20 KB (413);
- 5 forms per 10 minutes per IP (429);
- field lengths of `LEAD_LIMITS`;
- unknown properties are refused.

**Validation:**
- required fields per form: CTA and inquiry need name + phone; contact needs name + phone + e-mail;
- e-mail format; phone ≥ 5 digits;
- errors name **fields only** (`fields.email: required | invalid`); submitted values are never echoed.

**Spam** (`spamVerdict`, review §K):
- the honeypot field `hp` or a fill time under 3 s (`fillMs`) decide alone;
- links, HTML markup and typical keywords add up;
- spam is **stored** with status `spam` and answered like any lead (the sender learns nothing). It is not e-mailed.

**Answer:** `201 { reference }`. The log line says `lead received` with the spam verdict, and nothing else.

## 3. Notifications (outbox → e-mail)

**Who sends:** the worker, one outbox message per tick, through the `EmailProvider`:
- `SmtpEmailProvider`: nodemailer, `SMTP_URL` + `MAIL_FROM`;
- `UnconfiguredEmailProvider`;
- `FakeEmailProvider` (tests).

**New-lead notice:**
- in Russian, to `LEAD_NOTIFY_TO`;
- contains the number, form, language, page, topic, contacts, message and the admin link;
- spam, deleted and anonymized leads are skipped.

**Failures** (codes only):

| Code | Meaning | Retry |
|---|---|---|
| `mail_not_configured` | SMTP is not set (reported first) | every 15 minutes |
| `no_recipients` | `LEAD_NOTIFY_TO` is empty | every 15 minutes |
| `smtp_rejected` / `smtp_unavailable` | the mail server refused / did not answer | after 1, 5, 15, 60, 180 and then 720 minutes |

- The lead itself is never lost.
- The admin shows «Уведомление не отправлено: …» with «Отправить ещё раз».
- The history records the first failure of each kind and the successful send.

**Export notice:** after a CSV export, every active Owner gets a notice naming the person and the number of rows.

## 4. Admin

**«Заявки → Все заявки»** (`/leads`, leads.read: Owner, Admin, Marketer):
- status chips with counts, and «Корзина»;
- search: name, company or number; or an **exact** e-mail / phone, through the blind index (no partial search in encrypted fields);
- filters: form, assignee, period. All filters are kept in the address;
- the table shows the number + date, contact with phone / e-mail and a duplicate hint, form + topic, status, assignee, and a failed-notice mark.

**Lead page:**
- contacts with `tel:` / `mailto:` and copy;
- the message;
- status and assignee (leads.manage; If-Match; the assignee must be a user who may read leads);
- encrypted notes and the history in words;
- «Откуда»: form, topic, page, language, notification and the consent record;
- «В корзину» / «Восстановить»;
- spam reasons.

**«Выгрузить CSV»** (leads.export):
- needs a fresh second factor (step-up), and uses the list's filters;
- `;`-separated, UTF-8 with BOM, CRLF;
- every cell is formula-safe (a leading `= + - @` gets a quote) and quoted when needed;
- audited as `lead.export` (count and filter), and the Owners are notified.

**Audit actions:** `lead.update`, `lead.note`, `lead.delete`, `lead.restore`, `lead.export`, `lead.notify_retry`, `lead.anonymize`.

## 5. Bin, anonymization, retention (approved §13.1)

- **Bin:** «В корзину» is a soft delete; the lead can be restored for 30 days.
- **Anonymization:** the worker runs hourly and clears name, company, e-mail, phone, message, blind indexes, IP hash, attribution and notes of leads that:
  - were deleted more than 30 days ago, or
  - are older than `LEAD_RETENTION_MONTHS`.

  Date, form, language, page, topic and status remain, with a history entry. An anonymized lead cannot be changed.

## 6. Logging (approved §13.1)

- **Request logs:** id, method and path without the query string. Bodies are never serialized.
- **pino `redact`:** cookie, authorization, set-cookie, and `*.email`, `*.phone`, `*.message`, `*.name`, `*.fields`, `body`.
- **Mail:** the providers never log addresses, subjects or bodies.
- **Canary test:** a lead with marker values goes through intake, validation errors, failed and successful mail, notes and export. The log output at debug level, the audit log, the outbox and the lead events must contain none of the markers.

## 7. Configuration

| Variable | Meaning |
|---|---|
| `SMTP_URL`, `MAIL_FROM` | SMTP for all e-mail (`smtp://` or `smtps://`); both or neither |
| `LEAD_NOTIFY_TO` | Comma-separated recipients of new-lead notices |
| `LEAD_RETENTION_MONTHS` | 1–120, default 24 |
| `PRIVACY_NOTICE_VERSION` | Version of the privacy notice the forms display; stored with each lead |
| `PUBLIC_SITE_URL` | The only origin allowed to send forms |

## 8. Tests

| Suite | What |
|---|---|
| `packages/core/test/leads.test.ts` | spam verdict, normalization, references, CSV cells |
| `apps/api/test/leads.db.test.ts` | intake: encryption, blind index, consent record, outbox; origin / header / validation / size / rate limits; spam; outbox with and without SMTP, retry; admin list / search / detail; status / assignee / notes with audit and If-Match; export with step-up, formula escaping, BOM, audit and Owner notice; bin and anonymization (deleted and retention); the canary test |
| `apps/api/test/nginx.db.test.ts` | the form reaches the API through nginx; no other API path on the site host |
| `apps/admin/test/leads.test.ts` | Russian wording |
| `apps/admin/e2e/leads.e2e.mjs` | a sent lead in the list; work on it; notice waiting for SMTP; CSV download; bin and restore; editor without access; mobile |

## 9. Deviations (Phase K-1)

| # | Deviation | Reason |
|---|---|---|
| K-1 | The site forms still use the demo service | K-2, behind a flag, after the client confirms the privacy texts (B3) |
| K-2 | Outbox delivered by the existing worker, not pg-boss | Same pattern as releases and image copies; one process, SKIP LOCKED |
| K-3 | Security e-mails (password reset, alerts) still use the unconfigured notifier | They move to the same outbox once SMTP (B5) is known; password-reset tokens must not be stored in the outbox in plain text |
| K-4 | Recipients come from the environment, not from a settings screen | «Настройки» is a later screen; recipients are few and change rarely |
| K-5 | No CAPTCHA | Review §K: only if spam gets through the honeypot / timing / rate limits |
| K-6 | The list shows up to 200 leads per filter | Volume is small; filters narrow it down. Server paging exists in the API (`limit` / `offset`) |
