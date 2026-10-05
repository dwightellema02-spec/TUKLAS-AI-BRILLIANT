# Phase 34 — Classroom readiness: the whole teacher + student journey — verification report

**Goal (from the master plan):** a teacher and a student can actually use the platform end to end. **What this report can and cannot say:** the whole journey now runs cleanly through the real screens, in a real browser, against both the in-memory store and a fresh PostgreSQL database, with no server errors. That is **not** the same as "100% working": real classes, real phones, real networks and real children will find things automated tests cannot. The list in section 5 is what is known to be missing or unverified. Nothing here has been used by a real teacher or student.

## 1. Method

Instead of testing features one at a time, `scripts/test-phase34-journey.mjs` plays one classroom in Chromium: **teacher on a laptop viewport, student on a 390 px touch viewport**, signing in through the real sign-in dialog:

admin creates teacher → teacher signs in → creates a class (code shown) → builds, publishes and assigns a **pre-test** through the screens → student registers, joins with the code, sees the assessments card, takes the pre-test (score shown, answers hidden) → opens a lesson from the learning path and talks to the tutor (it must not give the answer) → teacher assigns a **practice set** from the class page → student starts it from the dashboard, finishes it, sees it in history → teacher builds the **post-test** → student takes it → teacher uses the **pre/post comparison** → teacher sees results and the student list → teacher archives the post-test → it disappears for the student. It also fails on any uncaught page error, any HTTP 5xx and any browser console error during the whole run.

`scripts/test-phase34-prisma.ts` runs the same journey against a **brand-new PostgreSQL database** (schema push, curriculum-only seed, admin bootstrap — the production path) and then inspects the rows.

## 2. Defects the journey found (all fixed)

| # | Finding | Where it showed |
|---|---|---|
| 1 | On a phone the **Sign In button was hidden inside the hamburger menu**: a student could not find how to sign in. | Phone viewport |
| 2 | A teacher could assign only a **lesson**; the **practice-set** assignment existed in the API but had no field in the screen, and a student's assignment list had **no way to open a practice-set assignment** (only lessons). Also the due date was fixed at "7 days" with no way to choose. | Class page / student dashboard |
| 3 | **Adaptive guidance returned HTTP 500 for every student on a real database**: when no skill was known it invented the demo id `skl_01`, which does not exist in PostgreSQL (foreign-key error). Passing an unknown skill id did the same. Now: real skill only, unknown id → 404, no skills → no recommendation (not an error). | PostgreSQL run |
| 4 | Several student screens opened the demo practice set `ps_integers_basics` (dashboard, learning path, mastery page, lesson practice block): it does not exist in a real database, so "Practice now" led to a broken page. Now they look up a published practice set and say so if the teacher has none. | Code audit after #3 |
| 5 | `POST /api/practice/start` answered **500** for an unknown or unpublished practice set (now 404 / 409). | Known issue from Phase 31 |
| 6 | The header badge said **"Neon PostgreSQL"** for any database and **"Sandbox DB"** for demo mode: wrong for a self-hosted database and unclear for a teacher. Now "Database connected" / "Demo data (not saved)". | Screenshot review |

## 3. New in this phase

- Teacher **Compare pre-test and post-test** panel on the Assessments screen (class + two tests → averages, number of students, change, per-skill change, and the plain-language caveat); it uses only graded results.
- **Archive** an assessment (author/admin; students lose access; results stay; cannot be reopened).
- Practice-set assignments with a chosen due date; students open them from their dashboard.
- Documents: `docs/TEACHER_QUICKSTART.md` and `docs/PILOT_CHECKLIST.md`.

## 4. Evidence

| Check | Result |
|---|---|
| `scripts/test-phase34-journey.mjs` (Chromium, in-memory server) | all checks pass, repeated runs |
| Same journey against a PostgreSQL database with production-style seed | all checks pass, no 5xx, no console errors (before fix #3 it failed with 500s) |
| `scripts/test-phase34-prisma.ts` | journey + row checks (one teacher, one student, one class/enrolment, two graded attempts, a completed practice session, tutor messages, question attempts) |
| `scripts/test-phase34-api.ts` (HTTP) | 13 passed, in-memory and PostgreSQL |
| `scripts/test-phase33-assessments.ts` (extended with archiving) | 105 passed, in-memory and PostgreSQL |
| Regression | see the commit message / final run |

## 5. Not done / not verified (be honest with the school)

- **Real use.** No real teacher, student, phone, classroom Wi-Fi or school device has used this. Screens were designed and checked by automated browsers only.
- **Docker image build.** Attempted in the build environment; the base-image download and the package mirror were blocked by the environment's network policy (HTTP 403), so the image **was not built**. The container's start-up steps (schema, curriculum seed, admin bootstrap, production server) were run outside Docker in earlier phases against PostgreSQL, but the `Dockerfile` itself remains unproven.
- **Live Gemini.** The tutor has only run on the local deterministic engine; no live-model evaluation was possible.
- **Voice** works only as far as the simulated-engine tests show (Phase 32); real microphones need a trial.
- **Teacher AI settings** are global to the installation (one teacher's change affects all).
- **Not built:** teacher-controlled release of test results, extra time per student, late-submission flags, editing a published assessment, question shuffling, video transcripts, OCR, spoken fractions/decimals, in-app password reset by email, a teacher view that pairs pre/post per student.
- The journey uses one teacher and one student; **concurrency at class size (30–40 students at once)** was not load-tested. The race conditions that matter for grading (double submit, double start) were tested.
- Filipino wording in the interface and tutor has not been reviewed by a Filipino-speaking teacher.

## 6. Needs a person (👤)

1. A **dry run with one real teacher** doing the setup from `docs/TEACHER_QUICKSTART.md` without help; note every point of confusion.
2. A **real-device trial** on an Android phone and a school laptop (sign-in, class join, a test, tutor typing and voice, practice).
3. A **parent/guardian notice and school approval** (see `docs/PILOT_CHECKLIST.md`).
4. Someone to **build and run the Docker image on a machine with normal internet access**, or choose another deployment path from `docs/DEPLOY.md`.
