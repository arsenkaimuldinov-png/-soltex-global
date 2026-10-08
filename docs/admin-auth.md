# Admin authentication, roles and audit (Phase C)

**Architecture:** [`admin-architecture-approved.md`](admin-architecture-approved.md) §7, §8, §10, §19, §23.
**Code:**
- `packages/core/src/domain/permissions.ts`: roles, permissions, MFA requirement, user-management rules;
- `apps/api/src/auth/`, `audit/`, `http/`, `routes/`, `users/`;
- migrations `apps/api/drizzle/0002_*`, `0003_*`.

**API description:** [`apps/api/openapi.json`](../apps/api/openapi.json) (OpenAPI 3.1, generated from the route schemas).

The admin UI does not exist yet. Phase C delivers the server side only.

---

## 1. Roles and permissions

Six fixed roles. Permissions are an explicit list per role. There is no wildcard, no `isAdmin` shortcut, and no role hierarchy in the code. Unknown roles or permissions are always denied.

| Permission | Owner | Admin | Content Manager | Editor | SEO Specialist | Marketer |
|---|:-:|:-:|:-:|:-:|:-:|:-:|
| content.read | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| content.edit | ✓ | ✓ | ✓ | ✓ | | |
| content.publish | ✓ | ✓ | ✓ | | | |
| seo.read | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| seo.edit | ✓ | ✓ | ✓ | | ✓ | |
| seo.publish | ✓ | ✓ | | | ✓ | |
| redirects.read | ✓ | ✓ | ✓ | | ✓ | |
| redirects.manage | ✓ | ✓ | | | ✓ | |
| media.read | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| media.upload | ✓ | ✓ | ✓ | ✓ | | |
| media.replace | ✓ | ✓ | ✓ | | | |
| media.delete | ✓ | ✓ | | | | |
| leads.read / manage / export | ✓ | ✓ | | | | ✓ |
| users.manage | ✓ | ✓ | | | | |
| settings.manage | ✓ | ✓ | | | | |
| system.read | ✓ | ✓ | ✓ | | ✓ | |
| system.deploy | ✓ | ✓ | ✓ | | | |
| system.rollback | ✓ | ✓ | | | | |
| audit.read | ✓ | ✓ | | | | |

**Field-level rules** (`deniedContentFields`):
- the SEO Specialist may change only SEO fields (slug, meta texts, OG image, noindex, canonical, alt text);
- the Editor may change content fields but not SEO fields.

The content API (Phase E) will enforce these rules. The test suite already covers them.

**User management** (`canManageUser`):
- only an Owner may create an Owner, or change or disable one;
- nobody changes their own role or status, or resets their own MFA, through user management;
- `users.manage` is required for everything else.

**Permission chain per request** (`apps/api/src/auth/guard.ts`):
1. Every `/api/v1` route must declare `config.access`. The app refuses to start when a route has none.
2. The check runs in `preValidation`, so an anonymous caller gets `401` before any input validation.
3. The order of checks is: session → second factor → role MFA requirement → permission → step-up.
4. A denied permission is written to the audit log (`access.denied`).

| Access level | Requires |
|---|---|
| `public` | nothing: `GET /health`, `POST /auth/login`, `POST /auth/password-reset/request`, `POST /auth/password-reset/confirm` |
| `pending` | a live session, even before the second factor (session info, logout, MFA verification) |
| `enrollment` | the second factor, if one is enrolled; the role requirement may still be unmet (enrolling a factor). Adding a further factor needs step-up |
| `full` | the second factor and the role requirement met; optionally a `permission` and `stepUp` |

---

## 2. Passwords

