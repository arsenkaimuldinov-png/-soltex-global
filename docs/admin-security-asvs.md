# Security review: OWASP ASVS 4.0.3 Level 2 (Phase M-1)

Status: **Phase M-1** (2026-10-17). Scope: the admin (`apps/admin`), the API and worker (`apps/api`), the preview server, the public site build (`apps/web`) and its nginx configuration (`deploy/nginx`). The target is ASVS 4.0.3 Level 2 (approved §7; review §Q).

**How each requirement was checked:**
- **code:** the implementation was read;
- **test:** an automated test proves it; the test is named;
- **scan:** the OWASP ZAP scan of §3 found nothing;
- **N:** it belongs to the server set-up (Phase N, `docs/deployment.md`) and is checked there.

**Status values:**
- **Pass**;
- **Partial**: met, with a named limit;
- **Gap**: not met; the reason and the plan are given;
- **N/A**: the feature does not exist.

---

## 1. Summary

| Chapter | Result | Open points |
|---|---|---|
| V1 Architecture | Pass | — |
| V2 Authentication | Pass, 2 partial | security e-mails wait for SMTP (2.2.3, 2.5.5); the common-password list is local, there is no breach-corpus lookup (2.1.7) |
| V3 Sessions | Pass | absolute lifetime now 12 h (was 7 days) |
| V4 Access control | Pass | — |
| V5 Validation, encoding | Pass | — |
| V6 Cryptography | Pass, 1 partial | key storage and rotation procedure: Phase N (6.4.1) |
| V7 Errors, logging | Pass, 1 N | time synchronisation of the server: Phase N (7.3.4) |
| V8 Data protection | Pass, 1 partial, 2 N | lead search by an exact e-mail or phone uses the query string (8.3.1, mitigated); backups: Phase N |
| V9 Communications | Pass (configuration) | certificates and TLS checks on the real host: Phase N |
| V10 Malicious code | Pass | — |
| V11 Business logic | Pass | — |
| V12 Files | Pass, 1 gap, 1 partial | no antivirus scan of uploads (12.4.2); no per-user upload quota (12.1.3) |
| V13 API | Pass | — |
| V14 Configuration | Pass, 1 partial | the Google Fonts stylesheet has no SRI (14.2.3) |

**Changes made in this phase:**
- **Sessions:** at most 12 hours, then a new sign-in (§3.3.2).
- **Initial passwords:**
  - are temporary: valid 7 days;
  - are replaced at the first sign-in;
  - an admin can give a new one (§2.3.1).
- **Passwords:** a new password must differ from the current one.
- **Leads:** opening a lead is audited as `lead.view` (§8.3.5).
- **Audit log wording:** every audit action has Russian wording (media and lead actions were shown as «Действие в системе»), and a test checks this.
- **CSP of the public site:**
  - the site gets a Content Security Policy; the inline script is allowed by its hash (§14.4.3);
  - one text is kept in core and in nginx, and a lint check compares them.
- **Preview server:** sends a CSP and `X-Frame-Options` on every answer.
- **nginx:** TLS 1.2/1.3 only, with Mozilla intermediate settings (§9.1).
- **E-mail:** STARTTLS is required for `smtp://` to another host, TLS 1.2+ (§9.2).
- **New tests:**
  - every guarded route × every role (§4.1);
  - CSRF on every state-changing route (§4.2.2, §13.2.3).
- **`sql.raw` review gate** in `npm run lint` (§5.3.4).
- **Dependencies:** `sharp` 0.35.5 and `source-map-js` 1.2.2 (§14.2.1).
- **Scan:** a repeatable OWASP ZAP scan, `scripts/security-scan.mjs` (§3).

---

## 2. Requirements

### V1 Architecture, design and threat modelling

