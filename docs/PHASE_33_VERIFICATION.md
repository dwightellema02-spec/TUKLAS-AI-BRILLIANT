# Phase 33 — Assessments: audit, hardening, screens and pre/post wiring — verification report

**Status:** implemented and verified over HTTP (in-memory and PostgreSQL, fresh database), in Chromium (a teacher builds/publishes/assigns through the screens; a student takes a quiz and a timed pre-test on a phone-sized viewport), with mutation checks. Nothing was tested with real students or a real class.

## 1. What existed before

A Phase 14 backend (create / publish / assign / start / submit endpoints, grading, an in-memory demo store) and **no screens at all**. Before changing anything I probed it (with a throw-away script that was not kept):

| # | Finding (confirmed by the probe) | Severity |
|---|---|---|
| 1 | An assessment could be created with an unknown type, a non-existent question, negative points (201 for all). | Medium |
| 2 | **Assignment was never checked**: any signed-in student saw every published assessment from every teacher and could open and take it. | High |
| 3 | A teacher could assign an assessment to **another teacher's class** or to a class that does not exist (200 for both). | Medium |
| 4 | Choices were sent to students from `options \|\| choices` verbatim: the `isCorrect` marker leaked. | High |
| 5 | A **pre-test could be started repeatedly** (new attempt each time), and its result revealed the correct answers and explanations. That ruins a pre/post comparison. | High (research validity) |
| 6 | Grading flattened answers with `String()`: matching/ordering answers could never be right; an array `["a"]` was accepted as `"a"`; an object with a bad `toString` crashed the validator. | Medium |
| 7 | Double-submit race: the "already submitted" check and the write were separate (two simultaneous submits could both be graded and write duplicate response rows). | Medium |
| 8 | In database mode (non-production) any failure silently fell back to the in-memory store: data appeared saved and was lost. | High |
| 9 | Made-up author name ("Teacher Santos"), timestamp-based ids that can collide, no time-limit handling, no way for a student to re-read a result, no results for teachers. | Low–Medium |
| 10 | Found while building the screens: the countdown counted timer ticks (browsers slow background tabs); an ordering question left untouched was submitted as blank. | Medium |
| 11 | Found by the PostgreSQL run: starting a retake of a quiz returned a deleted attempt (the "two simultaneous starts" clean-up compared against the first, already graded, attempt). | High (DB mode only) |

## 2. What changed

- `src/lib/assessment/assessment-service.ts` (rewritten): `AssessmentError` with proper status codes; no in-memory fallback in database mode; random ids.
  - **Create:** title 3–120, known type, 1–60 unique questions that exist and are the author's own or PUBLISHED, points 0.5–100, passing 0–100, time limit 1–300 min, grade 1–12, lesson must exist.
  - **Publish:** author/admin, needs questions, idempotent. **Assign:** published only, class must be the teacher's, optional student must be enrolled, valid due date, no duplicate.
  - **Student access = assigned + published + active class membership** (a direct student assignment covers one student). Anything else is the same 404 as a missing id. Leaving or archiving the class removes access immediately.
  - **Attempts:** start resumes an open attempt; **PRE_TEST / POST_TEST are single-attempt** (409 afterwards), other kinds can be retaken. Concurrent starts converge on one attempt.
  - **Submit:** the attempt is claimed with a conditional update (exactly one concurrent submit is graded, the rest get 409); odd answer shapes are wrong, never errors; client-sent `score`/`isCorrect` is ignored; a time limit (30 s grace) flags the attempt `timedOut` but still grades it; if grading fails after the claim the attempt is handed back.
  - **Answer visibility:** student copy uses the Phase 31 allow-list (no key/explanation/feedback). A quiz shows right answers after submitting. **A pre/post result shows score and per-skill totals only** (`answersHidden: true`, no per-question results), so neither test contaminates the other.
  - New: `listForStudent`, `getAttemptResult` (owner only), `getResults` (author/admin; roster including "not started", per-question accuracy).
- `server.ts`: assessment routes rewritten around those errors; `/api/student/assessments*` is student-only; new `GET /api/student/assessments/attempts/:id` and `GET /api/teacher/assessments/:id/results`.
- Screens: teacher **Assessments** (build from the question bank, publish, assign with due date, results), teacher results page, student **My assessments** list, student take/result page (every question type, progress, refresh-safe answers, deadline-based timer with auto-submit, confirm dialog), dashboard card.

## 3. Evidence

| Check | Result |
|---|---|
| `scripts/test-phase33-assessments.ts` (HTTP): 22 invalid-create cases, publish/assign permissions, who can see/open/start, answer-key absence, grading incl. tampering and odd shapes, three simultaneous submits → exactly one 200, once-only pre/post, result access, teacher results, class leave/archive | **97 passed, 0 failed** (in-memory and PostgreSQL) |
| `scripts/test-phase33-prisma.ts` (fresh PostgreSQL DB, production-style seed) | 20 passed: stored rows, one graded attempt per student on pre/post, scores equal the sum of stored question scores, no stuck or duplicate rows, back-dated attempt → `timedOut` flagged and stored |
| `scripts/test-phase33-browser.mjs` (Chromium, 390 px student viewport) | all pass, run repeatedly: draft→publish→assign through the UI; student sees card, takes a 5-type quiz (reload keeps answers) = 100%; timed pre-test auto-submits when the (fake) clock passes the limit; pre-test answers hidden; cannot retake; teacher results show the student |
| Pre/post → research comparison | pre n=2 mean 25, post n=1 mean 100 read from these graded attempts; another teacher sees 0 students |
| Mutation checks | removing: assignment gate, once-only rule, answer hiding, class-ownership check, publish-before-assign rule, duplicate-question rule, structured-answer rule, and (PostgreSQL) the atomic submit claim — each makes a test fail |
| Regression | see the commit message / final run |

## 4. Known limitations (not fixed here)

- **Real students have not used this.** Wording, layout, timer comfort and the "answers are hidden" message need classroom feedback.
- Due dates are informational: a late submission is allowed and not flagged. There is no teacher "release results" switch, no unpublish/archive button in the UI (the API status exists), no editing of a published assessment, no per-student time extension, no question shuffling (the schema has the flag; unused).
- The time limit is a server-side deadline with a 30-second grace; a student who closes the tab keeps their attempt open and can resume it after the deadline, at which point it is submitted as timed out.
- Pre/post comparison needs the teacher to pass the two assessment ids to the research page/API; there is no UI that pairs them yet.
- Answering an assessment writes to the same question-history/mastery tables as practice, so pre-tests influence mastery estimates (intentional, but a design choice to confirm).
- The AI tutor is not offered on the assessment screens (stated to students); this is a UI omission rather than a server-side block.
- Matching/ordering UI follows the validator's formats but has only been exercised with simple data; very long items may wrap awkwardly.
- Question types GRAPH/GEOMETRY/DRAG_DROP/INTERACTIVE_DIAGRAM have no input; they would show a text box.

## 5. Needs a person (👤)

1. Run one real class through a pre-test → lessons → post-test on real devices, with the teacher doing the setup unaided.
2. Decide the policy questions above (late submissions, releasing results, whether pre-tests should feed mastery).
3. Have a teacher read the intro/result wording and the "answers hidden" explanation for clarity and tone, including in Filipino if students need it.