- **Hashing:** Argon2id (`@node-rs/argon2`), m = 19 MiB, t = 2, p = 1 (OWASP minimum).
- **Unknown e-mail:** the login still verifies against a dummy hash, so response timing does not reveal whether an account exists.
- **Policy:** 12–256 characters; not on the bundled list of common passwords; must not contain the local part of the account e-mail. There are no composition rules (NIST 800-63B).
- **Change:** needs the current password and a full session. The session token rotates, and the user's other sessions are revoked.
- **Reset:**
  - a random token, stored as sha256, valid 30 minutes, single use;
  - the response is the same whether or not the account exists;
  - confirming sets the new password, revokes every session and does **not** sign the user in;
  - e-mail delivery arrives in Phase K. Until then the `Notifier` only logs that a reset was requested: never the token, never the address.

**Brute-force protection:**

| Mechanism | Value |
|---|---|
| Progressive delay per account | after 5 consecutive failures: 2^(n−5) s, at most 300 s (`429 login_throttled` + `Retry-After`) |
| Account lock-out | 20 consecutive failures → locked for 15 minutes for **unknown devices**. A browser that has signed in successfully before (`__Host-soltex_device` cookie, stored hashed, 180 days) can still sign in, so an attacker cannot lock out the real user |
| Per IP | login 30 / 15 min; reset request 5 / h; reset confirm 10 / 15 min; MFA verify 10 / 5 min; passkey options 20 / 5 min; password change 10 / 15 min; global 600 / min |
| On lock-out | audit `auth.lockout` and a security alert to the user (delivered from Phase K) |

---

## 3. Sessions

- **Token:** an opaque random token (32 bytes) in the cookie `__Host-soltex_session` (`HttpOnly`, `Secure`, `SameSite=Strict`, `Path=/`). The database stores only its sha256. Nothing is signed, so the API has no session secret.
- **Lifetime:**
  - idle timeout 8 h;
  - absolute timeout 7 days;
  - a session waiting for its second factor expires after 10 minutes.
- **Assurance level:**
  - `aal = 1` after the password;
  - `aal = 2` after a passkey, TOTP or recovery code;
  - the token rotates at every level change and at every password change (session fixation).
- **Step-up:** sensitive actions need a second factor verified within the last 10 minutes. These actions are user management, removing a factor, regenerating recovery codes, and adding a factor once one exists.
- **Failed second factors:** after 5 failed checks the session is revoked.
- **Endpoints:**
  - list own sessions;
  - revoke one;
  - revoke all others;
  - logout;
  - an admin can revoke all sessions of a user.
- **Automatic revocation:** a role change, disabling an account, a password reset and an MFA reset revoke all of the user's sessions.
- **Stored per session:** IP as a keyed HMAC hash only, and the User-Agent truncated to 200 characters.

---

## 4. Second factors

| Role | Requirement (`mfaRequirement`) |
|---|---|
| Owner, Admin | **passkey** (TOTP alone is not enough) |
| Content Manager, SEO Specialist, Marketer | any second factor (they hold sensitive permissions) |
| Editor | none, unless `MFA_FOR_ALL_ROLES=true` (client decision, approved §22 item 7) |

Users who still have to enroll get `mfa_enrollment_required` everywhere except the enrollment endpoints. The first factor can be enrolled at `aal 1`, directly after the password.

**Passkeys (WebAuthn, `@simplewebauthn/server`):**
- the relying party is `WEBAUTHN_RP_ID`, the origin is `ADMIN_ORIGIN`;
- user verification (biometrics / PIN) is required;
- registration uses attestation `none`;
- only the public key, sign counter, transports and backup flags are stored, never anything secret.
- **Challenges:**
  - random, stored in `webauthn_challenges`, valid 5 minutes;
  - bound to the session, the user and the purpose (registration / authentication);
  - consumed atomically, so they are single use. A replay, an expired challenge, another session's challenge or a registration challenge used for sign-in → `challenge_invalid`.
- **Ownership:** a credential must belong to the signing-in user. A user can list and remove only their own passkeys. The last passkey of a role that requires one cannot be removed.