| # | Requirement (short) | Status | Evidence |
|---|---|---|---|
| 1.1.2 | Threat model for design changes | Pass | review §Q, approved §7–§13 (threats per area: auth, uploads, leads, preview, redirects) |
| 1.1.3 | Security constraints in user stories | Pass | each phase's acceptance (`admin-architecture-implementation.md`) lists security checks |
| 1.1.4 | Trust boundaries documented | Pass | approved §10 (site / admin / API / preview hosts, loopback API, nginx as entry) |
| 1.1.5 | High-level architecture | Pass | `admin-architecture-approved.md` |
| 1.1.6 | Centralised security controls | Pass | access guard (`auth/guard.ts`), CSRF hook (`http/security.ts`), audit (`audit/audit.ts`), crypto (`auth/crypto.ts`) |
| 1.2.1 | Separate low-privilege OS accounts | N | systemd units, Phase N |
| 1.2.2 | Authentication between components | Pass | API on loopback; DB roles `soltex_app` / `soltex_migrate` / `soltex_backup` (approved §17.1; `db.test.ts`) |
| 1.2.3 | One vetted authentication mechanism | Pass | sessions + WebAuthn / TOTP / recovery codes, `admin-auth.md` |
| 1.4.1 | Access control at trusted enforcement points | Pass | the API guard; the admin hides, the API refuses (`coverage.db.test.ts`) |
| 1.4.4 | Single access-control mechanism | Pass | `config.access` on every route; a route without it fails at start-up |
| 1.4.5 | Feature / data attributes, not roles | Pass | permissions (`@soltex/core/domain` permission map); only «Дополнительно» checks a role |
| 1.5.1–1.5.4 | Input / output handling defined | Pass | Zod schemas on every route; React output encoding; parameterised SQL |
| 1.6.1–1.6.4 | Key management, rotation, key ids | Pass | `DATA_ENCRYPTION_KEYS` with key ids; ciphertext format `v1.<key id>.…`; Phase N: storage |
| 1.7.1–1.7.2 | Common logging format, secure transfer | Pass / N | pino JSON; shipping to the server's journal: Phase N |
| 1.8.1–1.8.2 | Sensitive data identified and protected | Pass | leads (`admin-leads.md` §1), TOTP secrets, tokens (hashed), IP (keyed hash) |
| 1.9.1–1.9.2 | Encrypted communication between components | Pass | loopback only (API, DB, preview); TLS at nginx (Phase N) |
| 1.10.1 | Source control with check-ins, review | Pass | git, one reviewed commit per phase; migrations reviewed and committed |
| 1.11.1–1.11.2 | Business logic flows documented, no unsynchronised state | Pass | release state machine (`RELEASE_TRANSITIONS`), If-Match on every edit, advisory locks for builds |
| 1.12.2 | Uploaded files served safely | Pass | `/media` static only, `nosniff`, long names by server (`admin-media.md`) |
| 1.14.1–1.14.6 | Segregation, build pipeline, no unsupported client tech | Pass | separate hosts; CI builds; no plugins / Flash |

### V2 Authentication

