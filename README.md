# Tuklas AI

> **Interactive, adaptive, problem-based mathematics learning platform.**  
> Aligned with the Department of Education (DepEd) **MATATAG Curriculum**.  
> Initial Scope: **Grade 7 Mathematics (Term 1)**.

---

## 1. Project Purpose

**Tuklas AI** is an intelligent educational platform designed to help students master mathematics through active thinking rather than passive video or text consumption. 

Its core pedagogical workflow is:

$$\text{LEARN} \longrightarrow \text{THINK} \longrightarrow \text{ANSWER} \longrightarrow \text{RECEIVE FEEDBACK} \longrightarrow \text{UNDERSTAND MISTAKE} \longrightarrow \text{PRACTICE} \longrightarrow \text{MASTER} \longrightarrow \text{PROGRESS}$$

The architecture is built completely from scratch with a modular, data-driven design intended to expand horizontally across Grade levels (Grades 7–10), subsequent Terms (1, 2, 3), and cross-disciplinary subjects (English, Science).

---

## 2. Multi-Phase Roadmap Status

- [x] **Phase 1: Project Foundation** — Clean Next.js-style modular App Router layout, brand identity, accessible primitives, and foundation routes.
- [x] **Phase 2: Database + Authentication Foundation** — PostgreSQL & Prisma ORM, bcrypt password hashing, HMAC-SHA256 session tokens, RBAC gates, and full-stack Express server.
- [x] **Phase 3: Curriculum System + Teacher Content Studio** — Curriculum hierarchy explorer, lesson authoring studio, YouTube/Mathisipan resource validation, document storage metadata, modular content blocks, publishing lifecycle, and student lesson reader.
- [x] **Phase 4: Learning Path + Prerequisite System** — Visual learning path progression, curriculum sequencing, skill prerequisite DAG with cycle-detection, lesson access gating, deterministic next-activity recommendation, continue learning engine, and teacher learning-path management.
- [x] **Phase 5: Interactive Lesson Engine** — 10 modular content block types, KaTeX mathematical notation, interactive Number Line Explorer, formative Checkpoint block with attempt tracking, worked Example progressive reveal, YouTube validated player, and student Resume Engine.
- [x] **Phase 6: Question + Practice Engine** — 7 question types, server-side mathematical QuestionValidator, attempt history tracking, retry system, deterministic practice sets, student practice UI with review mode, teacher question bank, and question authoring studio.
- [x] **Phase 7: AI Tutor** — Server-side Socratic AI Tutor, provider abstraction (Google Gemini API & Local Pedagogical Engine), curriculum-aware context builder, prompt injection defense, progressive hint levels, rate limiting, and persistent conversation models.
- [x] **Phase 8: AI Mistake Analyzer** — Real-time mathematical error categorization, misconception detection, attempt evidence linkage, and student diagnostic feedback cards.
- [x] **Phase 9: Adaptive Learning Engine** — Deterministic rule-first next-step guidance, EASY/MEDIUM/HARD difficulty stepping, prerequisite remediation, teacher override audit logs, and secondary AI explanations.
- [x] **Phase 10: Mastery Engine** — 5 controlled mastery levels (`NOT_STARTED`, `LEARNING`, `DEVELOPING`, `PROFICIENT`, `MASTERED`), multi-dimensional evidence (accuracy, recent window, consistency score, application index, difficulty diversity), prerequisite inspection, longitudinal audit trail (`SkillMasteryHistory`), student mastery detail views, and teacher competency matrix.

- [x] **Phase 22: Document Intelligence + Grounded Learning** — Real PDF/DOCX/TXT upload, validation, text extraction, chunking and BM25 retrieval; the AI Tutor is grounded in lesson content, teacher notes and extracted documents with verified citations, answer-key and draft/locked-lesson protection, and honest handling of unreadable files and videos. See [`docs/PHASE_22_VERIFICATION.md`](docs/PHASE_22_VERIFICATION.md) for evidence and limitations.

