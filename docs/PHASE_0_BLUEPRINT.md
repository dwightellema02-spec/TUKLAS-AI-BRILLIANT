# TUKLAS AI — MASTER BLUEPRINT (PHASE 0)
**Document Version:** 1.0.0  
**Status:** Approved for Review  
**Date:** September 2026  
**Lead Architect:** Principal Software Architect

---

## 1. SPECIFICATION ANALYSIS

### 1.1 Project Objective
**Tuklas AI** is an intelligent, active-learning educational platform purpose-built for Mathematics education, starting with **Grade 7 MATATAG Curriculum (Term 1)**, designed with complete modularity to expand horizontally (Grades 8–10, Terms 2–3) and cross-disciplinarily (English, Science, etc.).

### 1.2 Core Pedagogy
The core pedagogical pipeline moves away from passive reading and lecture consumption into an active cognitive loop:
$$\text{LEARN} \longrightarrow \text{THINK} \longrightarrow \text{ANSWER} \longrightarrow \text{RECEIVE FEEDBACK} \longrightarrow \text{UNDERSTAND MISTAKE} \longrightarrow \text{PRACTICE} \longrightarrow \text{MASTER} \longrightarrow \text{PROGRESS}$$

### 1.3 Key Architectural Constraints
1. **Originality & Independence:** No proprietary vendor assets, scraped content, or reverse-engineered UI. All content, interactive widgets, hints, and mistake models are original.
2. **Data-Driven Curriculum:** Zero hardcoding of curriculum trees inside UI components. Grade levels, competencies, skills, and prerequisite dependency graphs are dynamic database entities.
3. **Pluggable Question & Lesson Engine:** Lesson sections and question types operate through polymorphic registries. New types (e.g. GeoGebra-style interactive geometry, drag-and-drop algebra tiles) must integrate without modifying core orchestrators.
4. **Server-Side AI Abstraction:** AI tutor endpoints must reside strictly on the server layer. Student context (active skill, recent attempts, known misconceptions) is injected systematically into strict, reproducible Socratic prompts.
5. **Research-Grade Analytics:** Dual-purpose tracking for classroom teacher insight and empirical educational research (pre/post-testing, normalized learning gain $g$, mistake frequency distributions) with clean PII decoupling.

---

## 2. PROPOSED SYSTEM ARCHITECTURE

