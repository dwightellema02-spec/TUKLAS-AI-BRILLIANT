// Phase 8: AI Mistake Analyzer Orchestrator

import { dbService } from "../db";
import { getAIProvider, LocalTutorEngine } from "./provider";
import { runDeterministicAnalysis, generateDeterministicMistakeCategory } from "./deterministic-analyzer";
import { buildMistakeAnalysisSystemPrompt, buildMistakeAnalysisUserPrompt } from "./prompts";
import { validateMistakeAnalysisOutput } from "./validators";
import type {
  MistakeAnalysisDTO,
  AnalysisTriggerType,
  QuestionAttemptDetail,
} from "./types";

export interface AnalyzeStudentMistakesParams {
  studentId: string;
  skillId?: string | null;
  lessonId?: string | null;
  practiceSessionId?: string | null;
  trigger?: AnalysisTriggerType;
  maxAttempts?: number;
  forceRefresh?: boolean;
}

export class MistakeAnalyzerService {
  /**
   * Main entrypoint for analyzing student mistake patterns
   */
  static async analyzeStudentMistakes(
    params: AnalyzeStudentMistakesParams
  ): Promise<MistakeAnalysisDTO> {
    const {
      studentId,
      skillId,
      lessonId,
      practiceSessionId,
      trigger = "PRACTICE_COMPLETED",
      maxAttempts = 10,
      forceRefresh = false,
    } = params;

    // 1. Collect relevant attempts (capped between 3 and 20 attempts)
    const limit = Math.min(20, Math.max(3, maxAttempts));
    const attempts: QuestionAttemptDetail[] =
      await dbService.getDetailedAttemptsForStudent({
        studentId,
        skillId,
        lessonId,
        practiceSessionId,
        limit,
      });

    // 2. Check for insufficient sample size (< 2 attempts)
    if (attempts.length < 2) {
      const emptyFallback = {
        category: "UNKNOWN" as const,
        observation: `Only ${attempts.length} attempt recorded for this skill so far.`,
        pattern: "More practice questions are needed to identify a distinct learning pattern.",
        possibleCause: "Sample size too small for statistical or pedagogical inference.",
        confidence: 0.2,
        recommendation: "Continue practicing additional questions so Tuklas can detect your unique learning style.",
        evidenceAttemptIds: attempts.map((a) => a.id),
      };

      return (await dbService.saveMistakeAnalysis({
        studentId,
        skillId,
        lessonId,
        practiceSessionId,
        category: emptyFallback.category,
        observation: emptyFallback.observation,
        pattern: emptyFallback.pattern,
        possibleCause: emptyFallback.possibleCause,
        confidence: emptyFallback.confidence,
        recommendation: emptyFallback.recommendation,
        evidenceSummary: `Baseline recorded with ${attempts.length} attempts.`,
        trigger,
        analyzerVersion: "1.0",
        metadata: JSON.stringify({ attemptsCount: attempts.length, insufficient: true }),
        evidenceAttemptIds: emptyFallback.evidenceAttemptIds,
      })) as MistakeAnalysisDTO;
    }

    // 3. Prerequisite graph analysis
    let prerequisiteData: Array<{
      skillId: string;
      title: string;
      accuracy: number;
      totalAttempts: number;
    }> = [];

    if (skillId) {
      try {
        prerequisiteData = await dbService.getPrerequisitePerformance(studentId, skillId);
      } catch (e) {
        console.warn("Failed to query prerequisite performance:", e);
      }
    }

    // 4. Deterministic Pre-Analysis (facts, distributions, rule-based indicators)
    const deterministic = runDeterministicAnalysis(attempts, prerequisiteData);
    const deterministicFallback = generateDeterministicMistakeCategory(deterministic, attempts);

    // 5. Cache check: If not forced, check recent completed analysis for student + skill
    if (!forceRefresh && skillId) {
      const existing = await dbService.getLatestMistakeAnalysisForSkill(studentId, skillId);
      if (existing) {
        const createdAtTime = new Date(existing.createdAt).getTime();
        const now = Date.now();
        // If analysis is younger than 15 minutes and the latest attempt is the same, reuse it
        const latestAttemptId = attempts[attempts.length - 1]?.id;
        const hasLatestEvidence = existing.evidenceSummary?.includes(latestAttemptId) || (now - createdAtTime < 15 * 60 * 1000);
        if (hasLatestEvidence) {
          const fullExisting = await dbService.getMistakeAnalysisById(existing.id, studentId, "STUDENT");
          if (fullExisting) return fullExisting as MistakeAnalysisDTO;
        }
      }
    }

    // 6. Resolve Skill & Lesson titles for AI grounding
    let skillTitle = "Target Math Skill";
    let lessonTitle = "Lesson Practice";

    if (skillId) {
      const skills = await dbService.getSkills();
      const s = skills.find((item: any) => item.id === skillId);
      if (s) skillTitle = s.title;
    }
    if (lessonId) {
      const l = await dbService.getLessonById(lessonId);
      if (l) lessonTitle = l.title;
    }

    // 7. Invoke AI Provider with strict validation
    const validAttemptIds = attempts.map((a) => a.id);
    let structured = deterministicFallback;

    // Check teacher AI settings
    const settings = await dbService.getTeacherAISettings();
    const canUseAI = settings.aiTutorEnabled !== false;

    if (canUseAI) {
      const provider = getAIProvider();
      const systemPrompt = buildMistakeAnalysisSystemPrompt();
      const userPrompt = buildMistakeAnalysisUserPrompt({
        skillTitle,
        lessonTitle,
        deterministic,
        attempts,
      });

      try {
        const rawResponse = await provider.generateTutorResponse({
          systemPrompt,
          userPrompt,
          maxTokens: 600,
          temperature: 0.2, // Low temperature for factual, analytical consistency
          timeoutMs: 12000,
        });

        structured = validateMistakeAnalysisOutput(
          rawResponse.text,
          validAttemptIds,
          deterministicFallback
        );
      } catch (err) {
        console.warn("AI Mistake Analysis provider failed, using deterministic fallback:", err);
        const fallbackProvider = new LocalTutorEngine();
        try {
          const fallbackRaw = await fallbackProvider.generateTutorResponse({
            systemPrompt,
            userPrompt,
            maxTokens: 500,
          });
          structured = validateMistakeAnalysisOutput(
            fallbackRaw.text,
            validAttemptIds,
            deterministicFallback
          );
        } catch {
          structured = deterministicFallback;
        }
      }
    }

    // 8. Persist analysis & evidence links
    const saved = await dbService.saveMistakeAnalysis({
      studentId,
      skillId,
      lessonId,
      practiceSessionId,
      category: structured.category,
      observation: structured.observation,
      pattern: structured.pattern,
      possibleCause: structured.possibleCause,
      confidence: structured.confidence,
      recommendation: structured.recommendation,
      evidenceSummary: `Analyzed ${attempts.length} attempts (${deterministic.correctCount} correct, ${deterministic.incorrectCount} incorrect, ${deterministic.accuracyPercentage}% accuracy).`,
      status: "COMPLETED",
      trigger,
      analyzerVersion: "1.0",
      metadata: JSON.stringify({
        deterministic,
        evidenceCount: structured.evidenceAttemptIds.length,
        timestamp: new Date().toISOString(),
      }),
      evidenceAttemptIds: structured.evidenceAttemptIds,
    });

    return saved as MistakeAnalysisDTO;
  }

