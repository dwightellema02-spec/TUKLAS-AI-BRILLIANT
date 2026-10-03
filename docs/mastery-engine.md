# Tuklas AI — Mastery Engine Documentation (Phase 10)

## 1. Overview & Core Distinction

The **Mastery Engine** determines a student's current proficiency level for individual skills using multi-dimensional, evidence-based rules.

### Key Distinction from Adaptive Learning (Phase 9)
* **Adaptive Learning (Phase 9)**: *"Based on recent evidence, what should the student do next?"* (e.g., recommend easier practice, review a prerequisite, continue path).
* **Mastery Engine (Phase 10)**: *"What is the student's current mastery level of this skill?"* (e.g., `DEVELOPING`, `PROFICIENT`, `MASTERED`).

Mastery is **never** decided by a single test score or an ungrounded AI guess. It requires consistent, repeatable evidence across question types and difficulty bands.

---

## 2. Controlled Mastery Levels

The engine operates on five strict states:

| Level | Definition |
| :--- | :--- |
| `NOT_STARTED` | The student has logged 0 practice or checkpoint attempts on this skill. |
| `LEARNING` | Initial exploration (<5 attempts) or low performance (<60% accuracy) where understanding is still forming. |
| `DEVELOPING` | Partial understanding (60%–79% accuracy, or recurring sign errors / conceptual gaps that require guided practice). |
| `PROFICIENT` | Solid, repeatable understanding (>=10 attempts, >=80% accuracy, >=0.55 consistency score) with no active conceptual misunderstandings. |
| `MASTERED` | Comprehensive evidence of mastery (>=15 attempts, >=85% overall & recent accuracy, >=0.75 consistency, >=2 distinct question types, >=60% on hard questions, zero recurring misconceptions). |

---

## 3. Multi-Source Evidence Architecture

```text
Question Attempts (Overall, Recent, Streaks, Hints, Retries)
                          +
Difficulty Distribution (Easy, Medium, Hard accuracy)
                          +
Question Format Diversity (Multiple Choice, Numeric Input, Equation)
                          +
Phase 8 Mistake Evidence (Conceptual, Sign Error, Procedural)
                          +
Phase 9 Adaptive Evidence (Completed Remediations, Overrides)
                          +
Phase 4 Prerequisite DAG (Warning flags for weak prerequisites)
                          ↓
                Mastery Decision Rules
                          ↓
            Deterministic Status + Metrics
                          ↓
        SkillMastery Record + History Audit Trail
```

---

## 4. Centralized Thresholds (`src/config/mastery-learning.ts`)

All numerical parameters are centralized in `src/config/mastery-learning.ts`:

* **`masteryVersion`**: `"MASTERY_V1"`
* **`minimumAttemptsForLearning`**: `1`
* **`minimumAttemptsForDeveloping`**: `5`
* **`minimumAttemptsForProficient`**: `10`
* **`minimumAttemptsForMastered`**: `15`
* **`recentAttemptWindowSize`**: `5`
* **`developingAccuracyThreshold`**: `0.60`
* **`proficientAccuracyThreshold`**: `0.80`
* **`masteredAccuracyThreshold`**: `0.85`
* **`recentAccuracyMasteredThreshold`**: `0.85`
* **`recentPerformanceDeclineThreshold`**: `0.55` (Reverts high-historical students to `DEVELOPING` if recent window collapses)
* **`proficientConsistencyThreshold`**: `0.55`
* **`masteredConsistencyThreshold`**: `0.75`
* **`minimumQuestionTypeDiversityForMastered`**: `2`
* **`minimumHardQuestionPerformance`**: `0.60`
* **`maxConceptualMisunderstandingsForMastered`**: `0`
* **`maxSignErrorsForMastered`**: `0`
* **`prerequisiteConcernThreshold`**: `0.65`

---

## 5. Metric Dimensions

1. **Overall Accuracy**: Total correct attempts divided by total attempts.
2. **Recent Window Accuracy**: Accuracy on the most recent 5 attempts, capturing current state.
3. **Consistency Score ($0.0 - 1.0$)**: Evaluates streak stability (penalizes alternating flip-flops), divergence between historical and recent accuracy, hint independence, and cross-difficulty stability.
4. **Application Score ($0.0 - 1.0$)**: Evaluates performance on higher-order, open-ended question formats (`NUMERIC_INPUT`, `EQUATION`, `ORDERING`, `MATCHING`, or `HARD` items) rather than passive multiple choice alone.

---

## 6. Database Models

```prisma
model SkillMastery {
  id                 String               @id @default(uuid())
  studentId          String
  skillId            String
  status             MasteryLevel         @default(NOT_STARTED)
  evidenceSummary    String?
  accuracy           Float                @default(0.0)
  recentAccuracy     Float                @default(0.0)
  consistencyScore   Float                @default(0.0)
  applicationScore   Float                @default(0.0)
  attemptCount       Int                  @default(0)
  masteryVersion     String               @default("MASTERY_V1")
  lastEvaluatedAt    DateTime             @default(now())
  metadata           String?              // JSON: difficulty, types, flags, explanation
  createdAt          DateTime             @default(now())
  updatedAt          DateTime             @updatedAt

  student            User                 @relation("StudentSkillMasteries", fields: [studentId], references: [id], onDelete: Cascade)
  skill              Skill                @relation(fields: [skillId], references: [id], onDelete: Cascade)
  history            SkillMasteryHistory[]

  @@unique([studentId, skillId])
}

model SkillMasteryHistory {
  id                 String               @id @default(uuid())
  skillMasteryId     String
  previousStatus     MasteryLevel?
  newStatus          MasteryLevel
  reason             String
  evidenceSummary    String?
  masteryVersion     String               @default("MASTERY_V1")
  metadata           String?
  createdAt          DateTime             @default(now())

  mastery            SkillMastery         @relation(fields: [skillMasteryId], references: [id], onDelete: Cascade)
}
```

---

## 7. API Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/student/mastery` | Authenticated student retrieves list of all evaluated skill masteries. |
| `GET` | `/api/student/mastery/:skillId` | Authenticated student evaluates/retrieves single skill mastery with full evidence breakdown. |
| `POST` | `/api/student/mastery/:skillId/recalculate` | Student forces on-demand recalculation with latest evidence & AI explanation. |
| `GET` | `/api/teacher/students/:studentId/mastery` | Teacher retrieves competency mastery matrix for an authorized student. |
| `GET` | `/api/teacher/students/:studentId/mastery/:skillId` | Teacher inspects single skill mastery, metric dimensions, and historical transitions. |

---

## 8. Socratic AI Tutor Integration

When a student queries the AI Tutor:
> *"How am I doing with adding integers?"*

The AI Tutor context resolves the student's actual `SkillMastery` record from the database. The system prompt instructs the Socratic tutor to accurately reflect their factual status (`DEVELOPING`, `PROFICIENT`, etc.) and cite observed evidence, preventing hallucinated or unearned mastery claims.

---

## 9. Accessibility & Interface

* **Multi-modal Visual Indicators**: Mastery states use explicit color palettes, iconography (`Award`, `CheckCircle2`, `TrendingUp`, `BookOpen`, `CircleDashed`), and explicit text badges (`Mastered`, `Proficient`, `Developing`, `Learning`, `Not Started`) ensuring full compliance with anti-color-only guidelines.
* **Student Experience**: Available on `/student` dashboard, `/student/learning-path`, and dedicated `/student/mastery/[skillId]` detail view.
* **Teacher Experience**: Competency Mastery Matrix in `/teacher/students/[studentId]/insights` with click-to-view evidence drawer and audit history.
