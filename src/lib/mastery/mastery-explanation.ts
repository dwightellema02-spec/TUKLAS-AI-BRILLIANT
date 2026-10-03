/**
 * Tuklas AI - Mastery Explanation Builder
 * Phase 10: Pedagogical, student-friendly explanations for mastery statuses
 *
 * Deterministic explanation with optional secondary AI enhancement.
 */

import { getAIProvider } from "@/lib/ai/provider";
import type {
  MasteryLevel,
  MasteryEvidenceBundle,
  MasteryExplanationDTO,
} from "./mastery-types";

export class MasteryExplanationBuilder {
  /**
   * Generate an accessible, student-friendly explanation
   */
  static generateDeterministicExplanation(params: {
    level: MasteryLevel;
    skillTitle: string;
    evidence: MasteryEvidenceBundle;
    flags: {
      prerequisiteConcern: boolean;
      limitedQuestionTypeEvidence: boolean;
      recentPerformanceDecline: boolean;
      activeConceptualMisconception: boolean;
      calculationSlipOnly: boolean;
    };
  }): MasteryExplanationDTO {
    const { level, skillTitle, evidence, flags } = params;
    const { totalAttempts, overallAccuracy, recentAccuracy, mistakes } = evidence;

    switch (level) {
      case "MASTERED":
        return {
          level: "MASTERED",
          summary: `You have demonstrated thorough mastery of ${skillTitle}!`,
          why: `Your recent practice shows strong, consistent performance (${Math.round(
            recentAccuracy * 100
          )}% accuracy) across diverse question types without recurring errors.`,
          nextStep: "You're ready to proceed to the next skill in your learning sequence.",
          encouragement: "Outstanding achievement! Keep up the excellent mathematical thinking.",
        };

      case "PROFICIENT": {
        let whyText = `You've demonstrated solid understanding with ${Math.round(
          overallAccuracy * 100
        )}% accuracy across ${totalAttempts} practice problems.`;
        if (flags.limitedQuestionTypeEvidence) {
          whyText += " Practice with a broader variety of question formats will help secure full mastery.";
        }
        return {
          level: "PROFICIENT",
          summary: `You are proficient in ${skillTitle}.`,
          why: whyText,
          nextStep: "Try higher-level challenge problems or advance to subsequent competencies.",
          encouragement: "Great work! You have built a reliable foundation in this skill.",
        };
      }

      case "DEVELOPING": {
        let whyText = `You are answering many questions correctly (${Math.round(
          overallAccuracy * 100
        )}%), but some inconsistency remains.`;
        if (mistakes.hasRepeatedSignErrors) {
          whyText = "You understand the core idea, but recent attempts still show occasional sign errors.";
        } else if (flags.recentPerformanceDecline) {
          whyText = "Your recent practice had a few tricky questions that brought accuracy down temporarily.";
        } else if (flags.prerequisiteConcern) {
          whyText = "Reviewing earlier foundational concepts will make this skill much easier to conquer.";
        }
        return {
          level: "DEVELOPING",
          summary: `Your understanding of ${skillTitle} is actively developing.`,
          why: whyText,
          nextStep: "Continue practice to lock in your accuracy and eliminate recurring slips.",
          encouragement: "You're making steady progress. Each problem strengthens your intuition!",
        };
      }

      case "LEARNING":
        return {
          level: "LEARNING",
          summary: `You've started exploring ${skillTitle}.`,
          why:
            totalAttempts < 5
              ? `You've logged ${totalAttempts} attempt(s) so far. More practice will reveal your true progress.`
              : `Current accuracy is ${Math.round(
                  overallAccuracy * 100
                )}%. Additional guided practice will help clarify the concept.`,
          nextStep: "Complete interactive lesson examples and foundational practice sets.",
          encouragement: "Every math journey starts here. Take it step-by-step!",
        };

      case "NOT_STARTED":
      default:
        return {
          level: "NOT_STARTED",
          summary: `You haven't attempted ${skillTitle} yet.`,
          why: "No practice or checkpoint attempts have been recorded for this skill.",
          nextStep: "Start with the interactive lesson to introduce the core concepts.",
          encouragement: "Ready to discover something new? Let's dive in!",
        };
    }
  }

  /**
   * Optionally enrich explanation using AIProvider (strictly preserving the deterministic level & why)
   */
  static async enrichWithAI(params: {
    level: MasteryLevel;
    skillTitle: string;
    evidence: MasteryEvidenceBundle;
    flags: {
      prerequisiteConcern: boolean;
      limitedQuestionTypeEvidence: boolean;
      recentPerformanceDecline: boolean;
      activeConceptualMisconception: boolean;
      calculationSlipOnly: boolean;
    };
  }): Promise<MasteryExplanationDTO> {
    const fallback = this.generateDeterministicExplanation(params);

    try {
      const ai = getAIProvider();
      const systemPrompt = `You are Tuklas AI's supportive mathematics mastery advisor.
Provide a concise, encouraging 2-sentence explanation for a Grade 7 student.
Return strictly valid JSON format with keys: summary, why, nextStep, encouragement.
Never change the provided mastery level.`;

      const userPrompt = JSON.stringify({
        skill: params.skillTitle,
        masteryLevel: params.level,
        attempts: params.evidence.totalAttempts,
        overallAccuracy: `${Math.round(params.evidence.overallAccuracy * 100)}%`,
        recentAccuracy: `${Math.round(params.evidence.recentAccuracy * 100)}%`,
        flags: params.flags,
      });

      const response = await ai.generateTutorResponse({
        systemPrompt,
        userPrompt,
        temperature: 0.3,
        maxTokens: 300,
        timeoutMs: 4000,
      });

      if (response && response.text) {
        const cleaned = response.text.replace(/```json/g, "").replace(/```/g, "").trim();
        const parsed = JSON.parse(cleaned);
        if (parsed.summary && parsed.why) {
          return {
            level: params.level,
            summary: String(parsed.summary),
            why: String(parsed.why),
            nextStep: String(parsed.nextStep || fallback.nextStep),
            encouragement: String(parsed.encouragement || fallback.encouragement),
          };
        }
      }
    } catch {
      // AI fallback gracefully to deterministic explanation
    }

    return fallback;
  }
}
