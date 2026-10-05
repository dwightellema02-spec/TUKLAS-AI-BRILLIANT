# Phase 36 — Teacher analytics and evidence-based recommendations (master plan Modules 18 and 19) — verification report

**Status:** implemented and verified with unit tests of the rules (fixed dates, 2,000 random students), an HTTP scenario with a real class in both stores, a Chromium check, a fresh-PostgreSQL run and mutation checks. **The thresholds are starting points, not validated cut-offs, and nobody has used the dashboard in a real class.**

## 1. What was audited

Module 18 asks the teacher to see: student progress, mastery, common mistakes, difficult concepts, lesson performance, practice performance, assessment performance, and students needing remediation. Module 19 asks that recommendations be based on evidence, never random.

## 2. Findings (all pre-existing, all fixed unless noted)

| # | Finding | Severity |
|---|---|---|
| 1 | **Practice sessions were scored wrongly on a real (PostgreSQL) database — since Phase 6.** The session's correct-answer count was computed from the in-memory attempt list, which in database mode holds nothing, so every session ended with **at most 1 correct answer** (a student who got 6 of 6 right was stored as 1 of 6). Mastery was unaffected (it reads the attempt rows) but the practice history, session scores, "average class accuracy" and every teacher flag built on them were wrong. Found because the new PostgreSQL scenario compared against known answers. Fixed; a database-level check now confirms stored counts equal distinct correct attempts. | **High** |
| 2 | "Last activity" and the Active/Inactive status counted only lessons and practice: a student who took a quiz or used the tutor was shown as inactive or "no data". | Medium |
| 3 | The "needs attention" list was cut to the **first 6 in student order**, not the most urgent: a HIGH-priority student could be hidden behind six LOW ones. | Medium |
| 4 | Flags were generic text ("Practice accuracy is currently 55%") with a canned action. No numbers, no evidence, one reason per student. | Medium |
| 5 | No signal from **assessments** (a failed quiz) or from the **tutor** (the tutor already flags conversations for the teacher; the dashboard ignored them). | Medium |
| 6 | No assessment performance and no lesson performance on the dashboard; no way to look at one class when a teacher has several. | Medium |
| 7 | Average accuracy was a mean of session percentages (a 3-question session weighed as much as a 30-question one). Now weighted by questions. | Low |
| 8 | **Questions with no skill** feed neither mastery nor recommendations, and nothing told the teacher: a class could look "fine" because the evidence was missing. The dashboard now says how many answers it cannot use. | Medium |
| 9 | (Module 19, checked, no defect) Student guidance follows evidence once questions are skill-linked: all-wrong → "practise easier" citing 0%; all-right → "harder" citing 100%; no data → "not enough evidence yet". | — |

## 3. What changed

- `src/lib/teacher/class-evidence.ts` — pure rules. One entry per student, strongest first, **the full list is returned** (the screen shows 6 and "Show all N"). Every line carries its numbers (for example "Practice: 4 of 10 questions right (40%) over 2 sessions"). Minimum evidence is required (5 answered questions; mastery needs 3 attempts). A **pre-test is never a flag** (baseline); only the latest result of each assessment counts. Activity = lessons, practice, assessments, tutor use. Flags: low practice accuracy, low assessment, repeated same-pattern mistakes (3+; "unclear pattern" ignored), recent decline, tutor-flagged conversation (14 days), still developing several skills, inactivity (14 days), not started (3-day grace). Suggested actions name the skill or mistake the evidence points to.
- Group recommendations: a skill several students share difficulty with (3+, or at least a third and 2+), with the most common diagnosed pattern and the students' names.
- Dashboard: class filter, assessment performance (assigned/finished/mean/pass rate), lesson performance, group recommendations, a note when answers cannot be used; student detail shows the same evidence, their assessment results and tutor use.

## 4. Evidence

| Check | Result |
|---|---|
| `scripts/test-phase36-analytics.ts` | **76 passed, 0 failed** (in-memory and PostgreSQL): thresholds at the boundary (4/10, 5/10, 12/20, 13/20), pre-test exemption, retake counting, activity sources, grace periods, decline, ordering, completeness (30 of 40 flagged students all returned), group rules, status, 2,000 random students (no `undefined`/`NaN` text, input unchanged, deterministic); a real six-student class over HTTP (practice, quiz, pre-test, tutor) including the exact flags, statuses, assessment figures, weighted accuracy, class filter and scope, and detail page |
| `scripts/test-phase36-browser.mjs` (Chromium, laptop and phone width) | all pass in-memory and on PostgreSQL: 6 rows then "Show all 7", evidence with numbers, assessment card, class filter, student page explanation, no sideways scroll |
| `scripts/test-phase36-prisma.ts` (fresh PostgreSQL) | 11 passed incl. the stored-count check above |
| Mutation checks | removing the pre-test exemption, tutor/assessment activity, boundary values, minimum-evidence rule, latest-result rule, severity ordering, group thresholds, "unclear pattern" exclusion, mastery minimum — each fails a test |
| Regression | see the commit message / final run |

## 5. Known limitations

- **Thresholds are unvalidated** (50 / 65 %, 14 days, 3 mistakes…). They are exported constants; a teacher-adjustable setting is not built. Expect some flags to feel too eager or too slow in a real class.
- **Mistake-pattern flags** depend on the mistake analyser having run (it runs in the background after practice). The rule is unit-tested; the HTTP scenario did not produce analyser output, so that path is not exercised end to end.
- Skill-level views are only as good as the **skill tagging** of questions. The dashboard now warns, but the question editor does not yet force or suggest a skill.
- Loading evidence makes several queries per student; this was not load-tested at 30–40 students on a slow database.
- The teacher AI assistant (Ask AI) was not re-verified against the new figures.
- Flags are prompts for a conversation, never grades or diagnoses; no flag is shown to students.
- Not built: a printable class report, trends over weeks, comparison between classes, and per-teacher threshold settings.

## 6. Needs a person (👤)

1. A teacher should look at a real class's dashboard for a week and say which flags were useful, wrong, or missing; tune the thresholds from that.
2. Check the wording of the evidence lines and suggested actions (and whether Filipino versions are needed).
3. Decide whether skill selection should be required when a question is created.
