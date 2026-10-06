# Phase 39 — Teacher lesson access (open lessons early)

**Why:** the course is strictly sequential: a student cannot start a lesson until the one before it is completed (and its prerequisite skills are met). That is right for self-paced work, but a real class moves at the teacher's pace: it may be ahead, a student may have been absent, or the teacher may want a topic out of order. With no override, the first such case blocks the class. This was the top remaining risk from the Phase 38 debugging pass.

## What a teacher can do (class page → "Lesson access")
* Open a lesson **for the whole class**, or **for one student** of the class (choose in "Open for").
* **"Open through here"**: open every lesson from the start of the course up to a chosen one (catch-up in one click).
* Close an opening again.
* Students see the lesson as available with the label **"Opened by your teacher"**.

## Rules (all enforced on the server)
* Only the class's own teacher or an administrator; other teachers, students and signed-out users are refused (403/401).
* Only **published** lessons can be opened (draft: 409); unknown lesson 404; a student who is not in the class 404; wrong types 400; archived class 409.
* An opening replaces only the *lock* on that lesson. It never changes progress, never completes anything, and never opens the lesson after it.
* Closing never strands work: a student who already started the lesson keeps it.
* An opening applies only while the student is enrolled in that class and the class is not archived; removing the student or archiving the class ends it.
* Openings belong to a class: a second class starts with none. Deleting a class deletes its openings; the database refuses duplicates.

## What changed
`LessonUnlock` table (class, lesson, student or "" for the whole class); `db.getTeacherOpenedLessonIds` and the learning path (which every lesson-access check goes through); repo/service methods; `GET`/`POST /api/teacher/classes/:id/lesson-access`; `LessonAccessCard` on the class page; the student path label. Works in PostgreSQL and in the in-memory store.

## Verification
| Check | Result |
|---|---|
| `scripts/test-phase39-unlocks.ts` (HTTP, in-memory and PostgreSQL) | 45 passed each: order applies first; class-wide, per-student and open-through; lock text; working inside a locked lesson is refused (403) and an opened one accepted; a student outside the class unaffected; closing keeps started work; permissions and every validation error; removal / archive end the opening; a second class is independent |
| Mutation checks | Disabling the override fails 8 checks; ignoring the "archived" rule fails 1 |
| `scripts/test-phase39-browser.mjs` (in-memory and PostgreSQL) | Teacher opens a lesson on the class screen, it survives a reload, the student on a phone then sees "Opened by your teacher" and can enter it; per-student view; close; no sideways scroll; no page errors |
| `scripts/test-phase39-prisma.ts` | Fresh database with the real Term 1 course: rows stored, unique key, cascade on class delete |

## Limits
* Opening is per lesson, not per date: there is no "open automatically next Monday".
* A teacher cannot lock a lesson the sequence already allows.
* Students are not notified when a lesson is opened; they see it the next time they open their learning path.
* Teacher-only: there is no student request ("please open the next lesson").
* Not used by a real teacher yet.
