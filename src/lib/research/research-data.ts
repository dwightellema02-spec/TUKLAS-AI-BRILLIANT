/**
 * Tuklas AI - Research data access.
 * Every research query is scoped to a set of students (the teacher's own active-class students; null = everyone,
 * administrators only). With a database configured, ONLY the database is read; without one, the in-memory demo store.
 */

import { prisma, hasValidDatabaseUrl, dbService, fallbackStore } from "../db";
import { assessmentFallbackStore } from "../assessment/assessment-service";

export interface ResearchScope {
  /** null = all students (administrator). An empty array = nobody (a teacher with no students): returns no data. */
  studentIds: string[] | null;
}

export interface AttemptRow {
  studentId: string;
  questionId: string;
  skillId: string | null;
  isCorrect: boolean;
  attemptNumber: number;
  hintUsed: boolean;
  timeTakenMs: number | null;
  submittedAt: Date;
  difficulty: string;
  questionType: string;
  cognitiveLevel: string;
  prompt: string;
  lessonId: string | null;
}

const inScope = (scope: ResearchScope, studentId: string) => scope.studentIds === null || scope.studentIds.includes(studentId);
const studentFilter = (scope: ResearchScope, field: string) => (scope.studentIds === null ? {} : { [field]: { in: scope.studentIds } });

