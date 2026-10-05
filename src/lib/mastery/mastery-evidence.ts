/**
 * Tuklas AI - Mastery Evidence Collector
 * Phase 10: Multi-source evidence aggregation for SkillMastery evaluation
 */

import { prisma, hasValidDatabaseUrl, fallbackStore } from "@/lib/db";
import { MASTERY_CONFIG } from "@/config/mastery-learning";
import { MasteryCalculator } from "./mastery-calculator";
import type {
  MasteryEvidenceBundle,
  DifficultyStats,
  QuestionTypeStats,
  PrerequisiteMasteryCheck,
  MasteryMistakeEvidence,
  MasteryAdaptiveEvidence,
  MasteryLevel,
} from "./mastery-types";
import type { QuestionDifficulty } from "@prisma/client";

export class MasteryEvidenceCollector {
  /**
   * Aggregate all available learning evidence for student + skill
   */
  static async collectEvidence(studentId: string, skillId: string): Promise<MasteryEvidenceBundle> {
    // 1. Resolve Skill & Lesson details
    const skillInfo = await this.resolveSkillInfo(skillId);

    // 2. Fetch all student question attempts associated with this skill
    const attempts = await this.fetchSkillAttempts(studentId, skillId);

    // Sort chronologically
    const attemptsAsc = [...attempts].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
    const attemptsDesc = [...attempts].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    const totalAttempts = attempts.length;
    const correctAttempts = attempts.filter((a) => a.isCorrect).length;
    const incorrectAttempts = totalAttempts - correctAttempts;
    const overallAccuracy = MasteryCalculator.calculateAccuracy(correctAttempts, totalAttempts);

    // Recent Window
    const recentWindow = attemptsDesc.slice(0, MASTERY_CONFIG.recentAttemptWindowSize);
    const recentCorrect = recentWindow.filter((a) => a.isCorrect).length;
    const recentAccuracy = MasteryCalculator.calculateAccuracy(recentCorrect, recentWindow.length);

    // Historical (excluding recent window)
    const historicalWindow = attemptsDesc.slice(MASTERY_CONFIG.recentAttemptWindowSize);
    const historicalCorrect = historicalWindow.filter((a) => a.isCorrect).length;
    const historicalAccuracy = MasteryCalculator.calculateAccuracy(historicalCorrect, historicalWindow.length);

    // Streaks
    const consecutiveCorrect = MasteryCalculator.calculateConsecutiveCorrect(attemptsDesc);
    const consecutiveIncorrect = MasteryCalculator.calculateConsecutiveIncorrect(attemptsDesc);

    // 3. Difficulty Breakdown
    const difficultyBreakdown: Record<QuestionDifficulty, DifficultyStats> = {
      EASY: { attempts: 0, correct: 0, accuracy: 0.0 },
      MEDIUM: { attempts: 0, correct: 0, accuracy: 0.0 },
      HARD: { attempts: 0, correct: 0, accuracy: 0.0 },
    };

    for (const att of attempts) {
      const diff = (att.difficulty as QuestionDifficulty) || "MEDIUM";
      if (!difficultyBreakdown[diff]) {
        difficultyBreakdown[diff] = { attempts: 0, correct: 0, accuracy: 0.0 };
      }
      difficultyBreakdown[diff].attempts++;
      if (att.isCorrect) difficultyBreakdown[diff].correct++;
    }

    for (const diff of Object.keys(difficultyBreakdown) as QuestionDifficulty[]) {
      difficultyBreakdown[diff].accuracy = MasteryCalculator.calculateAccuracy(
        difficultyBreakdown[diff].correct,
        difficultyBreakdown[diff].attempts
      );
    }

    // 4. Question Type Breakdown
    const questionTypeBreakdown: Record<string, QuestionTypeStats> = {};
    for (const att of attempts) {
      const qType = att.questionType || "MULTIPLE_CHOICE";
      if (!questionTypeBreakdown[qType]) {
        questionTypeBreakdown[qType] = { attempts: 0, correct: 0, accuracy: 0.0 };
      }
      questionTypeBreakdown[qType].attempts++;
      if (att.isCorrect) questionTypeBreakdown[qType].correct++;
    }

    for (const qType of Object.keys(questionTypeBreakdown)) {
      questionTypeBreakdown[qType].accuracy = MasteryCalculator.calculateAccuracy(
        questionTypeBreakdown[qType].correct,
        questionTypeBreakdown[qType].attempts
      );
    }
    const distinctQuestionTypesCount = Object.keys(questionTypeBreakdown).length;

    // 5. Behavioral Metrics
    const totalHintsUsed = attempts.filter((a) => a.hintUsed).length;
    const totalRetries = attempts.reduce((acc, a) => acc + (a.retryCount || 0), 0);
    const practiceSessionsCompleted = await this.countCompletedPracticeSessions(studentId, skillId);

    // 6. Phase 8 Mistake Evidence
    const mistakes = await this.fetchMistakeEvidence(studentId, skillId);

    // 7. Phase 9 Adaptive Evidence
    const adaptive = await this.fetchAdaptiveEvidence(studentId, skillId);

    // 8. Phase 4 Prerequisite Status
    const prerequisites = await this.fetchPrerequisitesCheck(studentId, skillId);
    const hasPrerequisiteConcern = prerequisites.some((p) => p.isWeak);

    // 9. Computed Metrics
    const applicationScore = MasteryCalculator.calculateApplicationScore({
      attempts: attempts.map((a) => ({
        isCorrect: a.isCorrect,
        questionType: a.questionType,
        difficulty: a.difficulty,
      })),
    });

    const consistencyScore = MasteryCalculator.calculateConsistencyScore({
      attemptsChronologicalAsc: attemptsAsc.map((a) => ({
        isCorrect: a.isCorrect,
        hintUsed: a.hintUsed,
      })),
      difficultyBreakdown,
      recentAccuracy,
      overallAccuracy,
    });

    return {
      studentId,
      skillId,
      skillTitle: skillInfo.title,
      lessonId: skillInfo.lessonId,
      lessonTitle: skillInfo.lessonTitle,
      totalAttempts,
      correctAttempts,
      incorrectAttempts,
      overallAccuracy,
      recentAccuracy,
      historicalAccuracy,
      consecutiveCorrect,
      consecutiveIncorrect,
      difficultyBreakdown,
      questionTypeBreakdown,
      distinctQuestionTypesCount,
      totalHintsUsed,
      totalRetries,
      practiceSessionsCompleted,
      mistakes,
      adaptive,
      prerequisites,
      hasPrerequisiteConcern,
      applicationScore,
      consistencyScore,
    };
  }

