/**
 * Phase 9: Centralized Adaptive Learning Configuration
 *
 * Defines deterministic thresholds, windows, and boundaries to ensure
 * predictable, research-aligned, and explainable student next-step recommendations.
 */

export interface AdaptiveLearningConfig {
  /** Minimum question attempts required before triggering active difficulty adjustments */
  minimumAttemptsForAdaptation: number;

  /** Number of recent attempts evaluated in sliding window */
  recentAttemptWindow: number;

  /** Accuracy percentage below which performance triggers easier practice or remediation (e.g. 0.60 = 60%) */
  lowAccuracyThreshold: number;

  /** Accuracy percentage threshold for advancing to harder practice (e.g. 0.85 = 85%) */
  highAccuracyThreshold: number;

  /** Accuracy percentage threshold for practicing at the same difficulty level (e.g. 0.70 = 70%) */
  moderateAccuracyThreshold: number;

  /** Minimum prerequisite accuracy before recommending prerequisite review */
  prerequisiteWeaknessThreshold: number;

  /** Number of repeated errors of the same mistake pattern that trigger remediation */
  repeatedMistakeThreshold: number;

  /** Number of hints per question that indicates struggle even if ultimately correct */
  highHintUsageThreshold: number;

  /** Maximum difficulty step changes per recommendation cycle */
  maxDifficultyIncrease: number;
  maxDifficultyDecrease: number;

  /** Duration in hours before an uncompleted recommendation expires */
  recommendationExpirationHours: number;

  /** Maximum days a recommendation remains active without fresh evidence */
  recommendationExpirationDays: number;
}

export const ADAPTIVE_CONFIG: AdaptiveLearningConfig = {
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
  recommendationExpirationDays: 7,
};
