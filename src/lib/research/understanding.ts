/**
 * Tuklas AI - Understanding Research Metric Calculation
 * Phase 14: Multi-Dimensional Evidence Calculation
 */

import { RESEARCH_CONFIG } from "./research-config";
import type { ResearchMetricResult } from "./research-types";

export interface UnderstandingCalculationInput {
  attempts: Array<{
    isCorrect: boolean;
    hintUsed?: boolean;
    mistakeCategory?: string | null;
    questionType?: string | null;
    attemptNumber?: number;
  }>;
  checkpoints?: Array<{
    isCorrect: boolean;
    attempt?: number;
  }>;
  minAttempts?: number;
}

export class UnderstandingCalculator {
  /**
   * Deterministically calculate conceptual understanding metric
   */
  static calculate(input: UnderstandingCalculationInput): ResearchMetricResult {
    const minThreshold = input.minAttempts ?? RESEARCH_CONFIG.thresholds.minAttemptsForUnderstanding;
    const attempts = input.attempts || [];
    const totalCount = attempts.length;

    if (totalCount < minThreshold) {
      return {
        metric: "UNDERSTANDING",
        value: 0,
        level: "INSUFFICIENT_EVIDENCE",
        confidence: totalCount / minThreshold,
        evidenceCount: totalCount,
        calculationVersion: RESEARCH_CONFIG.version,
        calculatedAt: new Date().toISOString(),
        summary: `Insufficient evidence to determine understanding (${totalCount}/${minThreshold} attempts recorded).`,
        evidence: {
          totalAttempts: totalCount,
          correctAttempts: attempts.filter((a) => a.isCorrect).length,
          details: `Evaluation requires at least ${minThreshold} comprehensive attempts across formative exercises and checkpoints.`,
        },
      };
    }

    const correctCount = attempts.filter((a) => a.isCorrect).length;
    // Component 1: Non-hint accuracy (true independent mastery)
    const nonHintAttempts = attempts.filter((a) => !a.hintUsed);
    const nonHintAccuracy =
      nonHintAttempts.length > 0
        ? nonHintAttempts.filter((a) => a.isCorrect).length / nonHintAttempts.length
        : correctCount / totalCount;

    // Component 2: Checkpoint performance (guided in-lesson checkpoints)
    const checkpoints = input.checkpoints || [];
    const checkpointScore =
      checkpoints.length > 0
        ? checkpoints.filter((c) => c.isCorrect).length / checkpoints.length
        : nonHintAccuracy;

    // Component 3: Variety of question types demonstrated (transfer across representations)
    const uniqueTypes = new Set(attempts.map((a) => a.questionType).filter(Boolean));
    const varietyScore = Math.min(1.0, Math.max(0.5, uniqueTypes.size / 2.5));

    // Component 4: Misconception penalty (severe conceptual misunderstandings reduce score)
    const severeMisconceptions = attempts.filter((a) => {
      const cat = a.mistakeCategory || "";
      return cat === "CONCEPTUAL_MISUNDERSTANDING" || cat === "PREREQUISITE_GAP";
    }).length;
    const misconceptionRatio = Math.min(1.0, severeMisconceptions / Math.max(1, totalCount - correctCount));
    const misconceptionFactor = Math.max(0.0, 1.0 - misconceptionRatio * 0.4);

    // Weighted synthesis
    const { baseAccuracyWeight, checkpointWeight, transferVarietyWeight, misconceptionPenaltyWeight } =
      RESEARCH_CONFIG.understandingWeights;

    const weightedScore =
      nonHintAccuracy * baseAccuracyWeight +
      checkpointScore * checkpointWeight +
      varietyScore * transferVarietyWeight +
      misconceptionFactor * misconceptionPenaltyWeight;

    const finalValue = Number(Math.max(0.0, Math.min(1.0, weightedScore)).toFixed(4));
    const level = RESEARCH_CONFIG.resolveMetricLevel(finalValue, totalCount, minThreshold);

    const confidence = Number(
      Math.min(1.0, 0.5 + (totalCount / 20) + (checkpoints.length > 0 ? 0.2 : 0.0)).toFixed(2)
    );

    return {
      metric: "UNDERSTANDING",
      value: finalValue,
      level,
      confidence,
      evidenceCount: totalCount,
      calculationVersion: RESEARCH_CONFIG.version,
      calculatedAt: new Date().toISOString(),
      summary: `Conceptual understanding score of ${(finalValue * 100).toFixed(1)}% (${level}) synthesized from non-hint accuracy (${(nonHintAccuracy * 100).toFixed(0)}%), checkpoints, and misconception frequencies.`,
      evidence: {
        totalAttempts: totalCount,
        correctAttempts: correctCount,
        hintFreeAttempts: nonHintAttempts.length,
        checkpointCount: checkpoints.length,
        misconceptionCount: severeMisconceptions,
        details: `${nonHintAttempts.length} unassisted attempts, ${checkpoints.length} checkpoints, ${severeMisconceptions} severe conceptual misconceptions.`,
      },
    };
  }
}
