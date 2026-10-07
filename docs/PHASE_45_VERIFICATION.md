# Phase 45 — A lesson draft from an uploaded document (Modules 5 and 15)

**Objective:** teachers will add the Term 2 and 3 lessons themselves. Until now each lesson had to be typed section by section; the system could read an uploaded document for the tutor but could not turn it into a lesson.

## What it does
On **Teacher → New lesson → "Start from a document"** (or `POST /api/teacher/lessons/import?unitId=...&title=...`) a teacher uploads a `.docx`, `.pdf` or `.txt` file and gets a **DRAFT** lesson in the chosen unit, owned by them, to review in the studio.
* **Word headings** (Heading 1/2/3) split the document into sections. Plain text and PDF are split at headings that are ALL CAPS, numbered, or start with a lesson word (Introduction, Example, Practice, Summary...); this is less reliable, and the page says so when no headings were found.
* The first heading becomes the lesson title (a title typed by the teacher wins; otherwise the file name is used and the teacher is told).
* Objectives / Learning Targets become the lesson's learning objectives. Example sections become EXAMPLE blocks, Summary / Key Points become SUMMARY blocks, the rest TEXT.
* **Answer keys, solutions and teacher-only sections are never imported** (a student could read them); the result lists what was left out.
* **Practice sections stay plain text and are flagged** ("3 question-like lines; add them as questions in the studio"). The importer does not create or grade questions.
* **Nothing is invented**: every sentence is the document's own, only split at headings and paragraph breaks.
* Honest limits: pictures are not imported (counted and reported); at most 40 sections (the teacher is told); a section over 6,000 characters is split into numbered parts without losing a paragraph; control characters are removed; "$" gets a warning because pairs of $ display as maths.
* Safety: teacher/admin only; the unit must exist; the same upload checks as other documents (type by content, 25 MB, decompression-bomb check, 30 s timeout); 20 uploads per 10 minutes per teacher; the original file is **not kept**; every import is audited (size and counts, not the file name); the save is all-or-nothing (a failed save removes the half-made lesson). The draft is not published: the usual submit / approve / publish steps still apply.

## Verification
| Check | Result |
|---|---|
| `test-phase45-draft.ts` (real python-docx Word files, text and PDF fixtures) | 30 passed: title, objectives, sections and kinds; answer key left out (Word, text and PDF); every sentence found verbatim in the source; image reported; only-answer-key, scanned, encrypted, empty and garbage files refused with a reason; 45 sections → 40 + warning; 119 paragraphs in one giant section all kept across numbered parts; all-or-nothing save with a failing store |
| `test-phase45-import.ts` over HTTP, in-memory | 33 passed: signed-out and student refused; no/unknown unit 400; draft stored as DRAFT with order, kinds, objectives; **answer-key text in no stored section**; students cannot open it or see it listed; another teacher cannot edit it; same file twice = two lessons; text file with teacher's title; image, 45-section cases; 8 kinds of bad file (key-only, scanned, encrypted, empty, bomb 413, fake .docx 415, disguised PDF 415, .exe 415) create **nothing**; audit rows without file names; upload rate limit |
| same suite on PostgreSQL (`test-phase45-prisma.ts`, real migrations + Term 1 course) | 32 + 10 passed: 25 new lessons all DRAFT with an author and sections, no orphan sections, answer key in no row, audit rows present |
| `test-phase45-browser.mjs` | 11 checks: the page, a scanned PDF refused with the reason, the Word lesson reported (4 sections, answer key left out, practice warning), opened in the studio, answer key nowhere on the page, a student cannot open the draft |
| Mutation check | Reverting the id fix below makes the new "section ids are unique" check fail |

## A defect found on the way
In the demo (in-memory) store, lessons, sections, questions, attempts and similar rows got ids like `blk_<milliseconds>`. Creating several in the same millisecond gave **duplicate ids**, which the browser reported as React "two children with the same key". All 12 id generators now add a random suffix. (PostgreSQL mode uses UUIDs and was never affected.)

## Not done / limits (please read)
* **Questions are not created from the document**, and no AI is used to write lessons: the structure comes from headings. Practice items must be turned into questions in the studio.
* Plain-text and PDF heading detection is a heuristic: a Title-Case heading with no number or lesson word is not recognised; Word documents with Heading styles are reliable.
* Tables are flattened to text, pictures and equations typed as Word equation objects are not imported (equations typed as plain text are).
* The imported document is not attached to the lesson for the tutor. (Uploading it as a lesson resource still works separately.)
* No teacher has tried it on their own real lesson documents; the fixtures are made for the tests.

## Full regression
`tsc`, `build` and every in-memory and PostgreSQL suite (phases 22–45): the first run passed 45 of 46 steps. The one failure, `test:phase41:pg`, was a real consequence of this phase: its browser journey picked the first `<select>` on the New-lesson page, which is now the import card's unit list. I gave the lesson form's unit list an accessible name ("Unit for the new lesson"), made the journey use it, and re-ran it (71 + 24 + 12 passed). The Phase 34 journey and the new Phase 45 journey pass on the final code. I did not re-run the whole regression a second time after that one-line change.