```
+---------------------------------------------------------------------------------+
|                                 CLIENT LAYER                                    |
|  +---------------------------------------------------------------------------+  |
|  | Modern Web Application (Next.js / React 19 + TypeScript + Tailwind CSS)  |  |
|  |                                                                           |  |
|  |  +---------------------+  +---------------------+  +-------------------+  |  |
|  |  |  Student Experience |  |  Teacher Dashboard  |  | Research/Admin    |  |  |
|  |  |  - Interactive Read |  |  - Class Management |  | - Data Export     |  |  |
|  |  |  - Practice Runner  |  |  - Mastery Heatmaps |  | - Intervention Log|  |  |
|  |  |  - Socratic Tutor   |  |  - Curricular Alloc |  | - Anonymized Sets |  |  |
|  |  +---------------------+  +---------------------+  +-------------------+  |  |
|  |                                                                           |  |
|  |  +---------------------------------------------------------------------+  |  |
|  |  | UI Component System (Accessible Primitives, KaTeX, Lucide, Motion)   |  |  |
|  |  +---------------------------------------------------------------------+  |  |
|  +---------------------------------------------------------------------------+  |
+---------------------------------------+-----------------------------------------+
                                        | HTTPS / Secure JSON REST & SSE
                                        v
+---------------------------------------------------------------------------------+
|                                 SERVER LAYER                                    |
|  +---------------------------------------------------------------------------+  |
|  | Next.js Route Handlers / Express Application Server                       |  |
|  |                                                                           |  |
|  |  +---------------------------------------------------------------------+  |  |
|  |  | Authentication & RBAC Middleware (Session verification, Role check) |  |  |
|  |  +---------------------------------------------------------------------+  |  |
|  |                                                                           |  |
|  |  +------------------+  +-------------------+  +------------------------+  |  |
|  |  | Lesson Engine    |  | Practice Engine   |  | Adaptive Progression   |  |  |
|  |  | - Section loader |  | - Answer checker  |  | - Bayesian / Heuristic |  |  |
|  |  | - Checkpoint sync|  | - Attempt logger  |  | - Prerequisite router  |  |  |
|  |  +------------------+  +-------------------+  +------------------------+  |  |
|  |                                                                           |  |
|  |  +------------------+  +-------------------+  +------------------------+  |  |
|  |  | Mistake Analyzer |  | Mastery Engine    |  | Research Analytics     |  |  |
|  |  | - Misconception  |  | - 4-Dimension     |  | - De-identification    |  |  |
|  |  |   classifier     |  |   scoring model   |  | - Pre/Post test engine |  |  |
|  |  +------------------+  +-------------------+  +------------------------+  |  |
|  |                                                                           |  |
|  |  +---------------------------------------------------------------------+  |  |
|  |  | AI Socratic Service Abstraction (Google GenAI / LLM Interface)       |  |  |
|  |  | - System Prompts  - Socratic Escalator  - Output JSON Schemas       |  |  |
|  |  +---------------------------------------------------------------------+  |  |
|  +---------------------------------------------------------------------------+  |
+----------------------+----------------------------------+-----------------------+
                       |                                  |
                       v                                  v
+--------------------------------------+  +---------------------------------------+
|           PERSISTENCE LAYER          |  |         EXTERNAL SERVICES             |
|  +--------------------------------+  |  |  +---------------------------------+  |
|  | Relational Database (PostgreSQL)|  |  |  | Gemini 2.5/Flash AI Engine      |  |
|  | Managed via Prisma ORM         |  |  |  | - Contextual Socratic Prompts   |  |
|  | - Curriculum & Graph DAG       |  |  |  +---------------------------------+  |
|  | - Student State & Attempts     |  |  |  +---------------------------------+  |
|  | - Mastery & Research Logs      |  |  |  | YouTube API (Mathisipan video)  |  |
|  +--------------------------------+  |  |  +---------------------------------+  |
+--------------------------------------+  +---------------------------------------+
```

---

## 3. PROPOSED FOLDER STRUCTURE