export const ResearchData = {
  async attempts(scope: ResearchScope, filters?: { skillId?: string; lessonId?: string; studentId?: string }): Promise<AttemptRow[]> {
    if (scope.studentIds !== null && scope.studentIds.length === 0) return [];
    if (hasValidDatabaseUrl) {
      const where: any = { ...studentFilter(scope, "studentId") };
      if (filters?.studentId) where.studentId = filters.studentId;
      if (filters?.skillId) where.skillId = filters.skillId;
      if (filters?.lessonId) where.question = { lessonId: filters.lessonId };
      const rows = await prisma.questionAttempt.findMany({ where, include: { question: true }, orderBy: { submittedAt: "asc" } });
      return rows.map((a) => ({
        studentId: a.studentId, questionId: a.questionId, skillId: a.skillId ?? a.question?.skillId ?? null, isCorrect: a.isCorrect,
        attemptNumber: a.attemptNumber, hintUsed: a.hintUsed, timeTakenMs: a.timeTakenMs ?? null, submittedAt: a.submittedAt,
        difficulty: a.question?.difficulty ?? "MEDIUM", questionType: a.question?.type ?? "MULTIPLE_CHOICE",
        cognitiveLevel: (a.question as any)?.cognitiveLevel ?? "PROCEDURAL", prompt: a.question?.prompt ?? "", lessonId: a.question?.lessonId ?? null,
      }));
    }
    return fallbackStore.questionAttempts
      .filter((a) => inScope(scope, a.studentId) && (!filters?.studentId || a.studentId === filters.studentId) && (!filters?.skillId || a.skillId === filters.skillId))
      .map((a) => {
        const q: any = fallbackStore.questions.find((x) => x.id === a.questionId) ?? {};
        return {
          studentId: a.studentId, questionId: a.questionId, skillId: a.skillId ?? q.skillId ?? null, isCorrect: a.isCorrect,
          attemptNumber: a.attemptNumber, hintUsed: !!a.hintUsed, timeTakenMs: a.timeTakenMs ?? null, submittedAt: new Date(a.submittedAt),
          difficulty: q.difficulty ?? "MEDIUM", questionType: q.type ?? "MULTIPLE_CHOICE", cognitiveLevel: q.cognitiveLevel ?? "PROCEDURAL",
          prompt: q.prompt ?? "", lessonId: q.lessonId ?? null,
        };
      })
      .filter((a) => !filters?.lessonId || a.lessonId === filters.lessonId)
      .sort((a, b) => a.submittedAt.getTime() - b.submittedAt.getTime());
  },

  async checkpoints(scope: ResearchScope, studentId?: string): Promise<Array<{ userId: string; isCorrect: boolean; attempt: number }>> {
    if (scope.studentIds !== null && scope.studentIds.length === 0) return [];
    if (hasValidDatabaseUrl) {
      const where: any = { ...studentFilter(scope, "userId") };
      if (studentId) where.userId = studentId;
      const rows = await prisma.checkpointAttempt.findMany({ where, orderBy: { createdAt: "asc" } });
      return rows.map((c) => ({ userId: c.userId, isCorrect: c.isCorrect, attempt: c.attempt }));
    }
    return fallbackStore.checkpointAttempts
      .filter((c) => inScope(scope, c.userId) && (!studentId || c.userId === studentId))
      .map((c) => ({ userId: c.userId, isCorrect: c.isCorrect, attempt: c.attempt }));
  },

  async mistakes(scope: ResearchScope): Promise<Array<{ studentId: string; skillId: string | null; category: string; recommendation: string; createdAt: Date }>> {
    if (scope.studentIds !== null && scope.studentIds.length === 0) return [];
    if (hasValidDatabaseUrl) {
      const rows = await prisma.mistakeAnalysis.findMany({ where: studentFilter(scope, "studentId"), orderBy: { createdAt: "asc" } });
      return rows.map((m) => ({ studentId: m.studentId, skillId: m.skillId, category: m.category, recommendation: m.recommendation, createdAt: m.createdAt }));
    }
    return (fallbackStore.mistakeAnalyses as any[])
      .filter((m) => inScope(scope, m.studentId))
      .map((m) => ({ studentId: m.studentId, skillId: m.skillId ?? null, category: String(m.category ?? "UNKNOWN"), recommendation: m.recommendation ?? "", createdAt: new Date(m.createdAt ?? Date.now()) }));
  },

  async masteries(scope: ResearchScope): Promise<Array<{ studentId: string; skillId: string; status: string }>> {
    if (scope.studentIds !== null && scope.studentIds.length === 0) return [];
    if (hasValidDatabaseUrl) {
      const rows = await prisma.skillMastery.findMany({ where: studentFilter(scope, "studentId"), select: { studentId: true, skillId: true, status: true } });
      return rows.map((r) => ({ studentId: r.studentId, skillId: r.skillId, status: r.status }));
    }
    return (fallbackStore.skillMasteries as any[]).filter((m) => inScope(scope, m.studentId)).map((m) => ({ studentId: m.studentId, skillId: m.skillId, status: String(m.status) }));
  },

  async tutorConversations(scope: ResearchScope): Promise<Array<{ studentId: string; skillId: string | null; createdAt: Date }>> {
    if (scope.studentIds !== null && scope.studentIds.length === 0) return [];
    if (hasValidDatabaseUrl) {
      const rows = await (prisma as any).aITutorConversation.findMany({ where: studentFilter(scope, "studentId"), select: { studentId: true, skillId: true, createdAt: true } });
      return rows.map((r: any) => ({ studentId: r.studentId, skillId: r.skillId ?? null, createdAt: r.createdAt }));
    }
    return (fallbackStore.aiConversations as any[]).filter((c) => inScope(scope, c.studentId)).map((c) => ({ studentId: c.studentId, skillId: c.skillId ?? null, createdAt: new Date(c.createdAt ?? Date.now()) }));
  },

  async skillTitles(): Promise<Map<string, string>> {
    const skills: any[] = (await dbService.getSkills()) as any[];
    return new Map(skills.map((s) => [s.id, s.title]));
  },

  async students(ids: string[]): Promise<Map<string, { name: string; gradeLevel: number | null }>> {
    const out = new Map<string, { name: string; gradeLevel: number | null }>();
    if (ids.length === 0) return out;
    if (hasValidDatabaseUrl) {
      const rows = await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, gradeLevel: true } });
      for (const r of rows) out.set(r.id, { name: r.name, gradeLevel: r.gradeLevel ?? null });
    } else {
      for (const u of fallbackStore.users) if (ids.includes(u.id)) out.set(u.id, { name: u.name, gradeLevel: (u as any).gradeLevel ?? null });
    }
    return out;
  },

  /** Graded results of one assessment, one row (the latest graded attempt) per student, with each response's skill. */
  async assessmentResults(assessmentId: string, scope: ResearchScope): Promise<{
    title: string | null;
    perStudent: Array<{ studentId: string; scorePercent: number; submittedAt: Date | null }>;
    responses: Array<{ skillId: string | null; isCorrect: boolean }>;
  }> {
    if (scope.studentIds !== null && scope.studentIds.length === 0) return { title: null, perStudent: [], responses: [] };
    let title: string | null = null;
    let attempts: Array<{ studentId: string; scorePercent: number; submittedAt: Date | null; responses: Array<{ questionId: string; isCorrect: boolean }> }> = [];

    if (hasValidDatabaseUrl) {
      const asm = await prisma.assessment.findUnique({ where: { id: assessmentId }, select: { title: true } });
      title = asm?.title ?? null;
      const rows = await prisma.assessmentAttempt.findMany({
        where: { assessmentId, status: "GRADED", ...studentFilter(scope, "studentId") },
        include: { responses: { select: { questionId: true, isCorrect: true } } },
        orderBy: { startedAt: "asc" },
      });
      attempts = rows.map((r) => ({ studentId: r.studentId, scorePercent: r.scorePercent, submittedAt: r.submittedAt, responses: r.responses }));
    } else {
      title = assessmentFallbackStore.assessments.find((a) => a.id === assessmentId)?.title ?? null;
      attempts = assessmentFallbackStore.attempts
        .filter((a) => a.assessmentId === assessmentId && a.status === "GRADED" && inScope(scope, a.studentId))
        .map((a) => ({ studentId: a.studentId, scorePercent: a.scorePercent, submittedAt: a.submittedAt ? new Date(a.submittedAt) : null, responses: a.responses }));
    }

    const latest = new Map<string, (typeof attempts)[number]>();
    for (const a of attempts) latest.set(a.studentId, a); // ordered oldest -> newest, so the last one wins

    const questionIds = Array.from(new Set(Array.from(latest.values()).flatMap((a) => a.responses.map((r) => r.questionId))));
    const skillOf = new Map<string, string | null>();
    if (questionIds.length > 0) {
      if (hasValidDatabaseUrl) {
        const qs = await prisma.question.findMany({ where: { id: { in: questionIds } }, select: { id: true, skillId: true } });
        for (const q of qs) skillOf.set(q.id, q.skillId);
      } else {
        for (const q of fallbackStore.questions) if (questionIds.includes(q.id)) skillOf.set(q.id, (q as any).skillId ?? null);
      }
    }
    return {
      title,
      perStudent: Array.from(latest.values()).map((a) => ({ studentId: a.studentId, scorePercent: a.scorePercent, submittedAt: a.submittedAt })),
      responses: Array.from(latest.values()).flatMap((a) => a.responses.map((r) => ({ skillId: skillOf.get(r.questionId) ?? null, isCorrect: r.isCorrect }))),
    };
  },
};
