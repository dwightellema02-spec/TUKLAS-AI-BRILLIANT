/**
 * Phase 9: AI Adaptive Explainer
 *
 * Generates encouraging, clear, and age-appropriate (Grade 7) student explanations
 * for adaptive recommendations. AI is strictly secondary; deterministic fallbacks
 * are always ready and used whenever the AI provider is unavailable.
 */

import { getAIProvider } from "./provider";
import type {
  AdaptiveDecisionType,
  AdaptiveExplanation,
  AdaptiveEvidenceBundle,
  RuleEvaluationResult,
} from "../adaptive/adaptive-types";

export class AdaptiveExplainer {
  /**
   * Produce student-facing explanation for a recommendation
   */
  static async explainRecommendation(params: {
    decision: RuleEvaluationResult;
    bundle: AdaptiveEvidenceBundle;
    activityTitle: string;
    useAI?: boolean;
  }): Promise<AdaptiveExplanation> {
    const { decision, bundle, activityTitle, useAI = true } = params;

    // 1. Generate Deterministic Baseline Explanation first
    const fallback = this.getDeterministicExplanation(decision, bundle, activityTitle);

    if (!useAI) {
      return fallback;
    }

    // 2. Attempt AI Generation
    try {
      const provider = getAIProvider();

      const systemPrompt = `You are an encouraging, empathetic Grade 7 Mathematics teacher in the Philippines.
Explain an adaptive learning recommendation to a student in simple, warm, and motivating language.
Return ONLY valid JSON with keys:
{
  "message": "1-2 sentences explaining what we recommend next",
  "reason": "1 sentence why this recommendation helps their learning",
  "nextStep": "1 short instruction on what to do next",
  "encouragement": "A brief uplifting motto or praise"
}
Do NOT mention internal terms like 'algorithm', 'system', 'AI', or 'threshold'.
Keep math references positive and clear.`;

      const userPrompt = JSON.stringify({
        decisionType: decision.decisionType,
        skill: bundle.skill.skillTitle,
        lesson: bundle.skill.lessonTitle || "Grade 7 Mathematics",
        accuracy: `${Math.round(bundle.practice.accuracy * 100)}%`,
        totalAttempts: bundle.practice.totalAttempts,
        mistakePattern: bundle.mistake.pattern || "None detected",
        recommendedActivity: activityTitle,
        ruleReason: decision.ruleDescription,
      });

      const response = await provider.generateTutorResponse({
        systemPrompt,
        userPrompt,
        temperature: 0.3,
        maxTokens: 300,
        timeoutMs: 4000, // Short timeout to maintain snappy UI
      });

      if (response && response.text) {
        // Strip markdown backticks if present
        const cleaned = response.text.replace(/```json/g, "").replace(/```/g, "").trim();
        const parsed = JSON.parse(cleaned);

        if (parsed.message && parsed.nextStep) {
          return {
            message: String(parsed.message),
            reason: String(parsed.reason || fallback.reason),
            nextStep: String(parsed.nextStep),
            encouragement: String(parsed.encouragement || fallback.encouragement),
          };
        }
      }
    } catch {
      // Graceful fallback on any network, quota, or parsing anomaly
    }

    return fallback;
  }

  /**
   * Deterministic, pedagogical fallback explanations
   */
  static getDeterministicExplanation(
    decision: RuleEvaluationResult,
    bundle: AdaptiveEvidenceBundle,
    activityTitle: string
  ): AdaptiveExplanation {
    const skillName = bundle.skill.skillTitle;
    const accuracyPct = Math.round(bundle.practice.accuracy * 100);

    switch (decision.decisionType) {
      case "REVIEW_PREREQUISITE":
        return {
          message: `Before moving deeper into ${skillName}, reviewing foundational concepts will make everything clearer.`,
          reason: `Foundational prerequisite principles need a quick refresher.`,
          nextStep: `Explore: ${activityTitle}`,
          encouragement: "Strengthening your foundation makes higher math much easier!",
        };

      case "REMEDIATE":
        return {
          message: `You're working hard on ${skillName}! Let's review the main rules and try a guided example.`,
          reason: `A quick review will help you master the signs and operations with confidence.`,
          nextStep: `Explore: ${activityTitle}`,
          encouragement: "Mistakes are proof that you are discovering new ideas!",
        };

      case "PRACTICE_EASIER":
        return {
          message: `Let's build your problem-solving momentum with a few foundational questions.`,
          reason: `Reinforcing baseline steps ensures you never doubt your calculations.`,
          nextStep: `Begin practice: ${activityTitle}`,
          encouragement: "One step at a time builds mathematical confidence!",
        };

      case "PRACTICE_SAME_DIFFICULTY":
        return {
          message: `Great progress! You are steadily developing your skills in ${skillName}.`,
          reason: `Consistent practice at this level locks in your accuracy (${accuracyPct}%).`,
          nextStep: `Continue practice: ${activityTitle}`,
          encouragement: "Keep the momentum going!",
        };

      case "PRACTICE_HARDER":
        return {
          message: `Excellent performance! With ${accuracyPct}% accuracy, you are ready for a new challenge.`,
          reason: `You have consistently solved these problems with high precision.`,
          nextStep: `Take on the challenge: ${activityTitle}`,
          encouragement: "Fantastic work! Let's see how high you can climb!",
        };

      case "INSUFFICIENT_EVIDENCE":
      case "CONTINUE":
      default:
        return {
          message: `Keep exploring ${skillName} with our interactive practice activities.`,
          reason: `Each problem you solve provides valuable insight into your learning.`,
          nextStep: `Start: ${activityTitle}`,
          encouragement: "Every step forward brings you closer to mastery!",
        };
    }
  }
}