  /**
   * Resolve Skill title, and associated lesson info
   */
  private static async resolveSkillInfo(skillId: string) {
    if (hasValidDatabaseUrl) {
      try {
        const skill = await prisma.skill.findUnique({
          where: { id: skillId },
          include: {
            lessons: {
              include: { lesson: { select: { id: true, title: true } } },
              take: 1,
            },
          },
        });
        if (skill) {
          const lsn = skill.lessons[0]?.lesson;
          return {
            title: skill.title,
            lessonId: lsn?.id,
            lessonTitle: lsn?.title,
          };
        }
      } catch (e) {
        if (hasValidDatabaseUrl) throw e; // database mode never falls back to demo data
        console.warn("Prisma error in resolveSkillInfo:", e);
      }
    }

    const fallbackSkill = fallbackStore.curriculum.skills.find((s) => s.id === skillId);
    let lsnId: string | undefined;
    let lsnTitle: string | undefined;

    if (fallbackSkill) {
      const matchLesson = fallbackStore.curriculum.lessons.find((l) =>
        l.skillIds && l.skillIds.includes(skillId)
      );
      if (matchLesson) {
        lsnId = matchLesson.id;
        lsnTitle = matchLesson.title;
      }
    }

    return {
      title: fallbackSkill?.title || "Target Mathematical Skill",
      lessonId: lsnId,
      lessonTitle: lsnTitle,
    };
  }