| # | Requirement (short) | Status | Evidence |
|---|---|---|---|
| 2.1.1 | Passwords ≥ 12 characters | Pass | policy 12–256 (`auth/passwords.ts`; `auth.unit.test.ts`) |
| 2.1.2 | Passwords up to 64+ characters allowed | Pass | up to 256 |
| 2.1.3 | No truncation | Pass | Argon2id over the full string |
| 2.1.4 | Any printable Unicode, spaces | Pass | no character rules; length counted in code points |
| 2.1.5–2.1.6 | Users can change their password; current password required | Pass | `POST /auth/password/change` (`auth.db.test.ts`) |
| 2.1.7 | Breached / common passwords refused | Partial | the bundled list of common passwords; no online breach-corpus lookup (no third-party call from the API by design, review §Q A10) |
| 2.1.8 | Password strength meter | Partial | hints and the generator in the admin; no meter |
| 2.1.9 | No composition rules | Pass | |
| 2.1.10 | No periodic rotation | Pass | |
| 2.1.11 | Paste and password managers allowed | Pass | plain inputs, `autocomplete` set |
| 2.1.12 | Show / hide password | Pass | `PasswordInput` («Показать пароль») |
| 2.2.1 | Anti-automation | Pass | per-IP limits, progressive delay, lock-out for unknown devices (`auth.db.test.ts`) |
| 2.2.2 | No weak authenticators (SMS, e-mail codes) | Pass | passkey, TOTP, recovery codes only |
| 2.2.3 | Notification after changes to authentication details | Partial | `Notifier.securityAlert` on every change; delivery waits for SMTP (deviation K-3, client decision B5) |
| 2.3.1 | Initial passwords random, temporary, replaced | **Pass** (Phase M-1) | generated in the admin (24 characters, Web Crypto); valid 7 days; replaced at the first sign-in (`initial-password.db.test.ts`, E2E) |
| 2.4.1–2.4.5 | Password storage | Pass | Argon2id m = 19 MiB, t = 2, p = 1, per-password salt (`@node-rs/argon2`) |
| 2.5.1 | Recovery secret not sent in clear | Pass | reset link token in the URL fragment, single use, 30 min |
| 2.5.2–2.5.3 | No hints, no knowledge-based answers | Pass | |
| 2.5.4 | No default or shared accounts | Pass | first Owner by CLI only (`bootstrap.db.test.ts`) |
| 2.5.5 | Notify on change of authentication factor | Partial | as 2.2.3 |
| 2.5.6 | Secure forgotten-password flow | Pass | same answer for unknown accounts; reset does not bypass MFA (`auth.db.test.ts`) |
| 2.5.7 | Lost OTP / authenticator: re-proofing | Pass | admin MFA reset with out-of-band identity check (`rbac.db.test.ts`) |
| 2.6.1–2.6.3 | Lookup secrets (recovery codes) | Pass | 10 × 128 bit, hashed, single use (`mfa.db.test.ts`) |
| 2.7.x | Out-of-band verifiers | N/A | none (no SMS / e-mail codes) |
| 2.8.1–2.8.6 | Time-based OTP | Pass | RFC 6238, ±1 step, each step once, secret encrypted, removal with step-up (`mfa.db.test.ts`) |
| 2.9.1–2.9.3 | Cryptographic verifiers (WebAuthn) | Pass | user verification required, challenges single use and bound (`passkeys.db.test.ts`) |
| 2.10.1–2.10.4 | Service credentials not hard-coded | Pass / N | environment only; `.env` mode 600 outside the repository: Phase N |

### V3 Session management

| # | Requirement (short) | Status | Evidence |
|---|---|---|---|
| 3.1.1 | No session token in URLs | Pass | cookie only; preview token only in the fragment, exchanged for a cookie |
| 3.2.1 | New token at authentication | Pass | rotation at every level change (`auth.db.test.ts`) |
| 3.2.2 | ≥ 64 bits of entropy | Pass | 256-bit random token |
| 3.2.3 | Stored securely in the browser | Pass | `__Host-` cookie, HttpOnly, Secure, SameSite=Strict |
| 3.2.4 | Approved generator | Pass | `crypto.randomBytes` |
| 3.3.1 | Logout invalidates the session | Pass | `auth.db.test.ts` |
| 3.3.2 | Re-authentication at least every 12 h (L2) | **Pass** (Phase M-1) | absolute 12 h, idle 8 h (`initial-password.db.test.ts`) |
| 3.3.3 | Terminate other sessions after a password change | Pass | automatic |
| 3.3.4 | View and end active sessions | Pass | «Профиль и безопасность → Сеансы» |
| 3.4.1–3.4.5 | Cookie attributes, `__Host-` prefix, Path | Pass | `auth.db.test.ts`, E2E |
| 3.5.x | Token-based sessions | N/A | no JWT |
| 3.7.1 | Re-authentication for sensitive actions | Pass | step-up within 10 min (user management, factors, export, rollback, initial passwords) |

