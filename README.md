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