```
tuklas-ai/
├── README.md
├── package.json
├── tsconfig.json
├── .env.example
├── prisma/
│   ├── schema.prisma                  # Master database definition
│   └── seeds/
│       ├── curriculum_g7_t1.ts        # MATATAG Grade 7 Term 1 initial data
│       └── index.ts                   # Master seed runner
├── src/
│   ├── app/                           # Next.js App Router or Page views
│   │   ├── (auth)/
│   │   │   ├── login/
│   │   │   └── register/
│   │   ├── (dashboard)/
│   │   │   ├── student/
│   │   │   │   ├── path/             # Visual learning path
│   │   │   │   ├── lessons/[id]/      # Interactive lesson runner
│   │   │   │   ├── practice/[skillId]/# Adaptive practice session
│   │   │   │   └── mastery/           # Mastery & skill matrix
│   │   │   ├── teacher/
│   │   │   │   ├── classes/           # Class & student roster
│   │   │   │   ├── analytics/         # Common mistakes & competencies
│   │   │   │   └── curriculum/        # Mathisipan / video attachment
│   │   │   └── research/
│   │   │       ├── experiments/       # Pre/post-test cohorts
│   │   │       └── exports/           # Anonymized data exports (CSV/JSON)
│   │   └── api/                       # API Route Handlers
│   │       ├── auth/[...route]/
│   │       ├── curriculum/
│   │       ├── lessons/
│   │       ├── practice/
│   │       ├── ai/
│   │       │   ├── tutor-hint/
│   │       │   └── analyze-mistake/
│   │       ├── mastery/
│   │       └── research/
│   ├── components/
│   │   ├── common/                    # Accessible UI primitives (Button, Card, Modal, Input, Badge)
│   │   ├── math/                      # KaTeX math formula display & editor
│   │   ├── layout/                    # Navbars, Sidebars, App Shells by Role
│   │   ├── curriculum/                # Tree browser, Skill nodes, Prerequisite lines
│   │   ├── lessons/                   # Polymorphic Section Renderers
│   │   │   ├── LessonRunner.tsx
│   │   │   ├── TextSection.tsx
│   │   │   ├── ExampleSection.tsx
│   │   │   ├── InteractiveSection.tsx
│   │   │   ├── CheckpointSection.tsx
│   │   │   └── SummarySection.tsx
│   │   ├── questions/                 # Polymorphic Question Renderers
│   │   │   ├── QuestionDispatcher.tsx
│   │   │   ├── MultipleChoice.tsx
│   │   │   ├── NumericInput.tsx
│   │   │   ├── TextInput.tsx
│   │   │   ├── TrueFalse.tsx
│   │   │   ├── EquationInput.tsx
│   │   │   ├── MatchingQuestion.tsx
│   │   │   └── OrderingQuestion.tsx
│   │   ├── practice/                  # Active Practice Orchestration
│   │   │   ├── PracticeSession.tsx
│   │   │   ├── FeedbackBanner.tsx
│   │   │   ├── SocraticChat.tsx
│   │   │   └── ProgressBar.tsx
│   │   └── dashboard/                 # Analytics & Visualizations
│   │       ├── StudentProgressCard.tsx
│   │       ├── SkillRadarChart.tsx
│   │       └── MistakeHeatmap.tsx
│   ├── lib/                           # Core Business Engines & Services
│   │   ├── ai/
│   │   │   ├── ai-provider.ts         # Server-side provider interface
│   │   │   ├── gemini-client.ts       # @google/genai implementation
│   │   │   ├── prompts/
│   │   │   │   ├── socratic-tutor.ts  # Tiered guiding prompt templates
│   │   │   │   └── mistake-parser.ts  # Misconception categorization
│   │   │   └── types.ts
│   │   ├── adaptive/
│   │   │   ├── engine.ts              # Next-action & difficulty decider
│   │   │   ├── prerequisite-graph.ts  # Topological DAG traversal & fallback
│   │   │   └── difficulty-scaler.ts
│   │   ├── mastery/
│   │   │   ├── mastery-calculator.ts  # 4-dimension scoring algorithm
│   │   │   └── thresholds.ts          # Configurable cutoffs
│   │   ├── practice/
│   │   │   ├── answer-validator.ts    # Exact, numeric-range, algebraic equiv
│   │   │   └── question-selector.ts   # Targeted item selection
│   │   ├── curriculum/
│   │   │   └── matatag-g7-loader.ts
│   │   ├── db/
│   │   │   └── prisma.ts              # Global Prisma client singleton
│   │   └── auth/
│   │       ├── session.ts             # Auth session helpers
│   │       └── rbac.ts                # Permission gates
│   └── types/                         # Shared Domain Interfaces
│       ├── curriculum.ts
│       ├── lesson.ts
│       ├── question.ts
│       ├── attempt.ts
│       ├── mastery.ts
│       ├── user.ts
│       └── research.ts
```

---

## 4. DATABASE ENTITY RELATIONSHIP (ER) PLAN

### 4.1 Entities & Relational Graph

```
[Subject] 1---* [Grade] 1---* [Term] 1---* [Unit] 1---* [Competency] 1---* [Skill]
                                                                             |
               +-------------------------------------------------------------+
               | 1
               *
          [SkillPrerequisite] (Self-referential DAG: skillId, prerequisiteSkillId)
               |
               | 1
               *
          [Question] 1---* [QuestionOption]
               | 1
               *
          [Attempt] *---1 [User (Student)]
               | 1
               *
          [MistakeLog]

[Unit] 1---* [Lesson] 1---* [LessonSection]
                | 1
                *
          [LessonProgress] *---1 [User (Student)]

[User (Student)] 1---* [StudentMastery] *---1 [Skill]
[User (Teacher)] 1---* [Classroom] 1---* [ClassEnrollment] *---1 [User (Student)]
[Classroom] 1---* [LessonAssignment] *---1 [Lesson]
[ResearchCohort] 1---* [ResearchSession] 1---* [Attempt]
```

### 4.2 Data Schema Specifications