### V4 Access control

| # | Requirement (short) | Status | Evidence |
|---|---|---|---|
| 4.1.1 | Enforced on a trusted server | Pass | API guard |
| 4.1.2 | Attributes cannot be manipulated by the user | Pass | role from the database per request |
| 4.1.3 | Least privilege | Pass | fixed roles (approved §8.2); `core` permission matrix test |
| 4.1.5 | Fails securely | Pass | unknown → 401 / 403; route without rule → start-up error |
| 4.2.1 | Protection against IDOR | Pass | own sessions / passkeys only; every record route checks the permission; field-level SEO rule (`content.db.test.ts`) |
| 4.2.2 | CSRF protection | Pass | header + Origin + Sec-Fetch-Site on **every** state-changing route (`coverage.db.test.ts`), SameSite=Strict |
| 4.3.1 | MFA for administrative interfaces | Pass | required by role; Owner / Admin passkey |
| 4.3.2 | Directory browsing disabled | Pass | nginx: no autoindex; trailing-slash rule (`nginx.db.test.ts`) |
| 4.3.3 | Additional authorisation for sensitive actions | Pass | step-up (§3.7.1) |
| — | Role × route matrix | Pass | `coverage.db.test.ts`: every guarded route × 6 roles, 403 exactly without the permission |

### V5 Validation, sanitisation and encoding

| # | Requirement (short) | Status | Evidence |
|---|---|---|---|
| 5.1.1 | HTTP parameter pollution | Pass | Zod on query, params, body |
| 5.1.2 | Mass assignment | Pass | `.strict()` objects: unknown fields refused |
| 5.1.3 | Positive validation | Pass | enums, lengths, formats |
| 5.1.4 | Structured data validated | Pass | e-mail, phone, URL paths, attribution |
| 5.1.5 | Redirects to allow-listed targets | Pass | `safeFrom` (no open redirect, `logic.test.ts`); redirect rules point to internal paths only (`redirects.db.test.ts`) |
| 5.2.1–5.2.2 | Untrusted HTML sanitised | Pass | no HTML input: texts and lists only; no `dangerouslySetInnerHTML` anywhere (checked) |
| 5.2.4 | No `eval` / dynamic code | Pass | checked |
| 5.2.6 | SSRF | Pass | the server fetches no user-given URL |
| 5.2.7 | SVG / scriptable content | Pass | SVG refused by content sniffing (`media.db.test.ts`) |
| 5.3.1–5.3.3 | Context-aware output encoding | Pass | React; CSV formula-safe cells (`leads.db.test.ts`); e-mails plain text |
| 5.3.4 | Parameterised queries | Pass | Drizzle; `sql.raw` only with code constants, checked at load time and by `scripts/check-sql-raw.mjs` in `npm run lint` |
| 5.3.8 | OS command injection | Pass | the builder spawns `npm run build` with fixed arguments, no shell |
| 5.3.9 | Path traversal / file inclusion | Pass | storage paths from the server; preview and media resolve inside their roots (`media.db.test.ts`, `publishing.db.test.ts`) |
| 5.4.x | Memory safety | N/A | managed runtime |
| 5.5.1–5.5.4 | Deserialisation | Pass | JSON only (`415` otherwise) |

### V6 Stored cryptography

| # | Requirement (short) | Status | Evidence |
|---|---|---|---|
| 6.1.1 | Regulated private data encrypted at rest | Pass | lead e-mail, phone, message, notes: AES-256-GCM per column, row and field bound (`leads.db.test.ts`) |
| 6.2.1–6.2.6 | Approved algorithms, modes, unique nonces | Pass | AES-256-GCM random 96-bit IV; HMAC-SHA-256; Argon2id; TOTP SHA-1 as RFC 6238 requires |
| 6.3.1–6.3.2 | Random values | Pass | `crypto.randomBytes`, UUID v7 only for identifiers |
| 6.4.1 | Key management | Partial / N | key ids and rotation supported; the secret bundle, escrow and rotation runbook: Phase N (approved §12) |
| 6.4.2 | Keys not exposed | Pass | environment only; never in logs or responses; the build environment has no secrets |

