# Phase 46 — Three smaller improvements

## 1. More mistakes recognised on the Term 1 questions
The mistake analyzer (Phase 44) names a specific slip when the student's wrong answer equals what a usual mistake would give. It knew those wrong values for 76 of the 126 numeric Term 1 questions. It now knows them for **121 of 126** (24 kinds of problem, up from 15), by adding the usual slips to the tutor's coaching (which also makes the tutor's hints sharper on these questions):
* discount (amount vs sale price, percent not turned into a decimal, comparing with the sale price instead of the original), commission and sales tax (decimal slip, price plus tax, division turned round), simple interest (no /100, principal plus interest, one year's interest instead of the number of years), budget (total of expenses, only the first expense, share vs what is left);
* straight-line / full-turn confusions for supplementary angles and interior-exterior pairs, adding instead of taking away for a ray inside an angle, the neighbouring instead of the opposite angle, the wrong number of equal parts for angles in a ratio, the total instead of the missing angle, 180 instead of 360 for the exterior angles;
* perimeter shared among the wrong number of sides (new kind of problem), one unit's amount instead of the scaled amount;
* a pattern that missed percentage-decrease questions that write the price with ₱ was fixed.

The five questions still without a known slip are recall questions with no numbers to work from (naming a polygon's sides from its name, vertices to sides).
Every new nudge follows the Phase 40 rules and is swept by that suite (925 checks): no message contains a number from the problem, none states the answer, none equals the correct answer.

## 2. Keep the imported document for the AI tutor (opt-in)
On the "Start from a document" card a teacher can tick "Also keep the document with the lesson so the AI tutor can use it" (`attach=true`). The document is stored as a lesson resource exactly like a normal upload (extracted, chunked, checked); chunks that look like an answer key are flagged and never retrieved for students. Off by default. If attaching fails the draft lesson is still saved and the teacher is told. A document that cannot be read is refused even when attaching was asked for.
Found on the way: a teacher's view of a lesson included the server's internal **storage key** of uploaded files (a pre-existing leak to teachers only); it is now removed.

## 3. Someone is told when it is down
`scripts/monitor-ready.ts` (`npm run monitor:ready`) watches `/api/ready` from outside the app and sends **one** alert after 3 failed checks in a row (settings: interval, threshold, timeout, an optional webhook with Slack-style `text` and Discord-style `content`), then one "ready again". "Not ready" means no answer in time, a network error, a non-200, or a 200 that does not say `ready:true` (a proxy's own page). A broken webhook never stops the watching and is not retried every check; the webhook address is never printed. `--once` gives an exit code for cron. `docs/RUNBOOK.md` section 9b also describes the simpler option: a hosted uptime service pointed at `/api/ready`.

## Verification
| Check | Result |
|---|---|
| `test-phase44-mistakes.ts` | 21 passed; recognises slips for 121 of 126 numeric questions, every slip value reported as the specific finding |
| `test-phase40-coaching.ts` | 925 passed (the first run caught two of my new messages repeating the problem's numbers; reworded) |
| `test-phase45-import.ts` | 37 passed in memory and on PostgreSQL (attach on/off, unreadable file refused, no storage key shown); `test-phase45-prisma.ts` also checks the answer-key text sits only in chunks flagged as answer keys |
| `test-phase46-monitor.ts` | 26 passed: what counts as ready; no alert for 2 failures, exactly one for 3, no repeats, one recovery message, a blip resets the count; a failing webhook is survived; the real command line against a real server and a real webhook receiver (stop server: one alert; restart: one recovery; nothing printed of the webhook address); settings validated. **Mutation check:** an alert that repeats makes 8 checks fail |

## Not done / limits
* Slips are matched on the exact wrong number; a student who makes two mistakes at once, or rounds differently, gets the general finding.
* The monitor sends nothing if the machine it runs on is down: put it on a different machine than the app, or use a hosted service.
* Attaching keeps the original file on the server's disk; erasing a teacher does not delete it (only students' data is covered by the erasure tool).
* None of this has been tried by teachers; the live Gemini path was not exercised.

## Full regression
`tsc`, `build` and every in-memory and PostgreSQL suite (phases 22–46, including `test:phase44`, `test:phase45`, `test:phase45:pg`, `test:phase46`): **47 of 47 steps passed**. The browser journeys (Phases 34, 39, 43, 45) were not re-run after these changes; the only UI change is one checkbox on the import card.
