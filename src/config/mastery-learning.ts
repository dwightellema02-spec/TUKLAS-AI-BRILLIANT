/**
 * Tuklas AI - Mastery Engine Configuration
 * Phase 10: Centralized Deterministic Thresholds & Parameters
 *
 * All mastery thresholds are declared here to ensure transparency,
 * repeatability, and easy calibration for research validation.
 * DO NOT hardcode or scatter these numbers across multiple files.
 */

export const MASTERY_CONFIG = {
  /** Current rule version identifier for longitudinal research integrity */
  masteryVersion: "MASTERY_V1",

  // -----------------------------------------------------------------
  // ATTEMPT THRESHOLDS
  // Rationale: A student cannot be declared proficient or mastered
  // on a fluke sample of 1 or 2 lucky guesses. Evidence must be sufficient.
  // -----------------------------------------------------------------
  /** Minimum attempts required to advance beyond NOT_STARTED to LEARNING */
  minimumAttemptsForLearning: 1,

  /** Minimum attempts required before a student can be classified as DEVELOPING */
  minimumAttemptsForDeveloping: 5,

  /** Minimum attempts required before a student can be classified as PROFICIENT */
  minimumAttemptsForProficient: 10,

  /** Minimum attempts required before a student can be considered for MASTERED */
  minimumAttemptsForMastered: 15,

  /** Recent window size (e.g. last N attempts) to capture current state */
  recentAttemptWindowSize: 5,

  // -----------------------------------------------------------------
  // ACCURACY THRESHOLDS (0.0 to 1.0)
  // Rationale: Realistic mathematical education benchmarks.
  // -----------------------------------------------------------------
  /** Accuracy ceiling for LEARNING state */
  learningAccuracyThreshold: 0.60,

  /** Accuracy range for DEVELOPING (0.60 to < 0.80) */
  developingAccuracyThreshold: 0.60,

  /** Overall accuracy required for PROFICIENT (>= 80%) */
  proficientAccuracyThreshold: 0.80,

  /** Overall accuracy required for MASTERED (>= 85%) */
  masteredAccuracyThreshold: 0.85,

  /** Recent accuracy required for MASTERED (must demonstrate >= 85% in recent window) */
  recentAccuracyMasteredThreshold: 0.85,

  /** Performance decline threshold: If recent accuracy drops below this, drop status */
  recentPerformanceDeclineThreshold: 0.55,

  // -----------------------------------------------------------------
  // CONSISTENCY & DIVERSITY THRESHOLDS
  // Rationale: Mastery requires repeatable success across question formats
  // and difficulty levels, not just memorizing one multiple-choice pattern.
  // -----------------------------------------------------------------
  /** Minimum consistency score for PROFICIENT (0.0 to 1.0) */
  proficientConsistencyThreshold: 0.55,

  /** Minimum consistency score for MASTERED (0.0 to 1.0) */
  masteredConsistencyThreshold: 0.75,

  /** Minimum application score (word problems / open response) for MASTERED (0.0 to 1.0) */
  masteredApplicationThreshold: 0.65,

  /** Minimum performance on HARD questions if approved HARD questions were attempted (0.0 to 1.0) */
  minimumHardQuestionPerformance: 0.60,

  /** Minimum question-type diversity count attempted for MASTERED (e.g. at least 2 distinct types) */
  minimumQuestionTypeDiversityForMastered: 2,

  // -----------------------------------------------------------------
  // MISTAKE & PREREQUISITE GOLDFIELDS
  // Rationale: A student with active repeated conceptual misunderstandings
  // or critical sign errors cannot be marked MASTERED.
  // -----------------------------------------------------------------
  /** Maximum allowable active recurring conceptual mistakes for MASTERED */
  maxConceptualMisunderstandingsForMastered: 0,

  /** Maximum allowable recurring sign errors for MASTERED */
  maxSignErrorsForMastered: 0,

  /** Prerequisite warning accuracy: If prerequisite skill accuracy is below this, flag concern */
  prerequisiteConcernThreshold: 0.65,

  // -----------------------------------------------------------------
  // CACHE & RECALCULATION POLICIES
  // -----------------------------------------------------------------
  /** Cache time-to-live in minutes before recalculating on demand */
  snapshotCacheMinutes: 30,
} as const;

export type MasteryConfig = typeof MASTERY_CONFIG;
