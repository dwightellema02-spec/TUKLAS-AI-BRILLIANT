# Phase 22 — Document Intelligence + Grounded Learning: Verification Report

Master-plan modules: **15 Document Intelligence**, tutor-context slice of **6 Resource Intelligence** and **12 AI Tutor Engine**.
Preceded by three defect fixes found in the audit.

Legend: ✅ verified · ⚠️ partial · ❌ not implemented · 🧪 automated only · 👤 real-user/live test required · 🚨 defect

## 0. Defects fixed first

| # | Defect | Fix | Evidence |
|---|---|---|---|
| 1 | `LocalTutorEngine` default branch used `guidingQuestion: "..."` (a label, not an assignment) so the guiding question was always empty | Assignment fixed | tutor replies in suite §9 carry a guiding question |
| 2 | Default model `gemini-3.8-flash` could not be confirmed to exist | Default is now `gemini-2.5-flash`; `AI_MODEL` is shape-validated (`resolveGeminiModel`); a rejected model still falls back to the local engine | 👤 not verifiable here: no Gemini key/quota in this environment |
| 3 | `AUTH_SECRET` fell back to a hard-coded string; additionally `dotenv.config()` ran *after* `session.ts` had already read `process.env`, so an `.env` `AUTH_SECRET` was **never used** | Production refuses to start without a unique >=32-char secret (`placeholder_*` and the dev default are rejected); `import "dotenv/config"` is now the first import in `server.ts` | verified by importing the module with `NODE_ENV=production` with and without a secret |

## 1. Pipeline implemented (all real, no mocks)

`UPLOAD -> VALIDATE -> EXTRACT -> CLEAN -> CHUNK -> INDEX -> RETRIEVE -> GROUND` in `src/lib/documents/`:

| Step | File | Notes |
|---|---|---|
| Validate | `validate.ts` | extension + magic bytes must agree; 25MB cap; DOCX zip inspected (entry count, uncompressed size, compression ratio, `word/document.xml` present); filename sanitised |
| Extract | `extract.ts` | PDF via `unpdf` (pdf.js), DOCX via `mammoth` (headings preserved), TXT; 30s timeout; encrypted/corrupt PDFs reported, not guessed |
| Clean | `clean.ts` | control chars, de-hyphenation, running headers/footers removed only from the first/last 2 lines of a page; body text never removed |
| Chunk | `chunk.ts` | heading-aware, ~900 chars, page span + section label; answer-key sections flagged |
| Index/Retrieve | `retrieve.ts` | BM25, math-aware tokens (`-5` stays signed), minimum-score floor (no forced irrelevant sources) |
| Ground | `grounding.ts` | permission check, answer-key exclusion, solved-problem exclusion, honest resource inventory |
| Question drafts | `question-generation.ts` | evidence-quote must be verbatim in the cited chunk; arithmetic re-checked deterministically; DRAFT only |
| Storage | `file-store.ts` | random names, outside any static dir, `0600`; unreadable files' bytes are not retained |

Schema: `LessonResource` gains `extractionStatus/Error`, `pageCount`, `charCount`, `contentHash`; new `ResourceChunk` table (cascade delete). Applied with `prisma db push` (the repo has no migrations directory).

API: `POST /api/lessons/:id/documents` (raw body, auth+ownership checked before the body is buffered), `POST /api/lessons/:id/notes`, `DELETE /api/lessons/:id/resources/:rid` (scoped to the lesson), `GET .../resources/:rid/extraction`, `POST .../resources/:rid/generate-questions`.

Tutor: retrieved excerpts are injected as quoted untrusted data with an inventory of what is readable; the output validator verifies citations against what was retrieved, strips inline `[S1]`, and blocks claims about documents with no supporting source and **all** claims about video content.

## 2. Existing defects fixed because they undermined grounding