  /**
   * Deterministically evaluate a single question attempt for immediate mistake categorization
   */
  static evaluateAttempt(params: {
    prompt: string;
    questionData?: any;
    studentAnswer: any;
    correctAnswer?: any;
    skillId?: string;
  }): { category: string; feedback?: string } {
    const { prompt, studentAnswer, correctAnswer } = params;
    const ansStr = String(studentAnswer || "").trim().toLowerCase();
    const corrStr = String(correctAnswer || "").trim().toLowerCase();
    const promptLower = (prompt || "").toLowerCase();

    // Check for sign error
    const ansNum = parseFloat(ansStr);
    const corrNum = parseFloat(corrStr);
    if (!isNaN(ansNum) && !isNaN(corrNum) && ansNum === -corrNum && ansNum !== 0) {
      return { category: "SIGN_ERROR", feedback: "Check your positive and negative signs carefully." };
    }

    // Check for comparison error on negative numbers
    if (
      (promptLower.includes("compare") || promptLower.includes("order") || promptLower.includes("greater") || promptLower.includes("less")) &&
      (promptLower.includes("negative") || promptLower.includes("-"))
    ) {
      return { category: "CONCEPTUAL_MISUNDERSTANDING", feedback: "Remember that on a number line, values farther to the right are always greater." };
    }

    // Default calculation or conceptual error
    if (!isNaN(ansNum) && !isNaN(corrNum)) {
      return { category: "CALCULATION_ERROR", feedback: "Review your calculation steps to verify your arithmetic." };
    }

    return { category: "CONCEPTUAL_MISUNDERSTANDING", feedback: "Review the lesson materials and concept definitions." };
  }
}
