# TUKLAS AI — PHASE 9: ADAPTIVE LEARNING ENGINE

**Specification & Architecture Guide**  
**Version:** 1.0.0  
**Phase:** 9 (Adaptive Learning Engine)  
**Date:** September 2026  

---

## 1. Executive Overview

The **Adaptive Learning Engine** in Tuklas AI intelligently determines what a student should practice or study next based on concrete evidence gathered from their actual learning behavior, question attempts, prerequisite graph standing, and mistake patterns.

### Core Pedagogy
Adaptive learning answers:
> *"Based on the evidence we currently have, what should the student do next?"*

It explicitly avoids declaring official competency mastery (reserved for **Phase 10 — Mastery Engine**). It does not skip required curriculum competencies or permanently alter curriculum requirements; instead, it dynamically adapts pacing, question difficulty, and remediation routes through the approved MATATAG Grade 7 curriculum.

---

## 2. Controlled Decision Types

All adaptive decisions originate from a strictly controlled server-side enum (`AdaptiveDecisionType`):

| Decision Type | Description | Trigger Conditions |
| :--- | :--- | :--- |
| `INSUFFICIENT_EVIDENCE` | Too few attempts logged to discern reliable pattern. | Attempts < `minimumAttemptsForAdaptation` (default: 3) |
| `REVIEW_PREREQUISITE` | Directs student to foundational prerequisite concept. | Prerequisite accuracy < 50% or `PREREQUISITE_GAP` analysis |
| `REMEDIATE` | Guided lesson walkthrough and concept review. | Accuracy < 60% alongside confirmed conceptual/sign gap |
| `PRACTICE_EASIER` | Step down question difficulty to foundational level. | Accuracy < 60% without systemic misconception |
| `PRACTICE_SAME_DIFFICULTY` | Maintain practice at current difficulty. | Moderate accuracy (60% to 84%) or steady improvement |
| `PRACTICE_HARDER` | Advance to higher question difficulty. | High recent accuracy (≥ 85%) and low hint reliance |
| `REPEAT_LESSON` | Revisit full interactive lesson module. | Significant gap identified across all formative checkpoints |
| `CONTINUE` | Regular forward progression along curriculum path. | Healthy baseline pace |
| `RETRY` | Immediate retry with fresh isomorphic items. | Isolated misread error |
| `TEACHER_REVIEW` | Flagged for 1-on-1 educator consultation. | Multi-cycle plateau or teacher override |

---

## 3. Evidence Collection Pipeline

The `EvidenceCollector` (`src/lib/adaptive/evidence-collector.ts`) aggregates four distinct modalities of student data:

1. **Practice Performance Evidence:**
   - Total attempts in sliding window (default: 10 items)
   - Correct vs. incorrect answers and aggregate accuracy
   - Retry counts and hint usage frequency
   - Average duration per item
   - Recent performance trajectory (`IMPROVING`, `DECLINING`, `STABLE`, `INSUFFICIENT_DATA`)
   - Difficulty distribution breakdown (`EASY`, `MEDIUM`, `HARD`)

2. **Skill & Prerequisite DAG Evidence:**
   - Current competency and active skill
   - Directed Acyclic Graph (DAG) prerequisite competencies from database
   - Student's historical accuracy on each parent prerequisite skill

3. **AI Mistake Analysis Evidence (Phase 8):**
   - Categorized misconception classification (`SIGN_ERROR`, `CONCEPTUAL_MISUNDERSTANDING`, `PREREQUISITE_GAP`, `CALCULATION_ERROR`, etc.)
   - Pattern descriptions, confidence score, and pedagogical hypotheses

4. **Curriculum Learning Path Evidence (Phase 4):**
   - Current lesson completion state
   - Ratio of completed lessons in unit
   - Next available unblocked lesson in sequence

---

## 4. Deterministic Decision Engine

The primary decision-maker is a pure deterministic rules engine (`src/lib/adaptive/decision-rules.ts`). Thresholds are centralized in `src/config/adaptive-learning.ts`:

```typescript
export const ADAPTIVE_CONFIG = {
  minimumAttemptsForAdaptation: 3,
  recentAttemptWindow: 10,
  lowAccuracyThreshold: 0.60,
  highAccuracyThreshold: 0.85,
  moderateAccuracyThreshold: 0.70,
  prerequisiteWeaknessThreshold: 0.50,
  repeatedMistakeThreshold: 2,
  highHintUsageThreshold: 2,
  maxDifficultyIncrease: 1,
  maxDifficultyDecrease: 1,
  recommendationExpirationHours: 168, // 7 days
};
```

