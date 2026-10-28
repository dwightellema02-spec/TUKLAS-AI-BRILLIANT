# Phase 51 verification - Subject-Based Authorization for Mathematics Lessons

Date: 2026-10-28. Requirement (professor): only authorized Mathematics teachers may create, import, edit, publish and manage Mathematics lessons for Grades 7-10, including their YouTube/Mathisipan links. Teachers of other subjects are refused, including through direct API requests. Nothing was deployed, merged or pushed.

## Before and after
| | Before | After |
|---|---|---|
| Any `TEACHER` creates a lesson in any unit | allowed | refused unless an administrator has verified their Mathematics assignment |
| `ADMIN` authors or publishes lessons | allowed | refused unless the administrator is also verified (another administrator verifies; nobody verifies their own account) |
| Lessons with no author (the seeded Grade 7 lessons) | editable by any teacher | editable only by verified Mathematics teachers |
| Import, upload, notes, blocks, video attach/remove, status, publish, delete, reorder | role + ownership | role + ownership + verified subject assignment (checked on the server) |
| Ownership between two verified teachers | author only (admin excepted) | unchanged: author only; an administrator needs the assignment too |
| Students | read published lessons and videos | unchanged |

## What changed
* Schema: new table `TeacherSubjectAssignment` (migration `20261028000000_teacher_subject_assignment`). One current Mathematics row covers Grades 7, 8, 9 and 10; revoking keeps the row as history.
* `src/lib/db.ts`: `canAuthorLessons` (subject read from Unit -> Term -> Grade -> Subject in the database, never from the request), grant / revoke / list functions, and `assertCanEditLesson` now checks the assignment first.
* `server.ts`: one guard in front of every lesson-writing route (`/api/lessons`, `/api/lessons/:id/*`, `/api/teacher/lessons/import`, `/api/teacher/lessons/:id/publish`, `/api/units/:id/reorder-lessons`; case-insensitive), answering 403 `SUBJECT_AUTHORIZATION_REQUIRED` and writing `lesson.authoring_denied` to the audit log. New admin routes: `GET /api/admin/subject-authorizations`, `POST /api/admin/users/:id/subject-authorization` and `.../revoke`; `GET /api/me/subject-authorization`; `POST /api/admin/users` accepts `verifyMathematics: true`.
* UI: a notice on the lesson list, new-lesson and edit pages; import and create buttons disabled for unverified people (the server decides); the Administrator page shows "Mathematics verified / not verified" with a verify / remove button and a checkbox when creating an account.
* Tests: `npm run test:phase51` (in memory, 77 checks), `npm run test:phase51:pg` (fresh PostgreSQL database built from the migrations, 99 checks plus 9 database checks, including Grades 7, 8, 9, 10 and a unit outside that range). Older suites that authored lessons as a bare teacher or admin now verify the teacher first.
* Docs: one line added to `docs/DEFENSE_DAY_CHECKLIST.md`.

## Results (run 2026-10-28)
* `npm run lint` (tsc): pass. `npm run build`: pass.
* In-memory and browser suites (phases 22-51, 31 scripts): 30 passed. `test:phase38:browser` run alone fails with "Failed to parse URL from undefined"; it needs `BASE_URL` and is normally run by `test:phase38:pg`, which passed. Not a Phase 51 failure.
* PostgreSQL suites (24 scripts, each on its own fresh database): all passed.
* The mutation check: with the rule switched off, 12 Phase 51 checks fail, so the test does detect a missing rule.
* Not run: `test:phase42:load`, a second Docker simulation, and a live Gemini run.
* A first regression run was discarded: I had left `DATABASE_URL` set for the in-memory suites. The results above are from the corrected second run. Several older suites also needed their setup changed (see below); the failures there were the new rule working as intended.

## Older tests changed because of the new rule
Teachers they create are verified at creation (`verifyMathematics: true`); phases 22, 30 and 37 grant or use a verified account; phase 25 has the author publish; phase 28 now asserts that an unverified administrator is refused and a verified one is allowed.

## Decisions taken (approved by the owner)
Administrators need the assignment too; an administrator verifies teachers in Tuklas; no existing teacher is authorized until verified (the demo teacher too); one assignment covers Grades 7-10; seeded lessons only by verified Mathematics teachers; the author may publish their own lesson (no second reviewer).

## Not covered / limits
* Question-bank and practice-set content that is not attached to a lesson, class assignments, lesson unlocks, assessments, and curriculum structure (units, competencies, skills) still follow their old rules. A non-Mathematics teacher cannot create a lesson inside any unit, but can still add units and questions. Decide whether to extend the rule.
* Teachers can still READ lessons (including the teacher view). Only writes are restricted.
* Only the Mathematics subject exists. Grades are enforced only for Mathematics (7-10).
* In-memory (no database) mode: assignments are not saved, so after each restart the demo teacher must be verified again.
* An administrator cannot verify their own account; a deployment with one administrator needs a second administrator or a verified teacher account.
* After deployment every existing teacher account loses authoring until an administrator verifies it.
* The guard matches route paths; a new lesson-writing route must be added to `lessonWriteTarget` in `server.ts` (the check in `assertCanEditLesson` is a second layer for routes that use it).
* A video attached by a Mathematics teacher is not checked for mathematical accuracy; the existing URL validation is unchanged.
* No independent security review. Browser behaviour of the new notice and admin buttons was typechecked and built but not exercised by a browser test.
