# Phase 25 — Classroom foundation and auth hardening: verification report

**Status:** implemented and tested in in-memory mode and on a real PostgreSQL 16 database. It is **not** production-ready end to end: see section 4 (notably student progress/learning path on PostgreSQL).

## 1. Defects found in the existing repo (all pre-existing)

| # | Finding | Severity | Fix |
|---|---|---|---|
| 1 | With a database configured, `findUserByEmail` still fell back to the seeded demo accounts, which share a public password: a **production login backdoor** for teacher/admin. | Critical | Accounts come from the database only when one is configured (`useInMemoryAccounts`). Verified by starting a `NODE_ENV=production` server on PostgreSQL and failing to log in as every demo account. |
| 2 | `prisma/seed.ts` was stale (wrong field names) and could create public-password users in production. | High | Fixed; refuses to run in production without an explicit override. |
| 3 | Teacher dashboard and teacher AI assistant **invented numbers** (default 65% accuracy, "strong foundational recall", "Adding Integers"). | High | Removed. Missing data is `null` / `NO_DATA` and shown as "—" / "No activity yet". |
| 4 | Teacher insight/analyze routes had an ID-based authorization gap (IDOR). | High | Teacher access to a student now exists only through an active (non-archived) class the teacher owns. |
| 5 | No login throttling. | Medium | Per-email and per-IP limits (8 / 40 per 15 min), same for class-code guessing; `Retry-After` on 429; dummy bcrypt compare to equalize timing for unknown emails. |
| 6 | `data/users-persistence.json` (password hashes) was tracked in git. | Medium | Untracked and git-ignored. **Hashes remain in git history; rotate any real password that was ever used.** |
| 7 | `getAITutorMessages` returned the oldest N messages. | Low | Fixed in an earlier phase. |

## 2. What was built

* **Accounts:** `validateNewPassword` (8+ chars, a letter and a digit); `POST /api/admin/users` (create TEACHER/ADMIN), `GET /api/admin/users` (never returns hashes), `POST /api/auth/change-password`; `npm run admin:create` bootstraps the first admin from env vars on a PostgreSQL database, never overwrites, never prints the password.
* **Classrooms:** schema additions (`joinCode` unique, `joinCodeActive`, `archivedAt`, enrolment `source`, assignment `createdById`); `ClassroomRepo` (Prisma, with in-memory fallback only when no database) and `ClassroomService` (rules and authorization). 6-character codes from an unambiguous alphabet; regenerate, switch off, archive/restore; up to 30 classes per teacher, 80 students per class, 60 emails per request.
* **Joining:** students join with a code; one generic 404 for malformed / unknown / switched-off / archived codes; throttled.
* **Assignments:** require a published lesson and/or an existing practice set; validated due date; students see only PUBLISHED assignments of classes they are in.
* **UI:** teacher classes page (create class), class page (code card with copy / new code / off / archive, add students by email with per-email results, remove student, create assignment with a published-lesson select); student dashboard card (join, my classes, leave, assignments); admin page (create teacher/admin accounts, list).

## 3. Evidence

| Check | Result |
|---|---|
| `tsc --noEmit`, `vite build` | clean |
| `scripts/test-phase25-classrooms.ts` (black-box HTTP, in-memory) | **113/113**: accounts, throttle, password change; class CRUD and limits; teacher IDOR matrix; roster privacy; access follows enrolment (remove, leave, archive); join codes; assignments; honest analytics |
| `scripts/test-phase25-prisma.ts` (PostgreSQL 16) | **19/19**: bootstrap admin, seed refusal in production, production server rejects every demo account, no JSON mirroring, full classroom suite on PostgreSQL, DB rows, unique join-code constraint rejects a duplicate, cascade delete |
| Browser (headless Chromium, `scripts/test-phase25-browser.mjs`) | **all checks pass** across admin, teacher and three student sessions: weak password rejected, class created, code shown, roster add/unknown-email, assignment needs a lesson, student sees class and assignment, wrong code generic, lower-case code works, code off blocks joins, removal revokes visibility |
| Regression | phases 9, 10, 12 (21/21), 13, 14, 22 (149), 23 (209), 24 (161), auth-repair, workflow pass; PostgreSQL scripts for 22 (12/12) and 23 (14/14) pass; browser scripts for 22 (11/11), 23 (10/10), 24 (10/10) pass on fresh servers |
| Mutation checks (guard removed -> suite must fail) | teacher-owns-class check off -> 15 failing; owner check dropped in `teacherHasStudent` -> 2; archived check dropped -> 1; join throttle off -> 3; join accepts archived/disabled codes -> 2. All restored. |

The browser script first showed races in my own test (checking before data loaded) and one non-fresh server; these were test faults, fixed with waits, not product changes.

## 4. What this does NOT prove / known gaps 👤

1. **Student progress and learning path on PostgreSQL are still in-memory only** (`getStudentLearningPath`, `updateStudentProgress`). On a PostgreSQL deployment the lesson-access check, the learning-path page, student-detail path nodes and the tutor's lesson-access grounding depend on demo lessons and fail closed or show demo data. **This blocks a real student workflow on PostgreSQL and is the recommended next phase.**
2. Teacher AI settings are global and in-memory.
3. Tokens are stateless: a password change or role change does not revoke existing sessions until they expire.
4. The production cookie uses `SameSite=None`; add CSRF protection or tighten before a public launch.
5. Many Prisma read paths still fall back to demo data when the database is empty.
6. No admin disable/delete user, no password-reset-by-email flow, no audit table (only `AUDIT` console lines).
7. Assignments do not restrict lesson access; they are a to-do list for students, not a gate.
8. The throttle is in-process memory: it resets on restart and is per-instance. Behind a proxy set `TRUST_PROXY=true`, or all clients share one IP.
9. Real users have not used this. UI was checked only in a desktop-size headless browser, with no accessibility audit and no mobile layout check.
10. The live-model tutor evaluation from Phase 24 is still unrun (no API key); the Filipino text still needs a native-speaker review.

## 5. Manual tests required 👤

* Create the first admin with `npm run admin:create` against your real database, create a teacher, a class and a student account, and walk the flow in a real browser and on a phone.
* Confirm `NODE_ENV=production` deployments have `SESSION_SECRET` set and the demo seed was never run.
* Run a teacher through the class page with a real roster and check the wording of every message.

## 6. Recommended next phase

1. **Persist lessons' student progress and learning path in PostgreSQL** (gap 1), then re-run a student end to end on PostgreSQL.
2. Session revocation / CSRF hardening (gaps 3 and 4).
3. Live tutor evaluation when a Gemini key is available.
