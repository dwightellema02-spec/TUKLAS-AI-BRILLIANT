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
* **Only Weeks 1–6.** The rest of the course is added by teachers (Phase 41), not shipped. After Week 6 a student reaches the integers lesson (Term 2) next.
* Lessons are strictly sequential (existing platform behaviour): a student cannot open Week 4 until Week 3 is completed. Phase 39 adds a teacher control to open lessons early.
* The learning-path header shows the term of the first lesson ("Term 1") even when the path continues into Term 2.
* **The built-in tutor's coaching is still integer-centred.** Its right/wrong verdict on a practice question comes from the question's stored answer key and is correct on every seeded numeric practice question (tested both ways). But its hints are generic ("let's break it into small steps") and carry no polygon, percent or rate content; real topic-aware coaching for these topics was added in Phase 40.
* The in-memory sandbox (no database) keeps its own small demo curriculum; this content is for the PostgreSQL deployment.
* Nothing here was used by real students. Docker image build and live Gemini remain unverified (see earlier phases).

## Debugging pass (after the first Phase 38 commit)
Opening the lessons in a real browser (student on a 390px phone, teacher on a laptop) and probing the tutor found defects the first round of tests did not:

| Defect | Fix | Guard |
|---|---|---|
| The convex / non-convex diagram was a **broken image** (an unescaped `<` in its SVG text made the picture invalid); two other diagrams had clipped labels; the polygon names were ~6px on a phone | Text is XML-escaped; long labels wrap; polygons laid out 3×2 with larger labels | Content test now checks SVG text is escaped and elements closed; browser test loads every image |
| React "`<div>` cannot be a descendant of `<p>`" warning on every image caption (and two assessment-result lines) | `<p>` → `<div>` | Browser test fails on any page error / React warning (mutation-checked: putting the bug back fails it) |
| The **Term 2 integers unit was invisible to teachers**: the curriculum explorer, the unit page and the new-lesson form only read the first term (the unit page silently showed Term 1's first unit instead); terms/units had no defined order | All three read every term; the API orders terms and units | Browser test |
| Learning-path header named only the first unit ("Polygons … 1 of 7 lessons") and numbered the integers lesson "Lesson 1" | Header names the course ("Term 1 and Term 2"); lessons are numbered by place in the course | Browser test |
| The built-in tutor answered "I feel stuck" / recap / real-life requests on polygon, percent and rate questions with **integer facts** ("the sign of a number tells us its direction from zero") | Integer-specific fallbacks are used only for integer problems or lessons; neutral wording otherwise | PostgreSQL test sends 7 help requests per lesson and fails on integer talk (mutation-checked: fails without the fix, 3 of 6 lessons) |

Also checked and fine: all 14 Week 1 sections render (21 formulas, no KaTeX errors, no sideways scroll at 390px); checkpoints show feedback and are graded server-side; lesson sessions persist; the learning path unlocks Week 2 after Week 1 and states why later lessons are locked; the tutor's verdict is right on all 53 numeric practice questions, for a correct and a wrong answer.

Lessons are strictly sequential; the teacher override for this was added in Phase 39.
