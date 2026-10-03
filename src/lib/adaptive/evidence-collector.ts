/**
 * Phase 9: Evidence Collector
 *
 * Gathers and structures multimodal student evidence from:
 * 1. Historical question attempts and practice sessions (Phase 5/6)
 * 2. Prerequisite competency graphs and lesson progress (Phase 4)
 * 3. AI Mistake Analysis diagnostic reports (Phase 8)
 */

import { dbService } from "../db";
import { ADAPTIVE_CONFIG } from "@/config/adaptive-learning";
import { PrerequisiteChecker } from "./prerequisite-checker";
import type {
  AdaptiveEvidenceBundle,
  PracticeEvidence,
  MistakeEvidence,
  LearningPathEvidence,
  QuestionDifficulty,
} from "./adaptive-types";

export class EvidenceCollector {
  /**
   * Collect a complete evidence snapshot for a given student and skill/lesson
   */
  static async collectEvidence(params: {
    studentId: string;
    skillId: string;
    lessonId?: string | null;
  }): Promise<AdaptiveEvidenceBundle> {
    const { studentId, skillId, lessonId } = params;

    // 1. Practice Attempts Evidence
    const attempts = await dbService.getDetailedAttemptsForStudent({
      studentId,
      skillId,
      limit: ADAPTIVE_CONFIG.recentAttemptWindow,
    });

    const totalAttempts = attempts.length;
    const correctCount = attempts.filter((a: any) => a.isCorrect).length;
    const incorrectCount = totalAttempts - correctCount;
    const accuracy = totalAttempts > 0 ? correctCount / totalAttempts : 0;

    let retryCount = 0;
    let hintUsageCount = 0;
    let totalTimeTaken = 0;

    const difficultyCounts: Record<QuestionDifficulty, { total: number; correct: number }> = {
      EASY: { total: 0, correct: 0 },
      MEDIUM: { total: 0, correct: 0 },
      HARD: { total: 0, correct: 0 },
    };

    attempts.forEach((att: any) => {
      if (att.attemptNumber && att.attemptNumber > 1) retryCount++;
      if (att.hintUsed) hintUsageCount++;
      if (att.timeTakenMs) totalTimeTaken += att.timeTakenMs;

      const diff = (att.question?.difficulty as QuestionDifficulty) || "MEDIUM";
      if (difficultyCounts[diff]) {
        difficultyCounts[diff].total++;
        if (att.isCorrect) difficultyCounts[diff].correct++;
      }
    });

    // Compute Recent Performance Trend
    let recentTrend: "IMPROVING" | "DECLINING" | "STABLE" | "INSUFFICIENT_DATA" =
      "INSUFFICIENT_DATA";

    if (totalAttempts >= 4) {
      // Split attempts into earlier half and later half
      const midpoint = Math.floor(totalAttempts / 2);
      const recentSlice = attempts.slice(0, midpoint);
      const earlierSlice = attempts.slice(midpoint);

      const recentAccuracy =
        recentSlice.filter((a: any) => a.isCorrect).length / recentSlice.length;
      const earlierAccuracy =
        earlierSlice.filter((a: any) => a.isCorrect).length / earlierSlice.length;

      if (recentAccuracy - earlierAccuracy >= 0.2) recentTrend = "IMPROVING";
      else if (earlierAccuracy - recentAccuracy >= 0.2) recentTrend = "DECLINING";
      else recentTrend = "STABLE";
    }

    const practiceEvidence: PracticeEvidence = {
      totalAttempts,
      correctAnswers: correctCount,
      incorrectAnswers: incorrectCount,
      accuracy,
      retryCount,
      hintUsageCount,
      averageTimeTakenMs: totalAttempts > 0 ? Math.round(totalTimeTaken / totalAttempts) : undefined,
      recentTrend,
      difficultyCounts,
      lastAttemptAt: attempts[0]?.submittedAt || attempts[0]?.createdAt,
    };

    // 2. Skill & Prerequisite Graph Evidence
    const skillEvidence = await PrerequisiteChecker.evaluatePrerequisites(
      studentId,
      skillId
    );

    // 3. Mistake Analysis Diagnostic Evidence (Phase 8)
    const analyses = await dbService.getMistakeAnalysesForStudent(studentId, {
      skillId,
      limit: 1,
    });
    const latestAnalysis = analyses[0];

    const mistakeEvidence: MistakeEvidence = {
      hasAnalysis: Boolean(latestAnalysis),
      primaryCategory: latestAnalysis?.category,
      categoryLabel: latestAnalysis?.category ? String(latestAnalysis.category).replace(/_/g, " ") : undefined,
      observation: latestAnalysis?.observation,
      pattern: latestAnalysis?.pattern,
      confidence: latestAnalysis?.confidence,
      repeatedSignErrors:
        latestAnalysis?.category === "SIGN_ERROR" ||
        (latestAnalysis?.pattern && latestAnalysis.pattern.toLowerCase().includes("sign")) ||
        false,
      conceptualGap:
        latestAnalysis?.category === "CONCEPTUAL_MISUNDERSTANDING" ||
        latestAnalysis?.category === "APPLICATION_DIFFICULTY" ||
        false,
      prerequisiteGap:
        latestAnalysis?.category === "PREREQUISITE_GAP" || false,
      calculationErrorOnly:
        latestAnalysis?.category === "CALCULATION_ERROR" ||
        latestAnalysis?.category === "POSSIBLE_CARELESS_ERROR" ||
        false,
      rawRecommendations: latestAnalysis?.recommendation,
    };

    // 4. Learning Path Evidence (Phase 4)
    const studentProgress = await dbService.getStudentLearningPath(studentId);
    const learningPathNodes = studentProgress?.learningPath || [];
    const completedLessons = learningPathNodes.filter((n: any) => n.state === "COMPLETED");
    const matchedLessonNode = learningPathNodes.find(
      (n: any) => n.lessonId === (lessonId || skillEvidence.lessonId)
    );

    const learningPathEvidence: LearningPathEvidence = {
      currentLessonId: lessonId || skillEvidence.lessonId || null,
      isLessonCompleted: matchedLessonNode?.state === "COMPLETED" || false,
      completedLessonsCount: completedLessons.length,
      totalLessonsInUnit: learningPathNodes.length || 3,
      nextRecommendedLessonId: studentProgress?.nextRecommended?.lessonId || null,
    };

    return {
      studentId,
      skillId,
      lessonId: lessonId || skillEvidence.lessonId || null,
      practice: practiceEvidence,
      skill: skillEvidence,
      mistake: mistakeEvidence,
      learningPath: learningPathEvidence,
      collectedAt: new Date(),
    };
  }
}
