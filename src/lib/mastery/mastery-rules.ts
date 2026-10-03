/**
 * Tuklas AI - Mastery Decision Rules
 * Phase 10: Deterministic Rule Engine for Multi-dimensional Mastery Status
 */

import { MASTERY_CONFIG } from "@/config/mastery-learning";
import type { MasteryEvidenceBundle, MasteryLevel } from "./mastery-types";

export interface EvaluatedRuleOutcome {
  level: MasteryLevel;
  ruleCode: string;
  ruleDescription: string;
  evidenceSummary: string;
  flags: {
    prerequisiteConcern: boolean;
    limitedQuestionTypeEvidence: boolean;
    recentPerformanceDecline: boolean;
    activeConceptualMisconception: boolean;
    calculationSlipOnly: boolean;
  };
}

export class MasteryRules {
  /**
   * Apply transparent, evidence-based deterministic rules to evaluate mastery level
   */
  static evaluate(evidence: MasteryEvidenceBundle): EvaluatedRuleOutcome {
    const {
      totalAttempts,
      overallAccuracy,
      recentAccuracy,
      historicalAccuracy,
      consistencyScore,
      distinctQuestionTypesCount,
      difficultyBreakdown,
      mistakes,
      hasPrerequisiteConcern,
      applicationScore,
    } = evidence;

    const flags = {
      prerequisiteConcern: hasPrerequisiteConcern,
      limitedQuestionTypeEvidence:
        distinctQuestionTypesCount < MASTERY_CONFIG.minimumQuestionTypeDiversityForMastered,
      recentPerformanceDecline:
        totalAttempts >= MASTERY_CONFIG.minimumAttemptsForDeveloping &&
        recentAccuracy < MASTERY_CONFIG.recentPerformanceDeclineThreshold &&
        historicalAccuracy >= 0.70,
      activeConceptualMisconception: mistakes.hasRepeatedConceptual,
      calculationSlipOnly:
        mistakes.hasMistakeAnalysis &&
        !mistakes.hasRepeatedConceptual &&
        mistakes.primaryCategory === "CALCULATION_ERROR",
    };

    // -------------------------------------------------------------
    // RULE 1: NOT_STARTED
    // If student has 0 attempts recorded
    // -------------------------------------------------------------
    if (totalAttempts === 0) {
      return {
        level: "NOT_STARTED",
        ruleCode: "RULE_NOT_STARTED",
        ruleDescription: "No practice or checkpoint attempts logged for this skill.",
        evidenceSummary: "0 attempts recorded. Skill learning has not yet commenced.",
        flags,
      };
    }

    // -------------------------------------------------------------
    // RULE 2: LEARNING (Early Phase / Sparse Evidence)
    // Fewer than 5 attempts logged
    // -------------------------------------------------------------
    if (totalAttempts < MASTERY_CONFIG.minimumAttemptsForDeveloping) {
      return {
        level: "LEARNING",
        ruleCode: "RULE_INSUFFICIENT_FOR_DEVELOPING",
        ruleDescription: `Only ${totalAttempts} attempt(s) recorded (< ${MASTERY_CONFIG.minimumAttemptsForDeveloping} required). Initial learning phase.`,
        evidenceSummary: `${totalAttempts} attempts with ${Math.round(overallAccuracy * 100)}% accuracy. More practice required for developing assessment.`,
        flags,
      };
    }

    // -------------------------------------------------------------
    // RULE 3: PERFORMANCE DECLINE (Recent window drop from high historical)
    // If student had good performance historically (>= 70%) but recent dropped
    // -------------------------------------------------------------
    if (flags.recentPerformanceDecline) {
      return {
        level: "DEVELOPING",
        ruleCode: "RULE_RECENT_PERFORMANCE_DECLINE",
        ruleDescription: `Recent accuracy dropped to ${Math.round(recentAccuracy * 100)}% (historical: ${Math.round(historicalAccuracy * 100)}%). Reverted to DEVELOPING for reinforcement.`,
        evidenceSummary: `${totalAttempts} attempts. Historical: ${Math.round(historicalAccuracy * 100)}%, Recent: ${Math.round(recentAccuracy * 100)}%. Needs reinforcement.`,
        flags,
      };
    }

    // -------------------------------------------------------------
    // RULE 4: LEARNING (Low Accuracy)
    // Overall accuracy is under 60% or recent accuracy is under 50%
    // -------------------------------------------------------------
    if (overallAccuracy < MASTERY_CONFIG.developingAccuracyThreshold || recentAccuracy < 0.50) {
      return {
        level: "LEARNING",
        ruleCode: "RULE_LOW_ACCURACY_LEARNING",
        ruleDescription: `Accuracy of ${Math.round(overallAccuracy * 100)}% indicates foundational understanding is still forming.`,
        evidenceSummary: `${totalAttempts} attempts, ${Math.round(overallAccuracy * 100)}% accuracy. Recent: ${Math.round(recentAccuracy * 100)}%. Requires guided review.`,
        flags,
      };
    }

    // -------------------------------------------------------------
    // RULE 5: CHECK MASTERED CRITERIA
    // High bar: >=15 attempts, >=85% overall & recent, high consistency, diverse types, no recurring misconceptions
    // -------------------------------------------------------------
    const hardAttempts = difficultyBreakdown["HARD"]?.attempts || 0;
    const hardAccuracy = difficultyBreakdown["HARD"]?.accuracy || 0.0;
    const passesHardCriteria =
      hardAttempts === 0 || hardAccuracy >= MASTERY_CONFIG.minimumHardQuestionPerformance;

    const meetsMasteredAttempts = totalAttempts >= MASTERY_CONFIG.minimumAttemptsForMastered;
    const meetsMasteredAccuracy =
      overallAccuracy >= MASTERY_CONFIG.masteredAccuracyThreshold &&
      recentAccuracy >= MASTERY_CONFIG.recentAccuracyMasteredThreshold;
    const meetsMasteredConsistency =
      consistencyScore >= MASTERY_CONFIG.masteredConsistencyThreshold;
    const meetsTypeDiversity =
      distinctQuestionTypesCount >= MASTERY_CONFIG.minimumQuestionTypeDiversityForMastered;
    const meetsMistakeCriteria =
      !mistakes.hasRepeatedConceptual && !mistakes.hasRepeatedSignErrors;

    if (
      meetsMasteredAttempts &&
      meetsMasteredAccuracy &&
      meetsMasteredConsistency &&
      meetsTypeDiversity &&
      passesHardCriteria &&
      meetsMistakeCriteria
    ) {
      return {
        level: "MASTERED",
        ruleCode: "RULE_MASTERED_CRITERIA_SATISFIED",
        ruleDescription: "Demonstrates consistent, highly accurate, repeatable mastery across varied question formats and difficulty bands.",
        evidenceSummary: `${totalAttempts} attempts | Overall: ${Math.round(overallAccuracy * 100)}% | Recent: ${Math.round(recentAccuracy * 100)}% | Consistency: ${Math.round(consistencyScore * 100)}% | Types: ${distinctQuestionTypesCount} | No recurring misconceptions.`,
        flags,
      };
    }

    // -------------------------------------------------------------
    // RULE 6: PROFICIENT
    // >=10 attempts, >=80% overall accuracy, >=75% recent, moderate consistency
    // -------------------------------------------------------------
    const meetsProficientAttempts = totalAttempts >= MASTERY_CONFIG.minimumAttemptsForProficient;
    const meetsProficientAccuracy =
      overallAccuracy >= MASTERY_CONFIG.proficientAccuracyThreshold && recentAccuracy >= 0.70;
    const meetsProficientConsistency =
      consistencyScore >= MASTERY_CONFIG.proficientConsistencyThreshold;

    if (
      meetsProficientAttempts &&
      meetsProficientAccuracy &&
      meetsProficientConsistency &&
      !mistakes.hasRepeatedConceptual
    ) {
      // Note reasons why not yet MASTERED
      let pendingNote = "";
      if (!meetsMasteredAttempts) {
        pendingNote = `Needs ${MASTERY_CONFIG.minimumAttemptsForMastered - totalAttempts} more attempts for Mastered.`;
      } else if (!meetsMasteredConsistency) {
        pendingNote = `Consistency score (${Math.round(consistencyScore * 100)}%) is progressing toward 75% threshold.`;
      } else if (!meetsTypeDiversity) {
        pendingNote = "Requires practice across multiple question formats.";
      } else if (mistakes.hasRepeatedSignErrors) {
        pendingNote = "Minor sign errors still detected in recent attempts.";
      }

      return {
        level: "PROFICIENT",
        ruleCode: "RULE_PROFICIENT_CRITERIA_SATISFIED",
        ruleDescription: `Solid, repeatable understanding with ${Math.round(overallAccuracy * 100)}% accuracy and consistent execution. ${pendingNote}`,
        evidenceSummary: `${totalAttempts} attempts | Overall: ${Math.round(overallAccuracy * 100)}% | Recent: ${Math.round(recentAccuracy * 100)}% | Consistency: ${Math.round(consistencyScore * 100)}% | Status: Proficient.`,
        flags,
      };
    }

    // -------------------------------------------------------------
    // RULE 7: DEVELOPING (Default for 5+ attempts with 60%+ accuracy)
    // Shows partial understanding but still demonstrates meaningful errors or inconsistency
    // -------------------------------------------------------------
    let reasonText = `Accuracy of ${Math.round(overallAccuracy * 100)}% indicates partial understanding.`;
    if (mistakes.hasRepeatedSignErrors) {
      reasonText += " Repeated sign errors need targeted focus.";
    } else if (mistakes.hasRepeatedConceptual) {
      reasonText += " Conceptual gaps identified during recent practice.";
    } else if (consistencyScore < MASTERY_CONFIG.proficientConsistencyThreshold) {
      reasonText += " Performance shows variability across attempts.";
    }

    return {
      level: "DEVELOPING",
      ruleCode: "RULE_DEVELOPING",
      ruleDescription: reasonText,
      evidenceSummary: `${totalAttempts} attempts | Overall: ${Math.round(overallAccuracy * 100)}% | Recent: ${Math.round(recentAccuracy * 100)}% | Consistency: ${Math.round(consistencyScore * 100)}%.`,
      flags,
    };
  }
}
