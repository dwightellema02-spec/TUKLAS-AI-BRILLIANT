# Phase 30 — Session revocation, CSRF protection and the audit log: verification report

**Status:** implemented and tested over HTTP in both stores, on PostgreSQL (including a production-mode server), in a real browser, and with mutation checks. A security review by a person, and a penetration test, have **not** been done; see section 5.

## 1. Defects found (all pre-existing)

| # | Finding | Severity | Fix |
|---|---|---|---|
| 1 | **Sessions could not be revoked.** A session token was a signed blob valid for 7 days. Changing a password, losing a phone, or an administrator removing someone changed nothing: the old token kept working. | High | Every API request looks the account up. The token is honoured only if the account exists, is not disabled, and the token's **session version** equals the account's. |
| 2 | **Roles were frozen into the token.** A demoted teacher kept teacher rights (and a deleted/disabled account kept access) until the token expired. | High | The role, name and email used by every route are the account's **current** ones, read on each request. |
| 3 | **Cross-site request forgery.** The production cookie was `SameSite=None`, so any other website could make a signed-in browser send authenticated POSTs to the API. | High | Cookie is `HttpOnly; Secure (production/https); SameSite=Lax`. In addition, state-changing `/api` requests marked cross-site by the browser, or whose `Origin` is not this site (or listed in `ALLOWED_ORIGINS`), are refused. Requests with an `Authorization` header are exempt (a forged request cannot set it). |
| 4 | The sign-in token was also stored in `localStorage`, readable by any script injected into the page. | Medium | The web app no longer stores it (the HttpOnly cookie is enough on the same origin); an older stored token is deleted on load. |
| 5 | No account controls: no password change screen, no "sign out everywhere", an administrator could not disable an account, change a role, or reset a password. | Medium | Account page for users; administrator controls to disable/enable, sign out devices, reset password and change role, with safeguards (not your own account; the last active administrator). |
| 6 | No audit trail. | Medium | `AuditLog` table (or in-memory list without a database) with an administrator viewer: account creation/changes, password changes, sign-out-everywhere, blocked sign-ins to disabled accounts, lesson status changes, and content-block creation/edits/deletes (answer-key edits are recorded without the key). No password or hash is ever written. |
| 7 | No security headers; API answers (personal data) could be cached. | Low | `nosniff`, `Referrer-Policy`, `Permissions-Policy`, `Cache-Control: no-store` on `/api`; in production also `X-Frame-Options: DENY` + `frame-ancestors 'none'` (unless `ALLOW_EMBEDDING=true`) and HSTS over https. |
| 8 | Signature comparison could throw on a malformed token (length mismatch). | Low | Length checked first. |

## 2. How it works

* `User.sessionVersion` and `User.disabledAt` (schema push needed on existing databases). A password change, reset, role change, disable/enable or "sign out" increments the version; every older token stops working at once. Enabling an account does not bring old tokens back.
* The check runs in one global middleware, so all ~170 existing routes get it without being edited. Cost: one primary-key lookup per API request.
* Changing your own password returns a fresh token/cookie so that device stays signed in; all others are signed out.
* A normal "Sign out" only clears this browser's cookie (it is not a revocation); "Sign out on all devices" revokes everything.
* New environment options: `COOKIE_SAMESITE` (`lax` default, `strict`, `none` for cross-site embedding, which forces `Secure`), `ALLOWED_ORIGINS` (comma list), `ALLOW_EMBEDDING`.

## 3. Evidence

| Check | Result |
|---|---|
| `scripts/test-phase30-sessions.ts`, in-memory | **66/66** over HTTP: password change signs out both other devices and keeps this one; wrong current password changes nothing; sign-out-everywhere; admin disable (token dies at once, generic login error identical to a wrong password), enable (old token does NOT return), revoke, reset (weak refused); role change effective at once; self-disable / self-demote / self-reset refused; unknown user 404; non-admins refused; forged, tampered (role edited to ADMIN), expired, old-version, legacy no-version, unknown-account and garbage tokens refused; cookie flags; 12 cross-site cases (own origin OK, no Origin OK, evil origin / `null` / `Sec-Fetch-Site: cross-site` refused on POST and PATCH and login and logout, GET allowed, Bearer exempt); security headers; audit contents, actors, filtering, no secrets and no answer key |
| Same suite on PostgreSQL (`scripts/test-phase30-prisma.ts`) | **66/66** on a brand-new production-style database + **25/25** database and production-mode checks: stored session versions and `disabledAt`, 16 audit rows with no secret, an answer-key edit recorded without the key, production cookie `HttpOnly; Secure; SameSite=Lax`, production anti-framing headers, HSTS, cross-origin login refused, `COOKIE_SAMESITE=none` + `ALLOWED_ORIGINS` + `ALLOW_EMBEDDING` variants, and "behind the app's back" changes: a role or disabled flag changed directly in the database takes effect on the very next request |
| Real browser (`scripts/test-phase30-browser.mjs`) | **all checks pass**: sign-in leaves no token in `localStorage`/`sessionStorage`; the cookie is HttpOnly + SameSite=Lax and not in `document.cookie`; on the account page a mismatched confirmation and a wrong current password are rejected, the change succeeds, device A stays signed in, device B is signed out; "Sign out on all devices" kills the other session; the admin page disables a teacher (their session dies immediately, the audit list shows it) and enables again |
| Mutation checks (change made -> a check must fail) | session version ignored -> 8 failing; password change does not revoke -> 2; origin check removed -> 5; Sec-Fetch-Site rule removed -> 1; Bearer exemption applied to everything -> 6; cookie default SameSite=None -> 2; self-disable allowed, disable not audited, secrets written to the audit log, distinct "disabled" error -> each detected (suite fails/crashes); on PostgreSQL: role taken from the token instead of the account -> 1; disabled flag ignored -> 1. All restored. |
| Regression | (see section 4) |