#### A. Identity & Access Management
* **`User`**: `id` (UUID), `email` (Unique), `hashedPassword` (nullable if OAuth), `name`, `role` (`STUDENT` | `TEACHER` | `ADMIN` | `RESEARCHER`), `gradeLevel` (nullable), `createdAt`, `updatedAt`.
* **`Classroom`**: `id` (UUID), `name`, `code` (Unique invite key), `teacherId` (FK -> User.id), `grade`, `subject`, `createdAt`.
* **`ClassEnrollment`**: `id`, `classroomId` (FK), `studentId` (FK -> User.id), `enrolledAt`.

#### B. Curriculum Hierarchy & Prerequisite DAG
* **`Subject`**: `id`, `code` (`MATH`), `name` ("Mathematics"), `description`.
* **`Grade`**: `id`, `subjectId` (FK), `level` (7), `name` ("Grade 7").
* **`Term`**: `id`, `gradeId` (FK), `termNumber` (1), `name` ("Term 1").
* **`Unit`**: `id`, `termId` (FK), `sequenceOrder` (Int), `title` ("Numbers and Number Sense"), `description`.
* **`Competency`**: `id`, `unitId` (FK), `code` ("M7NS-Ia-1"), `statement` ("Describes and illustrates the sets of integers and integers on a number line"), `sequenceOrder`.
* **`Skill`**: `id`, `competencyId` (FK), `code` ("G7-MATH-T1-SKILL-01"), `title` ("Multiplying Integers"), `description`, `difficultyBase` (Float 1.0–5.0), `learningObjectives` (JSON), `createdAt`.
* **`SkillPrerequisite`**: `id`, `skillId` (FK -> Skill.id), `prerequisiteSkillId` (FK -> Skill.id), `isStrict` (Boolean: whether progress is gated).

#### C. Interactive Lesson Engine
* **`Lesson`**: `id`, `unitId` (FK), `skillId` (FK, nullable), `title` ("Multiplication of Integers: Sign Rules"), `summary`, `estimatedMinutes` (Int), `status` (`DRAFT` | `PUBLISHED`), `videoUrl` (nullable YouTube Mathisipan link), `createdAt`.
* **`LessonSection`**: `id`, `lessonId` (FK), `sequenceOrder` (Int), `sectionType` (`TEXT` | `IMAGE` | `VIDEO` | `EXAMPLE` | `QUESTION` | `INTERACTIVE` | `HINT` | `CHECKPOINT` | `PRACTICE` | `SUMMARY`), `contentPayload` (JSON structured data), `checkpointQuestionId` (FK -> Question.id, nullable).
* **`LessonProgress`**: `id`, `studentId` (FK -> User.id), `lessonId` (FK), `currentSectionIndex` (Int), `isCompleted` (Boolean), `completedAt`, `updatedAt`.

#### D. Question & Practice System
* **`Question`**: `id`, `skillId` (FK), `type` (`MULTIPLE_CHOICE` | `NUMERIC_INPUT` | `TEXT_INPUT` | `TRUE_FALSE` | `EQUATION` | `MATCHING` | `ORDERING`), `difficulty` (1.0–5.0), `promptLatex` (Text with KaTeX markdown), `explanationLatex` (Text), `rubricPayload` (JSON containing exact match, tolerance, or equivalence rules), `createdAt`.
* **`QuestionOption`**: `id`, `questionId` (FK), `contentLatex` (Text), `isCorrect` (Boolean), `feedbackLatex` (Specific distractor explanation).
* **`Attempt`**: `id`, `studentId` (FK -> User.id), `questionId` (FK), `skillId` (FK), `studentResponse` (JSON), `isCorrect` (Boolean), `attemptNumber` (Int for repeat tries), `difficultyScore` (Float), `durationSeconds` (Int), `hintsRequestedCount` (Int), `createdAt`.

#### E. Mistake Analysis & Diagnostics
* **`MistakeLog`**: `id`, `attemptId` (FK -> Attempt.id), `studentId` (FK), `questionId` (FK), `category` (`CARELESS_CALCULATION` | `REPEATED_MISCONCEPTION` | `MISSING_PREREQUISITE` | `CONCEPTUAL_MISUNDERSTANDING` | `APPLICATION_DIFFICULTY`), `confidenceScore` (Float 0.0–1.0), `detectedPattern` (Text e.g. "Negative times negative yields negative"), `remediationSkillId` (FK -> Skill.id, nullable), `reviewedByTeacher` (Boolean), `createdAt`.

