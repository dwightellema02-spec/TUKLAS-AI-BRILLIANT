/**
 * Phase 9: Deterministic Adaptive Decision Rules
 *
 * Implements strict, pedagogical, and explainable rule heuristics
 * based on collected student evidence. Pure function evaluation.
 */

import { ADAPTIVE_CONFIG } from "@/config/adaptive-learning";
import { DifficultyAdjuster } from "./difficulty-adjuster";
import { PrerequisiteChecker } from "./prerequisite-checker";
import type {
  AdaptiveEvidenceBundle,
  RuleEvaluationResult,
  QuestionDifficulty,
} from "./adaptive-types";

export class AdaptiveDecisionRules {
  /**
   * Evaluate the complete evidence bundle through prioritized deterministic rules
   */
  static evaluate(bundle: AdaptiveEvidenceBundle): RuleEvaluationResult {
    const { practice, mistake, skill } = bundle;

    // -------------------------------------------------------------
    // RULE 1: INSUFFICIENT EVIDENCE
    // If student has fewer attempts than required for a statistically valid sample
    // -------------------------------------------------------------
    if (practice.totalAttempts < ADAPTIVE_CONFIG.minimumAttemptsForAdaptation) {
      return {
        decisionType: "INSUFFICIENT_EVIDENCE",
        confidence: "LOW",
        ruleCode: "RULE_INSUFFICIENT_EVIDENCE",
        ruleDescription: `Only ${practice.totalAttempts} attempts logged. Additional practice is needed to determine an adaptive trajectory.`,
        targetDifficulty: "EASY",
        recommendedActivityType: "PRACTICE_SET",
        requiresRemediation: false,
      };
    }

    // -------------------------------------------------------------
    // RULE 2: PREREQUISITE WEAKNESS DETECTION
    // If mistake analysis flagged PREREQUISITE_GAP or prerequisite DAG accuracy < 50%
    // -------------------------------------------------------------
    const weakestPrereq = PrerequisiteChecker.identifyWeakestPrerequisite(skill);
    if (mistake.prerequisiteGap || weakestPrereq) {
      const prereqId = weakestPrereq?.prerequisiteSkillId;
      const prereqTitle = weakestPrereq?.prerequisiteTitle || "Prerequisite Concept";
      return {
        decisionType: "REVIEW_PREREQUISITE",
        confidence: "HIGH",
        ruleCode: "RULE_PREREQUISITE_GAP",
        ruleDescription: `Identified foundational difficulty in prerequisite skill "${prereqTitle}". Reviewing this prerequisite will unlock current progress.`,
        weakPrerequisiteSkillId: prereqId,
        weakPrerequisiteTitle: prereqTitle,
        recommendedActivityType: "PREREQUISITE_LESSON",
        requiresRemediation: true,
      };
    }

    // -------------------------------------------------------------
    // RULE 3: REPEATED CONCEPTUAL MISUNDERSTANDING / SIGN ERROR
    // If accuracy is poor (<60%) AND there is a confirmed conceptual gap or repeated sign misconception
    // -------------------------------------------------------------
    if (
      practice.accuracy < ADAPTIVE_CONFIG.lowAccuracyThreshold &&
      (mistake.repeatedSignErrors || mistake.conceptualGap)
    ) {
      const topicDetail = mistake.repeatedSignErrors
        ? "sign application rules"
        : "underlying conceptual models";

      return {
        decisionType: "REMEDIATE",
        confidence: "HIGH",
        ruleCode: "RULE_CONCEPTUAL_REMEDIATION",
        ruleDescription: `Persistent difficulties detected with ${topicDetail}. Guided review and structured practice are recommended.`,
        targetDifficulty: "EASY",
        recommendedActivityType: "LESSON_REVIEW",
        requiresRemediation: true,
      };
    }

    // -------------------------------------------------------------
    // RULE 4: LOW RECENT ACCURACY -> PRACTICE EASIER
    // Accuracy is below 60%, but not necessarily a systemic misconception
    // -------------------------------------------------------------
    if (practice.accuracy < ADAPTIVE_CONFIG.lowAccuracyThreshold) {
      // Check if student relies heavily on hints
      const isHighHint = practice.hintUsageCount >= ADAPTIVE_CONFIG.highHintUsageThreshold;
      const hintNote = isHighHint ? " alongside frequent hint requests" : "";

      return {
        decisionType: "PRACTICE_EASIER",
        confidence: "MEDIUM",
        ruleCode: "RULE_PRACTICE_EASIER",
        ruleDescription: `Recent accuracy is ${Math.round(practice.accuracy * 100)}%${hintNote}. Building confidence with foundational questions will solidify technique.`,
        targetDifficulty: "EASY",
        recommendedActivityType: "PRACTICE_SET",
        requiresRemediation: false,
      };
    }

    // -------------------------------------------------------------
    // RULE 5: CONSISTENT STRONG PERFORMANCE -> PRACTICE HARDER
    // Accuracy >= 85%, few hints, ready for greater challenge
    // Note: Does NOT declare mastery (Phase 10 boundary)
    // -------------------------------------------------------------
    if (practice.accuracy >= ADAPTIVE_CONFIG.highAccuracyThreshold) {
      // Compute difficulty step
      const currentLevel: QuestionDifficulty =
        practice.difficultyCounts.HARD.total > 0
          ? "HARD"
          : practice.difficultyCounts.MEDIUM.total > 0
          ? "MEDIUM"
          : "EASY";

      const diffResult = DifficultyAdjuster.computeTargetDifficulty(
        currentLevel,
        practice,
        mistake
      );

      return {
        decisionType: "PRACTICE_HARDER",
        confidence: "HIGH",
        ruleCode: "RULE_PRACTICE_HARDER",
        ruleDescription: `High accuracy of ${Math.round(practice.accuracy * 100)}% demonstrates ready competence. Advancing to ${diffResult.targetDifficulty} questions.`,
        targetDifficulty: diffResult.targetDifficulty,
        recommendedActivityType: "PRACTICE_SET",
        requiresRemediation: false,
      };
    }

    // -------------------------------------------------------------
    // RULE 6: MODERATE / DEVELOPING PERFORMANCE -> PRACTICE SAME DIFFICULTY
    // Accuracy between 60% and 84%
    // -------------------------------------------------------------
    if (
      practice.accuracy >= ADAPTIVE_CONFIG.lowAccuracyThreshold &&
      practice.accuracy < ADAPTIVE_CONFIG.highAccuracyThreshold
    ) {
      const trendNote =
        practice.recentTrend === "IMPROVING"
          ? "Performance is improving steadily."
          : practice.recentTrend === "DECLINING"
          ? "Performance shows minor inconsistency."
          : "Performance is consistent.";

      return {
        decisionType: "PRACTICE_SAME_DIFFICULTY",
        confidence: "MEDIUM",
        ruleCode: "RULE_PRACTICE_SAME_DIFFICULTY",
        ruleDescription: `Accuracy of ${Math.round(practice.accuracy * 100)}% indicates healthy developing progress. ${trendNote} Continuing at current difficulty.`,
        targetDifficulty: "MEDIUM",
        recommendedActivityType: "PRACTICE_SET",
        requiresRemediation: false,
      };
    }

    // -------------------------------------------------------------
    // RULE 7: DEFAULT CONTINUE PATH
    // -------------------------------------------------------------
    return {
      decisionType: "CONTINUE",
      confidence: "MEDIUM",
      ruleCode: "RULE_CONTINUE_PATH",
      ruleDescription: "Continue through regular lesson progression and formative activities.",
      targetDifficulty: "MEDIUM",
      recommendedActivityType: "CONTINUE_PATH",
      requiresRemediation: false,
    };
  }
}
