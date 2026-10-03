/**
 * Tuklas AI - Application Research Metric Calculation
 * Phase 14: Transfer & Application Evaluation
 */

import { RESEARCH_CONFIG } from "./research-config";
import type { CognitiveLevel, ResearchMetricResult } from "./research-types";

export interface ApplicationCalculationInput {
  attempts: Array<{
    isCorrect: boolean;
    cognitiveLevel?: CognitiveLevel | string | null;
    difficulty?: string | null;
    questionPrompt?: string;
  }>;
  minAttempts?: number;
}

export class ApplicationCalculator {
  /**
   * Deterministically calculate concept application and transfer metric
   */
  static calculate(input: ApplicationCalculationInput): ResearchMetricResult {
    const minThreshold = input.minAttempts ?? RESEARCH_CONFIG.thresholds.minAttemptsForApplication;

    // Filter attempts specifically addressing APPLICATION or HIGHER_ORDER transfer
    const applicationAttempts = input.attempts.filter((a) => {
      const level = (a.cognitiveLevel || "").toUpperCase();
      return level === "APPLICATION" || level === "HIGHER_ORDER";
    });

    const totalCount = applicationAttempts.length;

    if (totalCount < minThreshold) {
      return {
        metric: "APPLICATION",
        value: 0,
        level: "INSUFFICIENT_EVIDENCE",
        confidence: totalCount / minThreshold,
        evidenceCount: totalCount,
        calculationVersion: RESEARCH_CONFIG.version,
        calculatedAt: new Date().toISOString(),
        summary: `Insufficient evidence to determine concept application (${totalCount}/${minThreshold} application/higher-order attempts recorded).`,
        evidence: {
          totalAttempts: input.attempts.length,
          correctAttempts: input.attempts.filter((a) => a.isCorrect).length,
          applicationAttempts: totalCount,
          applicationCorrect: applicationAttempts.filter((a) => a.isCorrect).length,
          details: `Requires at least ${minThreshold} questions classified under APPLICATION or HIGHER_ORDER cognitive transfer.`,
        },
      };
    }

    const correctCount = applicationAttempts.filter((a) => a.isCorrect).length;
    // Extra weight for higher-order items
    let weightedPoints = 0;
    let maxWeightedPoints = 0;

    for (const a of applicationAttempts) {
      const isHigherOrder = (a.cognitiveLevel || "").toUpperCase() === "HIGHER_ORDER";
      const weight = isHigherOrder ? 1.5 : 1.0;
      maxWeightedPoints += weight;
      if (a.isCorrect) weightedPoints += weight;
    }

    const applicationRatio = Number((weightedPoints / Math.max(1, maxWeightedPoints)).toFixed(4));
    const level = RESEARCH_CONFIG.resolveMetricLevel(applicationRatio, totalCount, minThreshold);
    const confidence = Number(Math.min(1.0, 0.6 + (totalCount / 10)).toFixed(2));

    return {
      metric: "APPLICATION",
      value: applicationRatio,
      level,
      confidence,
      evidenceCount: totalCount,
      calculationVersion: RESEARCH_CONFIG.version,
      calculatedAt: new Date().toISOString(),
      summary: `Concept application score of ${(applicationRatio * 100).toFixed(1)}% based on ${correctCount} correct out of ${totalCount} transfer and word problems (${level}).`,
      evidence: {
        totalAttempts: input.attempts.length,
        correctAttempts: input.attempts.filter((a) => a.isCorrect).length,
        applicationAttempts: totalCount,
        applicationCorrect: correctCount,
        details: `${correctCount} correct out of ${totalCount} application/higher-order transfer attempts.`,
      },
    };
  }
}
