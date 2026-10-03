/**
 * Phase 9: Recommendation Builder
 *
 * Combines evidence collection, deterministic rules output, selected remediation activity,
 * and optional AI explanation into an audited, structured recommendation object.
 */

import { ADAPTIVE_CONFIG } from "@/config/adaptive-learning";
import { AdaptiveExplainer } from "../ai/adaptive-explainer";
import { RemediationSelector } from "./remediation-selector";
import type {
  AdaptiveEvidenceBundle,
  RuleEvaluationResult,
  AdaptiveRecommendationDTO,
} from "./adaptive-types";

export class RecommendationBuilder {
  /**
   * Assemble a complete AdaptiveRecommendation object
   */
  static async buildRecommendation(params: {
    bundle: AdaptiveEvidenceBundle;
    decision: RuleEvaluationResult;
    useAI?: boolean;
  }): Promise<{
    recommendationPayload: {
      studentId: string;
      skillId?: string | null;
      lessonId?: string | null;
      decisionType: any;
      reason: string;
      evidenceSummary: string;
      confidence: any;
      recommendedActivityType: any;
      recommendedActivityId?: string | null;
      source: "RULE_ENGINE" | "AI_ASSISTED";
      status: "ACTIVE";
      targetDifficulty?: any;
      metadata: string;
      expiresAt: Date;
    };
    dto: Partial<AdaptiveRecommendationDTO>;
  }> {
    const { bundle, decision, useAI = true } = params;

    // 1. Select concrete remediation or practice activity
    const activity = await RemediationSelector.selectRemediationActivity({
      skillId: bundle.skillId,
      targetDifficulty: decision.targetDifficulty,
      prerequisiteSkillId: decision.weakPrerequisiteSkillId,
      activityType: decision.recommendedActivityType,
    });

    // 2. Generate student-facing explanation (AI with deterministic fallback)
    const explanation = await AdaptiveExplainer.explainRecommendation({
      decision,
      bundle,
      activityTitle: activity.activityTitle,
      useAI,
    });

    // 3. Compact evidence summary string for database audit
    const evidenceSummary = `Attempts: ${bundle.practice.totalAttempts} | Accuracy: ${Math.round(
      bundle.practice.accuracy * 100
    )}% | Trend: ${bundle.practice.recentTrend} | Hints: ${
      bundle.practice.hintUsageCount
    } | Primary Mistake: ${bundle.mistake.primaryCategory || "None"} | Rule: ${
      decision.ruleCode
    }`;

    // 4. Calculate expiration timestamp (e.g. 7 days)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + ADAPTIVE_CONFIG.recommendationExpirationHours);

    // 5. Build metadata JSON string
    const metadata = JSON.stringify({
      ruleCode: decision.ruleCode,
      ruleDescription: decision.ruleDescription,
      activityTitle: activity.activityTitle,
      activityDetails: activity.details,
      practiceSetId: activity.practiceSetId,
      lessonId: activity.lessonId,
      explanation,
      practiceMetrics: {
        totalAttempts: bundle.practice.totalAttempts,
        correctAnswers: bundle.practice.correctAnswers,
        accuracy: bundle.practice.accuracy,
        recentTrend: bundle.practice.recentTrend,
      },
      mistakeSnapshot: {
        category: bundle.mistake.primaryCategory,
        pattern: bundle.mistake.pattern,
      },
    });

    const payload = {
      studentId: bundle.studentId,
      skillId: bundle.skillId,
      lessonId: bundle.lessonId,
      decisionType: decision.decisionType,
      reason: decision.ruleDescription,
      evidenceSummary,
      confidence: decision.confidence,
      recommendedActivityType: decision.recommendedActivityType,
      recommendedActivityId: activity.activityId,
      source: useAI ? ("AI_ASSISTED" as const) : ("RULE_ENGINE" as const),
      status: "ACTIVE" as const,
      targetDifficulty: decision.targetDifficulty,
      metadata,
      expiresAt,
    };

    const dto: Partial<AdaptiveRecommendationDTO> = {
      studentId: bundle.studentId,
      skillId: bundle.skillId,
      skillTitle: bundle.skill.skillTitle,
      lessonId: bundle.lessonId,
      lessonTitle: bundle.skill.lessonTitle || undefined,
      decisionType: decision.decisionType,
      reason: decision.ruleDescription,
      evidenceSummary,
      confidence: decision.confidence,
      recommendedActivityType: decision.recommendedActivityType,
      recommendedActivityId: activity.activityId,
      recommendedActivityTitle: activity.activityTitle,
      recommendedPracticeSetId: activity.practiceSetId,
      source: payload.source,
      status: "ACTIVE",
      targetDifficulty: decision.targetDifficulty,
      explanation,
      metadata: JSON.parse(metadata),
      expiresAt: expiresAt.toISOString(),
    };

    return { recommendationPayload: payload, dto };
  }
}