#### F. Mastery & Adaptive Tracking
* **`StudentMastery`**: `id`, `studentId` (FK), `skillId` (FK), `state` (`NOT_STARTED` | `LEARNING` | `DEVELOPING` | `PROFICIENT` | `MASTERED`), `understandingScore` (0.0–1.0), `accuracyScore` (0.0–1.0), `applicationScore` (0.0–1.0), `consistencyScore` (0.0–1.0), `compositeScore` (0.0–1.0), `lastEvaluatedAt`, `historyLog` (JSON).

#### G. Educational Research & Interventions
* **`ResearchCohort`**: `id`, `name` ("Grade 7 Matatag Cohort A"), `protocolType` ("PRE_POST_INTERVENTION"), `isActive` (Boolean).
* **`ResearchSession`**: `id`, `cohortId` (FK), `studentId` (FK), `sessionType` (`PRE_TEST` | `INTERVENTION_LESSON` | `PRACTICE` | `POST_TEST`), `metricsPayload` (JSON), `anonymizedSubjectHash` (SHA-256 string for blinded research).

---

## 5. API ARCHITECTURE PLAN

All client-server interactions adhere to strict, typed REST endpoints with Server-Sent Events (SSE) for streaming AI hints.

### 5.1 Public & Authentication
* `POST /api/auth/register` — Create student or teacher account.
* `POST /api/auth/login` — Authenticate and issue secure session cookie.
* `POST /api/auth/logout` — Terminate session.
* `GET /api/auth/me` — Return authenticated identity and role permissions.

### 5.2 Curriculum & Learning Paths
* `GET /api/curriculum/tree?subject=MATH&grade=7&term=1` — Returns hierarchical curriculum with nested units, competencies, and skills.
* `GET /api/curriculum/skills/:skillId` — Skill metadata, objectives, and prerequisite dependencies.
* `GET /api/learning-path/current` — Returns the current student's personalized next steps based on mastery graph.

### 5.3 Interactive Lessons
* `GET /api/lessons/:lessonId` — Fetch lesson sections, interactive widgets, and metadata.
* `POST /api/lessons/:lessonId/progress` — Save section checkpoint (`{ sectionIndex, checkpointAnswer }`).
* `POST /api/lessons/:lessonId/complete` — Mark lesson finished, triggering mastery evaluation.

### 5.4 Practice Engine & Attempt Tracking
* `GET /api/practice/next-question?skillId=:id` — Selects adaptive item according to student's current skill mastery and difficulty.
* `POST /api/practice/submit-attempt` — Validates answer, records `Attempt`, calculates instant correctness, triggers mistake analysis.
  * *Request Body:* `{ questionId, studentResponse, durationSeconds, hintsRequestedCount }`
  * *Response:* `{ isCorrect, explanation, rubricFeedback, mistakeClassification?, nextAction }`

### 5.5 AI Socratic Tutor & Mistake Analyzer
* `POST /api/ai/socratic-hint` — Request tiered guidance.
  * *Request Body:* `{ questionId, studentAnswer, tier: 1 | 2 | 3 | 4 | 5, attemptHistory }`
  * *Response:* Streams or returns `{ guidanceText, tier, followUpQuestion? }` without spoiling direct answer.
* `POST /api/ai/analyze-mistake` — Server-side background worker to classify wrong answer misconception.

### 5.6 Teacher Analytics & Class Management
* `GET /api/teacher/classes` — Teacher's classes and roster.
* `GET /api/teacher/classes/:classId/mastery-grid` — Student $\times$ Skill competency matrix with heatmaps.
* `GET /api/teacher/classes/:classId/mistake-patterns` — Top misconceptions aggregated across class.
* `POST /api/teacher/lessons/:lessonId/attach-resource` — Attach verified YouTube Mathisipan video and trigger practice generator.

### 5.7 Research Analytics & Data Export
* `GET /api/research/cohorts` — List active research studies.
* `GET /api/research/export/csv?cohortId=:id` — De-identified CSV download containing Normalized Gain ($g$), pre-test scores, post-test scores, time on task, and error taxonomy.

