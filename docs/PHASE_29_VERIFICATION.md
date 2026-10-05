# Phase 29 — Honest research analytics and no demo fallbacks: verification report

**Status:** implemented and tested over HTTP in both stores, in a real browser, and with mutation checks. The statistics themselves (thresholds, calculators) were **not** validated by a researcher; see section 5.

## 1. Defects found (all pre-existing, all in code a thesis would rely on)

| # | Finding | Severity | Fix |
|---|---|---|---|
| 1 | **The pre/post comparison was invented.** With no data, it returned a 65% pre-test and 88% post-test average, three hard-coded skill accuracies, "1 student", and the class name "Section Mabini". The CSV export carried the same numbers. | Critical | Averages, student counts and per-skill accuracies are computed from graded responses (each student's latest graded attempt). With no data they are `null`, the trend is `INSUFFICIENT_DATA`, the page says "No data". Only skills measured on both tests are compared. |
| 2 | **Mistake analytics, intervention observations and the time series were fixed fiction**: mistake counts 5/3/2/1, a story of "+47 points after the AI tutor hint" for a named student, five dated accuracy values rising 65% → 91%. | Critical | Mistakes come from recorded mistake analyses; interventions are real before/after accuracy around tutor conversations (at least 3 attempts each side, worded as non-causal); the time series is real accuracy per day. Per-day understanding/application/consistency are no longer fabricated (shown as "—"). |
| 3 | **Difficult skills**: skill 2 was force-flagged whatever the data said, and every entry claimed "1 student", with made-up misconceptions and mastery distribution. | High | Needs at least 5 attempts from at least 2 students and a real accuracy < 65% or hint rate > 40%; misconceptions and mastery counts are the recorded ones; the reason quotes the real figures. |
| 4 | **No scoping.** Every research endpoint returned data for all students to any teacher; the class filter was ignored; the raw-attempts CSV exported every student's attempts with the name "Juan de la Cruz" hard-coded; the metrics CSV exported one hard-coded demo student. | High (privacy) | A teacher's scope is the students in their own active classes (administrators: everyone); a class filter requires owning that class (403/404). Exports use the same scope and real names. |
| 5 | The research page hard-coded the class ("Section Mabini"), the student ("Juan de la Cruz (Primary Sample)") and offered no real choices. | High | Class and student lists come from the signed-in teacher's own data; every request carries the chosen class. |
| 6 | The student profile invented the name "Juan de la Cruz" for an unknown student. | Medium | Unknown student -> 404. |
| 7 | **Demo-data fallbacks in database mode** (about 70 call sites): an empty lessons/curriculum/skills/mastery table served the demo content, and any database error was swallowed and answered from demo memory, including some writes. | High | With a database configured, errors propagate (a 500, not fake data) and empty tables stay empty. In-memory mode (no database) is unchanged. |
| 8 | Minor: a negative skill change was drawn in green; "Phase 14 Empirical Engine" label. | Low | Fixed. |

## 2. What changed

* `src/lib/research/research-data.ts` (new): scoped, database-or-memory loaders; `research-service.ts` rewritten on top of it; `comparison.ts` returns nulls instead of numbers when data is missing; types and CSV export accept nulls.
* `server.ts`: `researchScopeFor` (ownership-checked) and a common error mapper on all nine research routes; the pre/post tests default to the latest PRE_TEST / POST_TEST in the database.
* `src/lib/db.ts` and the dashboard, assessment, mastery and research services: in database mode a failed query throws instead of falling back; the four "empty means demo" reads (curriculum, lessons, skills, masteries) now return empty.

## 3. Evidence

| Check | Result |
|---|---|
| `scripts/test-phase29-research.ts`, in-memory | **52/52** over HTTP with real practice data created through the real routes (three teachers, three students, real answers): 18 access-control checks (students and signed-out refused on all 8 endpoints, cross-teacher class and profile access refused, unknown class/student), exact figures for Teacher One's students (profile 1/6 accuracy, difficult skill with 12 attempts / 2 students / accuracy 2/12 / hint rate 50%), Teacher Two sees none of it, exact time-series totals, per-teacher CSV contents with real names, nulls and INSUFFICIENT_DATA instead of 65 -> 88, real class name, an administrator sees everyone, a teacher with no classes gets only empty results |
| `scripts/test-phase14-research.ts` (updated) | **32/32**: now asserts that averages equal the mean of the real graded results, that nothing is invented when there are none, and that mistake counts add up to the recorded analyses and the time series to the real attempts |
| Same suite on PostgreSQL (`scripts/test-phase29-prisma.ts`) | **52/52** on a brand-new production-style database + **17/17** database checks, including a **second, completely empty database** where lessons, curriculum, skills and questions come back empty (they used to return demo content) and research is empty |
| Real browser (`scripts/test-phase29-browser.mjs`) | **all checks pass**: no hard-coded class or student; the class and student lists are the teacher's own; no hard-coded profile request; no old "+23.0 pts / Relative growth" text; the comparison either says "No data" or states it is not evidence of cause; negative changes are not shown as improvements; choosing a class scopes every request |
| Mutation checks (change made -> suite must fail) | teacher scope = everyone -> 15 failing; class filter skips ownership -> 3; profile skips authorisation -> 2; minimum-students rule removed -> 1; comparison invents a 65 baseline -> 2; attempts CSV unscoped -> 4; time series counts other students -> 11; empty scope treated as everyone -> 3; on PostgreSQL, the "empty lessons table serves demo lessons" fallback restored -> 1. All restored. |
| Regression | (see section 4) |

## 4. Regression

Run after the final code change: tsc and vite build clean; phases 9, 10, 12 (21/21), 13 (25/25), 14 (32/32, updated), 22 (149), 23 (209), 24 (161), 25 (113), 26 (41), 27 (52), 28 (43), 29 (52), auth-repair and workflow pass. PostgreSQL scripts: 22 (12/12) and 23 (14/14) on a demo-seeded development database, 25 (113 + 19), 26 (43 + 12), 27 (53 + 12), 28 (43 + 10), 29 (52 + 17). Real-browser scripts on fresh servers: phase 22 (11/11), 23 (10/10), 24 (10/10), 25, 27, 28 and 29 (all pass). The old phase 6/7/8 scripts remain unrunnable (hard-coded stale tokens) and were not run.

**The regression run found two test problems, both fixed in the tests, not the product:**
* The phase 25 PostgreSQL run failed after the fallback removal. The test looked up the unit with the wrong response shape and fell back to the demo id `unt_01`; the old fallback then quietly created the lesson **in memory while the server was in database mode**, so the test had been passing on a silent lie. The test now reads the real unit id. (The same wrapper also now picks the newest class when several runs share a database.)
* The phase 28 browser script was flaky (it failed about 1 run in 3 clicking a radio button with a forced click). It now clicks the label; 8 consecutive runs pass.

## 5. What this does NOT prove / known gaps 👤

1. **The research statistics are not validated.** The accuracy / understanding / application / consistency formulas, weights and thresholds (`research-config.ts`) are design choices that no researcher or statistician has reviewed. The new code only guarantees that the numbers shown come from real data and are scoped correctly; it does not make them valid measures.
2. **Small samples.** Class-level views need at least 2 students and 5 attempts to flag a skill; there are no significance tests or confidence intervals. The pre/post comparison is two group means (each student's latest graded attempt), not a paired analysis, and is described as an observed difference, not evidence of cause.
3. **Pre/post wiring was tested at unit level, not end to end over HTTP.** There is no teacher UI for choosing which two assessments to compare; the page uses the demo assessment ids in memory mode and the latest PRE_TEST/POST_TEST in the database. The assessment-creation flow (Phase 14) was not re-audited.
4. **Intervention observations** exist only where a student has at least 3 attempts on a skill before and after a tutor conversation; most real data will show none. They are not causal evidence and not controlled for time, practice or other help.
5. **Mistake categories** depend on the mistake analyzer (Phase 8), which was not re-audited here.
6. About 70 database error paths now fail loudly instead of falling back. That is the intent, but it means a database hiccup now shows an error page where the app used to carry on with demo data; there is no retry logic.
7. Other places still contain demo-style constants that were not touched: the teacher AI-settings store (global, in memory), `getStudentLearningPath` fallbacks in no-database mode, and demo ids in the in-memory seed. Admin-only research exports across many students are capped at 300 students.
8. No real data has flowed through any of this; no real students, no mobile or accessibility audit; the live Gemini tutor evaluation and Filipino text review are still pending.

## 6. Manual tests required 👤

* With real classes and real practice data, compare the research page figures with a spreadsheet calculation for one skill and one student.
* Have a researcher or adviser review `research-config.ts` and the metric formulas before any figure is quoted in a paper.

## 7. Recommended next phase

1. Statistical review of the metrics and a teacher UI for choosing the pre/post assessments; end-to-end test of assessment creation, taking, grading and comparison.
2. Session revocation (password/role change) and CSRF hardening.
3. Review workflow and an audit trail for answer keys and role changes.
4. Live tutor evaluation when a Gemini key is available.
