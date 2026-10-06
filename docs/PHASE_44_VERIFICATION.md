# Phase 44 — The mistake analyzer on the real Term 1 topics (Module 9)

**Objective:** the analyzer that tells a student and a teacher *what kind of mistake* was made had been written and tested on integer questions. Term 1 is polygons and angles, percentages, money and rates. Did it say anything true about them?

## What measuring it found (all-wrong runs on each of the 17 Term 1 skills)
| # | Defect | Effect | Fix |
|---|---|---|---|
| 1 | **16 of 17 skills were reported as `QUESTION_TYPE_DIFFICULTY`** ("unfamiliar with how to format answers for numeric input") | A student failing a *topic* was told their problem was the *answer format* | The format finding now needs the student to do well (50%+) on the other formats |
| 2 | **Any hyphen counted as a negative sign.** "Convex and non-convex polygons" was reported as a negative-number comparison problem, with a recommendation to "place negative numbers on a number line" | A wrong, confusing finding on a polygon lesson | A sign is now a real minus in front of a number, "(-3)", or the word "negative". "two-step", "non-convex", "5 - 2" are not signs. The single-attempt check used the same shortcut and got the same fix |
| 3 | Nothing on these topics was recognised: every miss became "arithmetic computation errors" | Teachers saw one generic sentence for every topic | **Known slips**: the tutor's coaching (Phase 40) already knows, per kind of problem, which wrong values the usual mistakes produce. The analyzer now reuses that: a wrong answer equal to a known slip is reported as `PROCEDURAL_ERROR`, naming the topic ("7 of 10 incorrect answers match a common slip in the new value after a percentage change"), with the idea to revisit, pointing at exactly those attempts |
| 4 | Missed multiple-choice and true/false questions were also called "arithmetic" errors | Wrong kind of advice | These are now a conceptual finding ("a key idea or definition is not yet clear") |

A slip is only claimed when at least half of the misses (or at least two and a quarter) match, and the text says "N of M" with lower confidence when it is a minority.

## Verification
| Check | Result |
|---|---|
| `scripts/test-phase44-mistakes.ts` (no server) | 21 passed: hyphens are not signs (all Term 1 skills); integer behaviour kept; no all-wrong run is blamed on the format (and a real format problem still is); true/false misses are conceptual; **all 109 known slip values across 76 numeric questions** are reported as the specific finding pointing at that attempt, none equals the correct answer, **none of the findings contains the question's correct answer**; "2 of 8" / "1 of 2" are reported honestly; one slip among five unrelated misses is not claimed |
| **Mutation checks** | Turning off the slip rule fails 2 checks; removing the format guard fails 2 |
| `scripts/test-phase44-prisma.ts` (PostgreSQL, real migrations + real Term 1 course, real HTTP) | 24 passed: a student completes the **Percentage Increase**, **Interior and Exterior Angles** and **Rates and Unit Rates** practice sets giving the usual wrong values; the stored analysis is `PROCEDURAL_ERROR` ("7 of 10…", "9 of 10…", "6 of 10…") naming the topic, with none of the old wrong claims; the class teacher sees the same finding |
| Phase 9 suite (adaptive engine, uses mistake analyses) | passes |
| Full regression | see the end of this file |

## Not done / limits (please read)
* Slips are recognised for **76 of the 126 numeric Term 1 questions** (15 kinds of problem). The other numeric questions, and any question a teacher adds for Terms 2–3, still get the general (now honest) findings. By lesson: Interior/Exterior Angles 10 of 12 practice questions, Percentage 9, Rates 6, Money 3, Polygon naming 2, Convex/Angle pairs 1.
* The analysis looks at the student's **10 most recent attempts** (existing behaviour); a 12-question set loses the first two.
* With `AI_PROVIDER=gemini` the model writes the analysis and the rule-based finding is only the fallback: I did **not** add the slip finding to the model's prompt, and nothing here was run with a live model.
* `test-phase8.cjs` and `test-phase8-pattern.cjs` (older scripts that need a server on port 3000) failed at sign-in when I tried them; I did not investigate, and they are not part of the regression.
* Teachers have not reviewed whether the wording of the findings suits their classes.

## Full regression
Running when this was committed; the result is recorded in the next commit.