### V7 Error handling and logging

| # | Requirement (short) | Status | Evidence |
|---|---|---|---|
| 7.1.1–7.1.2 | No credentials or sensitive data in logs | Pass | redaction; canary tests (`audit-security.db.test.ts`, `leads.db.test.ts`) |
| 7.1.3–7.1.4 | Security events logged with context | Pass | audit log: actor, request id, keyed IP hash, result |
| 7.2.1–7.2.2 | Authentication and access-control decisions logged | Pass | `auth.*`, `access.denied` |
| 7.3.1 | Log injection | Pass | structured JSON |
| 7.3.3 | Logs protected | Pass | audit log append-only for every role (`db.test.ts`) |
| 7.3.4 | Synchronised time | N | chrony / systemd-timesyncd, Phase N |
| 7.4.1–7.4.3 | Generic errors with an id, no stack traces | Pass | RFC 9457 with `request_id` (`audit-security.db.test.ts`) |

### V8 Data protection

| # | Requirement (short) | Status | Evidence |
|---|---|---|---|
| 8.1.1 | Sensitive data not cached on the server | Pass | `Cache-Control: no-store` on the API |
| 8.1.2–8.1.4 | Minimal data in requests, abnormal requests limited | Pass | rate limits; only ids in the outbox |
| 8.1.5–8.1.6 | Backups | N | Phase N (approved §12) |
| 8.2.1 | Anti-caching headers | Pass | API and preview `no-store` |
| 8.2.2 | No sensitive data in browser storage | Pass | admin: none (codes and tokens never stored, E2E); site: attribution only (no personal data) |
| 8.2.3 | Client data cleared at session end | Pass | the admin drops cached queries at sign-out and session end |
| 8.3.1 | Sensitive data in the body, not the URL | Partial | an exact e-mail or phone search in «Заявки» goes in the query string; the API logs URLs without query strings; the admin host's nginx log format must omit `$args` (Phase N) |
| 8.3.2 | Users can remove their data | Pass | leads: bin and anonymisation; staff accounts disabled by an admin |
| 8.3.4 | Sensitive data identified | Pass | `admin-leads.md` §1, approved §13 |
| 8.3.5 | Access to sensitive data audited | **Pass** (Phase M-1) | `lead.view` on every lead page; `lead.export` with filter and count |
| 8.3.7–8.3.8 | Encrypted, retention enforced | Pass | 24 months / 30 days in the bin (`leads.db.test.ts`) |

### V9 Communications

| # | Requirement (short) | Status | Evidence |
|---|---|---|---|
| 9.1.1 | TLS for all connections | Pass / N | nginx 443 only, HTTP → 301, HSTS; certificate: Phase N |
| 9.1.2–9.1.3 | Strong protocols and ciphers | Pass (config) | `ssl_protocols TLSv1.2 TLSv1.3` (Phase M-1); check with an external TLS test on the host: Phase N |
| 9.2.1–9.2.2 | Outgoing connections encrypted | **Pass** (Phase M-1) | SMTP: `smtps://` or STARTTLS required for `smtp://` to another host, TLS 1.2+ (`config.test.ts`); DB and API on loopback |

### V10 Malicious code

| # | Requirement (short) | Status | Evidence |
|---|---|---|---|
| 10.2.1–10.2.6 | No back doors, time bombs, phone-home | Pass | code review; the API makes no outgoing calls except SMTP |
| 10.3.1 | Auto-update | N/A | none |
| 10.3.2 | Integrity of external resources | Partial | Google Fonts stylesheet without SRI (14.2.3) |
| 10.3.3 | Sub-domain takeover | N | DNS records, Phase N |