  /**
   * Fetch attempts tied to skill from QuestionAttempt and practice sessions
   */
  private static async fetchSkillAttempts(studentId: string, skillId: string) {
    if (hasValidDatabaseUrl) {
      try {
        const dbAttempts = await prisma.questionAttempt.findMany({
          where: {
            studentId,
            OR: [
              { question: { skillId } },
              { question: { practiceSetQuestions: { some: { practiceSet: { skillId } } } } },
            ],
          },
          include: {
            question: { select: { skillId: true, difficulty: true, type: true } },
          },
          orderBy: { submittedAt: "desc" },
        });

        if (dbAttempts.length > 0) {
          return dbAttempts.map((a) => ({
            id: a.id,
            isCorrect: a.isCorrect,
            difficulty: (a as any).question?.difficulty || "MEDIUM",
            questionType: (a as any).question?.type || "MULTIPLE_CHOICE",
            hintUsed: Boolean(a.hintUsed),
            retryCount: 0,
            timeSpent: a.timeTakenMs ? Math.round(a.timeTakenMs / 1000) : 0,
            createdAt: a.submittedAt,
          }));
        }
      } catch (e) {
        if (hasValidDatabaseUrl) throw e; // database mode never falls back to demo data
        console.warn("Prisma error in fetchSkillAttempts:", e);
      }
    }

    // In-memory fallback
    const questionIdsForSkill = fallbackStore.questions
      .filter((q) => q.skillId === skillId)
      .map((q) => q.id);

    // Also include questions in practice sets mapped to this skill
    const practiceSetsForSkill = fallbackStore.practiceSets
      .filter((ps) => ps.skillId === skillId)
      .map((ps) => ps.id);

    const extraQuestionIds = fallbackStore.practiceSetQuestions
      .filter((pq) => practiceSetsForSkill.includes(pq.practiceSetId))
      .map((pq) => pq.questionId);

    const allMatchingQuestionIds = new Set([...questionIdsForSkill, ...extraQuestionIds]);

    const attempts = fallbackStore.questionAttempts.filter(
      (a) => a.studentId === studentId && allMatchingQuestionIds.has(a.questionId)
    );

    return attempts.map((a) => {
      const q = fallbackStore.questions.find((quest) => quest.id === a.questionId);
      return {
        id: a.id,
        isCorrect: a.isCorrect,
        difficulty: q?.difficulty || "MEDIUM",
        questionType: q?.type || "MULTIPLE_CHOICE",
        hintUsed: Boolean(a.hintUsed),
        retryCount: 0,
        timeSpent: a.timeTakenMs ? Math.round(a.timeTakenMs / 1000) : 0,
        createdAt: a.submittedAt,
      };
    });
  }

  /**
   * Count completed practice sessions for this skill
   */
  private static async countCompletedPracticeSessions(studentId: string, skillId: string): Promise<number> {
    if (hasValidDatabaseUrl) {
      try {
        const count = await prisma.practiceSession.count({
          where: {
            studentId,
            status: "COMPLETED",
            practiceSet: { skillId },
          },
        });
        return count;
      } catch (e) {
        if (hasValidDatabaseUrl) throw e; // database mode never falls back to demo data
        console.warn("Prisma error countCompletedPracticeSessions:", e);
      }
    }

    const sets = fallbackStore.practiceSets.filter((ps) => ps.skillId === skillId).map((ps) => ps.id);
    return fallbackStore.practiceSessions.filter(
      (s) =>
        s.studentId === studentId &&
        Boolean(s.practiceSetId && sets.includes(s.practiceSetId)) &&
        s.status === "COMPLETED"
    ).length;
  }

  /**
   * Fetch mistake analyses from Phase 8
   */
  private static async fetchMistakeEvidence(
    studentId: string,
    skillId: string
  ): Promise<MasteryMistakeEvidence> {
    let analyses: any[] = [];

    if (hasValidDatabaseUrl) {
      try {
        analyses = await prisma.mistakeAnalysis.findMany({
          where: { studentId, skillId },
          orderBy: { createdAt: "desc" },
          take: 5,
        });
      } catch (e) {
        if (hasValidDatabaseUrl) throw e; // database mode never falls back to demo data
        console.warn("Prisma error fetchMistakeEvidence:", e);
      }
    }

    if (analyses.length === 0) {
      analyses = (fallbackStore.mistakeAnalyses || []).filter(
        (m) => m.studentId === studentId && m.skillId === skillId
      );
    }

    if (analyses.length === 0) {
      return {
        hasMistakeAnalysis: false,
        totalAnalyses: 0,
        hasRepeatedConceptual: false,
        hasRepeatedSignErrors: false,
        hasPrerequisiteGaps: false,
        hasApplicationDifficulty: false,
        inconsistentPerformance: false,
      };
    }

    const latest = analyses[0];
    const hasRepeatedConceptual = analyses.some(
      (m) => m.category === "CONCEPTUAL_MISUNDERSTANDING" || m.category === "PROCEDURAL_ERROR"
    );
    const hasRepeatedSignErrors = analyses.some((m) => m.category === "SIGN_ERROR");
    const hasPrerequisiteGaps = analyses.some((m) => m.category === "PREREQUISITE_GAP");
    const hasApplicationDifficulty = analyses.some((m) => m.category === "APPLICATION_DIFFICULTY");
    const inconsistentPerformance = analyses.some((m) => m.category === "INCONSISTENT_PERFORMANCE");

    return {
      hasMistakeAnalysis: true,
      totalAnalyses: analyses.length,
      primaryCategory: latest.category,
      hasRepeatedConceptual,
      hasRepeatedSignErrors,
      hasPrerequisiteGaps,
      hasApplicationDifficulty,
      inconsistentPerformance,
      latestObservation: latest.observation,
      latestPattern: latest.pattern,
    };
  }

