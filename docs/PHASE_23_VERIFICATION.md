# Phase 23 — Tutor Conversational Core: Verification Report

Master-plan modules: **12 AI Tutor Engine** (response planning, Socratic policy, adaptive difficulty, answer-disclosure protection) and **13 AI Conversation Memory**; touches 9 (mistake diagnosis in conversation) and 18 (teacher visibility).

Legend: ✅ verified · ⚠️ partial · ❌ not implemented · 🧪 automated only · 👤 real-user/live-model test required · 🚨 defect

## 1. What was built

Pipeline per student message (`src/lib/ai/tutor.ts` → `src/lib/ai/conversation/`):

`read the student` -> `judge the answer` -> `update conversation state` -> `choose a strategy` -> `realize (LLM or local)` -> `verify` -> `retry once` -> `fall back to the plan realizer` -> `persist state`

| Piece | File | What it does |
|---|---|---|
| Signals | `signals.ts` | Classifies 17 intents (answer attempt, student's own problem, request answer/hint/example/easier/harder/review, confused, don't know, frustrated, off-topic...) plus hedging, frustration and "gave reasoning" flags |
| Evaluation | `evaluate.ts` | **Server-side** correctness for arithmetic problems, multiple-choice and numeric answers, with misconception diagnosis: `SIGN_ERROR`, `ADDED_MAGNITUDES`, `IGNORED_SIGNS`, `WRONG_OPERATION`, `CALCULATION_SLIP`. When it cannot check, it says `NONE`; it never claims right/wrong without evidence |
| Problems | `problems.ts` | Deterministic generation of related / simpler / harder problems and fully worked examples with verified steps. No number the tutor poses or solves comes from an LLM |
| State | `state.ts` | Versioned, persisted per conversation: turn, phase, help level (seeded from mastery), strategy history, hints given, last question, diagnoses, pending problem, independent successes, teacher flag. Robust to corrupt JSON |
| Planner | `planner.ts` | Pedagogical policy (see §2) |
| Realizer | `realizer.ts` | Template-based plan -> text with varied phrasing, used when the LLM is unavailable and as the fallback when the LLM breaks a rule |
| Guards | `guards.ts` | Answer disclosure, repetition, question count, wrong correctness claims, missing posed problem |

Other changes: new `AITutorConversation.stateJson` column; conversations are matched by exact context and expire after 3 idle hours; the expected answer is **no longer sent to the model** (previously included as "Internal Only"); teacher-facing tutor flags (`GET /api/teacher/students/:id/tutor-flags` + a card on the student page); the pedagogy (strategy, intent, evaluation, diagnosis, violations) is stored with every tutor message for analytics.

## 2. Policy (what the tutor does)

* **Asks for the answer** -> never given. 1st: redirect with a small first step. 2nd: a fully worked example with different numbers. 3rd: empathize and shrink the task.
* **Stays confused** -> approach changes each time (ask what they think -> number line -> small steps -> worked example -> everyday context -> prerequisite), acknowledges that it is changing approach, never repeats a message; after five confusions hands off to the teacher and keeps trying fresh, smaller approaches.
* **Wrong answer** -> diagnosed, not just "wrong". A *different* mistake gets a targeted question; the *same* mistake again moves to smaller steps; repeated errors escalate to a worked example, then teacher hand-off.
* **Correct answer** -> confirmed, asks why; after a justification poses a **new** problem with no hints; the student's answer to that is checked server-side; success -> celebrate and ask what next; struggle on it -> steps down to a simpler problem.
* **Frustration** -> acknowledged, task shrunk; sustained -> teacher flag.
* **Student types their own problem** -> guided (not solved) and evaluated against the true result.
* **Easier / harder / example / review requests** -> simpler problem / harder problem / worked example / key-ideas review (cited when documents exist).
* **Off-topic / prompt injection** -> redirected without echoing it.
* Starting help level follows the student's mastery status.

## 3. Defects found and fixed (several by the new tests/harness)

| # | Defect | Status |
|---|---|---|
| 1 | 🚨 **PostgreSQL path: the tutor's "recent history" was the *oldest* N messages** (ascending + `take`), freezing context after a few turns | fixed; verified on PostgreSQL |
| 2 | 🚨 Conversation matching ignored context (in-memory path could mix contexts) and never expired | fixed |
| 3 | 🚨 The expected answer was placed in the LLM prompt | removed; test asserts the answer appears nowhere in the prompt |
| 4 | 🚨 My own first plan directive wrote the protected answer into the prompt while forbidding it | caught by the prompt test, fixed |
| 5 | 🚨 **IDOR (pre-existing):** `GET /api/teacher/students/:id/insights` and `POST .../analyze` had no per-student authorization, so any teacher could read or trigger analysis for any student | fixed; tested |
| 6 | 🚨 Conversation endpoint would have exposed pending problems and answers (new state) | `stateJson` stripped; tested |
| 7 | Verbatim repeat of the teacher hand-off message; stacked/repeated acknowledgements | fixed |
| 8 | A short justification after a correct answer was treated as "unclear"; "because 13 is bigger" was read as the *answer* 13 | fixed |
| 9 | A student-typed problem was forgotten on the next turn; a bare number after it was not an attempt | fixed (found by the evaluation harness) |
| 10 | The tutor told students "I'll leave a note for your teacher" with no way for a teacher to see it | flags now stored and shown to the student's teacher |

