/**
 * Phase 9: Difficulty Adjuster
 *
 * Implements deterministic transition logic between EASY, MEDIUM, and HARD
 * question difficulties based on student accuracy, hint reliance, and mistake taxonomy.
 */

import type { QuestionDifficulty } from "@prisma/client";
import { ADAPTIVE_CONFIG } from "@/config/adaptive-learning";
import type { PracticeEvidence, MistakeEvidence } from "./adaptive-types";

export class DifficultyAdjuster {
  private static readonly LEVELS: QuestionDifficulty[] = ["EASY", "MEDIUM", "HARD"];

  /**
   * Determine whether difficulty should step up, step down, or remain steady
   */
  static computeTargetDifficulty(
    currentDifficulty: QuestionDifficulty = "MEDIUM",
    practice: PracticeEvidence,
    mistake: MistakeEvidence
  ): {
    targetDifficulty: QuestionDifficulty;
    adjusted: boolean;
    direction: "UP" | "DOWN" | "SAME";
    rationale: string;
  } {
    const currentIndex = this.LEVELS.indexOf(currentDifficulty);
    const validCurrentIndex = currentIndex !== -1 ? currentIndex : 1; // Default to MEDIUM

    // 1. Check for Insufficient Attempts
    if (practice.totalAttempts < ADAPTIVE_CONFIG.minimumAttemptsForAdaptation) {
      return {
        targetDifficulty: currentDifficulty,
        adjusted: false,
        direction: "SAME",
        rationale: `Retaining current difficulty (${currentDifficulty}) until at least ${ADAPTIVE_CONFIG.minimumAttemptsForAdaptation} attempts are logged.`,
      };
    }

    // 2. High Accuracy Path -> Consider step UP
    if (practice.accuracy >= ADAPTIVE_CONFIG.highAccuracyThreshold) {
      if (validCurrentIndex < this.LEVELS.length - 1) {
        const nextDifficulty = this.LEVELS[validCurrentIndex + 1];
        return {
          targetDifficulty: nextDifficulty,
          adjusted: true,
          direction: "UP",
          rationale: `High recent accuracy of ${Math.round(practice.accuracy * 100)}% demonstrates readiness for ${nextDifficulty} questions.`,
        };
      }
      return {
        targetDifficulty: "HARD",
        adjusted: false,
        direction: "SAME",
        rationale: `Maintaining top tier HARD difficulty with strong ${Math.round(practice.accuracy * 100)}% accuracy.`,
      };
    }

    // 3. Low Accuracy Path -> Evaluate step DOWN or REMEDIATION
    if (practice.accuracy < ADAPTIVE_CONFIG.lowAccuracyThreshold) {
      // Pedagogical nuance: if mistake is strictly calculation error and NOT conceptual,
      // don't drop difficulty precipitously; keep at same level to reinforce careful calculation.
      if (mistake.calculationErrorOnly && !mistake.conceptualGap && !mistake.repeatedSignErrors) {
        return {
          targetDifficulty: currentDifficulty,
          adjusted: false,
          direction: "SAME",
          rationale: `Conceptual understanding is present despite arithmetic slips. Keeping ${currentDifficulty} to build precision.`,
        };
      }

      if (validCurrentIndex > 0) {
        const prevDifficulty = this.LEVELS[validCurrentIndex - 1];
        return {
          targetDifficulty: prevDifficulty,
          adjusted: true,
          direction: "DOWN",
          rationale: `Recent accuracy of ${Math.round(practice.accuracy * 100)}% indicates benefit from reinforcing concepts at ${prevDifficulty} level.`,
        };
      }

      return {
        targetDifficulty: "EASY",
        adjusted: false,
        direction: "SAME",
        rationale: `Maintaining baseline EASY practice while targeting fundamental conceptual building blocks.`,
      };
    }

    // 4. Moderate Accuracy Path (60% - 84%) -> Maintain Steady
    return {
      targetDifficulty: currentDifficulty,
      adjusted: false,
      direction: "SAME",
      rationale: `Stable progress with ${Math.round(practice.accuracy * 100)}% accuracy. Continuing practice at ${currentDifficulty} level.`,
    };
  }

  /**
   * Helper to safely step down difficulty
   */
  static stepDown(difficulty: QuestionDifficulty): QuestionDifficulty {
    if (difficulty === "HARD") return "MEDIUM";
    return "EASY";
  }

  /**
   * Helper to safely step up difficulty
   */
  static stepUp(difficulty: QuestionDifficulty): QuestionDifficulty {
    if (difficulty === "EASY") return "MEDIUM";
    return "HARD";
  }
}