  /**
   * Fetch adaptive history from Phase 9
   */
  private static async fetchAdaptiveEvidence(
    studentId: string,
    skillId: string
  ): Promise<MasteryAdaptiveEvidence> {
    let recs: any[] = [];

    if (hasValidDatabaseUrl) {
      try {
        recs = await prisma.adaptiveRecommendation.findMany({
          where: { studentId, skillId },
          orderBy: { createdAt: "desc" },
          take: 5,
        });
      } catch (e) {
        if (hasValidDatabaseUrl) throw e; // database mode never falls back to demo data
        console.warn("Prisma error fetchAdaptiveEvidence:", e);
      }
    }

    if (recs.length === 0) {
      recs = (fallbackStore.adaptiveRecommendations || []).filter(
        (r) => r.studentId === studentId && r.skillId === skillId
      );
    }

    const totalRecommendations = recs.length;
    const latest = recs[0];
    const remediationsCompleted = recs.filter(
      (r) => r.decisionType === "REMEDIATE" && r.status === "COMPLETED"
    ).length;
    const prerequisiteReviewsTriggered = recs.filter(
      (r) => r.decisionType === "REVIEW_PREREQUISITE"
    ).length;

    return {
      totalRecommendations,
      lastDecisionType: latest?.decisionType,
      lastTargetDifficulty: latest?.targetDifficulty,
      remediationsCompleted,
      prerequisiteReviewsTriggered,
    };
  }

  /**
   * Check prerequisite skills from Phase 4 DAG
   */
  private static async fetchPrerequisitesCheck(
    studentId: string,
    skillId: string
  ): Promise<PrerequisiteMasteryCheck[]> {
    const checks: PrerequisiteMasteryCheck[] = [];

    let prereqSkillIds: string[] = [];

    if (hasValidDatabaseUrl) {
      try {
        const prereqs = await prisma.skillPrerequisite.findMany({
          where: { skillId },
          include: { prerequisiteSkill: { select: { id: true, title: true } } },
        });
        for (const p of prereqs) {
          const prereqId = p.prerequisiteSkill.id;
          const prereqTitle = p.prerequisiteSkill.title;

          // Check student mastery on prerequisite
          const prereqMastery = await prisma.skillMastery.findUnique({
            where: { studentId_skillId: { studentId, skillId: prereqId } },
          });

          const status = (prereqMastery?.status as MasteryLevel) || "NOT_STARTED";
          const accuracy = prereqMastery?.accuracy || 0.0;
          const isWeak =
            status === "NOT_STARTED" ||
            status === "LEARNING" ||
            (status === "DEVELOPING" && accuracy < MASTERY_CONFIG.prerequisiteConcernThreshold);

          checks.push({
            prerequisiteSkillId: prereqId,
            prerequisiteSkillTitle: prereqTitle,
            status,
            accuracy,
            isWeak,
          });
        }
        return checks;
      } catch (e) {
        if (hasValidDatabaseUrl) throw e; // database mode never falls back to demo data
        console.warn("Prisma error fetchPrerequisitesCheck:", e);
      }
    }

    // Fallback in-memory
    const hardcodedPrereqMap: Record<string, string[]> = {
      skl_02: ["skl_01"], // Compare integers requires Identify integers
      skl_03: ["skl_01", "skl_02"], // Order integers requires Compare integers
      skl_04: ["skl_01"], // Same-sign addition requires Identify integers
    };

    prereqSkillIds = hardcodedPrereqMap[skillId] || [];

    for (const prereqId of prereqSkillIds) {
      const pSkill = fallbackStore.curriculum.skills.find((s) => s.id === prereqId);
      const title = pSkill?.title || "Prerequisite Skill";

      const prereqMastery = (fallbackStore.skillMasteries || []).find(
        (m) => m.studentId === studentId && m.skillId === prereqId
      );

      const status = (prereqMastery?.status as MasteryLevel) || "NOT_STARTED";
      const accuracy = prereqMastery?.accuracy || 0.0;
      const isWeak =
        status === "NOT_STARTED" ||
        status === "LEARNING" ||
        (status === "DEVELOPING" && accuracy < MASTERY_CONFIG.prerequisiteConcernThreshold);

      checks.push({
        prerequisiteSkillId: prereqId,
        prerequisiteSkillTitle: title,
        status,
        accuracy,
        isWeak,
      });
    }

    return checks;
  }
}
