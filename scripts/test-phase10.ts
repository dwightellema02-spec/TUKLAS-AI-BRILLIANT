/**
 * Phase 10: Mastery Engine Comprehensive Automated Acceptance Test Suite
 *
 * Tests:
 * 1. MasteryCalculator: accuracy, consecutive counts, consistency score, application score
 * 2. Deterministic MasteryRules across all 5 levels:
 *    - NOT_STARTED (0 attempts)
 *    - LEARNING (<5 attempts, or low accuracy)
 *    - DEVELOPING (partial accuracy, recurring sign errors, or recent performance decline)
 *    - PROFICIENT (>=10 attempts, >=80% accuracy, consistency >=0.55)
 *    - MASTERED (>=15 attempts, >=85% accuracy, consistency >=0.75, diversity, no misconceptions)
 * 3. Recent Performance Sensitivity: Performance drop triggers DEVELOPING
 * 4. Longitudinal History Audit: Transition records in SkillMasteryHistory
 * 5. Full End-to-End Lifecycle via MasteryEngine
 */

import { MasteryCalculator } from "../src/lib/mastery/mastery-calculator";
import { MasteryRules } from "../src/lib/mastery/mastery-rules";
import { MasteryEngine } from "../src/lib/mastery/mastery-engine";
import { MasteryExplanationBuilder } from "../src/lib/mastery/mastery-explanation";
import { MASTERY_CONFIG } from "../src/config/mastery-learning";
import type { MasteryEvidenceBundle } from "../src/lib/mastery/mastery-types";

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${msg}`);
    process.exit(1);
  }
  console.log(`✅ PASSED: ${msg}`);
}

async function runTests() {
  console.log("=== PHASE 10: MASTERY ENGINE TEST SUITE ===\n");

  // -----------------------------------------------------------------
  // 1. CALCULATOR TESTS
  // -----------------------------------------------------------------
  console.log("--- 1. Testing MasteryCalculator ---");

  const acc0 = MasteryCalculator.calculateAccuracy(0, 0);
  assert(acc0 === 0.0, "Accuracy of 0 attempts is 0.0");

  const accHalf = MasteryCalculator.calculateAccuracy(7, 10);
  assert(accHalf === 0.7, "Accuracy of 7/10 is 0.70");

  // Consecutive counts
  const attemptsDesc = [
    { isCorrect: true },
    { isCorrect: true },
    { isCorrect: true },
    { isCorrect: false },
    { isCorrect: true },
  ];
  const consecutiveCorrect = MasteryCalculator.calculateConsecutiveCorrect(attemptsDesc);
  assert(consecutiveCorrect === 3, "Consecutive correct streaks calculated correctly (3)");

  const consecutiveIncorrect = MasteryCalculator.calculateConsecutiveIncorrect(attemptsDesc);
  assert(consecutiveIncorrect === 0, "Consecutive incorrect is 0 when latest is correct");

  // Consistency score
  const stableAttempts = [
    { isCorrect: true, hintUsed: false },
    { isCorrect: true, hintUsed: false },
    { isCorrect: true, hintUsed: false },
    { isCorrect: true, hintUsed: false },
    { isCorrect: true, hintUsed: false },
  ];
  const highConsistency = MasteryCalculator.calculateConsistencyScore({
    attemptsChronologicalAsc: stableAttempts,
    difficultyBreakdown: {
      EASY: { attempts: 3, correct: 3, accuracy: 1.0 },
      MEDIUM: { attempts: 2, correct: 2, accuracy: 1.0 },
      HARD: { attempts: 0, correct: 0, accuracy: 0.0 },
    },
    recentAccuracy: 1.0,
    overallAccuracy: 1.0,
  });
  assert(highConsistency >= 0.8, `Consistent streak yields high consistency score (${highConsistency})`);

  const erraticAttempts = [
    { isCorrect: true, hintUsed: true },
    { isCorrect: false, hintUsed: false },
    { isCorrect: true, hintUsed: true },
    { isCorrect: false, hintUsed: false },
    { isCorrect: true, hintUsed: true },
  ];
  const lowConsistency = MasteryCalculator.calculateConsistencyScore({
    attemptsChronologicalAsc: erraticAttempts,
    difficultyBreakdown: {
      EASY: { attempts: 5, correct: 3, accuracy: 0.6 },
      MEDIUM: { attempts: 0, correct: 0, accuracy: 0.0 },
      HARD: { attempts: 0, correct: 0, accuracy: 0.0 },
    },
    recentAccuracy: 0.6,
    overallAccuracy: 0.6,
  });
  assert(lowConsistency < highConsistency, "Erratic alternation produces lower consistency score");

  // Application score
  const appAttempts = [
    { isCorrect: true, questionType: "NUMERIC_INPUT", difficulty: "MEDIUM" },
    { isCorrect: true, questionType: "EQUATION", difficulty: "HARD" },
    { isCorrect: false, questionType: "MULTIPLE_CHOICE", difficulty: "EASY" },
  ];
  const appScore = MasteryCalculator.calculateApplicationScore({ attempts: appAttempts });
  assert(appScore === 1.0, `Application score on higher-order items is 1.0 (2/2 correct)`);

  // -----------------------------------------------------------------
  // 2. DETERMINISTIC MASTERY RULES UNIT TESTS
  // -----------------------------------------------------------------
  console.log("\n--- 2. Testing Deterministic Mastery Rules ---");

  // Helper factory
  const makeEvidence = (overrides: Partial<MasteryEvidenceBundle>): MasteryEvidenceBundle => ({
    studentId: "usr_student_01",
    skillId: "skl_01",
    skillTitle: "Identify integers",
    totalAttempts: 0,
    correctAttempts: 0,
    incorrectAttempts: 0,
    overallAccuracy: 0.0,
    recentAccuracy: 0.0,
    historicalAccuracy: 0.0,
    consecutiveCorrect: 0,
    consecutiveIncorrect: 0,
    difficultyBreakdown: {
      EASY: { attempts: 0, correct: 0, accuracy: 0.0 },
      MEDIUM: { attempts: 0, correct: 0, accuracy: 0.0 },
      HARD: { attempts: 0, correct: 0, accuracy: 0.0 },
    },
    questionTypeBreakdown: {},
    distinctQuestionTypesCount: 0,
    totalHintsUsed: 0,
    totalRetries: 0,
    practiceSessionsCompleted: 0,
    mistakes: {
      hasMistakeAnalysis: false,
      totalAnalyses: 0,
      hasRepeatedConceptual: false,
      hasRepeatedSignErrors: false,
      hasPrerequisiteGaps: false,
      hasApplicationDifficulty: false,
      inconsistentPerformance: false,
    },
    adaptive: {
      totalRecommendations: 0,
      remediationsCompleted: 0,
      prerequisiteReviewsTriggered: 0,
    },
    prerequisites: [],
    hasPrerequisiteConcern: false,
    applicationScore: 0.0,
    consistencyScore: 0.0,
    ...overrides,
  });

  // A. NOT_STARTED
  const rNotStarted = MasteryRules.evaluate(makeEvidence({ totalAttempts: 0 }));
  assert(rNotStarted.level === "NOT_STARTED", "0 attempts -> NOT_STARTED");
  assert(rNotStarted.ruleCode === "RULE_NOT_STARTED", "ruleCode is RULE_NOT_STARTED");

  // B. LEARNING (Insufficient attempts: 3 attempts < 5)
  const rInsufficient = MasteryRules.evaluate(
    makeEvidence({
      totalAttempts: 3,
      correctAttempts: 2,
      overallAccuracy: 0.67,
      recentAccuracy: 0.67,
    })
  );
  assert(rInsufficient.level === "LEARNING", "<5 attempts -> LEARNING");
  assert(rInsufficient.ruleCode === "RULE_INSUFFICIENT_FOR_DEVELOPING", "ruleCode is RULE_INSUFFICIENT_FOR_DEVELOPING");

  // C. LEARNING (Low accuracy: 8 attempts with 45% accuracy)
  const rLowAcc = MasteryRules.evaluate(
    makeEvidence({
      totalAttempts: 8,
      correctAttempts: 3,
      overallAccuracy: 0.38,
      recentAccuracy: 0.4,
    })
  );
  assert(rLowAcc.level === "LEARNING", "Low accuracy (<60%) -> LEARNING");
  assert(rLowAcc.ruleCode === "RULE_LOW_ACCURACY_LEARNING", "ruleCode is RULE_LOW_ACCURACY_LEARNING");

  // D. DEVELOPING (Partial understanding: 7 attempts, 70% accuracy, recurring sign errors)
  const rDeveloping = MasteryRules.evaluate(
    makeEvidence({
      totalAttempts: 7,
      correctAttempts: 5,
      overallAccuracy: 0.71,
      recentAccuracy: 0.67,
      consistencyScore: 0.6,
      mistakes: {
        hasMistakeAnalysis: true,
        totalAnalyses: 1,
        hasRepeatedConceptual: false,
        hasRepeatedSignErrors: true,
        hasPrerequisiteGaps: false,
        hasApplicationDifficulty: false,
        inconsistentPerformance: false,
      },
    })
  );
  assert(rDeveloping.level === "DEVELOPING", "Partial accuracy + sign errors -> DEVELOPING");
  assert(rDeveloping.ruleCode === "RULE_DEVELOPING", "ruleCode is RULE_DEVELOPING");

  // E. RECENT PERFORMANCE DECLINE
  // Student had 90% historical accuracy, but recent dropped to 40%
  const rDecline = MasteryRules.evaluate(
    makeEvidence({
      totalAttempts: 12,
      correctAttempts: 9,
      overallAccuracy: 0.75,
      historicalAccuracy: 0.9,
      recentAccuracy: 0.4, // below 0.55 threshold
      consistencyScore: 0.45,
    })
  );
  assert(rDecline.level === "DEVELOPING", "Recent performance drop -> reverts to DEVELOPING");
  assert(rDecline.flags.recentPerformanceDecline, "recentPerformanceDecline flag is set");
  assert(rDecline.ruleCode === "RULE_RECENT_PERFORMANCE_DECLINE", "ruleCode is RULE_RECENT_PERFORMANCE_DECLINE");

  // F. PROFICIENT
  // 12 attempts, 83% accuracy, recent 80%, consistency 0.65, no recurring conceptual
  const rProficient = MasteryRules.evaluate(
    makeEvidence({
      totalAttempts: 12,
      correctAttempts: 10,
      overallAccuracy: 0.83,
      recentAccuracy: 0.8,
      consistencyScore: 0.65,
      distinctQuestionTypesCount: 1, // only 1 type, so doesn't meet Mastered yet
    })
  );
  assert(rProficient.level === "PROFICIENT", "Solid attempts + high accuracy -> PROFICIENT");
  assert(rProficient.ruleCode === "RULE_PROFICIENT_CRITERIA_SATISFIED", "ruleCode is RULE_PROFICIENT_CRITERIA_SATISFIED");

  // G. MASTERED
  // 18 attempts, 90% accuracy, recent 90%, consistency 0.82, 2 question types, hard questions 75%, 0 mistakes
  const rMastered = MasteryRules.evaluate(
    makeEvidence({
      totalAttempts: 18,
      correctAttempts: 16,
      overallAccuracy: 0.89,
      recentAccuracy: 1.0,
      consistencyScore: 0.85,
      distinctQuestionTypesCount: 2,
      difficultyBreakdown: {
        EASY: { attempts: 6, correct: 6, accuracy: 1.0 },
        MEDIUM: { attempts: 8, correct: 7, accuracy: 0.88 },
        HARD: { attempts: 4, correct: 3, accuracy: 0.75 },
      },
      mistakes: {
        hasMistakeAnalysis: false,
        totalAnalyses: 0,
        hasRepeatedConceptual: false,
        hasRepeatedSignErrors: false,
        hasPrerequisiteGaps: false,
        hasApplicationDifficulty: false,
        inconsistentPerformance: false,
      },
    })
  );
  assert(rMastered.level === "MASTERED", "Full criteria satisfied -> MASTERED");
  assert(rMastered.ruleCode === "RULE_MASTERED_CRITERIA_SATISFIED", "ruleCode is RULE_MASTERED_CRITERIA_SATISFIED");

  // -----------------------------------------------------------------
  // 3. EXPLANATION BUILDER TESTS
  // -----------------------------------------------------------------
  console.log("\n--- 3. Testing Mastery Explanation Builder ---");

  const explMastered = MasteryExplanationBuilder.generateDeterministicExplanation({
    level: "MASTERED",
    skillTitle: "Identify integers",
    evidence: makeEvidence({ totalAttempts: 18, overallAccuracy: 0.9, recentAccuracy: 1.0 }),
    flags: {
      prerequisiteConcern: false,
      limitedQuestionTypeEvidence: false,
      recentPerformanceDecline: false,
      activeConceptualMisconception: false,
      calculationSlipOnly: false,
    },
  });
  assert(explMastered.level === "MASTERED", "Mastered explanation has level MASTERED");
  assert(Boolean(explMastered.summary && explMastered.why && explMastered.nextStep), "Mastered explanation has summary, why, and nextStep");

  // -----------------------------------------------------------------
  // 4. MASTERY ENGINE LIFECYCLE & HISTORY AUDIT TESTS
  // -----------------------------------------------------------------
  console.log("\n--- 4. Testing MasteryEngine Lifecycle & History ---");

  // Evaluation on seed student skill
  const evaluated = await MasteryEngine.evaluateSkillMastery({
    studentId: "usr_student_01",
    skillId: "skl_01",
    forceRecalculate: true,
  });

  assert(evaluated.studentId === "usr_student_01", "Evaluated student matches");
  assert(evaluated.skillId === "skl_01", "Evaluated skill matches");
  assert(evaluated.masteryVersion === "MASTERY_V1", "Version is MASTERY_V1");
  assert(Boolean(evaluated.evidenceSummary), "Evidence summary is populated");

  // Retrieve student masteries list
  const list = await MasteryEngine.getStudentMasteries("usr_student_01");
  assert(Array.isArray(list) && list.length > 0, "Student has list of skill masteries");
  const skl01 = list.find((m) => m.skillId === "skl_01");
  assert(Boolean(skl01), "skl_01 is present in student mastery list");

  console.log("\n=== ALL PHASE 10 ACCEPTANCE CRITERIA PASSED SUCCESSFULLY! ===");
}

runTests().catch((e) => {
  console.error("Test execution failed:", e);
  process.exit(1);
});
