# Phase 40 — Topic-aware tutor coaching for the Term 1 content

**Why:** before this phase the built-in tutor's coaching was written only for integer arithmetic. On the new polygon, percentage, money and rate questions it judged right/wrong answers correctly (from the stored answer key) but its hints were generic ("let's break it into small steps"), and in the Phase 38 debugging pass it was found reciting integer facts. A student who is stuck is exactly who the tutor is for.

## What the tutor now does on these questions
For each seeded question it knows (by the wording of the question, or else by the skill):
* **the basic idea** ("percentage change compares the change with the ORIGINAL value");
* **three small guiding questions**, one at a time, that never contain the answer or repeat the student's own numbers;
* **an everyday picture** (a sale sign, a receipt, a savings account, a jeepney trip);
* **a worked example with different numbers** (computed, and never ending in the student's correct answer or in the wrong value they just typed);
* **named slips**: when the student's wrong number is what a usual mistake would give (divided by the new value, used 180 instead of 90, divided the wrong way round, forgot to add the tax...), the tutor says what the slip is and asks a question, without saying the right answer.

Example (student typed 20 for "a value rises from 200 to 250, what is the percentage increase?"): *"It looks like you divided by the new value. The percentage change is measured against where the value started. Which number is the starting value?"*

Covers 28 problem kinds and all 17 skills (concept-level coaching for true/false and multiple-choice questions). Integer questions are untouched and still use the original engine; any other question keeps the neutral wording from Phase 38.

## How it is wired
`src/lib/ai/conversation/coaching.ts` (new) is consulted in `AITutorService.planTurn` only when no integer problem can be parsed from the question. The planner lets the usual strategies (hint ladder, steps, worked example, misconception) run for such questions instead of downgrading them to a generic recap; the realizer uses the coaching content for them. All existing safety layers still apply (answer-disclosure guard, protected answer, output screens).

## Verification
| Check | Result |
|---|---|
| `scripts/test-phase40-coaching.ts` (pure) | 921 passed. All 180 questions get coaching. For every numeric question the guiding text contains **neither the answer nor the problem's own numbers**, steps are questions, no slip is keyed to the correct answer. Every worked example is **re-solved by the independent solver** shared with the Phase 38 test (`scripts/lib/solve-prompt.ts`), reaches the right value in its working, differs from the student's problem, and does not end in the correct answer or in a wrong attempt |
| `scripts/test-phase40-prisma.ts` (fresh PostgreSQL, real API) | 13 passed: for each of the **72 practice questions** a new student runs an 8-turn conversation (wrong answer, hints, "show me an example", "I feel stuck", "just tell me the answer"...). The correct answer was **never stated** in any message; no integer talk; topic content in 72/72 conversations; no repeated messages; named slips for 20 / 50 on the percent question, 900 for an angle sum, 0.02 for a speed; the correct answer is still confirmed |
| Mutation check | With the coaching switched off the same test fails 6 checks (37 of 72 conversations repeated themselves; slips unnamed) |

Writing the content tests found and fixed real leaks: the polygon-names hint listed the very prefixes that answer "how many sides does an octagon have?", the exterior-angle-total hint stated 360, a check question contained the number 90 when 90 was the answer, and a discount hint echoed the student's own "25%".

## Not done / limits
* **Built-in (rule-based) tutor only.** When a live AI model (Gemini) is configured, its replies still come from its own prompt; the coaching content is not given to it yet. Not tested with a live model.
* **English only.** A student writing Filipino gets the Tagalog framing sentences but the coaching content is in English (mixed replies). Unreviewed Filipino was not added.
* Coaching is matched by the wording of the question. A teacher-written question worded differently falls back to concept-level coaching by skill (if its skill is one of the 17), otherwise to the neutral wording.
* The tutor does not pose *new practice problems* for these topics (transfer / simpler / harder); after a correct answer it asks the student to explain, then the conversation ends there.
* Slips are recognised only when the wrong number equals what the listed mistakes would produce; other wrong answers get the generic "walk me through what you did" or the next hint.
* "I still don't get it" / "I feel stuck" still get the generic opening question first, by design of the confusion ladder, and the coaching content arrives on the next move.
* The wording is original and was not reviewed by a teacher.
