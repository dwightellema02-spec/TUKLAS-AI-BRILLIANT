# Phase 26 — Student progress and learning path on PostgreSQL: verification report

**Status:** the student workflow (path → open lesson → progress → unlock next → teacher sees it) now runs on PostgreSQL and is tested over HTTP in both stores. It has **not** been used by real students; see section 4.

## 1. Defects found (all pre-existing)

| # | Finding | Severity | Fix |
|---|---|---|---|
| 1 | `getStudentLearningPath`, `updateStudentProgress` used the in-memory demo curriculum and progress even with a database: on PostgreSQL lessons you created never appeared, lock checks used demo data, progress was lost on restart. | Critical for a real deployment | Both read/write PostgreSQL when a database is configured. A database error is thrown, never answered with demo data. In-memory mode (no database) is unchanged. |
| 2 | **The first lesson was permanently locked for any new student** (in the demo curriculum): a skill whose prerequisite is taught by the same lesson was treated as unmet. | High (a fresh student could not start) | A prerequisite skill taught by the lesson itself no longer blocks it. |
| 3 | `POST /api/student/progress` and the lesson session/checkpoint routes had **no access check**: any student could mark a locked, unpublished or non-existent lesson complete (non-existent ids caused a 500 on PostgreSQL), and `action`/block numbers were unvalidated. | High | One `ensureLessonAccess` guard (404 unknown/unpublished, 403 locked) on progress, session GET/POST and checkpoint; input validation (400). |
| 4 | New progress rows were created with invented quality scores of 0.5. | Medium | Scores start at 0; they belong to mastery/practice. |
| 5 | `createLesson` numbered new lessons with the *in-memory* lesson count, so on PostgreSQL sequence numbers collided. | Medium | Uses `max(sequenceOrder)+1` from the database. |
| 6 | `getStudentProgress` mixed in demo progress in database mode. | Medium | Database only in database mode. |
| 7 | No production way to load the curriculum (the only seed also creates public-password accounts). | Medium | `npm run seed:curriculum` (`SEED_CURRICULUM_ONLY=true`) seeds the curriculum only, works in production, creates no accounts. |

Design note: one lesson-progress row per (student, lesson) with a deterministic primary key `lp:<userId>:<lessonId>`. That makes concurrent requests safe without a schema change (the existing unique constraint covers only student+skill).

## 2. Evidence

| Check | Result |
|---|---|
| `tsc --noEmit`, `vite build` | clean |
| `scripts/test-phase26-progress.ts`, in-memory | **41/41** over HTTP: path built from the store, DRAFT never shown, locking and reasons, 14 guard/validation cases on the four student routes, progress transitions (never regresses, completed stays completed), 8 concurrent updates, student isolation, session completion unlocks the next lesson, unit progress, dashboard, teacher view and teacher authorization |
| Same suite, PostgreSQL (`scripts/test-phase26-prisma.ts`) | **43/43** on a **brand-new empty database** prepared exactly like production (schema push, `seed:curriculum` under `NODE_ENV=production`, `create-admin`), including a **server restart** that keeps progress; plus **12/12** row-level checks: only the admin account exists (no demo users), one progress row per student per lesson after concurrent updates, no invented scores, completed rows are 100% with a completion time, lesson sequence numbers distinct |
| Regression | see section 3 |
| Mutation checks (guard removed -> a test must fail) | progress route access check off -> 13 failing; same-lesson prerequisite fix off -> 16; session route access check off -> 1; random progress-row id (breaks the one-row guarantee) on PostgreSQL -> 6 |

## 3. Regression

All run after the final code change: phases 9, 10, 12 (21/21), 13 (25/25), 14 (25/25), 22 (149), 23 (209), 24 (161), 25 (113), auth-repair and workflow pass. PostgreSQL scripts: phase 22 (12/12) and 23 (14/14) on a seeded database, phase 25 (113 + 19). Real-browser scripts on fresh servers: phase 22 (11/11), 23 (10/10), 24 (10/10), 25 (all pass). Note: the phase 22/23 PostgreSQL scripts need the demo seed (`npm run seed`) in a development database; they are not meant for production.
The phase 26 browser UI was not separately scripted: the student learning-path page was not re-checked in a browser this phase (only the HTTP API behind it).

## 4. What this does NOT prove / known gaps 👤

1. **Checkpoint correctness is still decided by the browser.** `POST .../checkpoint` stores the client's `isCorrect`. A student can mark their own answers correct. Grading must move to the server from the block's stored answer. This undermines any analytics built on checkpoint attempts.
2. Progress percentage is "blocks viewed / blocks", not mastery. Unlocking depends on completion, not on how well the student did.
3. Lesson order is one global sequence for the unit; there is no per-class pacing, and assignments still do not unlock or restrict lessons.
4. The student dashboard and adaptive/mastery services were exercised by the suite only on a new student's and a two-lesson student's data; their remaining demo-seed constants (for example a default `skl_01` skill) were not audited on PostgreSQL.
5. Many other Prisma read paths still fall back to demo data when their table is empty (lesson list, curriculum). Only the paths in this phase were converted.
6. Tokens are not revoked on password/role change; cookie `SameSite=None`; teacher AI settings are global in memory; no audit table (see Phase 25).
7. No real students, no mobile layout check, no load test (a single server process; concurrency was tested with 8 parallel requests only).
8. Live Gemini tutor evaluation still unrun; Filipino text still needs native-speaker review.

## 5. Manual tests required 👤

* On your real database run `npx prisma db push`, `npm run seed:curriculum`, `npm run admin:create`, then create a teacher, publish two lessons, register a student and walk the path on a phone.
* Review the lock messages ("Requires completion of ...") for clarity with a real student.

## 6. Recommended next phase

1. Server-side checkpoint grading (gap 1), then re-verify mastery/adaptive on PostgreSQL.
2. Remove the remaining demo-data fallbacks on Prisma read paths.
3. Session revocation / CSRF hardening.
