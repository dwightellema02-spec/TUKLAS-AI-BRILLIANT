# Phase 49 verification - daily lessons from the Budget of Work and Lesson Exemplars

Date: 2026-10-16. Goal: a week has several days of study, so the platform must not put a whole week in one lesson, and each lesson must stay inside what the Budget of Work (BOW) and the Lesson Exemplar (LE) teach for that day. The week-by-week map and the points to confirm are in `docs/BOW_LE_ALIGNMENT.md`.

## What changed
* The six weekly lessons became **25 daily lessons** (Week 1: 4, Week 2: 4, Week 3: 5, Weeks 4-6: 4 each), one per exemplar day (`src/lib/curriculum/grade7-term1-days.ts`). Text, examples and questions are original; the exemplars' wording is not copied.
* Practice sets are per day (4-12 questions each) and use only questions about that day's topics. The old weekly lessons are archived by the loader in a database seeded earlier.
* Question bank: 10 questions beyond the exemplars removed; 11 added where the exemplars have content the bank lacked (exterior angles, regular polygon angles and sides, original price from a sale price, principal and rate in simple interest).
* Tutor: (1) it no longer quotes a lesson passage that states the answer to the question being asked (the daily practice sets exposed this: "octa- (8)" under "how many sides does an octagon have?"); (2) coaching for three new kinds of question (original price, interior angle of a regular polygon, equal sides of a regular polygon).
* One rates question's numbers changed so its answer is not equal to a step number in the tutor's worked example.

## Tests
* New `npm run test:phase49` (`scripts/test-phase49-alignment.ts`, 472 checks): 25 lessons in week and day order; each names the topics of its day; none mentions a topic from a later day, a later week or outside the exemplars; practice questions stay inside the day; the removed questions are not in the bank. Mutation check: adding "commission" to the Week 5 Day 1 lesson, and a Week 2 word to a Week 1 lesson, each made it fail.
* Updated for daily lessons: `test-phase38-curriculum.ts` (822), `test-phase38-prisma.ts` (248), `test-phase38-browser.mjs`, `test-phase40-prisma.ts`, `test-phase44-prisma.ts`, and the independent answer solver.

## Results
* First full regression (`tsc`, `build`, every in-memory and PostgreSQL suite): 50 of 52 steps passed; Phase 44 (in memory and PostgreSQL) failed: the mistake coaching knew the usual slips for 114 of 124 numeric questions (the test asks for at least 115) because the new questions had none, and the PostgreSQL test looked for the old weekly practice-set titles. Both were fixed by adding the coaching and updating the titles, not by lowering the threshold.
* After the fixes these were rerun and passed: `test:phase22`, `22:pg`, `23`, `23:pg`, `24`, `34:pg`, `35`, `38`, `38:pg`, `40`, `40:pg`, `42`, `43`, `44`, `44:pg`, `49`, and `build`. **A second complete run of all 52 steps was not done** after these last fixes.

## Not verified / open
* A teacher has not read the 25 lessons against the exemplars. Treat them as a first draft until one has.
* **Decision to confirm:** the BOW puts money problems in Week 4; the exemplars teach them in Week 5. The platform follows the exemplars.
* Term 1 Weeks 7-10 (rational numbers, roots, irrational numbers) are not built (no exemplars supplied).
* Lesson videos are not attached; the YouTube links sent earlier were never matched to days (they cannot be checked from here).
* The tutor with a live model (`AI_PROVIDER=gemini`) was never run.
