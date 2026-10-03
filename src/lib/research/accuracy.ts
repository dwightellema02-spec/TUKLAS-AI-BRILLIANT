/**
 * Tuklas AI - Accuracy Research Metric Calculation
 * Phase 14: Deterministic Accuracy Calculation
 */

import { RESEARCH_CONFIG } from "./research-config";
import type { ResearchMetricResult } from "./research-types";

export interface AccuracyCalculationInput {
  attempts: Array<{
    isCorrect: boolean;
    attemptNumber?: number;
    hintUsed?: boolean;
    timeTakenMs?: number | null;
    questionId?: string;
    skillId?: string | null;
    lessonId?: string | null;
    difficulty?: string | null;
    questionType?: string | null;
    submittedAt?: Date | string;
    isAbandoned?: boolean;
  }>;
  minAttempts?: number;
}

export class AccuracyCalculator {
  /**
   * Deterministically calculate student accuracy metric
   */
  static calculate(input: AccuracyCalculationInput): ResearchMetricResult {
    const minThreshold = input.minAttempts ?? RESEARCH_CONFIG.thresholds.minAttemptsForAccuracy;

    // Filter valid scored attempts (exclude abandoned or system errors)
    const validAttempts = input.attempts.filter((a) => !a.isAbandoned);
    const totalCount = validAttempts.length;

    if (totalCount < minThreshold) {
      return {
        metric: "ACCURACY",
        value: 0,
        level: "INSUFFICIENT_EVIDENCE",
        confidence: totalCount / minThreshold,
        evidenceCount: totalCount,
        calculationVersion: RESEARCH_CONFIG.version,
        calculatedAt: new Date().toISOString(),
        summary: `Insufficient evidence to determine accuracy (${totalCount}/${minThreshold} required attempts recorded).`,
        evidence: {
          totalAttempts: totalCount,
          correctAttempts: validAttempts.filter((a) => a.isCorrect).length,
          details: `Requires at least ${minThreshold} valid scored attempts. Recorded ${totalCount}.`,
        },
      };
    }

    const correctCount = validAttempts.filter((a) => a.isCorrect).length;
    const accuracyRatio = Number((correctCount / totalCount).toFixed(4));
    const level = RESEARCH_CONFIG.resolveMetricLevel(accuracyRatio, totalCount, minThreshold);

    // Confidence scales with evidence sample size up to 1.0 at 10 attempts
    const confidence = Number(Math.min(1.0, 0.6 + (totalCount / 25)).toFixed(2));

    return {
      metric: "ACCURACY",
      value: accuracyRatio,
      level,
      confidence,
      evidenceCount: totalCount,
      calculationVersion: RESEARCH_CONFIG.version,
      calculatedAt: new Date().toISOString(),
      summary: `Observed accuracy of ${(accuracyRatio * 100).toFixed(1)}% based on ${correctCount} correct out of ${totalCount} valid attempts (${level}).`,
      evidence: {
        totalAttempts: totalCount,
        correctAttempts: correctCount,
        details: `${correctCount} correct out of ${totalCount} valid attempts.`,
      },
    };
  }
}