---

## 6. AI ARCHITECTURE & SOCRATIC TUTORING PLAN

```
+---------------------------------------------------------------------------------+
|                       CLIENT: PRACTICE / LESSON RUNNER                         |
|  - Student clicks "I need a hint" or submits incorrect answer                  |
+---------------------------------------+-----------------------------------------+
                                        | POST /api/ai/socratic-hint
                                        v
+---------------------------------------------------------------------------------+
|                     SERVER: AI ORCHESTRATION LAYER                              |
|  1. Authenticate & Authorize Request                                            |
|  2. Load Context:                                                               |
|     - Question prompt, correct answer, worked solution                          |
|     - Student's recent answers and timestamped attempts                         |
|     - Detected mistake category (e.g. Sign Error in Integers)                   |
|     - Requested Help Tier (1 -> 5)                                              |
|  3. Assemble Socratic System Prompt (Inject strict rules: NEVER GIVE DIRECT     |
|     ANSWER on tiers 1-3, enforce Socratic question prompt, output JSON)         |
|  4. Call AI Provider Interface (@google/genai SDK)                              |
|  5. Validate AI output against schema (Prevent hallucinated math or spoilers)  |
+---------------------------------------+-----------------------------------------+
                                        | Safe JSON / Stream Response
                                        v
+---------------------------------------------------------------------------------+
|                       CLIENT: PROGRESSIVE HINT DISPLAY                          |
+---------------------------------------------------------------------------------+
```

### 6.1 Socratic Escalation Tiers
1. **Tier 1 (Nudge / Orienting):** Focuses the student's attention on a key detail in the problem (e.g., *"Take a look at the sign of both numbers you are multiplying. What happens when two negative numbers meet?"*).
2. **Tier 2 (Guiding Question):** Asks the student a simpler sub-question that unlocks the step (e.g., *"What is $4 \times 5$? Now, remember the rule: $(-1) \times (-1) = ?$"*).
3. **Tier 3 (Stronger Hint / Rule Reminder):** States the underlying mathematical theorem or sign convention without solving their specific problem.
4. **Tier 4 (Worked Parallel Example):** Solves an analogous problem with different numbers step-by-step (e.g., demonstrating $(-3) \times (-7) = 21$ step-by-step so the student can apply the method to $(-4) \times (-5)$).
5. **Tier 5 (Full Explanation & Remediation):** Provides complete breakdown of the current problem, explains the mistake, and flags the adaptive engine to queue an immediate retry with an isomorphic question.

### 6.2 Mistake Analyzer Engine
When an answer is incorrect:
1. **Deterministic Rule Pass:** Check common deterministic algebraic mistakes (e.g., absolute value matched but sign flipped $\rightarrow$ `SIGN_ERROR`; added instead of multiplied $\rightarrow$ `OPERATION_CONFUSION`).
2. **AI Semantic Pass:** For complex text or multi-step expressions, the AI analyzes student reasoning to categorize the error (`CARELESS_CALCULATION`, `REPEATED_MISCONCEPTION`, `MISSING_PREREQUISITE`, `CONCEPTUAL_MISUNDERSTANDING`, `APPLICATION_DIFFICULTY`) and assign a confidence value ($0.0 \dots 1.0$).
3. **Audit Trail:** Teacher and researcher dashboards can inspect mistake categorizations and correct/calibrate them.

---

## 7. LEARNING-ENGINE ARCHITECTURE

### 7.1 Polymorphic Lesson Section System
Each lesson consists of sequential, extensible sections:
* `TEXT`: Rich instructional text with KaTeX formulas.
* `IMAGE` / `DIAGRAM`: SVG or high-fidelity diagrams with captions.
* `VIDEO`: Streamable lesson clips (e.g., Mathisipan).
* `EXAMPLE`: Step-by-step worked solutions with show/hide reveals.
* `INTERACTIVE`: Visual math widgets (e.g., interactive integer number line where students slide markers).
* `CHECKPOINT`: Micro-assessment question gating subsequent sections.
* `SUMMARY`: High-level takeaway cards.