**TOTP (otplib, RFC 6238, SHA-1, 6 digits, 30 s, ±1 step):**
- the secret is encrypted with AES-256-GCM: `v1.<key id>.<iv>.<tag>.<ciphertext>`;
- the additional authenticated data is `totp:<user id>`, so a secret copied to another user does not decrypt;
- keys come from `DATA_ENCRYPTION_KEYS` and can be rotated by key id;
- a used time step is stored atomically, so the same code cannot be used twice;
- removing TOTP needs step-up and is refused when it is the user's only factor.

**Recovery codes:**
- 10 codes of 128 bits each, shown **once**, when the first factor is enrolled and on regeneration (step-up);
- stored as sha256; each code works once;
- using one sends a security alert.

**Lost device:** an admin with `users.manage` resets the user's MFA (`POST /users/:id/mfa-reset`, step-up). This removes all factors and recovery codes, revokes the user's sessions, alerts the user and writes an audit event. The user must enroll again at the next sign-in. Nobody can reset their own MFA this way.

---

## 5. Audit log

`audit_events` is append-only:
- `soltex_app` has `INSERT, SELECT` only;
- a trigger raises an error on `UPDATE`, `DELETE` and `TRUNCATE` even for the owner role (`drizzle/0003_audit_append_only.sql`);
- the tests prove all three for the app role and for the owner role.

**Columns:**
- `id` (bigint identity), `at`;
- `actor_id`, `action`, `resource_type`, `resource_id`, `result` (`success` / `failure` / `denied`);
- `request_id` (= the response `X-Request-ID`), `ip_hash`, `user_agent`;
- `summary` (jsonb), `schema_version`.

**Secrets never reach the audit log or the application log:**
- `summary` accepts only whitelisted keys (`reason`, `method`, `role`, `factor`, `count`, `email_hash`, …). Secret-looking keys (password, token, secret, code, cookie, e-mail, …) raise an error. Values are limited to 200 characters;
- e-mail addresses of unknown accounts are stored only as `email_hash` (keyed HMAC);
- IP addresses are stored only as a keyed HMAC;
- the logger redacts `cookie`, `authorization` and `set-cookie`, and logs request URLs without the query string;
- a test greps the logs and the audit rows for the password, session token, token hash, TOTP secret, recovery codes and reset token.

**Events:**
- `auth.login` (password; result success / failure / denied), `auth.lockout`, `auth.logout`;
- `auth.mfa` (second factor or step-up, `factor` and `step_up` in the summary);
- `auth.password.change`, `auth.password_reset.request`, `auth.password_reset.confirm`;
- `auth.session.revoke`, `auth.session.revoke_others`;
- `mfa.totp.enroll_start`, `mfa.totp.enroll`, `mfa.totp.disable`, `mfa.recovery.regenerate`;
- `mfa.passkey.register`, `mfa.passkey.remove`;
- `user.create`, `user.update`, `user.profile_update`, `user.mfa_reset`, `user.sessions_revoke`, `user.bootstrap_owner`;
- `access.denied`.

**Reading:** `GET /api/v1/audit` (`audit.read`): newest first, cursor `before`, filters `actorId` and `action`.

---

## 6. HTTP conventions

| Topic | Implementation |
|---|---|
| Errors | RFC 9457 `application/problem+json`: `{type: "urn:soltex:problem:<code>", title (Russian), status, code, detail?, errors?, request_id}`. No stack traces; internal errors are logged with the request ID only |
| Request ID | `X-Request-ID` from nginx is accepted only if it is a UUID; otherwise a UUIDv7 is generated. Returned on every response, in every problem and in every audit row |
| CSRF | state-changing requests need `X-Requested-With: soltex-admin`. When present, `Origin` must equal `ADMIN_ORIGIN` and `Sec-Fetch-Site` must be `same-origin` or `none`. Cookies are `SameSite=Strict` |
| CORS | none: the admin and the API share one origin |
| Headers | `@fastify/helmet`: CSP `default-src 'none'; frame-ancestors 'none'`, `nosniff`, `Referrer-Policy: no-referrer`, HSTS in production; `Cache-Control: no-store` on `/api` |
| Input | Zod 4 schemas on every body, query and parameter; unknown fields rejected; body limit 64 KB (`413`); JSON only (`415`) |
| Rate limits | `@fastify/rate-limit`, in memory (one API process, approved §10); `429` as a problem with `Retry-After` |
| OpenAPI | 3.1.0, generated; each operation lists its security (session cookie, CSRF header) and `x-soltex-access`. `GET /api/v1/docs/openapi.json` needs `system.read` and is **off in production**. CI fails when `apps/api/openapi.json` is out of date |

