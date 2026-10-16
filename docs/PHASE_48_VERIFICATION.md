# Phase 48 verification - running on Vercel with Neon

Date: 2026-10-13. Goal: let the same code run as a Vercel serverless function backed by Neon, without breaking the Render/Docker setup.

## What changed
| Area | Change |
|---|---|
| Entry | `server.ts` exports the Express app and does not listen when `VERCEL` is set. `api/index.js` (committed wrapper) re-exports `build/serverless.mjs`, the bundle made by `npm run build:vercel` from `serverless/entry.ts`. Docker/Render/`npm start` behave as before. |
| Limits | New `src/lib/rate-store.ts` + `RateEvent` table (migration `20261013000000_rate_events`). Sign-in / join-code lock-outs, the tutor limit, upload limit and AI question-generation limit are counted in the database on Vercel (or with `DURABLE_RATE_LIMITS=true`), in memory elsewhere. The broad per-minute request ceilings stay per instance. `checkLoginThrottle`, `recordLoginFailure`, `clearLoginFailures` and `AITutorService.checkRateLimit` became async. |
| Uploads | On Vercel the original file is not stored (`originalsAreKept()`); the extracted text still is. Upload limit 4 MB there (`maxUploadBytes()`), with a plain 413 message. The upload route reports `originalKept` and a note. |
| Database | Connection settings on Vercel: 3 connections per instance; Neon's pooled host gets `pgbouncer=true`. Prisma generator also builds the `rhel-openssl-3.0.x` engine. |
| Setup | `npm run setup:db` (`scripts/setup-database.ts`): migrations, course, first administrator; no shell script; refuses the pooled address. |
| Config / docs | `vercel.json` (build, rewrites, function time, page security headers), `.vercelignore`, `.env.vercel.example`, `docs/DEPLOY_VERCEL_NEON.md`, RUNBOOK 9c, README line, Vercel-aware `check:env`. |

## Tests added
* `npm run test:phase48` - `scripts/test-phase48-store.ts`: host settings and the store in memory mode, plus shared (database) mode when a migrated PostgreSQL is available. Same assertions in both modes.
* `npm run test:phase48:pg` - `scripts/test-phase48-serverless.ts` (it runs the store test, including its database half, on its own fresh database, and fails if that half is skipped): fresh database -> `setup:db` (twice; pooled address refused) -> the real bundle in `scripts/serverless-shim.mjs` (read-only project disk, `vercel.json` headers on the page) -> four instances: two with shared limits, two without.
* `scripts/test-phase48-browser.mjs` - Chromium at phone size under the real Content-Security-Policy.

## Results
* `npm run test:phase48` (memory): 23 passed. `test-phase48-store.ts` with a migrated PostgreSQL (memory + shared mode): 41 passed. `test-phase48-serverless.ts`: 30 passed (setup:db on an empty database and again; pooled address refused; /api/ready, JSON 404, no X-Powered-By, app version found in the bundle; a token from instance A accepted by B; lock-out after 8 wrong passwords on A refuses the right password on B, and the control instances with sharing off do not; tutor limit 20 answered / 4 refused across two instances; small document imported with no file written and no storage path; 5 MB file refused with 413 and a plain message; a short AUTH_SECRET stops start-up without printing it; Chromium at 390 px, student and teacher pages, no script errors or policy violations, page carries the vercel.json headers).
* A first run of the serverless test found two real issues, both fixed: the shim's own wrapper added `X-Powered-By` (test harness only), and the start-up check for a bad `AUTH_SECRET` is raised by the existing code before the new check runs (still loud and clear; the test accepts either message). A first run of the store test silently skipped shared mode because of a wrong table check; fixed so the check is explicit.
* **Full regression on the final code** (`tsc`, `build`, and every in-memory and PostgreSQL suite, phases 22-48): **51 of 51 steps passed**, no re-runs needed. A re-run of `test:phase48:pg` afterwards (2026-10-16) passed 32 of 32; it also exposed that the shared development database lacks the new table, so the store test's database half had been skipped there - now it is always run on a fresh database. Earlier browser journeys were not re-run in this pass.

## What was NOT verified (read this)
* **No real Vercel deploy.** The shim stands in for the platform. Not proven: Vercel's build of `vercel-build`, its tracing of `node_modules` into the function (`includeFiles` is set for the Prisma engine), the `rhel-openssl-3.0.x` engine at run time, request-body handling by Vercel's Node runtime with `express.json()` / `express.raw()` (documented as working for Express; confirm that sign-in works on the first deploy), cold-start time, the 60 s function limit on the Hobby plan, the 4.5 MB body ceiling in practice.
* **No real Neon.** Tested on a local PostgreSQL 16. Neon's pooled address (PgBouncer) was never connected to; `pgbouncer=true` is the documented setting.
* The Docker image is still unbuilt outside the test environment; Render deploy unchanged and still untried.
* Live Gemini, real-phone voice, real users: unchanged (not done).
* The broad per-minute request ceiling is per instance on Vercel by design (one database write per request would load the free database).
* Vercel's Hobby plan is for non-commercial use; check their current terms for the school.