* The lesson editor's Save sent the client's resource list and the server **replaced** the lesson's resources with it; this would have wiped every uploaded document. Resources are now changed only through the dedicated endpoints.
* `removeLessonVideo` deleted by resource id without checking the lesson (a teacher could delete another lesson's resource). Removal is now scoped by lesson.
* `GET /api/lessons` and `GET /api/lessons/:id` were unauthenticated and returned DRAFT lessons and every resource. Both now require a session; non-staff only see PUBLISHED lessons; student views omit storage keys, hashes and uploader ids.
* The tutor accepted any client-supplied `lessonId`; it now requires the lesson to be PUBLISHED **and** unlocked for that student before even the title is used.
* The "document upload" form was simulated (typed filename, hard-coded 1.5MB, always `application/pdf`). Replaced with a real file upload.

## 3. Test evidence

| Check | Result |
|---|---|
| `tsc --noEmit` | clean |
| `vite build` | passes |
| `scripts/test-phase22-documents.ts` | **149/149** (real PDF/DOCX fixtures + spawned HTTP server) |
| `scripts/test-phase22-prisma.ts` against PostgreSQL 16 | **12/12** (persistence, cascade, ownership, scoped delete); prints `SKIPPED` without a Postgres URL |
| `scripts/test-phase22-browser.mjs` (headless Chromium) | **11/11** teacher upload UI + student citation UI |
| Regression: phases 9, 10, 12 (21/21), 13 (25/25), 14 (25/25), auth-repair (26/26), workflow | pass |
| Mutation check | disabling the lesson-access check fails 6 tests; disabling the claim guard fails 3 tests |

Fixtures are built by real tools (`scripts/fixtures/phase22/build_fixtures.py`: Chromium print-to-PDF, python-docx, pypdf encryption), including a multi-page PDF, an answer-key section, a scanned/image-only PDF, an encrypted PDF, an empty DOCX, a 150MB-expanding DOCX bomb, a non-Word ZIP and a prompt-injection document.

## 4. Feature status

| Goal | Status |
|---|---|
| Real PDF extraction | ✅🧪 text-based PDFs; scanned PDFs are detected and refused honestly |
| Real DOCX extraction | ✅🧪 |
| Cleaning / chunking | ✅🧪 heuristics; quality depends on the source layout (see limits) |
| Lesson-resource association | ✅ |
| Permission-aware retrieval | ✅🧪 draft, locked and unauthenticated cases covered |
| Tutor retrieval from documents | ✅🧪 with the local extractive engine; ⚠️👤 with Gemini (not exercised) |
| Citations | ✅🧪 chip in the UI, verified against retrieved sources |
| Unsupported-claim protection | ⚠️ deterministic phrase guard (verified); it cannot catch every paraphrase |
| Question generation from material | ⚠️🧪 validation pipeline verified with a stub provider; 👤 never run against a live model |
| Practice generation | ⚠️ drafts land in the question bank as DRAFT; adding them to a practice set is the existing teacher flow |
| Extraction failure handling | ✅🧪 |
| Large documents | ✅🧪 bounded and flagged TRUNCATED |
| File validation / security | ✅🧪 |
| Teacher workflow | ✅ HTTP + real browser (🧪 headless) |
| Student AI workflow | ✅ HTTP + real browser for typed questions |
| OCR for scanned PDFs | ❌ deliberately not implemented; reported as unreadable |
| Video transcripts | ❌ unchanged: the tutor is told it has not watched any video |

## 5. Known limitations and honest caveats

1. **No live LLM was involved.** There is no Gemini key here. Everything about how a real model uses SOURCE MATERIAL, resists prompt injection inside a document, or avoids giving answers is untested. Prompt-injection tests prove containment (quoting, delimiter stripping, output leak filter), not model obedience. 👤
2. The local engine's grounded reply is **extractive**: it quotes the best-matching sentence and asks a reflective question. It is honest but not an intelligent tutor.
3. The tutor's automatic opening message (sent with no student text) is grounded only when a chunk clears the BM25 floor; otherwise the generic concept explanation is used.
4. Retrieval is lexical (BM25). Paraphrased questions with no shared words will miss. Embeddings are a later option.
5. Answer-key detection is heading-based. An answer key with no recognisable heading will be treated as ordinary text. Teachers can inspect flagged chunks at `GET .../extraction`.
6. Tables in PDFs flatten to text; DOCX tables are joined with `|`. Equations typeset as images/OMML may be lost or garbled.
7. Uploaded originals are stored on local disk (`DOCUMENT_STORAGE_DIR`). On hosts with ephemeral disks, extracted chunks survive (database) but originals do not; swap `file-store.ts` for object storage.
8. Extraction runs in the request thread. Ten large PDFs in parallel will block the event loop; a worker/queue is needed for scale. Upload rate limit is in-memory per process.
9. Pre-existing, not fixed: `prisma/seed.ts` is stale (`progressScore` no longer exists in the schema, so seeding fails at step 9); `scripts/test-phase6/7/8*.cjs` fail on the untouched baseline (hard-coded fake tokens); `question` context for the tutor is not checked for publication state; teacher AI settings are global and in-memory; `npm ci` fails with ERESOLVE (use `--legacy-peer-deps`).
10. The Prisma code path was verified only for the new methods, not the whole application on PostgreSQL.

## 6. Manual tests still required 👤

* A teacher uploads real DepEd/LAS PDFs and DOCX files from a real device and inspects `GET .../extraction` for chunk quality and answer-key flags.
* With a real `GEMINI_API_KEY`: ask grounded questions, ask about an unreadable resource, ask for answers that appear in a document, and run `generate-questions` and review the drafts for correctness.
* A prompt-injection document uploaded by a teacher, then a student chat against it, on the live model.
* Deployment check of `DOCUMENT_STORAGE_DIR` persistence and `AUTH_SECRET` enforcement.

## 7. Recommended next phase

The highest-value unfinished module is **Module 12/13 — the tutor's conversational core**. The tutor still builds a single-turn prompt from the last 6 messages with no explicit state: it does not record which hints were given, cannot change strategy after repeated "I don't understand", and has no response planner. Phase 22 gave it real material to talk about; the next phase should make it talk like a tutor (conversation state, strategy switching, misconception handling) and evaluate it against a live model with a scripted multi-turn rubric.

Close second: classroom creation/enrollment routes (Module 18/Part 10-B), which the audit found missing.
