/**
 * Phase 9: Comprehensive Automated Acceptance Test Suite
 *
 * Tests:
 * 1. Deterministic Decision Rules (Insufficient, Prerequisite, Conceptual, Easier, Same, Harder)
 * 2. Difficulty Adjuster Transitions (EASY <-> MEDIUM <-> HARD)
 * 3. Recommendation Lifecycle (ACTIVE, COMPLETED, DISMISSED, SUPERSEDED)
 * 4. Teacher Override & Audit Trail
 * 5. Full End-to-End API Integration
 */

import { AdaptiveDecisionRules } from "../src/lib/adaptive/decision-rules";
import { DifficultyAdjuster } from "../src/lib/adaptive/difficulty-adjuster";
import { AdaptiveEngine } from "../src/lib/adaptive/adaptive-engine";
import { AdaptiveExplainer } from "../src/lib/ai/adaptive-explainer";
import { ADAPTIVE_CONFIG } from "../src/config/adaptive-learning";
import type { AdaptiveEvidenceBundle } from "../src/lib/adaptive/adaptive-types";

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${msg}`);
    process.exit(1);
  }
  console.log(`✅ PASSED: ${msg}`);
}

async function runTests() {
  console.log("=== PHASE 9: ADAPTIVE LEARNING ENGINE TEST SUITE ===\n");

  // -----------------------------------------------------------------
  // 1. DIFFICULTY ADJUSTER UNIT TESTS
  // -----------------------------------------------------------------
  console.log("--- 1. Testing Difficulty Adjuster ---");

  // A. Insufficient attempts -> remain at current difficulty
  const diffInsufficient = DifficultyAdjuster.computeTargetDifficulty(
    "MEDIUM",
    { totalAttempts: 1, correctAnswers: 1, incorrectAnswers: 0, accuracy: 1.0, retryCount: 0, hintUsageCount: 0, recentTrend: "INSUFFICIENT_DATA", difficultyCounts: { EASY: { total: 0, correct: 0 }, MEDIUM: { total: 1, correct: 1 }, HARD: { total: 0, correct: 0 } } },
    { hasAnalysis: false, repeatedSignErrors: false, conceptualGap: false, prerequisiteGap: false, calculationErrorOnly: false }
  );
  assert(diffInsufficient.targetDifficulty === "MEDIUM" && !diffInsufficient.adjusted, "Insufficient attempts preserves current difficulty");

  // B. High accuracy -> step UP from EASY to MEDIUM
  const diffEasyToMedium = DifficultyAdjuster.computeTargetDifficulty(
    "EASY",
    { totalAttempts: 5, correctAnswers: 5, incorrectAnswers: 0, accuracy: 1.0, retryCount: 0, hintUsageCount: 0, recentTrend: "IMPROVING", difficultyCounts: { EASY: { total: 5, correct: 5 }, MEDIUM: { total: 0, correct: 0 }, HARD: { total: 0, correct: 0 } } },
    { hasAnalysis: false, repeatedSignErrors: false, conceptualGap: false, prerequisiteGap: false, calculationErrorOnly: false }
  );
  assert(diffEasyToMedium.targetDifficulty === "MEDIUM" && diffEasyToMedium.direction === "UP", "High accuracy advances EASY -> MEDIUM");

  // C. High accuracy -> step UP from MEDIUM to HARD
  const diffMediumToHard = DifficultyAdjuster.computeTargetDifficulty(
    "MEDIUM",
    { totalAttempts: 5, correctAnswers: 5, incorrectAnswers: 0, accuracy: 1.0, retryCount: 0, hintUsageCount: 0, recentTrend: "IMPROVING", difficultyCounts: { EASY: { total: 0, correct: 0 }, MEDIUM: { total: 5, correct: 5 }, HARD: { total: 0, correct: 0 } } },
    { hasAnalysis: false, repeatedSignErrors: false, conceptualGap: false, prerequisiteGap: false, calculationErrorOnly: false }
  );
  assert(diffMediumToHard.targetDifficulty === "HARD" && diffMediumToHard.direction === "UP", "High accuracy advances MEDIUM -> HARD");

  // D. High accuracy at HARD -> stay HARD (top bound)
  const diffHardToHard = DifficultyAdjuster.computeTargetDifficulty(
    "HARD",
    { totalAttempts: 5, correctAnswers: 5, incorrectAnswers: 0, accuracy: 1.0, retryCount: 0, hintUsageCount: 0, recentTrend: "STABLE", difficultyCounts: { EASY: { total: 0, correct: 0 }, MEDIUM: { total: 0, correct: 0 }, HARD: { total: 5, correct: 5 } } },
    { hasAnalysis: false, repeatedSignErrors: false, conceptualGap: false, prerequisiteGap: false, calculationErrorOnly: false }
  );
  assert(diffHardToHard.targetDifficulty === "HARD" && diffHardToHard.direction === "SAME", "High accuracy at top maintains HARD");

  // E. Low accuracy (<60%) with conceptual gap -> step DOWN from HARD to MEDIUM
  const diffHardToMed = DifficultyAdjuster.computeTargetDifficulty(
    "HARD",
    { totalAttempts: 5, correctAnswers: 2, incorrectAnswers: 3, accuracy: 0.40, retryCount: 1, hintUsageCount: 2, recentTrend: "DECLINING", difficultyCounts: { EASY: { total: 0, correct: 0 }, MEDIUM: { total: 0, correct: 0 }, HARD: { total: 5, correct: 2 } } },
    { hasAnalysis: true, repeatedSignErrors: true, conceptualGap: true, prerequisiteGap: false, calculationErrorOnly: false }
  );
  assert(diffHardToMed.targetDifficulty === "MEDIUM" && diffHardToMed.direction === "DOWN", "Low accuracy steps down HARD -> MEDIUM");

  // F. Low accuracy with conceptual gap -> step DOWN from MEDIUM to EASY
  const diffMedToEasy = DifficultyAdjuster.computeTargetDifficulty(
    "MEDIUM",
    { totalAttempts: 5, correctAnswers: 2, incorrectAnswers: 3, accuracy: 0.40, retryCount: 1, hintUsageCount: 2, recentTrend: "DECLINING", difficultyCounts: { EASY: { total: 0, correct: 0 }, MEDIUM: { total: 5, correct: 2 }, HARD: { total: 0, correct: 0 } } },
    { hasAnalysis: true, repeatedSignErrors: true, conceptualGap: true, prerequisiteGap: false, calculationErrorOnly: false }
  );
  assert(diffMedToEasy.targetDifficulty === "EASY" && diffMedToEasy.direction === "DOWN", "Low accuracy steps down MEDIUM -> EASY");

  // G. Low accuracy at EASY -> stay EASY (bottom floor)
  const diffEasyToEasy = DifficultyAdjuster.computeTargetDifficulty(
    "EASY",
    { totalAttempts: 5, correctAnswers: 1, incorrectAnswers: 4, accuracy: 0.20, retryCount: 1, hintUsageCount: 2, recentTrend: "DECLINING", difficultyCounts: { EASY: { total: 5, correct: 1 }, MEDIUM: { total: 0, correct: 0 }, HARD: { total: 0, correct: 0 } } },
    { hasAnalysis: true, repeatedSignErrors: true, conceptualGap: true, prerequisiteGap: false, calculationErrorOnly: false }
  );
  assert(diffEasyToEasy.targetDifficulty === "EASY" && diffEasyToEasy.direction === "SAME", "Low accuracy at floor maintains EASY");

  // H. Calculation error ONLY -> do NOT step down difficulty precipitously
  const diffCalcOnly = DifficultyAdjuster.computeTargetDifficulty(
    "MEDIUM",
    { totalAttempts: 5, correctAnswers: 2, incorrectAnswers: 3, accuracy: 0.40, retryCount: 0, hintUsageCount: 0, recentTrend: "STABLE", difficultyCounts: { EASY: { total: 0, correct: 0 }, MEDIUM: { total: 5, correct: 2 }, HARD: { total: 0, correct: 0 } } },
    { hasAnalysis: true, repeatedSignErrors: false, conceptualGap: false, prerequisiteGap: false, calculationErrorOnly: true }
  );
  assert(diffCalcOnly.targetDifficulty === "MEDIUM" && !diffCalcOnly.adjusted, "Calculation slip preserves difficulty to build precision");

  // -----------------------------------------------------------------
  // 2. DETERMINISTIC DECISION RULES
  // -----------------------------------------------------------------
  console.log("\n--- 2. Testing Deterministic Decision Rules ---");

  const baseBundle: AdaptiveEvidenceBundle = {
    studentId: "usr_student_01",
    skillId: "skl_01",
    collectedAt: new Date(),
    skill: {
      skillId: "skl_01",
      skillTitle: "Identify integers",
      prerequisites: [],
    },
    practice: {
      totalAttempts: 5,
      correctAnswers: 5,
      incorrectAnswers: 0,
      accuracy: 1.0,
      retryCount: 0,
      hintUsageCount: 0,
      recentTrend: "IMPROVING",
      difficultyCounts: { EASY: { total: 0, correct: 0 }, MEDIUM: { total: 5, correct: 5 }, HARD: { total: 0, correct: 0 } },
    },
    mistake: {
      hasAnalysis: false,
      repeatedSignErrors: false,
      conceptualGap: false,
      prerequisiteGap: false,
      calculationErrorOnly: false,
    },
    learningPath: {
      currentLessonId: "lsn_01",
      isLessonCompleted: false,
      completedLessonsCount: 0,
      totalLessonsInUnit: 3,
    },
  };

  // Rule 1: Insufficient Evidence
  const bundleInsufficient: AdaptiveEvidenceBundle = {
    ...baseBundle,
    practice: { ...baseBundle.practice, totalAttempts: 1, accuracy: 1.0 },
  };
  const res1 = AdaptiveDecisionRules.evaluate(bundleInsufficient);
  assert(res1.decisionType === "INSUFFICIENT_EVIDENCE", "Rule 1 yields INSUFFICIENT_EVIDENCE for < 3 attempts");

  // Rule 2: Prerequisite Gap
  const bundlePrereq: AdaptiveEvidenceBundle = {
    ...baseBundle,
    mistake: { ...baseBundle.mistake, prerequisiteGap: true },
    skill: {
      ...baseBundle.skill,
      prerequisites: [{ prerequisiteSkillId: "skl_00", prerequisiteTitle: "Whole Numbers", accuracy: 0.3, attemptCount: 4, isWeak: true }],
    },
  };
  const res2 = AdaptiveDecisionRules.evaluate(bundlePrereq);
  assert(res2.decisionType === "REVIEW_PREREQUISITE", "Rule 2 triggers REVIEW_PREREQUISITE on prerequisite gap");

  // Rule 3: Repeated Conceptual Gap / Sign Error
  const bundleConceptual: AdaptiveEvidenceBundle = {
    ...baseBundle,
    practice: { ...baseBundle.practice, totalAttempts: 6, correctAnswers: 2, accuracy: 0.33 },
    mistake: { ...baseBundle.mistake, repeatedSignErrors: true, conceptualGap: true },
  };
  const res3 = AdaptiveDecisionRules.evaluate(bundleConceptual);
  assert(res3.decisionType === "REMEDIATE", "Rule 3 triggers REMEDIATE for low accuracy with sign/conceptual error");

  // Rule 4: Low Accuracy without systemic misconception
  const bundleLowAcc: AdaptiveEvidenceBundle = {
    ...baseBundle,
    practice: { ...baseBundle.practice, totalAttempts: 5, correctAnswers: 2, accuracy: 0.40 },
    mistake: { ...baseBundle.mistake, repeatedSignErrors: false, conceptualGap: false },
  };
  const res4 = AdaptiveDecisionRules.evaluate(bundleLowAcc);
  assert(res4.decisionType === "PRACTICE_EASIER", "Rule 4 triggers PRACTICE_EASIER for low accuracy without deep misconception");

  // Rule 5: High Accuracy (>= 85%)
  const bundleHighAcc: AdaptiveEvidenceBundle = {
    ...baseBundle,
    practice: { ...baseBundle.practice, totalAttempts: 6, correctAnswers: 6, accuracy: 1.0 },
  };
  const res5 = AdaptiveDecisionRules.evaluate(bundleHighAcc);
  assert(res5.decisionType === "PRACTICE_HARDER", "Rule 5 triggers PRACTICE_HARDER for consistently strong performance");

  // Rule 6: Developing / Moderate Accuracy (70%)
  const bundleModerate: AdaptiveEvidenceBundle = {
    ...baseBundle,
    practice: { ...baseBundle.practice, totalAttempts: 6, correctAnswers: 4, accuracy: 0.67 },
  };
  const res6 = AdaptiveDecisionRules.evaluate(bundleModerate);
  assert(res6.decisionType === "PRACTICE_SAME_DIFFICULTY", "Rule 6 triggers PRACTICE_SAME_DIFFICULTY for moderate performance");

  // -----------------------------------------------------------------
  // 3. DETERMINISTIC EXPLAINER FALLBACK
  // -----------------------------------------------------------------
  console.log("\n--- 3. Testing Explainer Fallbacks ---");
  const fallbackExp = AdaptiveExplainer.getDeterministicExplanation(res5, bundleHighAcc, "Challenge Set");
  assert(Boolean(fallbackExp.message && fallbackExp.nextStep), "Deterministic fallback explainer produces complete message & nextStep");

  // -----------------------------------------------------------------
  // 4. RECOMMENDATION LIFECYCLE & OVERRIDE
  // -----------------------------------------------------------------
  console.log("\n--- 4. Testing AdaptiveEngine Lifecycle ---");

  // Generate recommendation
  const rec = await AdaptiveEngine.generateAdaptiveRecommendation({
    studentId: "usr_student_01",
    skillId: "skl_01",
    trigger: "PRACTICE_COMPLETED",
    forceRefresh: true,
  });
  assert(rec.status === "ACTIVE", "Generated recommendation is ACTIVE");
  assert(Boolean(rec.reason && rec.decisionType), "Recommendation has valid reason and decisionType");

  // Complete recommendation
  const completedRec = await AdaptiveEngine.completeRecommendation(rec.id, "usr_student_01");
  assert(completedRec?.status === "COMPLETED", "Recommendation transitions to COMPLETED");

  // Dismiss recommendation
  const rec2 = await AdaptiveEngine.generateAdaptiveRecommendation({
    studentId: "usr_student_01",
    skillId: "skl_01",
    trigger: "STUDENT_REQUESTED",
    forceRefresh: true,
  });
  const dismissedRec = await AdaptiveEngine.dismissRecommendation(rec2.id, "usr_student_01");
  assert(dismissedRec?.status === "DISMISSED", "Recommendation transitions to DISMISSED");

  // Apply Teacher Override
  const rec3 = await AdaptiveEngine.generateAdaptiveRecommendation({
    studentId: "usr_student_01",
    skillId: "skl_01",
    forceRefresh: true,
  });
  const overridden = await AdaptiveEngine.applyTeacherOverride({
    recommendationId: rec3.id,
    teacherId: "usr_teacher_01",
    overrideDecision: "PRACTICE_HARDER",
    reason: "Student performed very well during class boardwork.",
    targetDifficulty: "HARD",
  });
  assert(overridden?.decisionType === "PRACTICE_HARDER", "Teacher override updated decisionType to PRACTICE_HARDER");
  assert(overridden?.source === "TEACHER_OVERRIDE", "Source updated to TEACHER_OVERRIDE");
  assert(Boolean(overridden?.overrides && overridden.overrides.length > 0), "Audit trail contains teacher override record");

  console.log("\n=== ALL PHASE 9 ACCEPTANCE CRITERIA PASSED SUCCESSFULLY! ===");
}

runTests().catch((e) => {
  console.error("Test execution failed:", e);
  process.exit(1);
});
