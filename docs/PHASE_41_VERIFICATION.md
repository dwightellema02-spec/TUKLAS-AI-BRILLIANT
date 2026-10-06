# Phase 41 — Teachers add the rest of the course (Terms 2 and 3)

**Decision from the project owner:** the platform will not ship Term 2 and 3 lessons; *teachers upload them*. So the question for this phase was: can a teacher really do that? I walked the whole job in a real browser (add the units, the skills, the lesson, its sections, publish, a student takes it) and it did not work. Three blockers were found and fixed.

## Defects found (all in PostgreSQL mode, i.e. production)
| # | Defect | Effect | Fix |
|---|---|---|---|
| 1 | **The studio's "Save Draft" kept nothing.** `updateLesson` ignored `contentBlocks` and `skillIds` and still answered "saved" | A teacher's sections and skill choices were silently lost | Sections and skills are saved in one transaction; sections that already exist keep their id (students' answers and progress point at them); removed ones are deleted; bad input is refused (400) |
| 2 | **Skill prerequisites could not be edited for any real skill** ("Target skill does not exist": the check looked at the in-memory demo store) | A teacher could not set up the order of skills | Validated against the database: unknown ids, self-reference and circles (direct or indirect) are refused |
| 3 | **No way to create Term 3, a unit, a competency or a skill** | Lessons could only go into the three seeded units, with the seeded skills | New: add / rename / delete units (any term, Term 3 is created by the first unit added to it), competencies and skills; skills can be given prerequisites (also to skills of another term); units can be put in order |
| 4 | **The studio's new-section templates were integer examples with a valid answer key** (a new checkpoint said "-2" is the right answer) | A teacher who forgot to edit one would publish integer content into e.g. a rational-numbers lesson | Templates are neutral and carry "(Replace this text)"; a lesson that still has it cannot be published (the error names the section) |
| 5 | Lists of skills, units and the question editor's skill menu were flat ("Unit 1" three times, 30 unlabeled skills) | Hard to pick the right one once the course grows | Skills are grouped under "Term 3 · Unit title"; the unit menu says "Term 3 · Unit 2: ..."; the question editor names each skill's unit |

## What a teacher does now (also in `docs/TEACHER_QUICKSTART.md`)
1. **Teacher → Curriculum → Add a unit** (choose Term 1, 2 or 3). Use **Move up / Move down** to put units in the right order (the integers unit is Weeks 9–10 of Term 2).
2. Open the unit → **Competencies and skills**: add the competency (code and statement) and the skills it contains (title, difficulty). Skills are what mastery and the analytics are measured on. Optionally set prerequisites in the panel beside it.
3. **Create New Lesson**: choose the unit and tick the skills.
4. In the studio add sections, fill in every one (the studio refuses to publish template text), attach documents or videos, **Save Draft**.
5. Submit for review → approve → publish. Students then see it in course order; if the class is ahead, open it from the class page (Phase 39).
6. Create questions and practice sets for the lesson's skills as before.

## Rules
Teachers and administrators may add. A teacher edits or deletes only what they added (or what has no owner, i.e. shipped with the platform, like lessons); administrators anything. A unit, competency or skill that still holds something cannot be deleted and the message says what (lessons, questions, practice sets, student progress, other skills that require it). Reordering units is open to any teacher (order is a course-level matter). Titles are unique within their parent (any capitals); sizes are capped.

## Verification
| Check | Result |
|---|---|
| `scripts/test-phase41-structure.ts` (PostgreSQL) | 71 passed: units in a new Term 3, ordering, duplicates and every bad input; competencies; skills (with prerequisites across terms, atomic: a bad prerequisite leaves no half-made skill); prerequisites on real skills incl. direct and indirect circles; who may edit what; delete only when empty (a skill used by a lesson, by a question, required by another skill...); reordering; the new lesson is last on a student's path and locked behind the lesson before it |
| same suite, in-memory demo mode | 5 passed: refuses cleanly (409 "needs the database"), students 403, signed-out 401; the demo store's prerequisites still work |
| `scripts/test-phase41-lesson-save.ts` (both stores) | 24 (PostgreSQL) / 17 (in-memory) passed: sections and skills are kept, in order; edit / reorder / add / remove; kept sections keep their id; refused saves change nothing; another teacher 403; template text blocks publishing (also inside a question's data) |
| `scripts/test-phase41-browser.mjs` (PostgreSQL) | The whole job through the real screens: add a Term 3 unit, move a unit up, add a competency and skill, delete refused with the reason, create the lesson (skills grouped), sections start neutral, publishing the unedited studio is refused, fill in with math, publish, a student on a phone opens it with the math rendered and no answer key; no page errors |
| `scripts/test-phase41-prisma.ts` | Fresh database, all of the above, plus rows: Term 3 created by the first unit, creators recorded, seeded units have none, no published lesson holds template text |
| Mutation checks | Putting the old `updateLesson` back fails the save suite (4 checks + crash); restoring the old prerequisites route fails 8 |

## Not done / limits
* **Teacher-written Term 2 and 3 content has not been seen by anyone**; nothing was authored or reviewed by me or a curriculum specialist. The platform only makes it possible.
* **Demo (in-memory) mode cannot change the curriculum structure** (it has one fixed unit); everything here needs the database.
* The studio still lets a teacher save a section as drafts with template text; only publishing is blocked.
* No bulk import: sections are typed or pasted in the studio one at a time (documents can be attached as resources). An "import a lesson from a Word/PDF file" feature does not exist; it would be a sensible next step if teachers have lessons as documents.
* Reordering lessons across units, moving a lesson to another unit and moving a unit to another term are not offered (lessons can be reordered within a unit as before).
* A skill added by one teacher cannot be edited by another (administrators can).
* The studio's block editor shows one section's fields at a time (existing design); the journey test therefore expands sections with the Expand button.
