# Tuklas AI Pre-Deployment Risk Report

Date: 2026-10-06. Scope: the code on branch `ccr-d5d3f1ee-004qqa` (built on `main` after PR #2). Nothing was deployed and no infrastructure was changed.

## 1. Overall status
🟡 **DEPLOYABLE BUT NEEDS SMALL FIXES** — for a controlled pilot on a single persistent Docker host with PostgreSQL. **Not deployable to Vercel/serverless** as built. Items 1–4 of the original risk list are fixed and tested; the remaining items are things only you can do (host, secrets, DPO review) or could not be tested here (real AI, Docker build).

## 2. Project configuration (from the code, not from earlier reports)
| | |
|---|---|
| Framework | Express 4 server (`server.ts`) + Vite/React 19 front end. **Not Next.js.** |
| Database / ORM | PostgreSQL 16, Prisma 6.4.1, migrations in `prisma/migrations` |
| Authentication | HMAC-signed session tokens (HttpOnly cookie or Bearer), bcrypt (cost 10), per-account and per-address login throttles |
| AI provider | `AI_PROVIDER=local` (built-in rule-based tutor, tested) or `gemini` (`@google/genai`, **never run live here**) |
| Deployment files | `Dockerfile`, `docker-compose.yml`, `render.yaml` (Render). No `vercel.json`, no Next config |
| Git | github.com/dwightellema02-spec/TUKLAS-AI-BRILLIANT; no `.env*` or secrets tracked (only `.env.example`, `.env.production.example`) |

## 3. Test results
| Check | Result |
|---|---|
| TypeScript (the project's lint; there is no ESLint) | PASS |
| Production build | PASS |
| Unit/integration suites, in-memory and PostgreSQL (phases 22–44) | see "Regression after fixes" below |
| Browser tests | Phase 34 journey, 39, 43 PASS (earlier today); not re-run after the small fixes |
| Database / migrations | PASS: built from the real migrations; schema == migrations is itself a test (phase 42) |
| Security probe (`scripts/pre-deployment-probe.ts`, production mode, fresh PostgreSQL) | **48 passed, 0 failed** after the fixes (first run: 40 passed, 8 failed) |
| Real AI | **NOT VERIFIED** (no API key available) |

### Regression after fixes
Full regression was still running when this was committed; the final result is recorded in the next commit.

## 4. The "minor risk" warning
**WARNING SOURCE NOT FOUND IN LOCAL CODEBASE.** There is no Vercel or Next.js configuration in the repository. If it appeared in a hosting dashboard, the exact text is needed to say what it means. The only warning-like items in the repo are the `npm audit` findings (section 6, item 7) and the hosting-compatibility points below; I am not claiming either is the warning you saw.

## 5. 🟢 Safe findings (verified by probing a production-mode server)
* Production **refuses to start without PostgreSQL** (`server.ts`, needs an explicit demo override otherwise); the demo accounts cannot sign in in production.
* **No silent in-memory fallback**: with the database made unavailable, curriculum and sign-in requests fail (5xx), `/api/ready` returns 503, and the app recovers by itself when the database returns. Accounts survive a restart.
* **IDOR**: a student cannot reach another student's practice session, tutor conversation, profile, insights, mastery, research data or exports; a teacher cannot reach another teacher's class, students, consent flags or exports; student/teacher cannot reach admin routes (25+ requests, all refused).
* **Browser-supplied values are not trusted by the tutor**: the student id comes from the session; forged `studentId`, `role`, `isCorrect`, `expectedAnswer` fields are ignored and the conversation belongs to the signed-in student. Answers are graded server-side (phase 27).
* **AI as a proxy**: signed-out callers refused; per-account rate limit works (40 rapid requests → refused); 100 KB request-body limit; 1,000-character message limit.
* **Sign-in does not reveal accounts**: identical status and message for unknown email and wrong password, and equal response time (93 ms vs 94 ms).
* `/api/health` and `/api/ready` expose no secrets (health says connected/not connected and a version; ready says only true/false).
* Server log contains neither `AUTH_SECRET` nor any password; `/.env` and the server source are not served; HSTS and no-framing headers are on.

## 6. 🟡 Minor risks
| # | Risk | Evidence | Impact | Fix | Status |
|---|---|---|---|---|---|
| 1 | Another student's practice session id returned **500** (answer route 400) | probe B; `db.ts` threw a plain Error | No data was returned; wrong status, noisy logs, hints that the id is real | `getPracticeSession` now returns "not found" for someone else's session; routes map "not found" to 404 | **FIXED**, tested (`test-phase44-hardening.ts`, probe B) |
| 2 | A tutor message over 1,000 characters returned a generic **500** | reproduced: 2,000 chars → 500, log "exceeds the maximum allowed length" | The limit already existed (the UI input is capped too) but an API client or paste got a misleading "temporarily unavailable" | 400 with a clear message | **FIXED**, tested |
| 3 | `X-Powered-By: Express` sent | probe E | Tells scanners the framework | `app.disable("x-powered-by")` | **FIXED**, tested |
| 4 | Login timing looked different (93 ms vs 59 ms) | first probe | **My probe was wrong**: after 5 wrong passwords the per-account lockout answers faster. With attempts below the lockout, timings are equal | none needed; probe corrected | Not a defect |
| 5 | `render.yaml`: free plan sleeps and its disk is not persistent (uploaded documents lost); first-admin and privacy variables missing; health check used `/api/health` | file review | Lost uploads and a missing privacy contact on Render | Added the variables, `/api/ready` health check, and a comment; **plan left unchanged (it costs money)** | Partly fixed; you must pick a paid plan with a disk |
| 6 | Rate limits (and the tutor limit) are **in memory** | `rateCheck` in `server.ts`, `rateLimitMap` in `tutor.ts` | Correct for one instance; **wrong with 2+ instances or serverless** (each has its own counters) and reset on restart | Run exactly one instance; move to a shared store before scaling | Open (by design for a pilot) |
| 7 | `npm audit`: 4 findings (1 high, 3 moderate) | `npm audit --omit=dev` | `source-map-js` (high) is a build-time CSS tool, not reachable by users. `mammoth` (+`argparse`, `sprintf-js`, moderate) parses uploaded `.docx`: denial-of-service only. The offered "fix" is a **downgrade of `mammoth` to 0.3.29**, which I did not apply | Watch for upstream releases; cap upload size | Open, accepted |
| 8 | `/api/health` names the provider `neon-postgresql` even if the database is not Neon | probe E | A label the UI uses; no secret | none | Cosmetic |
| 9 | Registering an existing email says "already exists" | probe A | Normal behaviour; reveals that an email is registered. Rate-limited | Accept for a school pilot | Accepted |

## 7. 🔴 Blockers
**No production blockers identified in the code.** Blockers that depend on your choices:
* **Vercel / serverless:** the app is a long-running stateful server (in-memory limits and sessions state, files on disk, graceful-shutdown logic). It will not work correctly there.
* **Production secrets and database:** not visible from here (see 8). Deploying without them set is a blocker; the app will refuse to start, which is the safe outcome.

## 8. Production environment
I cannot see your host's variables. What the code requires, and what `npm run check:env` enforces at start:
| Variable | Needed | Seen here |
|---|---|---|
| `DATABASE_URL` (PostgreSQL) | required | NOT CHECKED (no access to your host) |
| `AUTH_SECRET` (32+ random chars) | required (placeholder values are rejected) | NOT CHECKED |
| `ADMIN_EMAIL`, `ADMIN_NAME`, `ADMIN_PASSWORD` | first start only | NOT CHECKED |
| `APP_URL` (https), `TRUST_PROXY=true` | required behind a proxy | NOT CHECKED |
| `SCHOOL_NAME`, `PRIVACY_CONTACT_EMAIL` | recommended (privacy notice) | NOT CHECKED |
| `GEMINI_API_KEY` | only if `AI_PROVIDER=gemini` | NOT REQUIRED for `local` |
| `DOCUMENT_STORAGE_DIR` | persistent volume | NOT CHECKED |

## 9. Critical user flows
* Student (register → lesson → practice → wrong answer → mistake analysis → tutor → progress): **PASS** in the phase 34/38/39 browser journeys and phase 26–28/40 suites (earlier today, not re-run in a browser after the small fixes). **Mobile layout:** the student journey runs at a phone viewport (390 px) in the phase 34 test; I did not re-check visually.
* Teacher (create lesson/content/practice, publish, class, assignment, analytics): **PASS** in the phase 34/41/43 browser journeys.
* Admin (accounts, audit, export, erase): **PASS** (phase 43 browser journey).

## 10. AI verification
* **REAL AI: NOT PERFORMED.** No Gemini credentials were available, so none of the nine requested real-AI scenarios (normal question, repeated wrong answer, "I understand", direct-answer request, off-topic, prompt injection, lesson question, unavailable information) were run against a real model.
* **SIMULATED / SCRIPTED:** the built-in tutor and scripted stand-in providers verify the tutor's *rules* (no answer disclosure, retry on violation, prompt-injection filters, no student identity in prompts). That says nothing about a live model's wording. `scripts/eval-tutor-conversations.ts` can run the live evaluation once a key exists.

## 11. Final recommendation
🟡 **FIX THESE ITEMS FIRST, then deploy as a small pilot.**
1. Pick a **persistent Docker host with PostgreSQL** (not Vercel). On Render use a paid plan with a disk.
2. Set the environment variables in section 8 on that host.
3. **Build the Docker image once** on a machine with internet (never done here) and run `/api/ready`.
4. Run **exactly one instance** (rate limits are in memory).
5. Have the school's data protection officer read the privacy notice; teachers review the Term 1 content.
6. If you want the Gemini tutor, run the live evaluation first. Until then use `AI_PROVIDER=local`.

In simple words: the code is safe to put in front of a first class on one properly set-up server. It is not proven for several servers or Vercel, the live AI has never been tried, and the Docker build has never been run.
