# Phase 38 — Real Grade 7 Term 1 (Weeks 1–6) curriculum in the production seed

**Master-plan modules:** 1–3 (curriculum structure), 4–6 (lessons, skills), 8–9 (questions / practice).
**Source of scope and sequence:** the DepEd MATATAG *Grade 7 Mathematics Three-Term Budget of Work* supplied by the school (Term 1, Weeks 1–6). The six Q1 Lesson Exemplars were used only to confirm week and competency.

## Why
Until now a production database was seeded with a single lesson ("Understanding Integers", 3 skills). In the official Budget of Work, integers are **Term 2, Weeks 9–10**, and Term 1 begins with polygons. A real class on the real calendar had nothing to open in Week 1.

## What changed
| Area | Change |
|---|---|
| Content | `src/lib/curriculum/grade7-term1*.ts`: 2 units, 6 competencies, 17 skills with prerequisites, 6 lessons (70 blocks incl. worked examples, gradable checkpoints, five inline SVG diagrams), 180 questions, one 12-question practice set per lesson, and a teacher note per lesson |
| Loader | `grade7-term1-loader.ts`: idempotent; rows are looked up by stable keys and never overwritten, so a teacher's edits survive a re-seed |
| Seed | `prisma/seed.ts` loads Term 1 and moves the old "Numbers and Algebraic Expressions" unit (integers) to a **Term 2** unit "Number and Algebra: Integers" in place — same ids, so existing progress is kept |
| Learning path | **Bug fixed:** lessons were ordered by `sequenceOrder` alone, so lessons of different units interleaved (the integers lesson sat between Week 1 and Week 2). Order is now term → unit → lesson |

Units: **A** Measurement and Geometry: Polygons (Wk 1–3) · **B** Number and Algebra: Percentages and Rates (Wk 4–6).

## Content rules followed
* All text, examples and questions are **original**. DepEd Lesson Exemplars are restricted teacher materials; nothing was copied, and their video links were not used.
* Every numeric answer is computed in code from the numbers in the prompt.
* Real drawing with a compass/protractor is described in the lesson but cannot be assessed online; the practice set checks the ideas behind it.

## Verification
| Check | Result |
|---|---|
| `scripts/test-phase38-curriculum.ts` (pure) | 613 passed. Recomputes **every numeric answer independently** from the prompt (a second implementation, not the generator), plus: unique prompts/keys, valid choices, every skill ≥ 6 questions, prerequisites acyclic, every checkpoint gradable by the real `parseChoiceBlock`, SVG well-formed with no script, math delimiters balanced |
| `scripts/test-phase38-prisma.ts` (fresh PostgreSQL) | 74 passed: curriculum-only seed (no accounts); 6+1 lessons, 180 questions, 6 practice sets; seeding twice changes nothing; an old-style database is migrated in place; then as a **student over HTTP**: Week 2 is locked until Week 1 is done, every block is served with no answer keys, every checkpoint grades the intended answer correct and another option wrong, each lesson completes in order, and all 72 practice questions, answered with the intended answers, are graded correct by the server |

The PostgreSQL run found the lesson-ordering bug above (a student could not leave Week 1: Week 2 required "Understanding Integers"). It is fixed and the test now guards it.

## Not verified / limits — read before using with a class
* **Not reviewed by a DepEd curriculum specialist or a teacher.** Wording, difficulty and pacing are unvalidated; a teacher should read each lesson before students use it. Lesson text is English only.
* **Only Weeks 1–6.** Weeks 7–10 (rational numbers, roots) and Terms 2–3 are not loaded. After Week 6 a student reaches the integers lesson (Term 2) next.
* Lessons are strictly sequential (existing platform behaviour): a student cannot open Week 4 until Week 3 is completed, even if the class is ahead. There is no teacher override yet.
* The learning-path header shows the term of the first lesson ("Term 1") even when the path continues into Term 2.
* **The AI tutor's deterministic answer-checker only understands integer arithmetic.** For polygon-angle, percent and rate problems the tutor still guides, but it cannot independently verify a student's numeric answer in these topics. Practice and checkpoint grading (server-side) are unaffected.
* The in-memory sandbox (no database) keeps its own small demo curriculum; this content is for the PostgreSQL deployment.
* Nothing here was used by real students. Docker image build and live Gemini remain unverified (see earlier phases).