## 4. Test evidence

| Check | Result |
|---|---|
| `tsc --noEmit`, `vite build` | clean |
| `scripts/test-phase23-conversation.ts` | **208/208**: 38-utterance intent table; 600 random problems judged/diagnosed; 400 generated-problem invariants incl. worked-example arithmetic; state robustness; 150 random problems x 6 scripted multi-turn scenarios; 3,094 realizer outputs (every strategy x diagnosis) all pass every guard; real `AITutorService` persistence, isolation and idle expiry; LLM path with a scripted stand-in (retry, fallback, injection); HTTP including teacher flags and the IDOR fixes |
| `scripts/test-phase23-prisma.ts` (PostgreSQL 16) | 12/12 incl. the message-ordering fix |
| `scripts/test-phase23-browser.mjs` (headless Chromium) | 10/10 multi-turn conversation in the student UI |
| `scripts/eval-tutor-conversations.ts` (local, 40 runs, 4 personas) | 0 answers leaked, 0 repeats, 100% one-question, 0 persona failures |
| Regression: phases 9, 10, 12, 13, 14, 22 (149/149), 22 PostgreSQL 12/12, 22 browser 11/11, auth-repair 26/26, workflow | pass |
| Mutation checks | disclosure guard off -> 8 failures; strategy variation off -> 2 failures; answer evaluation always-correct -> 8 failing checks, then the harness crashed on the broken conversation flow |

## 5. What this does NOT prove 👤

1. **No live LLM was used.** The LLM path is verified only with a *scripted* stand-in provider: that bad output is detected, retried and replaced, and that prompts contain the plan/state and no answer. How Gemini actually words things, follows the plan, or resists injection is untested. Run `GEMINI_API_KEY=... npx tsx scripts/eval-tutor-conversations.ts --provider gemini --runs 20`; it reports first-pass violation rate, fallback rate and writes transcripts for human rubric scoring. Wording quality cannot be auto-scored.
2. **The local realizer is template-based.** It is correct, varied and uses the student's numbers and words, but it is not fluent open conversation, and some phrasing is stilted.
3. **English only.** The intent classifier is regex-based English. Filipino/Taglish ("hindi ko gets", "ano po ang sagot") is **not** understood and falls to the generic clarify path. For Philippine Grade 7 students this is a significant gap.
4. **Integer arithmetic only.** Deterministic evaluation, diagnosis, worked examples and transfer problems exist for binary integer expressions (+, −, ×, ÷). Other question types (multiple choice about concepts, absolute value, ordering, equations) get correct/incorrect judgement where the record allows it, but only generic strategies, with no problem generation.
5. **Policy thresholds are untuned.** The numbers (5 confusions, 5 wrong attempts, 3 idle hours, scaffold steps) are reasonable defaults, not validated with teachers or students. A teacher/pedagogy review of the policy and the wording is needed.
6. **Chat evidence does not feed mastery.** Independent successes are recorded in conversation state and message metadata only; the mastery engine is not updated from chat. Deliberate (soft evidence) but a gap against the research-data goal.
7. **Voice** uses none of this yet (no voice implementation exists).
8. **Teacher/classroom authorization reads the in-memory classroom store** (`TeacherService`). On a PostgreSQL deployment there are no classrooms in that store, so non-admin teachers would be denied everything (fail-closed). Classroom creation/enrolment is still missing; this remains the audit's second-priority gap.
9. The old `FULL_EXPLANATION` help level used to allow "full reasoning"; it now never states the final answer to the active problem (it maps to an explanation request). Intentional.
10. Teacher flags are visible only on the individual student page, not in roster/analytics views.

## 6. Manual tests required 👤

* A real student session with real Gemini quota, including Taglish messages and a deliberately hostile prompt.
* A teacher reviews 20+ transcripts from `eval-output/` with the rubric (acknowledges the student; explanation correct; hint right-sized; tone; no repetition; clear next step).
* A teacher checks the tutor-flags card appears for a struggling student in a real class.

## 7. Recommended next phase

Two candidates, in this order:

1. **Live-model evaluation and Filipino/Taglish understanding** (finish Module 12/13): run the harness against Gemini, tune from the failures, add Taglish intents, and extend deterministic evaluation beyond binary integer expressions (absolute value, comparison, equations, ordering).
2. **Classroom foundation** (Part 10 B / Module 18): DB-backed classrooms, enrolment and teacher authorization; currently in-memory only, which also blocks the new teacher flags in production.
