# Phase 37 — Question skills: linking, validation and visibility — verification report

**Why:** Phase 36 showed that questions with no skill feed neither mastery nor recommendations, and nothing told the teacher. A class could look "fine" because the evidence was missing. Checking how a teacher actually creates a question turned up four further problems that only show on a real database.

**Status:** implemented and verified over HTTP (in-memory and a fresh PostgreSQL database), in Chromium (in-memory and PostgreSQL), and with mutation checks. Nobody has used the question editor in a real classroom.

## 1. Findings (all pre-existing)

| # | Finding | Severity |
|---|---|---|
| 1 | The question editor **silently selected the first skill** for every new question (the list had no "none" option). A teacher who did not look got every question tagged "Identify integers", which corrupts the mastery evidence rather than just lacking it. | High |
| 2 | The question editor and the practice-set page **attached every new item to the demo lesson `lsn_01`** (a hidden default; the editor had no lesson field at all). On a real database that lesson does not exist, so saving was refused: **a teacher could not create a question or a practice set from the screens** (the earlier journey tests created them through the API, which hid this). | High |
| 3 | The server accepted any skill id; an unknown one failed later as a database foreign-key error (HTTP 500). | Medium |
| 4 | The **production curriculum seed linked its lesson to no skills** (the sandbox curriculum did). Work done inside the seeded lesson could not be tied to a skill, so lesson-based mastery, difficult-skill analysis and recommendations had nothing to use. | Medium |
| 5 | The editor's lesson list (once it had one) would have offered lessons the teacher is not allowed to attach to (the server refuses: Phase 28). | Low |

## 2. What changed

- **Server:** an unknown or non-text skill id is refused (400) on create, PATCH and PUT; a question attached to a lesson but given no skill **inherits the lesson's first skill**; a skill the teacher chose is never overridden; clearing a skill (null) is allowed; `GET /api/questions?noSkill=true` (staff only) lists questions without one.
- **Question editor:** no skill pre-selected ("Choose a skill…"); a warning that says what happens without one (or that the lesson's skill will be used); a lesson field (no lesson by default, only the teacher's own lessons for a teacher); saving as **Published** with no skill and no lesson asks for confirmation.
- **Question bank:** a "No skill" badge and an "Only questions without a skill" filter. **Assessment builder:** "no skill" marker beside such questions.
- **Practice-set page:** no hidden demo lesson.
- **Curriculum seed:** the seeded lesson is linked to its three skills; running the seed again changes nothing (it runs on every container start).

## 3. Evidence

| Check | Result |
|---|---|
| `scripts/test-phase37-skills.ts` (HTTP) | **21 passed, 0 failed** in-memory and PostgreSQL: unknown / non-text skills refused and nothing created, valid stored, no skill allowed, empty/null = none, lesson inheritance and no override, PATCH/PUT validation, edit leaves skill alone, clearing, the filter (staff only; students get the normal list; no answer keys; signed-out 401) |
| `scripts/test-phase37-browser.mjs` (Chromium) | all pass in-memory and PostgreSQL: no pre-selected skill, warning, option list, declined publish saves nothing, accepted publish saves, lesson chosen changes the warning and the saved question carries the lesson's skill, **a question and a practice set can be created from the screens**, "No skill" badge and filter, picker marker |
| `scripts/test-phase37-prisma.ts` (fresh PostgreSQL) | 13 passed: seed links the lesson to its skills and is safe to repeat; no question points to a missing skill; stored lesson + skill for the editor-made question |
| Mutation checks | removing the skill-exists check, the lesson inheritance, the PATCH/PUT check, the filter, or the staff-only guard each fails a test |
| Regression | see the commit message / final run |

## 4. Known limitations — read this one

- **The production curriculum is tiny.** The curriculum seed contains one lesson and three skills (Identify integers, Compare integers, Represent integers on a number line). The real Grade 7 MATATAG content is **not loaded**: teachers must create their lessons and skills in the curriculum studio, or the seed must be extended with the real curriculum. Until then "mastery by skill", "difficult skills" and recommendations can only talk about those three skills.
- Existing questions with no skill are **not fixed automatically**: the question bank now shows and filters them, but there is no "assign a skill to many questions" action.
- A skill is **never required** (only a confirmation when publishing). Skills are not suggested from the question's text.
- The editor lists only lessons the teacher wrote; a teacher cannot attach a question to a shared published lesson written by someone else.
- The student-facing practice screens were not changed.

## 5. Needs a person (👤)

1. Decide the real skill list (MATATAG competencies) and whether the seed should include the school's full Grade 7 curriculum.
2. Watch a teacher create 5 questions from scratch and note where they hesitate (skill choice, lesson field, the confirmation).