### Rule Priority Hierarchy
1. **Rule 1 (Insufficient Data):** If total attempts < 3 $\rightarrow$ `INSUFFICIENT_EVIDENCE`.
2. **Rule 2 (Prerequisite Gap):** If `PREREQUISITE_GAP` is detected or prerequisite accuracy < 50% $\rightarrow$ `REVIEW_PREREQUISITE`.
3. **Rule 3 (Conceptual Remediation):** If accuracy < 60% and repeated sign error or conceptual gap exists $\rightarrow$ `REMEDIATE`.
4. **Rule 4 (Easier Practice):** If accuracy < 60% without systemic misconception $\rightarrow$ `PRACTICE_EASIER`.
5. **Rule 5 (Harder Practice):** If accuracy $\ge$ 85% $\rightarrow$ `PRACTICE_HARDER`.
6. **Rule 6 (Developing Progress):** If 60% $\le$ accuracy < 85% $\rightarrow$ `PRACTICE_SAME_DIFFICULTY`.
7. **Rule 7 (Default):** Default path continuation $\rightarrow$ `CONTINUE`.

---

## 5. Difficulty Adjuster

The `DifficultyAdjuster` (`src/lib/adaptive/difficulty-adjuster.ts`) supports transitions between `EASY`, `MEDIUM`, and `HARD`:
- `EASY` $\rightarrow$ `MEDIUM` $\rightarrow$ `HARD` (on high accuracy)
- `HARD` $\rightarrow$ `MEDIUM` $\rightarrow$ `EASY` (on conceptual struggle)
- **Calculation Nuance:** If the student's errors are strictly arithmetic calculation slips (`CALCULATION_ERROR`) rather than conceptual confusion, difficulty is maintained at the current level to foster precision rather than dropping down prematurely.

---

## 6. Recommendation Lifecycle & Expiration

Recommendations adhere to a strict state machine:
- **`ACTIVE`:** Currently presented to the student as their primary next step.
- **`COMPLETED`:** Marked when the student finishes the targeted activity.
- **`SUPERSEDED`:** Automatically replaced when new evidence generates a fresher recommendation.
- **`DISMISSED`:** Closed by student preference.
- **`EXPIRED`:** Exceeded expiration window (default: 7 days) without interaction.

---

## 7. Teacher Override & Audit Trail

Educators maintain authoritative oversight through the Teacher Portal (`/teacher/students/[studentId]/insights`):
1. **Inspection:** Teachers view the student's active recommendation, system rationale, and underlying evidence summary.
2. **Override Action:** Teachers can override the system decision (e.g. advance to `PRACTICE_HARDER` or require `REVIEW_PREREQUISITE`).
3. **Mandatory Audit:** Every override requires a pedagogical justification and records:
   - `teacherId`
   - `originalDecision`
   - `overrideDecision`
   - `reason`
   - `timestamp`
4. The recommendation's source transitions to `TEACHER_OVERRIDE` and is prominently tagged in the history view.

---

## 8. AI Explainer Integration

The `AdaptiveExplainer` (`src/lib/ai/adaptive-explainer.ts`) uses the Phase 7 `AIProvider` to convert structured rule outputs into warm, age-appropriate (Grade 7) student messages:
```json
{
  "message": "Great progress! You are steadily developing your skills in Compare integers.",
  "reason": "Consistent practice at this level locks in your accuracy (70%).",
  "nextStep": "Continue practice: Integer Operations Practice Set (medium practice)",
  "encouragement": "Keep the momentum going!"
}
```
**Safety & Resilience:** If the AI provider times out, fails, or is unavailable, the system immediately returns a deterministic pedagogical message without interrupting the user experience.

---

## 9. API Specifications

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/student/adaptive/recommendation` | Active recommendation for authenticated student | Student |
| `POST` | `/api/student/adaptive/recommendation/generate` | Recalculate recommendation with fresh evidence | Student |
| `POST` | `/api/student/adaptive/recommendation/:id/complete`| Mark recommendation as completed | Student |
| `POST` | `/api/student/adaptive/recommendation/:id/dismiss` | Dismiss recommendation | Student |
| `GET` | `/api/teacher/students/:studentId/adaptive/recommendations` | Traceable recommendation history & audits | Teacher / Admin |
| `POST` | `/api/teacher/students/:studentId/adaptive/recommendation` | Force recalculation for student | Teacher / Admin |
| `POST` | `/api/teacher/students/:studentId/adaptive/override` | Submit audited teacher override | Teacher / Admin |

---

## 10. Automated Test Verification

Execute the comprehensive Phase 9 acceptance test suite:
```bash
npx tsx scripts/test-phase9.ts
```
Verifies:
- Difficulty adjuster transitions (`EASY` $\leftrightarrow$ `MEDIUM` $\leftrightarrow$ `HARD`)
- All 6 deterministic decision rules
- AI fallback explanations
- Recommendation lifecycle (`ACTIVE` $\rightarrow$ `COMPLETED` / `DISMISSED`)
- Teacher overrides and relational audit trails
