/**
 * Tuklas AI - Mastery Calculator
 * Phase 10: Multi-dimensional mathematical computations
 *
 * Implements deterministic calculation for:
 * 1. Overall & Recent Accuracy
 * 2. Longitudinal Performance Consistency
 * 3. Application Performance Index
 */

import { MASTERY_CONFIG } from "@/config/mastery-learning";
import type { DifficultyStats, QuestionTypeStats } from "./mastery-types";

export class MasteryCalculator {
  /**
   * Calculate accuracy as a float [0.0, 1.0]
   */
  static calculateAccuracy(correct: number, total: number): number {
    if (total <= 0) return 0.0;
    const acc = correct / total;
    return Math.round(Math.min(1.0, Math.max(0.0, acc)) * 100) / 100;
  }

  /**
   * Calculate consecutive correct answers from the most recent attempts backward
   */
  static calculateConsecutiveCorrect(attemptsChronologicalDesc: Array<{ isCorrect: boolean }>): number {
    let count = 0;
    for (const att of attemptsChronologicalDesc) {
      if (att.isCorrect) count++;
      else break;
    }
    return count;
  }

  /**
   * Calculate consecutive incorrect answers from the most recent attempts backward
   */
  static calculateConsecutiveIncorrect(attemptsChronologicalDesc: Array<{ isCorrect: boolean }>): number {
    let count = 0;
    for (const att of attemptsChronologicalDesc) {
      if (!att.isCorrect) count++;
      else break;
    }
    return count;
  }

  /**
   * Calculate Consistency Index (0.0 to 1.0)
   *
   * Consistency is determined by:
   * 1. Run stability: Fewer erratic alternating flips (Correct -> Wrong -> Correct -> Wrong)
   * 2. Variance across difficulty bands: Strong consistent performance across EASY and MEDIUM
   * 3. Hint dependency factor: Heavy hint usage lowers consistency score
   */
  static calculateConsistencyScore(params: {
    attemptsChronologicalAsc: Array<{ isCorrect: boolean; hintUsed?: boolean }>;
    difficultyBreakdown: Record<string, DifficultyStats>;
    recentAccuracy: number;
    overallAccuracy: number;
  }): number {
    const { attemptsChronologicalAsc, difficultyBreakdown, recentAccuracy, overallAccuracy } = params;
    const total = attemptsChronologicalAsc.length;
    if (total < 2) return 0.0;

    // Component A: Flip rate penalty (alternating between correct and wrong)
    let flips = 0;
    for (let i = 1; i < total; i++) {
      if (attemptsChronologicalAsc[i].isCorrect !== attemptsChronologicalAsc[i - 1].isCorrect) {
        flips++;
      }
    }
    const maxFlips = total - 1;
    const flipRatio = maxFlips > 0 ? flips / maxFlips : 0;
    // Lower flips means higher run stability (e.g. streaks of correct answers)
    const stabilityScore = Math.max(0.0, 1.0 - flipRatio * 0.7);

    // Component B: Recent vs Overall alignment
    // Large divergence (e.g. 90% overall but 40% recent) penalizes consistency
    const divergence = Math.abs(recentAccuracy - overallAccuracy);
    const alignmentScore = Math.max(0.0, 1.0 - divergence * 1.2);

    // Component C: Hint independence
    const hintsUsed = attemptsChronologicalAsc.filter((a) => a.hintUsed).length;
    const hintRatio = hintsUsed / total;
    const independenceScore = Math.max(0.0, 1.0 - hintRatio * 0.5);

    // Component D: Difficulty cross-performance
    let difficultyScore = 1.0;
    const easy = difficultyBreakdown["EASY"];
    const medium = difficultyBreakdown["MEDIUM"];
    if (easy && easy.attempts > 0 && medium && medium.attempts > 0) {
      // If easy is very high but medium is zero, moderate consistency
      const diffGap = Math.max(0, easy.accuracy - medium.accuracy);
      difficultyScore = Math.max(0.4, 1.0 - diffGap * 0.6);
    }

    // Weighted composite
    const raw =
      stabilityScore * 0.35 +
      alignmentScore * 0.25 +
      independenceScore * 0.20 +
      difficultyScore * 0.20;

    return Math.round(Math.min(1.0, Math.max(0.0, raw)) * 100) / 100;
  }

  /**
   * Calculate Application Score (0.0 to 1.0)
   *
   * Evaluates higher-order question performance:
   * - NUMERIC_INPUT, EQUATION, ORDERING, MATCHING (beyond passive MULTIPLE_CHOICE)
   * - Questions flagged as application or word problems
   */
  static calculateApplicationScore(params: {
    attempts: Array<{
      isCorrect: boolean;
      questionType?: string;
      difficulty?: string;
    }>;
  }): number {
    const { attempts } = params;
    if (attempts.length === 0) return 0.0;

    // Filter application-heavy questions
    const applicationAttempts = attempts.filter((a) => {
      const type = a.questionType || "MULTIPLE_CHOICE";
      return (
        type === "NUMERIC_INPUT" ||
        type === "EQUATION" ||
        type === "ORDERING" ||
        type === "MATCHING" ||
        a.difficulty === "HARD"
      );
    });

    if (applicationAttempts.length === 0) {
      // If no application questions have been attempted, return conservative estimate
      // based on general accuracy scaled down
      const totalCorrect = attempts.filter((a) => a.isCorrect).length;
      return Math.round((totalCorrect / attempts.length) * 0.7 * 100) / 100;
    }

    const correct = applicationAttempts.filter((a) => a.isCorrect).length;
    return this.calculateAccuracy(correct, applicationAttempts.length);
  }
}