---

## 7. Configuration

All values come from environment variables; see the root `.env.example`.

| Variable | Purpose |
|---|---|
| `ADMIN_ORIGIN` | origin of the admin and the API (CSRF, WebAuthn); https in production |
| `WEBAUTHN_RP_ID`, `WEBAUTHN_RP_NAME` | relying party. Changing the ID later invalidates every passkey |
| `DATA_ENCRYPTION_KEYS`, `DATA_ENCRYPTION_KEY_ID` | AES-256-GCM keys `id:base64(32 bytes)`, comma-separated; the current key id |
| `HASH_SECRET` | HMAC key for IP and e-mail hashes (≥ 32 bytes, base64) |
| `SESSION_COOKIE_SECURE` | must stay `true` (production refuses `false`) |
| `API_DOCS` | `off` / `authenticated`; forced `off` in production |
| `MFA_FOR_ALL_ROLES` | `true` also requires a second factor for Editors |

The API refuses to start without valid keys, except in `NODE_ENV=test` unit runs without a database.

---

## 8. First Owner

```
npm run auth:bootstrap-owner          # on the server, with the API environment
```

- Asks for the e-mail and name. The password is asked twice and never echoed.
- For automation: `-- --email … --name … --password-stdin < file`.
- Refuses (exit 3, nothing changed) when an active Owner already exists. It is safe to run again.
- A transaction-level advisory lock prevents two parallel runs from creating two Owners.
- Writes the audit event `user.bootstrap_owner` (`{method: "cli"}`).
- There are no default users or passwords anywhere.
- The Owner then signs in to the admin and must register a passkey before anything else.

All other users are created by an Owner or Admin in the admin (`POST /api/v1/users`, step-up) with an initial password.

---

## 9. Tests

| Suite | Tests | Covers |
|---|---|---|
| `packages/core/test/permissions.test.ts` | 6 | full role × permission matrix, no wildcard, MFA requirement, field-level, user-management rules |
| `apps/api/src/*.test.ts`, `src/auth/auth.unit.test.ts` | 20 | config, health, request IDs, problems, headers, access rule enforcement, OpenAPI coverage and drift, AES-GCM, Argon2id, password policy, throttle curve |
| `test/auth.db.test.ts` | 11 | login, cookie flags, logout, expiry, rotation, revoke / revoke-all, brute force and lock-out, known device, password change and reset |
| `test/mfa.db.test.ts` | 10 | TOTP enroll / verify / replay / encryption at rest, recovery codes, step-up, MFA failure limit |
| `test/passkeys.db.test.ts` | 10 | registration, sign-in, counter, challenge lifecycle (replay, expiry, session, purpose), origin, RP ID, user verification, ownership, last passkey |
| `test/rbac.db.test.ts` | 9 | every role against every guarded endpoint, nothing public by accident, user management and Owner rules, step-up, MFA reset |
| `test/audit-security.db.test.ts` | 10 | audit content, no secrets in audit or logs, request IDs, RFC 9457, validation, 413, CSRF, headers, no CORS, append-only |
| `test/bootstrap.db.test.ts` | 5 | first Owner, repeat refusal, weak password, CLI exit codes, no password echo |
| `src/db/db.test.ts` | 9 | Phase B round trip and roles, plus the audit grants and trigger for the app, owner and backup roles |

Commands:
- `npm test`: no database needed;
- `npm run test:db`: a provisioned PostgreSQL 17; it creates test users, so use a separate local database.
