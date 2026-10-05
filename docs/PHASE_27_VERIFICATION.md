# Phase 27 — Server-side grading of checkpoints and questions: verification report

**Status:** multiple-choice checkpoint/question blocks are graded by the server and the answer key is no longer sent to students. Tested over HTTP in both stores, in a real browser, and with mutation checks. **Not** tested with real students.

## 1. Defects found (all pre-existing)

| # | Finding | Severity | Fix |
|---|---|---|---|
| 1 | **Students graded themselves.** The browser compared the answer to the key and POSTed `isCorrect`; the server stored whatever it was told. Every checkpoint attempt, and anything computed from attempts (research analytics, understanding evidence), could be forged with one request. | High | The server loads the block, grades the answer, and ignores `isCorrect` / `feedback` from the client. |
| 2 | **The answer key was sent to every student** inside the lesson (`metadata.correctAnswer`), and also through `GET /api/lessons` and `GET /api/curriculum`. | High | Student-facing views drop `correctAnswer` and `explanation`; the server returns the explanation after answering, and the correct answer only to a student who answered correctly. |
| 3 | `GET /api/curriculum` required **no sign-in** and returned every lesson, **including DRAFT lessons**, with all their blocks. | High | Non-staff (and signed-out) callers get published lessons only, with keys removed. |
| 4 | Question components invented a question when metadata was missing (a default "-5, -2, -8, answer -2" item), so a misconfigured block silently showed a fake question. | Medium | No defaults; an unconfigured block shows "not set up yet" to the student, and answering it returns 422, never "correct". |
| 5 | A lesson with an unusable answer key (one option, key not among the options, bad JSON) could be published. | Medium | Publishing is refused with a message naming the block. |
| 6 | The in-memory store marked a block "completed" after any attempt, the database store only after a correct one. | Low | Both: only after a correct answer. |

## 2. How grading works

* `src/lib/lesson/block-grading.ts`: `parseChoiceBlock` (well-formed = at least two distinct string options, `correctAnswer` is one of them), `gradeChoiceAnswer` (case/space-insensitive; answer must be one of the choices; length cap), `toStudentBlockView`.
* `POST /api/student/lessons/:id/checkpoint` accepts only `{blockId, answer}`, requires lesson access (Phase 26), checks the block belongs to the lesson, grades, stores the canonical choice with the server's result and the server's feedback, and numbers the attempt.
* The student page and both block components call this route and render the server's verdict. Teacher preview has the full key and still grades locally (no network).

## 3. Evidence

| Check | Result |
|---|---|
| `scripts/test-phase27-grading.ts`, in-memory | **52/52**: 19 pure checks of the grading module (every malformed-metadata shape, normalisation, no key on a wrong answer, student view contents); then over HTTP: key absent from the lesson, list and curriculum (student and signed-out), draft lessons hidden from signed-out visitors, teacher still sees everything, forged `isCorrect` in both directions, server-numbered attempts, canonical stored answer, 9 rejection cases (not a choice, empty, huge, missing fields, TEXT block, unknown block, other lesson's block, signed out, locked lesson), history, completion semantics, publish refusal and recovery, 422 for a key broken after publishing |
| Same suite on PostgreSQL (`scripts/test-phase27-prisma.ts`) | **53/53** on a brand-new production-style database (including a server restart that keeps graded attempts) + **12/12** database checks: the forged-correct attempt is stored as wrong, the right one stored right and numbered 2, no client feedback stored, completed-block list stored |
| Real browser (`scripts/test-phase27-browser.mjs`) | **all checks pass**: the lesson payload the browser received has no `correctAnswer`, no API response contains a key, a wrong answer is reported without highlighting the right option, only the chosen option is marked, the request body is `{blockId, answer}` only, the right answer then highlights, the server holds one wrong and one correct attempt, no page errors |
| Mutation checks (change made -> suite must fail) | student view keeps the key -> 6 failing; server trusts client `isCorrect` -> 3; wrong answers reveal the key -> 2; curriculum not sanitised -> 3; lesson list not sanitised -> 1; publish check removed -> 2; lesson-access check removed from the checkpoint route -> 2. All restored. |
| Regression | (see section 4) |

## 4. Regression

Run after the final code change: tsc and vite build clean; phases 9, 10, 12 (21/21), 13 (25/25), 14 (25/25), 22 (149), 23 (209), 24 (161), 25 (113), 26 (41), 27 (52), auth-repair and workflow pass. PostgreSQL scripts: 22 (12/12), 23 (14/14, both on a demo-seeded development database), 25 (113 + 19), 26 (43 + 12), 27 (53 + 12). Real-browser scripts on fresh servers: phase 22 (11/11), 23 (10/10), 24 (10/10), 25 and 27 (all pass).

**Not run:** `scripts/test-phase6.cjs`, `test-phase7.cjs`, `test-phase8.cjs`, `test-phase8-pattern.cjs`. They contain hard-coded session tokens that no longer verify, so they fail at their first authenticated call before reaching any code I changed. They are stale and give no evidence either way; the later suites cover the same areas.

## 5. What this does NOT prove / known gaps 👤

1. **Only multiple-choice blocks are graded.** Free-text, numeric and other block types have no server grading; the separate practice/assessment engine (Phases 6-8) was not changed or re-audited here.
2. **Students can still self-report completion.** `POST .../session` accepts a client-supplied `completedBlockIds` list and `isCompleted`, and "Next Section" marks a block completed without an answer. Lesson completion is therefore still not conditional on answering correctly (or at all). That needs a product decision (must every checkpoint be answered? answered correctly?).
3. **Retrying is unlimited**, and a wrong answer reveals the explanation text, which often states the answer; the key itself is hidden, the explanation is not. Teachers should write explanations accordingly. Mastery weighting of repeated attempts was not reviewed.
4. **Teachers can add/edit blocks on any lesson.** The block routes check the role but not lesson ownership, so a teacher can change another teacher's answer key. (Not fixed in this phase.)
5. **Answer keys are still stored as plain JSON text in block metadata**, readable by every teacher and admin by design. There is no separate key store or audit trail of key changes.
6. The teacher preview page was not exercised in a browser this phase (it passes type checking and uses the unchanged local-grading path).
7. Anyone who completes a question once sees the key; a student can share it with others. Normal for a classroom; not a secure exam.
8. Not covered (earlier phases): token revocation, `SameSite=None` cookie, global in-memory teacher AI settings, no audit table, live Gemini evaluation, native-speaker review of the Filipino text, no real-user testing, no mobile/accessibility audit.

## 6. Manual tests required 👤

* Create a lesson with a checkpoint in the studio, publish it, and answer it as a student on a phone; confirm that a lesson with a broken checkpoint gives a clear message at publish time.
* Read the explanations of your existing questions and make sure none gives away the answer before the student has tried.

## 7. Recommended next phase

1. Decide and implement completion rules (gap 2), plus lesson-ownership checks on all lesson/block routes (gap 4).
2. Remove the remaining demo-data fallbacks on Prisma read paths.
3. Session revocation / CSRF hardening; then the live tutor evaluation when a Gemini key is available.
