/**
 * Tuklas AI - Research Analytics Configuration & Deterministic Thresholds
 * Phase 14: Centralized Thresholds & Data Versioning
 */

import type { ResearchMetricLevel } from "./research-types";

export const RESEARCH_CONFIG = {
  version: "RESEARCH_V1" as const,

  // Minimum required evidence thresholds
  thresholds: {
    minAttemptsForAccuracy: 3,
    minAttemptsForUnderstanding: 4,
    minAttemptsForApplication: 2,
    minAttemptsForConsistency: 5,
    minStudentsForClassroomAggregate: 2,
  },

  // Level classification thresholds (0.0 to 1.0)
  levels: {
    lowMax: 0.59, // 0.00 - 0.59
    developingMin: 0.60, // 0.60 - 0.74
    developingMax: 0.74,
    proficientMin: 0.75, // 0.75 - 0.89
    proficientMax: 0.89,
    highMin: 0.90, // 0.90 - 1.00
  },

  // Understanding Metric Component Weights
  understandingWeights: {
    baseAccuracyWeight: 0.50, // Accuracy without hint reliance
    checkpointWeight: 0.20, // Formative checkpoint score within lesson
    transferVarietyWeight: 0.15, // Demonstration across multiple question formats
    misconceptionPenaltyWeight: 0.15, // Penalty proportional to conceptual errors
  },

  // Consistency Metric Calculation Constants
  consistency: {
    maxVariancePenalty: 0.40, // Variance reduces score up to 40%
    streakRewardFactor: 0.20, // Consecutive correct boosts score
    recencyWeight: 0.40, // 40% weight on recent 5 attempts vs 60% historical
  },

  // Difficult Skill Flagging Criteria
  difficultSkillCriteria: {
    lowAccuracyThreshold: 0.65, // <65% average accuracy across cohort
    highHintRateThreshold: 0.40, // >40% of attempts requested hints
    minAttemptsToFlag: 5, // Requires at least 5 aggregate attempts
  },

  // Helper method to resolve level from numeric score (0.0 to 1.0)
  resolveMetricLevel(score: number, evidenceCount: number, minRequiredAttempts: number): ResearchMetricLevel {
    if (evidenceCount < minRequiredAttempts || isNaN(score)) {
      return "INSUFFICIENT_EVIDENCE";
    }
    if (score >= RESEARCH_CONFIG.levels.highMin) {
      return "HIGH";
    }
    if (score >= RESEARCH_CONFIG.levels.proficientMin) {
      return "PROFICIENT";
    }
    if (score >= RESEARCH_CONFIG.levels.developingMin) {
      return "DEVELOPING";
    }
    return "LOW";
  },
};