- [x] **Phase 23: Tutor Conversational Core** — The AI Tutor now reads each student message (intent, hedging, frustration), judges answers deterministically with mistake diagnosis, keeps persisted conversation state, and follows a pedagogical policy (changes approach when the student stays stuck, targets specific misconceptions, fades help, verifies independence with a new problem, hands off to the teacher honestly). Model output is verified against the plan and replaced if it breaks the rules. See [`docs/PHASE_23_VERIFICATION.md`](docs/PHASE_23_VERIFICATION.md).

- [x] **Phase 24: Taglish + More Problem Kinds** — The tutor understands everyday Filipino/Taglish messages (including number words such as "negative lima", "labing-apat") and answers Taglish students with Filipino empathy/feedback. Deterministic judging, mistake diagnosis, worked examples and verify-on-a-new-problem now cover absolute value, opposites, one-step equations, comparisons and true/false, not only two-number arithmetic. The Filipino phrasing is a first version that needs native-speaker review. See [`docs/PHASE_24_VERIFICATION.md`](docs/PHASE_24_VERIFICATION.md).
- [x] **Phase 25: Classroom Foundation + Auth Hardening** — Classes, join codes, enrolment and assignments are stored in PostgreSQL; teachers see only students in their own active classes; students join with a class code. Closed a production backdoor (demo accounts could log in when a database was configured), added login throttling, admin-created teacher accounts, an admin bootstrap command (`npm run admin:create`), and removed invented teacher analytics (no data now shows as "no data"). Learning-path/progress persistence on PostgreSQL is still open. See [`docs/PHASE_25_VERIFICATION.md`](docs/PHASE_25_VERIFICATION.md).
- [x] **Phase 26: Student Progress on PostgreSQL** — The learning path, lesson locking and student progress now read and write PostgreSQL (previously demo memory), with a production-safe curriculum seed (`npm run seed:curriculum`). Fixes a bug that left the first lesson permanently locked for new students and closes student routes that let anyone mark locked or unpublished lessons complete. See [`docs/PHASE_26_VERIFICATION.md`](docs/PHASE_26_VERIFICATION.md).
- [x] **Phase 27: Server-Side Grading** — Checkpoint and question answers are graded on the server from the stored answer key; the key and explanation never reach a student before they answer, and a student's own claim of correctness is ignored. Lessons with an unusable answer key can no longer be published. See [`docs/PHASE_27_VERIFICATION.md`](docs/PHASE_27_VERIFICATION.md).
- [x] **Phase 28: Ownership + Completion Rules** — A teacher can change only the lessons, blocks, videos, questions and practice sets they authored (admins can change anything; the shared question bank stays readable). A lesson can be completed only after every answerable question in it has been answered correctly, enforced on the server, and the browser can no longer forge which questions are done. See [`docs/PHASE_28_VERIFICATION.md`](docs/PHASE_28_VERIFICATION.md).
- [x] **Phase 29: Honest Research Analytics + No Demo Fallbacks** — The teacher research page no longer shows invented results (a fixed 65% → 88% pre/post improvement, made-up mistake counts, a fictional intervention and time series, hard-coded student and class). Every figure is computed from real data, limited to the teacher's own students, and shows "no data" when there is none. In database mode, an empty or failing database no longer silently serves demo data. See [`docs/PHASE_29_VERIFICATION.md`](docs/PHASE_29_VERIFICATION.md).
- [x] **Phase 30: Session Revocation, CSRF Protection, Audit Log** — Sessions are now checked against the account on every request: changing a password, "sign out everywhere", disabling an account, a role change or an administrator's reset takes effect immediately instead of after 7 days. The session cookie is `SameSite=Lax` (was `None`), state-changing cross-site requests are refused, tokens are no longer kept in `localStorage`, security headers are sent, and security-relevant actions are recorded in an audit log. New account page and admin account controls. See [`docs/PHASE_30_VERIFICATION.md`](docs/PHASE_30_VERIFICATION.md).
- [x] **Phase 31: Attack-Surface Sweep + Content-Security-Policy** — Every API route was called signed-out and as a student to find what was exposed. Fixed: question bank, practice sets, skills, AI settings and YouTube search were open to signed-out callers; any teacher could read any student's learning insight; practice-question redaction was a deny-list (now an allow-list); the student question list returned empty objects. Added a production Content-Security-Policy, per-address and per-endpoint rate limits, and removal of database/file-path details from error messages. See [`docs/PHASE_31_VERIFICATION.md`](docs/PHASE_31_VERIFICATION.md).
- [x] **Phase 32: Voice Tutor (Module 14)** — Students can speak to the tutor and have replies read aloud, using the browser's built-in speech engine (only text is sent and stored; no audio). Spoken maths ("negative five plus three", Taglish number words) is converted to digits for the same Socratic evaluator; voice and typing are one conversation with identical rules. Also fixed "fourteen" being read as 4. Verified with a **simulated** speech engine only; real-device microphone testing is still required. See [`docs/PHASE_32_VERIFICATION.md`](docs/PHASE_32_VERIFICATION.md).
- [x] **Phase 33: Assessments (screens + hardening)** — The assessment engine now has teacher screens (build from the question bank, publish, assign to a class, results) and student screens (take a quiz or a timed test, see results). Audit found that any student could open any teacher's assessment, answer keys leaked through choices, pre-tests could be retaken and revealed their answers, and a double-submit race. Fixed: assignment-gated access, once-only pre/post tests with hidden answers, atomic grading, input validation, no silent in-memory fallback in database mode. See [`docs/PHASE_33_VERIFICATION.md`](docs/PHASE_33_VERIFICATION.md).
- [x] **Phase 34: Classroom Readiness** — A browser test now plays a whole classroom through the real screens (teacher on a laptop, student on a phone): class, join code, pre-test, lesson + tutor, practice assignment, post-test, pre/post comparison, results, archive. It found and fixed: no visible Sign In on phones, practice-set assignments that students could not open, adaptive guidance returning 500 on a real database, and demo ids that broke "Practice" outside sandbox mode. Added the pre/post comparison screen, assessment archiving, a teacher quick-start and a pilot checklist. Not yet used by real students; the Docker image could not be built in the build environment. See [`docs/PHASE_34_VERIFICATION.md`](docs/PHASE_34_VERIFICATION.md), [`docs/TEACHER_QUICKSTART.md`](docs/TEACHER_QUICKSTART.md), [`docs/PILOT_CHECKLIST.md`](docs/PILOT_CHECKLIST.md).
- [x] **Phase 35: Tutor Safety (Modules 12/13/21)** — Untrusted text (a student's message, earlier turns, stored answers, teacher documents, file names) can no longer forge the structure of the prompt sent to the model; the model's output is screened for markup, links, tracking images, echoed instructions or secrets, and for the answer in any form (words, full-width digits, negative words). Tested with a scripted hostile model, 60 jailbreak messages (English/Filipino) and hostile LaTeX. A live model has not been tested. See [`docs/PHASE_35_VERIFICATION.md`](docs/PHASE_35_VERIFICATION.md).
- [x] **Phase 36: Teacher Analytics + Evidence-Based Recommendations (Modules 18/19)** — The teacher dashboard now flags students from real evidence with the numbers shown (practice, quizzes, repeated mistakes, tutor flags, inactivity), lists every flagged student (not just the first six), counts quiz and tutor use as activity, and adds a class filter, assessment and lesson performance, whole-group focus suggestions and a note when answers cannot be used because questions have no skill. Found and fixed a bug since Phase 6: practice sessions were scored wrongly on a real database (at most 1 correct answer). Thresholds are unvalidated and nobody has used it in a real class. See [`docs/PHASE_36_VERIFICATION.md`](docs/PHASE_36_VERIFICATION.md).
- [x] **Phase 37: Question Skills** — Questions are now linked to skills deliberately: the editor no longer silently tags the first skill, warns when none is chosen, inherits the lesson's skill, asks before publishing without one; the server refuses unknown skills; the question bank flags and filters questions without a skill. Also fixed: the question editor and practice-set page attached every new item to a demo lesson that does not exist in a real database (so they could not be saved there), and the production curriculum seed linked its lesson to no skills. The seeded curriculum is only one lesson and three skills. See [`docs/PHASE_37_VERIFICATION.md`](docs/PHASE_37_VERIFICATION.md).
- [x] **Phase 38: Grade 7 Term 1 Curriculum** — The production seed now loads real Term 1 (Weeks 1–6) content following the DepEd MATATAG Budget of Work (polygons and angles; percentages, money and rates): 17 skills with prerequisites, 6 lessons with worked examples, diagrams and graded checkpoints, 180 questions and a practice set per lesson. All text is original and every numeric answer is independently recomputed by the tests. Integers moved to Term 2 (migrated in place). Also fixed: the learning path interleaved lessons of different units. Not yet reviewed by a teacher or curriculum specialist; Weeks 7–10 and Terms 2–3 are not loaded. See [`docs/PHASE_38_VERIFICATION.md`](docs/PHASE_38_VERIFICATION.md).
- [x] **Phase 39: Lesson Access** — Lessons are taken in course order, which blocks a class that is ahead or behind. Teachers can now open lessons early for a whole class, for one student, or "through" a chosen lesson, from the class page; students see "Opened by your teacher". Enforced on the server, never alters progress, ends when the student leaves or the class is archived. Also from the debugging pass: a broken Week 2 diagram, the Term 2 unit hidden from teachers, off-topic tutor fallbacks, and learning-path labels were fixed. See [`docs/PHASE_39_VERIFICATION.md`](docs/PHASE_39_VERIFICATION.md).

---

## 3. Phase 7 Architecture: AI Tutor

### 3.1 AI Provider Abstraction
Tuklas AI isolates the application logic from individual AI vendors via `AIProvider`:
```text
Student Browser
      ↓
Tuklas Server (POST /api/ai/tutor)
      ↓
AITutorService
      ↓
AIProvider Interface (generateTutorResponse)
      ├─► GeminiAIProvider (via @google/genai, default model: gemini-3.8-flash)
      └─► LocalTutorEngine (Offline DepEd MATATAG Rule Engine)
```
- **Server-Side AI Only:** API keys (`GEMINI_API_KEY`, `AI_API_KEY`) are kept on the server and never exposed in `NEXT_PUBLIC_*` or client bundles.
- **Switching Providers:** Set `AI_PROVIDER="gemini"` or `AI_PROVIDER="local"` in environment variables. If no API key is configured or external APIs are unreachable, the system automatically falls back to the `LocalTutorEngine` without disrupting student learning.

### 3.2 Pedagogical Context Builder
The server dynamically constructs an educational context (`buildAITutorContext`) containing only necessary pedagogical metadata:
- **Curriculum Context:** Subject (Mathematics), Grade 7, Term 1, Unit, Lesson, and Target Skill.
- **Question Context:** Problem prompt, question type, difficulty, choices, and internal solution guidance.
- **Attempt History:** Previous student answers, correctness, and attempt counts.
- **Recent Conversation:** Sliding window of the last 6 messages to prevent token bloat and maintain relevance.
- **Privacy Enforcement:** Authentication tokens, passwords, and sensitive personal information are excluded.

### 3.3 Progressive Socratic Support Hierarchy
The tutor acts as a guide rather than an answer machine:
1. **`LEVEL_1_HINT`**: Gentle conceptual nudge or key question (e.g. number line location).
2. **`LEVEL_2_HINT`**: Stronger clue pointing to mathematical properties or operational rules.
3. **`GUIDING_QUESTION`**: Socratic prompt requiring the student to reflect on their next logical step.
4. **`CONCEPT_EXPLANATION`**: Concise refresher of the underlying mathematical principle.
5. **`WORKED_EXAMPLE`**: Step-by-step walk-through of an analogous problem with different numbers.
6. **`FULL_EXPLANATION`**: Complete explanation reserved for post-practice review or repeated attempts.

### 3.4 Safety & Guardrails
- **Academic Integrity:** When students request direct answers ("Just give me the answer"), the tutor redirects them (`responseType: "REDIRECT"`) to solve the first step together.
- **Scope Boundary:** Off-topic, personal, or entertainment queries are redirected to the current mathematics lesson.
- **Prompt Injection Defense:** Model outputs are sanitized against system prompt leaks, internal database secrets, and credentials.
- **Rate Limiting:** Sliding-window rate limiting (20 requests/minute per student) returns HTTP 429 when exceeded.
- **Hint Usage Tracking:** When students consult the tutor, `hintUsed = true` is flagged on `QuestionAttempt` for research analytics.

---

## 4. Phase 6 Architecture: Question + Practice Engine

### 3.1 Question Architecture & Curriculum Linkage
Tuklas manages practice questions connected directly to curriculum competencies and skills:
```text
Subject (Mathematics)
    ↓
Grade (Grade 7)
    ↓
Term (Term 1)
    ↓
Unit (Numbers and Algebraic Expressions)
    ↓
Lesson (Understanding Integers)
    ↓
Skill (Identify integers / Compare integers)
    ↓
Question (Reusable Question Bank)
    ↓
Practice Set (Assembled practice activity)
    ↓
Practice Session (Student attempt sequence)
    ↓
QuestionAttempt (Persistent history & analytics)
```

### 3.2 Supported Question Types
1. **`MULTIPLE_CHOICE`**: Single-select options rendered with clean option badges, shuffled choices, and safe server answer redaction.
2. **`NUMERIC_INPUT`**: Numerical answers with decimal/integer support and configurable precision tolerance ($\pm \epsilon$).
3. **`TEXT_INPUT`**: Text responses with space normalization, case-insensitive or case-sensitive matching, and acceptable synonym lists.
4. **`TRUE_FALSE`**: Binary truth evaluation with accessible toggles.
5. **`EQUATION`**: Algebraic expressions and linear equations supporting symmetric forms ($x = 7$ or $7 = x$) and root values.
6. **`MATCHING`**: Key-value concept pairing (e.g. matching integers to additive inverses) with shuffled options.
7. **`ORDERING`**: Sequential arrangement (e.g. arranging $-5, -2, 0, 3$ least to greatest) with accessible move controls.
*(Future types designed into the schema: `DRAG_DROP`, `GRAPH`, `GEOMETRY`, `INTERACTIVE_DIAGRAM`, `FILL_BLANK`, `MULTI_SELECT`, `FRACTION_INPUT`, `TABLE_INPUT`).*

### 3.3 Server-Side Question Validation (`QuestionValidator`)
All answer checks occur on the server via `src/lib/question-validator.ts`:
- **Zero Client Trust:** Correct answers and explanations are stripped (`redactQuestionForStudent`) before sending questions to students.
- **Strict & Tolerant Modes:** Numeric answers evaluate numerical magnitude without string discrepancies; text inputs normalize whitespace.
- **Immediate Formative Feedback:** Returns `isCorrect`, custom teacher-configured feedback, and reveals step-by-step worked explanations upon completion.

### 3.4 Practice Session & Attempt Tracking
- **Deterministic Practice Sets:** Practice sets preserve question sequences in `PracticeSetQuestion` and `PracticeSessionQuestion`.
- **Non-destructive Retries:** When retrying questions, every attempt is saved in `QuestionAttempt` with `attemptNumber`, time taken, and timestamp.
- **Session Results & Review:** Calculates real-time score ($\frac{\text{correct}}{\text{total}} \times 100$) and allows students to review answers, their inputs, and correct answer explanations.
- **Student Practice History:** Accessible at `/student/practice-history` for student portfolio review.

### 3.5 Teacher Workflow & Authoring
- **Question Bank (`/teacher/question-bank`):** Full table/card explorer with search and filters by Type, Difficulty, Skill, and Status.
- **Question Editor (`/teacher/questions/new` & `/teacher/questions/:id/edit`):** Authoring studio with live KaTeX preview, difficulty tagging, and type-specific answer builders.
- **Live Preview (`/teacher/questions/:id/preview`):** Interactive student-simulation tool allowing teachers to test question submissions before publishing.
- **Practice Sets Manager (`/teacher/practice-sets`):** Allows teachers to assemble sets of questions and link them to curriculum lessons.

### 3.6 Future AI Compatibility
The Phase 6 Question Bank and Validation Engine are architected so that future AI-generated questions plug in seamlessly:
$$\text{AI Generator} \longrightarrow \text{Question Schema} \longrightarrow \text{Automated Validation} \longrightarrow \text{Teacher Review (Status: REVIEW)} \longrightarrow \text{Approved} \longrightarrow \text{Published Practice}$$
No changes to student practice or validation infrastructure will be required when AI generation is introduced in subsequent phases.

---

## 3. Phase 5 Architecture: Interactive Lesson Engine

### 3.1 Structured Interactive Learning Journey
A Tuklas lesson is not a passive document or raw video player. It organizes pedagogical components into a sequenced, interactive learning session:
```text
Lesson
  ↓
1. Introduction (Concept context & motivation)
  ↓
2. Explanation (LaTeX math & formal definition)
  ↓
3. Curated Resource (Mathisipan YouTube embed)
  ↓
4. Worked Example (Progressive steps & hidden answer)
  ↓
5. Checkpoint (Formative question pausing progression)
  ↓
6. Interactive Explorer (Number line conceptual model)
  ↓
7. Question (Problem-solving item with hint & feedback)
  ↓
8. Hint (Scaffolded tip or mnemonic reminder)
  ↓
9. Practice (Targeted competency exercise launcher)
  ↓
10. Summary (Key principles & takeaway rules)
```

### 3.2 Content Block Types
Tuklas supports 10 distinct educational block types, each rendered via an isolated, accessible component:
1. **`TEXT`** — Educational typography supporting KaTeX math notation ($x \in \mathbb{Z}$), Markdown-style lists, and bold callouts.
2. **`IMAGE`** — Accessible diagrams with descriptive alt text and optional educational captions.
3. **`VIDEO`** — Privacy-enhanced, official YouTube embed with ID validation (`oxkHZZpP2oQ`).
4. **`EXAMPLE`** — Worked problems dividing content into *Problem*, *Step-by-step breakdown*, and *Answer* with optional progressive reveal.
5. **`QUESTION`** — Active problem items featuring options, interactive attempt feedback, and collapsible hints.
6. **`CHECKPOINT`** — Formative checkpoints that pause the student flow and record attempts in the database.
7. **`INTERACTIVE`** — Conceptual manipulation models (e.g. Integer Number Line Explorer with single-value and compare-values modes).
8. **`HINT`** — Expandable scaffolded tips designed to provide strategic assistance without giving away answers.
9. **`PRACTICE`** — Formative practice launchpad linking directly to MATATAG learning competencies.
10. **`SUMMARY`** — Visual recap cards summarizing essential takeaways and operational rules.

### 3.3 Resume Engine & Student Sessions
* **`LessonSession` Model:** Tracks each student's current active section (`currentSectionIndex`), list of completed block IDs (`completedBlockIds`), start timestamp, and last activity.
* **Seamless Resumption:** Returning students are automatically restored to their exact section and saved state.
* **`CheckpointAttempt` Logging:** Records student attempts, answer choice, correctness boolean, and explanatory feedback for audit and mastery preparation.
* **Dual View Modes:** Students can toggle between **Guided Step Mode** (focused, one section at a time with Prev/Next buttons) and **Continuous Scroll Mode** (all sections displayed with sticky outline navigation).

### 3.4 Teacher Studio Content Block Management
* **Dynamic Block Reordering:** Teachers can drag, move up/down, or update the sequence order of blocks with immediate backend synchronization.
* **Multi-Type Block Creation:** Teachers can append any of the 10 block types with auto-populated template schemas.
* **Draft/Review/Approved/Published State Machine:** Ensures student safety by only serving published lessons.

---

## 3. Phase 4 Architecture: Learning Path & Prerequisite System

### 3.1 Learning Path Progression
Students traverse an organized learning journey instead of browsing an unconstrained list of lessons:
```text
Curriculum
    ↓
Learning Path
    ↓
Unit
    ↓
Lesson (Sequence Order)
    ↓
Skill (Prerequisite DAG)
    ↓
Learning & Checkpoints
    ↓
Completed (100%)
    ↓
Next Lesson Unlocked
```

### 3.2 Visual States
Lessons on the student learning path convey status using clear accessible iconography and badges (not relying on color alone):
1. **`COMPLETED`** — Student completed all lesson content blocks (100% progress).
2. **`IN_PROGRESS`** — Student opened the lesson and began working through sections.
3. **`AVAILABLE`** — Prerequisites are satisfied; lesson is ready to start.
4. **`LOCKED`** — Required previous lessons or prerequisite skills have not yet been satisfied. Clicking displays a modal with exact missing requirements.

### 3.3 Prerequisite System & Cycle Detection
* **Directed Acyclic Graph (DAG):** Each skill can require one or more predecessor skills (e.g. *Identify Integers* $\to$ *Compare Integers* $\to$ *Add Integers* $\to$ *Subtract Integers*).
* **Cycle Detection Validation:** When a teacher/admin updates skill prerequisites via `POST /api/skills/:skillId/prerequisites`, a depth-first search graph traversal validates against circular loops ($A \to B \to A$) and returns HTTP 400 error if a cycle is detected.
* **Server-Side Access Gating:** `GET /api/student/lessons/:id/access` enforces that only published, unlocked lessons can be opened. Unauthorized attempts to open locked lessons are blocked.

### 3.4 Student Experience Features
* **`/student` (Enhanced Dashboard):**
  * **Welcome Section:** Greets the student with grade-level context.
  * **Continue Learning:** High-priority card with the most recent in-progress lesson, progress bar, and instant action button.
  * **Current Unit Progress:** Calculated dynamically from database progress records (`completedLessons / totalLessons`).
  * **Next In Path:** Deterministic curriculum-based recommendation.
  * **Interactive Map Preview:** Quick access to the unit's lesson progression.
* **`/student/learning-path` (Full Roadmap):**
  * Visual timeline with status icons along a continuous progression spine.
  * Unit and Term progress percentages.
  * Recommended Next Activity banner.
  * Interactive modal detailing prerequisite requirements for locked lessons.
* **`/student/lessons/[id]` (Progress-Enabled Reader):**
  * Access check gates locked content.
  * Opening an accessible lesson automatically triggers `NOT_STARTED` $\to$ `LEARNING`.
  * Section-by-section understanding checkpoints ("Read", "Reviewed", "I Understand").
  * Progress percentage bar at the top.
  * "Complete Lesson Activities" marks the lesson `COMPLETED` and unlocks the next sequence node.

### 3.5 Teacher Management Features
* **`/teacher/curriculum/[unitId]` (Learning Path & Prerequisite Manager):**
  * **Lesson Sequence Reordering:** Move lessons up/down with instant database sequence order updates (`POST /api/units/:unitId/reorder-lessons`).
  * **Prerequisite DAG Configuration:** Select any skill, view its current prerequisites, toggle checkmarks of candidate skills, and save with cycle detection.
  * **Publishing Status Overview:** Displays DRAFT, REVIEW, APPROVED, and PUBLISHED badges for each lesson.

---

## 4. Pre-Seeded Test Credentials

| Role | Email | Password | Allowed Access Areas |
| :--- | :--- | :--- | :--- |
| **Student** | `student@tuklas.ai` | `Tuklas2026!` | `/`, `/student`, `/student/learning-path`, `/student/lessons/:id` |
| **Teacher** | `teacher@tuklas.ai` | `Tuklas2026!` | `/`, `/student`, `/teacher`, `/teacher/curriculum/*`, `/teacher/lessons/*` |
| **Admin** | `admin@tuklas.ai` | `Tuklas2026!` | Full platform access |

---

## 5. Development & Verification

```bash
# Run Full-Stack Development Server (Express + Vite)
npm run dev

# Run TypeScript Linting & Strict Type Checks
npm run lint

# Build for Production
npm run build
```

---

## 6. Next Phase

```text
NEXT:
PHASE 5 — Interactive Lesson Engine
```
