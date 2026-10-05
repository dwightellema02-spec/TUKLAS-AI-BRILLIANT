# Phase 28 — Ownership checks and server-enforced completion: verification report

**Status:** implemented and tested over HTTP in both stores, in a real browser, and with mutation checks. Not tested with real teachers or students. Two product decisions were made by me and need your confirmation (section 5).

## 1. Defects found (all pre-existing)

| # | Finding | Severity | Fix |
|---|---|---|---|
| 1 | Any teacher could **add, edit, delete and reorder content blocks on any other teacher's lesson**, including rewriting a question's answer key, and attach videos to it. (Only lesson edit/status/delete, documents and notes were owner-checked.) | High | `assertCanEditLesson` on block create/update/delete, reorder, and video attach: 403 for another teacher, 404 for an unknown lesson (it used to be a 500). |
| 2 | Any teacher could edit, delete, or change the status of **any other teacher's questions**, add or remove questions in their practice sets, and attach new questions or practice sets to their lessons. | High | Mutations require the creator or an administrator. Reading stays open: the question bank is shared on purpose. |
| 3 | Any teacher could **reorder a unit shared with other teachers**. | Medium | A teacher may reorder only a unit whose lessons they all authored; otherwise an administrator does it (403 with that message). |
| 4 | A student could **complete any lesson without answering anything**: progress COMPLETE, the lesson-session `isCompleted`, and "Next Section"/"Complete Lesson" were all self-reported. | High | The server computes which questions are unanswered. COMPLETE and session completion return **409** with the missing question ids; "view all blocks" progress stops at 99%. |
| 5 | The session route stored whatever `completedBlockIds` the browser sent, so the browser could mark question blocks as done. | Medium | Question blocks count as completed only if answered correctly (server evidence); reading/video blocks are still self-reported; unknown block ids are dropped. |

## 2. Rules (these are policy choices; see section 5)

* **Ownership:** a teacher changes only what they authored (`authorId` / `createdById`); rows with no recorded author stay editable by any teacher (as the existing lesson routes already behaved); administrators change anything.
* **Completion:** every question block (CHECKPOINT/QUESTION) in the lesson must have at least one correct attempt. Retries are unlimited, so it is always achievable. A question whose key is broken (cannot be answered) never blocks completion, so students are never trapped. Lessons with no questions complete as before.

## 3. Evidence

| Check | Result |
|---|---|
| `scripts/test-phase28-ownership.ts`, in-memory | **43/43** over HTTP: 15 forbidden operations by a second teacher (blocks create/edit/delete/reorder, video, 4 question mutations, 2 practice-set mutations, attaching new questions/practice sets to the lesson, unit reorder) and a proof that none of them changed anything, including lesson order; the owner and an administrator still can; reading still works; 404 for unknown lessons; completion: refused with nothing answered (409 naming 2 missing), refused through the session route, 99% cap, forged `completedBlockIds` ignored for questions, a wrong answer does not count, 1 remaining after 1 correct, success after both, idempotent; a broken question does not trap a student; a reading-only lesson completes as before |
| Same suite on PostgreSQL (`scripts/test-phase28-prisma.ts`) | **43/43** on a brand-new production-style database + **10/10** database checks (the answer key is unchanged after the other teacher's attempt, the question carries the administrator's edit not the "hijacked" text, all three lessons stored as completed at 100%, the correct attempts stored) |
| Real browser (`scripts/test-phase28-browser.mjs`) | **all checks pass**: clicking through the seeded lesson to "Complete Lesson" without answering is refused with "Answer 2 remaining questions correctly to complete this lesson.", the student is returned to a question, answers both through the UI, and the server then shows the lesson COMPLETED |
| Mutation checks (change made -> suite must fail) | block create owner check off -> 2 failing; block edit owner check off -> 3; question ownership off -> 8; practice-set ownership off -> 2; unit-reorder check off -> 4; COMPLETE without answers -> 5; session completion without answers -> 1; session trusts client completed ids -> 1; progress may reach 100% unanswered -> 1; broken questions block completion -> 2. All restored. |
| Regression | (see section 4) |

The Phase 26 and 27 suites were updated: their helper that completes lessons now answers the lesson's questions first (a student can find the answer by trying the choices, which the helper does through the real routes), because completing without answering is now correctly refused.

## 4. Regression

Run after the final code change: tsc and vite build clean; phases 9, 10, 12 (21/21), 13 (25/25), 14 (25/25), 22 (149), 23 (209), 24 (161), 25 (113), 26 (41), 27 (52), 28 (43), auth-repair and workflow pass. PostgreSQL scripts: 22 (12/12) and 23 (14/14) on a demo-seeded development database, 25 (113 + 19), 26 (43 + 12), 27 (53 + 12), 28 (43 + 10). Real-browser scripts on fresh servers: phase 22 (11/11), 23 (10/10), 24 (10/10), 25, 27 and 28 (all pass). The old phase 6/7/8 scripts remain unrunnable (hard-coded stale tokens) and were not run.

## 5. Decisions for you, and what this does NOT prove 👤

1. **Decision: completion requires a correct answer to every question.** I chose "answered correctly at least once" rather than "attempted" or a score threshold. If you want something looser (any attempt) or stricter (first-try), it is a one-line change in `getLessonCompletionStatus`.
2. **Decision: teachers cannot reorder a unit shared with another teacher.** In a school where several teachers share one unit, only an administrator can reorder it. There is no UI for this yet beyond the existing studio reorder control, which will show the 403 message.
3. **Lessons and questions with no recorded author** (older rows) remain editable by every teacher. A migration to assign authors would be needed to close that.
4. Teachers still **share** the whole question bank for reading, including answer keys, by design. A teacher can copy someone else's question but not edit it. There is no "duplicate question" action in the UI yet.
5. Approval workflow is unchanged: a teacher can approve and publish their own lesson with no second reviewer. Role-based review (e.g. department head) is not implemented.
6. Reading/video blocks are still self-reported (a student can mark a video "watched" without watching).
7. No audit trail of who changed an answer key.
8. Classroom assignments still do not restrict lesson access (Phase 25 gap). Admin-only operations such as reordering have no dedicated UI.
9. No real teachers/students; no mobile or accessibility audit; the studio UI was not browser-tested for the new 403 responses (it shows the server message only where it already displayed errors).
10. Unchanged earlier gaps: stateless sessions, cookie `SameSite=None`, global in-memory teacher AI settings, many Prisma read paths still fall back to demo data when empty, live Gemini evaluation not run, Filipino text unreviewed.

## 6. Manual tests required 👤

* With two teacher accounts, try editing each other's lessons/questions in the studio and read the messages.
* Walk a real student through a lesson on a phone, including leaving a question unanswered and pressing "Complete Lesson".

## 7. Recommended next phase

1. Remove the remaining demo-data fallbacks on Prisma read paths (so an empty database is empty, not demo).
2. Session revocation (password/role change) and CSRF hardening.
3. Review workflow (second reviewer) and an audit trail for answer-key and role changes.
4. Live tutor evaluation when a Gemini key is available.