### 7.2 Polymorphic Question Engine
Supports decoupled evaluation strategies:
* `MULTIPLE_CHOICE`: Radio/cards with randomized distractors.
* `NUMERIC_INPUT`: Supports exact values, scientific notation, and float tolerance $(\pm \epsilon)$.
* `TEXT_INPUT`: Normalized string comparison (trim, lowercase, punctuation strip).
* `TRUE_FALSE`: Binary conceptual questions.
* `EQUATION`: Symbolic equivalence (e.g., $2x + 4$ is equivalent to $4 + 2x$ or $2(x+2)$).
* `MATCHING`: Pair key concepts with representations.
* `ORDERING`: Arrange numbers or steps in ascending/logical sequence.

### 7.3 Adaptive Progression & Difficulty Algorithm
* **Item Selection Function:** Selects next item $Q$ from skill pool based on target difficulty:
  $$D_{\text{target}} = D_{\text{current}} + \Delta(\text{recent attempts})$$
  * If last 3 consecutive answers are correct: $D_{\text{target}} \leftarrow \min(5.0, D + 0.5)$.
  * If student fails 2 consecutive attempts: $D_{\text{target}} \leftarrow \max(1.0, D - 0.4)$.
* **Remediation Trigger:** If accuracy on baseline items ($D \le 2.0$) drops below 50%, the system halts the current skill, walks the **Prerequisite Graph** to identify the weakest parent skill (e.g., "Adding Integers with Differing Signs"), administers a 3-question diagnostic remediation, and then transitions back upon success.

### 7.4 Mastery Engine (Multi-Signal Model)
Mastery is not a single test score. It is calculated across 4 distinct dimensions:
1. **Understanding ($U$):** Accuracy on conceptual questions and checkpoints ($0.0 - 1.0$).
2. **Accuracy ($A$):** Ratio of correct attempts without hints ($0.0 - 1.0$).
3. **Application ($P$):** Success on non-routine word problems and higher difficulty ($D \ge 3.5$) items ($0.0 - 1.0$).
4. **Consistency ($C$):** Performance over time across multiple sessions separated by spacing intervals ($0.0 - 1.0$).

$$\text{Composite Mastery Score } M = w_u U + w_a A + w_p P + w_c C$$
*(Default weights: $w_u=0.25, w_a=0.30, w_p=0.25, w_c=0.20$)*

**Mastery States:**
* `NOT_STARTED`: $M = 0$
* `LEARNING`: $0 < M < 0.50$
* `DEVELOPING`: $0.50 \le M < 0.70$
* `PROFICIENT`: $0.70 \le M < 0.85$
* `MASTERED`: $M \ge 0.85$ AND minimum 5 independent correct attempts without tier 4-5 hints.

---

## 8. SECURITY & DATA GOVERNANCE ARCHITECTURE

1. **Role-Based Access Control (RBAC):**
   * Role hierarchy: `STUDENT` < `TEACHER` < `ADMIN` / `RESEARCHER`.
   * Enforced at API route level with middleware asserting role capabilities.
   * Scoped queries prevent teachers from viewing students outside their enrolled classrooms.
2. **Server-Side Secret Isolation:**
   * Gemini API keys and database credentials reside exclusively in environment variables on the backend. No secret tokens are exposed to client JavaScript.
3. **Input Sanitization & Injection Defense:**
   * All student math inputs and responses are strictly validated via Zod schemas.
   * Parameterized queries via Prisma ORM completely prevent SQL injection.
4. **Rate Limiting & Anti-Abuse:**
   * Rate limiting on AI Tutor endpoints (e.g., maximum 10 hint requests per minute per user) to eliminate token abuse and Denial of Wallet attacks.
5. **Research Data De-Identification & Privacy (FERPA / Data Privacy Act Compliance):**
   * Research exports substitute student names and emails with deterministic cryptographic hashes (`SHA256(student_id + salt)`).
   * Sensitive metadata is decoupled into isolated audit tables.

---

## 9. TECHNICAL RISKS & MITIGATION MATRIX