### V11 Business logic

| # | Requirement (short) | Status | Evidence |
|---|---|---|---|
| 11.1.1 | Steps in order | Pass | release state machine, publication only from a built release |
| 11.1.2 | Realistic human timing | Pass | lead forms: fill time ≥ 3 s, honeypot |
| 11.1.3–11.1.4 | Limits and anti-automation | Pass | rate limits; one build at a time |
| 11.1.5 | Business limits documented | Pass | the `admin-*.md` documents |

### V12 Files and resources

| # | Requirement (short) | Status | Evidence |
|---|---|---|---|
| 12.1.1 | Large files refused | Pass | size limits per kind while streaming (`media.db.test.ts`) |
| 12.1.2 | Compressed files | N/A | no archives accepted |
| 12.1.3 | Per-user quota | Partial | per-file limits and role-restricted upload; no per-user quota (few trusted staff) |
| 12.2.1 | Type checked by content | Pass | magic bytes, allow-list |
| 12.3.1–12.3.6 | No user file names in paths, no traversal, no inclusion | Pass | UUID names; the original name is data only |
| 12.4.1 | Stored outside the web root / not executed | Pass | `MEDIA_DIR`; nginx serves `/media` as static files with `nosniff` |
| 12.4.2 | Antivirus scan of uploads | **Gap** | images are decoded and re-encoded (EXIF removed), which removes payloads in images; videos are stored as uploaded. Plan: ClamAV on the server (Phase N) if the client wants it; uploads come only from signed-in staff with `media.upload` |
| 12.5.1–12.5.2 | Only expected file types served, never executed | Pass | allow-listed extensions; static only |
| 12.6.1 | SSRF on file fetches | N/A | no «upload from URL» |

### V13 API and web services

| # | Requirement (short) | Status | Evidence |
|---|---|---|---|
| 13.1.1 | Same encoding everywhere | Pass | UTF-8 JSON |
| 13.1.3 | No sensitive information in API URLs | Partial | as 8.3.1 |
| 13.1.4 | Authorisation at URI and resource level | Pass | `coverage.db.test.ts` |
| 13.1.5 | Content type checked | Pass | `415` |
| 13.2.1 | Only allowed methods | Pass | Fastify routes; preview server `405` |
| 13.2.2 | JSON schema validation | Pass | Zod; OpenAPI generated from the same schemas |
| 13.2.3 | CSRF on state-changing requests | Pass | `coverage.db.test.ts` |
| 13.2.5–13.2.6 | Content type, trusted headers | Pass | `trustProxy` = loopback nginx only |
| 13.3.x / 13.4.x | SOAP / GraphQL | N/A | |

### V14 Configuration

| # | Requirement (short) | Status | Evidence |
|---|---|---|---|
| 14.1.1–14.1.5 | Build and deployment | Pass / N | lockfile, CI, reproducible builds; automated deployment and config integrity: Phase N |
| 14.2.1 | Components up to date | Pass | `npm audit --omit=dev`: 0 (after `sharp` 0.35.5, `source-map-js` 1.2.2); 9 moderate in development tools only (drizzle-kit's esbuild, potrace's phin), never deployed or run on the server |
| 14.2.2 | Unneeded features removed | Pass | API docs off in production; no sample routes |
| 14.2.3 | SRI for external assets | Partial | Google Fonts serves user-agent-specific CSS, so SRI cannot be used; fonts allowed by CSP only from `fonts.gstatic.com` |
| 14.2.4–14.2.6 | Trusted sources, inventory | Pass | npm registry; `package-lock.json` |
| 14.3.1–14.3.3 | No debug output, no version headers | Pass | `server_tokens off` (`nginx.db.test.ts`); no `X-Powered-By` |
| 14.4.1 | Content-Type with charset | Pass | |
| 14.4.2 | Content-Disposition for downloads | Pass | CSV export `attachment` |
| 14.4.3 | Content Security Policy | **Pass** (Phase M-1) | admin: strict CSP (scripts `'self'`; styles `'unsafe-inline'` for Radix, deviation D-5); API: `default-src 'none'`; site: SITE_CSP with the inline script hash (`nginx.db.test.ts`, `site-csp.e2e.mjs`); preview: the site policy for release files, `default-src 'none'` otherwise |
| 14.4.4 | `nosniff` | Pass | |
| 14.4.5 | HSTS | Pass | production API and nginx |
| 14.4.6 | Referrer-Policy | Pass | |
| 14.4.7 | Framing | Pass | admin / API `frame-ancestors 'none'`; site `'self'` + `X-Frame-Options SAMEORIGIN`; preview `DENY` |
| 14.5.1–14.5.4 | Methods, Origin, CORS, proxy headers | Pass | no CORS; Origin used only for CSRF |

