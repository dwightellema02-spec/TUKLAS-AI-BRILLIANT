/**
 * Tuklas AI - Consistency Research Metric Calculation
 * Phase 14: Stability & Longitudinal Performance Analysis
 */

import { RESEARCH_CONFIG } from "./research-config";
import type { ResearchMetricResult } from "./research-types";

export interface ConsistencyCalculationInput {
  attempts: Array<{
    isCorrect: boolean;
    submittedAt?: Date | string;
    attemptNumber?: number;
    score?: number;
  }>;
  minAttempts?: number;
}

export class ConsistencyCalculator {
  /**
   * Deterministically calculate performance consistency across attempts
   */
  static calculate(input: ConsistencyCalculationInput): ResearchMetricResult {
    const minThreshold = input.minAttempts ?? RESEARCH_CONFIG.thresholds.minAttemptsForConsistency;
    const attempts = input.attempts || [];
    const totalCount = attempts.length;

    if (totalCount < minThreshold) {
      return {
        metric: "CONSISTENCY",
        value: 0,
        level: "INSUFFICIENT_EVIDENCE",
        confidence: totalCount / minThreshold,
        evidenceCount: totalCount,
        calculationVersion: RESEARCH_CONFIG.version,
        calculatedAt: new Date().toISOString(),
        summary: `Insufficient evidence to determine performance consistency (${totalCount}/${minThreshold} attempts recorded).`,
        evidence: {
          totalAttempts: totalCount,
          correctAttempts: attempts.filter((a) => a.isCorrect).length,
          details: `Requires at least ${minThreshold} sequential attempts over time to evaluate longitudinal stability.`,
        },
      };
    }

    // 1. Calculate accuracy across window segments
    const windowSize = Math.max(2, Math.floor(totalCount / 3));
    const segmentAccuracies: number[] = [];

    for (let i = 0; i <= totalCount - windowSize; i += windowSize) {
      const slice = attempts.slice(i, i + windowSize);
      const correct = slice.filter((a) => a.isCorrect).length;
      segmentAccuracies.push(correct / slice.length);
    }

    // 2. Compute variance between segments
    const meanAccuracy =
      segmentAccuracies.reduce((acc, v) => acc + v, 0) / Math.max(1, segmentAccuracies.length);

    const variance =
      segmentAccuracies.reduce((acc, v) => acc + Math.pow(v - meanAccuracy, 2), 0) /
      Math.max(1, segmentAccuracies.length);

    const stdDev = Math.sqrt(variance);

    // 3. Streak Stability factor
    let longestStreak = 0;
    let currentStreak = 0;
    for (const a of attempts) {
      if (a.isCorrect) {
        currentStreak++;
        if (currentStreak > longestStreak) longestStreak = currentStreak;
      } else {
        currentStreak = 0;
      }
    }
    const streakFactor = Math.min(1.0, longestStreak / (totalCount * 0.6));

    // 4. Synthesize final consistency metric:
    // Base score = (1.0 - stdDev * 2.0) with streak bonus, scaled by mean accuracy
    const stabilityScore = Math.max(0.1, 1.0 - stdDev * 1.8);
    const overallConsistency =
      stabilityScore * 0.60 + streakFactor * 0.20 + meanAccuracy * 0.20;

    const finalValue = Number(Math.max(0.0, Math.min(1.0, overallConsistency)).toFixed(4));
    const level = RESEARCH_CONFIG.resolveMetricLevel(finalValue, totalCount, minThreshold);
    const confidence = Number(Math.min(1.0, 0.6 + (totalCount / 20)).toFixed(2));

    return {
      metric: "CONSISTENCY",
      value: finalValue,
      level,
      confidence,
      evidenceCount: totalCount,
      calculationVersion: RESEARCH_CONFIG.version,
      calculatedAt: new Date().toISOString(),
      summary: `Performance consistency of ${(finalValue * 100).toFixed(1)}% (${level}) with observed standard deviation of ${(stdDev * 100).toFixed(1)}% and max streak of ${longestStreak}.`,
      evidence: {
        totalAttempts: totalCount,
        correctAttempts: attempts.filter((a) => a.isCorrect).length,
        consistencyVariance: Number(variance.toFixed(4)),
        streakStability: longestStreak,
        details: `Standard deviation across attempts: ${(stdDev * 100).toFixed(1)}%. Maximum consecutive correct streak: ${longestStreak}.`,
      },
    };
  }
}