| Risk | Impact | Likelihood | Mitigation Strategy |
| :--- | :---: | :---: | :--- |
| **AI Hallucinations in Math** | High | Medium | Use deterministic rule engine for math verification; LLM only produces textual guidance/hints. Never let LLM decide if an answer is mathematically correct. |
| **Socratic Spoiling (LLM blurt out answer)** | High | Medium | Strict system prompts forbidding direct answers in early tiers; few-shot Socratic examples; JSON output schema with automated validator catching numerical answer substrings. |
| **Adaptive Oscillation / Frustration** | Medium | Low | Dampen difficulty adjustments with moving averages; set explicit floor thresholds before triggering remediation. |
| **Network Latency during Practice** | Medium | Medium | Optimistic UI feedback for local interactions; pre-fetch next question bundle asynchronously; keep hint prompts lightweight. |
| **Graph Dependency Cycles in Curriculum** | High | Low | Enforce Directed Acyclic Graph (DAG) validation at database insertion time (cycle detection algorithm in seed/admin). |

---

## 10. DECISIONS REQUIRED PRIOR TO IMPLEMENTATION

1. **Database Persistence:**
   * *Recommendation:* PostgreSQL managed via Prisma. In this development workspace, we will establish a structured schema with clean migration paths.
2. **Authentication Architecture:**
   * *Recommendation:* Modern session-based / JWT authentication with secure HTTP-only cookies, structured for smooth migration to Firebase Auth or NextAuth in production.
3. **Math Formula Typography:**
   * *Recommendation:* KaTeX for ultra-fast, accessible mathematical typesetting of LaTeX notation (e.g. fractions, exponents, sets).
4. **AI Model Selection:**
   * *Recommendation:* Gemini 2.5 Flash via `@google/genai` TypeScript SDK for ultra-low latency, high reasoning quality, and cost-effective real-time Socratic hints.

---

## 11. PHASE 1 IMPLEMENTATION PLAN

### Step 1: Project Foundation & Environment Setup
* Establish the master configuration files, environment variables template (`.env.example`), and core dependency declarations.
* Configure strict TypeScript boundaries and paths (`@/components`, `@/lib`, `@/types`).

### Step 2: Core Domain Type Definitions
* Create complete TypeScript types in `src/types/` representing the full domain:
  * `curriculum.ts` (Subject, Grade, Term, Unit, Competency, Skill, Prerequisite)
  * `lesson.ts` (Lesson, LessonSection, SectionType, LessonProgress)
  * `question.ts` (Question, QuestionType, QuestionOption, Rubric)
  * `attempt.ts` (Attempt, MistakeLog, MisconceptionCategory)
  * `mastery.ts` (MasteryState, MasteryScores, MasteryThresholds)
  * `user.ts` (User, Role, Classroom, Enrollment)

### Step 3: Architecture-Ready Component Scaffolding
* Scaffold foundational UI components with clean design and accessibility (App Shell, navigation, role selector for dev preview).
* Set up KaTeX math renderer component for formulas like $\frac{a}{b}$, $(-4) \times (-5) = 20$.

### Step 4: Verification & Acceptance Gates
* Run TypeScript compiler checks and build verification to guarantee 100% clean baseline without any errors.

---

## PHASE 0 COMPLETION CHECKLIST

- [x] **Architecture defined:** Full end-to-end system design, client-server separation, service boundaries, and workflow diagram documented.
- [x] **Folder structure defined:** Complete scalable file tree following clean architecture principles.
- [x] **Database architecture defined:** Comprehensive relational schema with 18+ normalized entities covering curriculum DAG, attempts, mistake analysis, mastery, and research.
- [x] **API architecture defined:** Full REST and streaming contract specifications with exact request/response models.
- [x] **AI architecture defined:** Context-aware Socratic tutoring pipeline, 5-tier escalation rules, mistake categorization prompt engine, and safety guardrails.
- [x] **Learning engine defined:** Active-learning loop, polymorphic lesson section renderer, polymorphic question evaluation, adaptive difficulty scaling, and 4-dimension mastery model.
- [x] **Security approach defined:** RBAC, server-side secret isolation, input sanitization, rate-limiting, and blinded research de-identification.
- [x] **Phase 1 plan created:** Actionable, sequenced implementation steps with acceptance criteria.

---
*End of Master Blueprint. Ready for stakeholder review before proceeding to Phase 1.*