Honest note on two layers: the "disabled" flag and the "role from the account" rule are second lines of defence behind the version bump, so the in-memory suite alone cannot tell them apart (a normal disable or role change also bumps the version). That is why the PostgreSQL wrapper changes those columns directly in the database and checks the very next request; with either rule removed that check fails.

## 4. Regression

Run after the final code change: tsc and vite build clean; phases 9, 10, 12 (21/21), 13 (25/25), 14 (32/32), 22 (149), 23 (209), 24 (161), 25 (113), 26 (41), 27 (52), 28 (43), 29 (52), 30 (66), auth-repair and workflow pass. PostgreSQL scripts: 22 (12/12) and 23 (14/14) on a demo-seeded development database, 25 (113 + 19), 26 (43 + 12), 27 (53 + 12), 28 (43 + 10), 29 (52 + 17), 30 (66 + 25). Real-browser scripts on fresh servers: phase 22 (11/11), 23 (10/10), 24 (10/10), 25, 27, 28, 29 and 30 (all pass). The old phase 6/7/8 scripts remain unrunnable (hard-coded stale tokens) and were not run.

Upgrade note: existing databases need `npx prisma db push` (new `User.sessionVersion`, `User.disabledAt` and the `AuditLog` table); the Docker start command already does this. Sessions issued before the upgrade keep working until their account's session version changes (they carry no version, which counts as 0).

## 5. What this does NOT prove / known gaps 👤

1. **No independent security review or penetration test.** Treat this as a solid baseline, not an assurance. Not covered: password-reset by email (there is none), multi-factor sign-in, device/session list ("where am I signed in"), rate limiting beyond sign-in and join-code attempts, a Content-Security-Policy (the app loads inline scripts/styles, maths rendering and embedded video, so a strict policy needs work), and subresource integrity.
2. **Tokens still live 7 days** and the session check costs one database read per API request; there is no sliding expiry or idle timeout, and no per-device revocation (only all devices).
3. **A normal "Sign out" does not revoke** the token, only clears this browser's cookie. Someone who copied the token before could still use it until the user chooses "Sign out on all devices" or changes the password.
4. The cross-site protection relies on browsers sending `Origin` / `Sec-Fetch-Site`. Very old browsers that send neither are allowed through (they still have the `SameSite=Lax` cookie). Bearer-token API clients are not CSRF-protected by design.
5. The first administrator is created from environment variables; there is no recovery flow if every administrator loses access (use `npm run admin:create` with a new address, or edit the database).
6. The audit log is in the application database (an administrator with database access can alter it), has no retention policy or export, and does not yet record failed sign-ins in general (only blocked disabled-account attempts), read access to student data, or class/assignment changes.
7. No real users; mobile and accessibility of the new screens not audited; the demo accounts' shortcut buttons in the sign-in dialog are hidden in production builds but the demo password text still exists in the bundle.
8. Unchanged earlier gaps: live Gemini tutor evaluation not run, Filipino text unreviewed, research statistics not validated by a researcher.

## 6. Manual tests required 👤

* Sign in on your phone and your computer, change the password on one, and confirm the other is signed out.
* As an administrator, disable a real teacher account and ask them to try to use their open tab.
* Put the site behind your real HTTPS host and confirm the cookie shows `Secure; HttpOnly; SameSite=Lax` in the browser developer tools.

## 7. Recommended next phase

1. Content-Security-Policy and a security review/penetration test; idle timeout and a "my devices" list.
2. Statistical review of the research metrics and a teacher screen for choosing pre/post assessments.
3. Live tutor evaluation when a Gemini key is available.