---

## 3. Dynamic scan (OWASP ZAP)

```
DATABASE_URL=…/soltex_scan MIGRATION_DATABASE_URL=…/soltex_scan ZAP_HOME=…/ZAP_2.16.1 \
  node scripts/security-scan.mjs [--no-build] [--minutes 40]
```

**Stack:** the scan starts the stack on loopback, wired as in production:
- the API;
- the built admin under its CSP;
- the preview server;
- the site with the nginx headers.

**Authentication:** a Content Manager signs in with a password and an authenticator code.

**ZAP steps:**
1. Imports the OpenAPI document (182 operations).
2. Spiders the admin and the site.
3. Runs the passive rules.
4. Runs an active scan, authenticated for the admin origin. One thread with a pause between requests keeps it under the API rate limits.

**Disposable database:** the scan's database must end in `_scan`, because the active scan changes data.

**Report:** `.qa/zap/report.html`.

**Result (2026-10-17):**
- **Volume:** 40 minutes of active scanning; the scanner stayed signed in to the end.
- **Findings:** no High alerts. The only Medium is `style-src 'unsafe-inline'`.
- **Earlier runs** of the same day found missing CSP, anti-clickjacking and `nosniff` headers on the site and the preview server. They are fixed (§1).

| Alert | Risk | Where | Decision |
|---|---|---|---|
| 10055 CSP: style-src unsafe-inline | Medium | admin, site, preview | Accepted. The admin needs it for Radix (deviation D-5), the site for React `style` attributes. Scripts are limited to `'self'` (and the site's one hash) |
| 40014 XSS weakness (persistent in JSON response) | Low, low confidence | `GET /api/v1/releases` (release note) | False positive. The text is returned as JSON with `nosniff` and an API CSP of `default-src 'none'`, and the admin renders it as text (React) |
| 10111 Authentication request identified | Info | login, users | Expected |
| 10027 Suspicious comments | Info | minified JS bundles | Library comments; no secrets (the bundles are scanned for secrets in CI) |
| 10109 Modern web application | Info | admin | Expected (single-page app) |

---

## 4. Open points and owners

| # | Point | Owner / phase |
|---|---|---|
| S-1 | Antivirus scan of uploaded videos (12.4.2) | client decision; ClamAV in Phase N |
| S-2 | Security e-mails (lock-out, factor changes, password change) delivered | SMTP from the client (B5); outbox path, deviation K-3 |
| S-3 | nginx log format of the admin host without query strings (8.3.1) | Phase N |
| S-4 | TLS check of the real host (9.1.2), DNS / sub-domain takeover (10.3.3), time sync (7.3.4), OS accounts (1.2.1), backups (8.1.5–8.1.6), key escrow (6.4.1) | Phase N |
| S-5 | Online breached-password lookup (2.1.7) | not planned (no third-party calls); the local list stays |
