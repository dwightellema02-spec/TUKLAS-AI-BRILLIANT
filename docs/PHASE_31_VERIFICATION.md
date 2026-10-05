# Phase 31 — Attack-surface sweep, answer-key allow-list, CSP and rate limits: verification report

**Status:** implemented and verified over HTTP in both stores, on PostgreSQL (including production-mode servers), in a real browser against the production build, and with mutation checks. This is still not an independent security review.

## 1. Method

`scripts/test-phase31-surface.ts` reads every `app.get/post/put/patch/delete("/api/...")` registration out of `server.ts` (122 routes) and calls each one signed out, and each staff-only route as a student. New routes are therefore swept automatically.

## 2. Defects found (all pre-existing)

| # | Finding | Severity | Fix |
|---|---|---|---|
| 1 | **Any teacher could open any student's learning insight** (`GET /api/student/insights/:id`), including students in other teachers' classes (the database method only restricted students). | High (privacy) | A teacher needs an active-class relationship to the student; otherwise 404. |
| 2 | **Signed-out callers could read** the question bank (`/api/questions`, `/api/questions/:id`), practice sets, skills, and the teachers' AI tutor settings. | Medium | Sign-in required. |
| 3 | **YouTube search and URL validation were public** (spends the external API quota; open to abuse). | Medium | Staff only, rate limited (30/min per user). |
| 4 | Practice-question redaction was a **deny-list** (strip `correctAnswer`, `acceptableAnswers`, ...): any other answer-bearing field a teacher or a future feature added to a question was sent to students. | Medium | **Allow-list**: only `choices` (id + text), shuffled matching/ordering items, `unit`/`placeholder`/`instructions`, and a fixed set of question fields are sent; explanation and feedback texts are not. |
| 5 | The student question list returned **empty objects** (`[{},{},...]`) because of an un-awaited promise. | Low | Fixed. |
| 6 | A student calling `PATCH /api/teacher/assignments/:id` got **400** (validation ran before the role check). | Low | Role check first (403). |
| 7 | `GET /api/lessons/:id` told signed-out callers whether a lesson id exists (404 vs 401). | Low | Session check first. |
| 8 | Raw internal errors (Prisma messages, file paths) could reach the browser in 500 responses. | Medium | Messages that look internal are replaced with a generic one (and logged); ordinary domain messages are kept so users still see helpful errors. |
| 9 | No Content-Security-Policy; no request-rate limits. | Medium | Production CSP (scripts only from this site, no inline/eval, own-origin API calls, YouTube-only frames, no plugins, no framing), `CSP_REPORT_ONLY=true` option; per-address API limit in production (default 1200/min, `API_RATE_LIMIT_PER_MINUTE`, `/api/health` exempt), per-user limits on YouTube and AI question generation. |

## 3. Evidence

| Check | Result |
|---|---|
| `scripts/test-phase31-surface.ts`, in-memory | **32/32**: all 116 non-public routes refuse a signed-out caller with 401/403; all 70 staff routes refuse a student with 403; practice questions (choice, matching, ordering, numeric, each with extra secret fields) leak nothing through question, list, practice-set, session start, session reload; only allow-listed question fields are sent; a first wrong answer does not reveal the answer, the final attempt does; Student 2 cannot read, answer, complete or review Student 1's session (and it is unchanged); an unrelated teacher cannot open Student 1's insight; students cannot use the YouTube search; a hammered search endpoint returns 429 + Retry-After without affecting another teacher |
| Same suite on PostgreSQL (`scripts/test-phase31-prisma.ts`) | **33/33** on a brand-new production-style database (adds: a bad query is really a 500 and shows only the generic message) + **16/16** database/production checks: answer keys intact in storage, production CSP contents, CSP on API responses, 41st request in a minute refused while `/api/health` stays up, report-only mode |
| Real browser, production build (`scripts/test-phase31-browser.mjs`) | **all checks pass**: injected inline `<script>` and inline event handler do not run and are reported as violations; student, teacher, admin, account and practice pages produce **zero CSP violations**; a student starts a practice session (no keys in the response), sees the question and choices, submits an answer and gets server feedback |
| Mutation checks (change made -> a check must fail) | question list open to signed-out callers -> 1 failing; any teacher can open any insight -> 1; students can use YouTube search -> 2; search not rate limited -> 2; redaction back to a deny-list -> 5; assignment role check after validation -> 1; lesson-id existence leak -> 2. All restored. |
| Regression | tsc and vite build clean; phases 9, 10, 12, 13, 14 (32/32), 22 (149), 23 (209), 24 (161), 25 (113), 26 (41), 27 (52), 28 (43), 29 (52), 30 (66) pass; PostgreSQL scripts 22 (12), 23 (14), 25 (113+19), 26 (43+12), 27 (53+12), 28 (43+10), 29 (52+17), 30 (66+25), 31 (33+16) pass |

## 4. What this does NOT prove / known gaps 👤

1. **No independent review or penetration test.** The sweep checks authentication and the staff/student boundary on every route, but not every object-level rule (for example, student-to-student isolation was tested for practice sessions, tutor conversations and insights, and in earlier phases for classrooms, progress and research, not for every route that takes an id).
2. **CSP allows inline styles and any https image** (the app sets some element styles; teachers may link pictures). It does not restrict where forms or fetches can go beyond the site itself. The development server (Vite) runs without CSP.
3. **Rate limits are per process and in memory**, keyed by IP address; behind a proxy you must set `TRUST_PROXY=true` or all users share one address. They reset on restart and are not shared between instances.
4. The error filter is a pattern list: an internal message that does not match it would still be shown.
5. Display defect noticed, not fixed: multiple-choice options stored as raw LaTeX (for example `\frac{1}{2}`) are shown as raw text, not as typeset maths, in the practice page.
6. `POST /api/practice/start` with an unknown practice-set id answers 500 instead of 404.
7. Unchanged earlier gaps (see the master audit).
