/**
 * Tuklas AI - Assessment Service
 * Phase 14: Comprehensive Assessment Engine (Pre-Test, Post-Test, Diagnostic, Formative, Summative)
 */

import { prisma, hasValidDatabaseUrl, dbService, fallbackStore } from "../db";
import { QuestionValidator } from "../question-validator";
import { MistakeAnalyzerService } from "../ai/mistake-analyzer";
import type {
  AssessmentDTO,
  AssessmentItemDTO,
  AssessmentAttemptResultDTO,
  AssessmentType,
  AssessmentStatus,
  CognitiveLevel,
} from "../research/research-types";

// In-memory fallback structures for development/test mode
export interface AssessmentStoreItem {
  id: string;
  title: string;
  description?: string;
  type: AssessmentType;
  status: AssessmentStatus;
  timeLimitMinutes?: number;
  passingScorePercent: number;
  authorId: string;
  lessonId?: string;
  unitId?: string;
  gradeLevel: number;
  shuffleQuestions: boolean;
  showFeedbackImmediately: boolean;
  metadata?: string;
  createdAt: Date;
  updatedAt: Date;
  items: Array<{
    id: string;
    assessmentId: string;
    questionId: string;
    sequenceOrder: number;
    points: number;
    cognitiveLevel: CognitiveLevel;
  }>;
  assignments: Array<{
    id: string;
    assessmentId: string;
    classroomId?: string;
    studentId?: string;
    dueDate?: Date;
    assignedAt: Date;
  }>;
}

export interface AssessmentAttemptStoreItem {
  id: string;
  assessmentId: string;
  studentId: string;
  assessmentType: AssessmentType;
  status: "IN_PROGRESS" | "SUBMITTED" | "GRADED";
  score: number;
  maxScore: number;
  scorePercent: number;
  isPassed: boolean;
  startedAt: Date;
  submittedAt?: Date;
  timeTakenMs?: number;
  metadata?: string;
  responses: Array<{
    id: string;
    attemptId: string;
    assessmentItemId: string;
    questionId: string;
    studentAnswer: string;
    isCorrect: boolean;
    scoreAwarded: number;
    points: number;
    timeTakenMs?: number;
    hintUsed: boolean;
    mistakeCategory?: string;
    cognitiveLevel: CognitiveLevel;
    feedbackGiven?: string;
    submittedAt: Date;
  }>;
}

// Global in-memory store for fallback/dev/test execution
export const assessmentFallbackStore: {
  assessments: AssessmentStoreItem[];
  attempts: AssessmentAttemptStoreItem[];
} = {
  assessments: [
    {
      id: "asm_pre_integers",
      title: "Pre-Test: Foundational Integer Concepts & Number Lines",
      description: "Baseline diagnostic assessment for Grade 7 MATATAG Unit 1: Numbers & Algebraic Expressions.",
      type: "PRE_TEST",
      status: "PUBLISHED",
      timeLimitMinutes: 30,
      passingScorePercent: 70.0,
      authorId: "usr_teacher_01",
      lessonId: "lsn_01",
      gradeLevel: 7,
      shuffleQuestions: false,
      showFeedbackImmediately: true,
      createdAt: new Date("2026-09-01"),
      updatedAt: new Date(),
      items: [
        {
          id: "asmi_01",
          assessmentId: "asm_pre_integers",
          questionId: "qst_01",
          sequenceOrder: 1,
          points: 1.0,
          cognitiveLevel: "KNOWLEDGE",
        },
        {
          id: "asmi_02",
          assessmentId: "asm_pre_integers",
          questionId: "qst_02",
          sequenceOrder: 2,
          points: 1.0,
          cognitiveLevel: "PROCEDURAL",
        },
        {
          id: "asmi_03",
          assessmentId: "asm_pre_integers",
          questionId: "qst_03",
          sequenceOrder: 3,
          points: 2.0,
          cognitiveLevel: "APPLICATION",
        },
        {
          id: "asmi_04",
          assessmentId: "asm_pre_integers",
          questionId: "qst_04",
          sequenceOrder: 4,
          points: 2.0,
          cognitiveLevel: "HIGHER_ORDER",
        },
      ],
      assignments: [
        {
          id: "asga_01",
          assessmentId: "asm_pre_integers",
          classroomId: "cls_mabini_01",
          assignedAt: new Date("2026-09-01"),
        },
      ],
    },
    {
      id: "asm_post_integers",
      title: "Post-Test: Comprehensive Mastery of Integers & Operations",
      description: "Summative evaluation of integer representation, addition, and subtraction rules.",
      type: "POST_TEST",
      status: "PUBLISHED",
      timeLimitMinutes: 30,
      passingScorePercent: 70.0,
      authorId: "usr_teacher_01",
      lessonId: "lsn_01",
      gradeLevel: 7,
      shuffleQuestions: false,
      showFeedbackImmediately: true,
      createdAt: new Date("2026-09-15"),
      updatedAt: new Date(),
      items: [
        {
          id: "asmi_11",
          assessmentId: "asm_post_integers",
          questionId: "qst_01",
          sequenceOrder: 1,
          points: 1.0,
          cognitiveLevel: "KNOWLEDGE",
        },
        {
          id: "asmi_12",
          assessmentId: "asm_post_integers",
          questionId: "qst_02",
          sequenceOrder: 2,
          points: 1.0,
          cognitiveLevel: "PROCEDURAL",
        },
        {
          id: "asmi_13",
          assessmentId: "asm_post_integers",
          questionId: "qst_05",
          sequenceOrder: 3,
          points: 2.0,
          cognitiveLevel: "APPLICATION",
        },
        {
          id: "asmi_14",
          assessmentId: "asm_post_integers",
          questionId: "qst_06",
          sequenceOrder: 4,
          points: 2.0,
          cognitiveLevel: "HIGHER_ORDER",
        },
      ],
      assignments: [
        {
          id: "asga_02",
          assessmentId: "asm_post_integers",
          classroomId: "cls_mabini_01",
          assignedAt: new Date("2026-09-15"),
        },
      ],
    },
  ],
  attempts: [
    {
      id: "att_pre_sample_01",
      assessmentId: "asm_pre_integers",
      studentId: "usr_student_01",
      assessmentType: "PRE_TEST",
      status: "GRADED",
      score: 4.0,
      maxScore: 6.0,
      scorePercent: 66.7,
      isPassed: false,
      startedAt: new Date("2026-09-02T08:00:00Z"),
      submittedAt: new Date("2026-09-02T08:22:00Z"),
      timeTakenMs: 1320000,
      responses: [
        {
          id: "resp_01",
          attemptId: "att_pre_sample_01",
          assessmentItemId: "asmi_01",
          questionId: "qst_01",
          studentAnswer: "-9",
          isCorrect: true,
          scoreAwarded: 1.0,
          points: 1.0,
          hintUsed: false,
          cognitiveLevel: "KNOWLEDGE",
          submittedAt: new Date("2026-09-02T08:05:00Z"),
        },
        {
          id: "resp_02",
          attemptId: "att_pre_sample_01",
          assessmentItemId: "asmi_02",
          questionId: "qst_02",
          studentAnswer: "-2",
          isCorrect: true,
          scoreAwarded: 1.0,
          points: 1.0,
          hintUsed: false,
          cognitiveLevel: "PROCEDURAL",
          submittedAt: new Date("2026-09-02T08:10:00Z"),
        },
        {
          id: "resp_03",
          attemptId: "att_pre_sample_01",
          assessmentItemId: "asmi_03",
          questionId: "qst_03",
          studentAnswer: "-14",
          isCorrect: false,
          scoreAwarded: 0.0,
          points: 2.0,
          hintUsed: true,
          mistakeCategory: "SIGN_ERROR",
          cognitiveLevel: "APPLICATION",
          submittedAt: new Date("2026-09-02T08:18:00Z"),
        },
        {
          id: "resp_04",
          attemptId: "att_pre_sample_01",
          assessmentItemId: "asmi_04",
          questionId: "qst_04",
          studentAnswer: "3",
          isCorrect: true,
          scoreAwarded: 2.0,
          points: 2.0,
          hintUsed: false,
          cognitiveLevel: "HIGHER_ORDER",
          submittedAt: new Date("2026-09-02T08:22:00Z"),
        },
      ],
    },
    {
      id: "att_post_sample_01",
      assessmentId: "asm_post_integers",
      studentId: "usr_student_01",
      assessmentType: "POST_TEST",
      status: "GRADED",
      score: 5.5,
      maxScore: 6.0,
      scorePercent: 91.7,
      isPassed: true,
      startedAt: new Date("2026-09-16T09:00:00Z"),
      submittedAt: new Date("2026-09-16T09:18:00Z"),
      timeTakenMs: 1080000,
      responses: [
        {
          id: "resp_11",
          attemptId: "att_post_sample_01",
          assessmentItemId: "asmi_11",
          questionId: "qst_01",
          studentAnswer: "-9",
          isCorrect: true,
          scoreAwarded: 1.0,
          points: 1.0,
          hintUsed: false,
          cognitiveLevel: "KNOWLEDGE",
          submittedAt: new Date("2026-09-16T09:03:00Z"),
        },
        {
          id: "resp_12",
          attemptId: "att_post_sample_01",
          assessmentItemId: "asmi_12",
          questionId: "qst_02",
          studentAnswer: "-2",
          isCorrect: true,
          scoreAwarded: 1.0,
          points: 1.0,
          hintUsed: false,
          cognitiveLevel: "PROCEDURAL",
          submittedAt: new Date("2026-09-16T09:07:00Z"),
        },
        {
          id: "resp_13",
          attemptId: "att_post_sample_01",
          assessmentItemId: "asmi_13",
          questionId: "qst_05",
          studentAnswer: "-2",
          isCorrect: true,
          scoreAwarded: 2.0,
          points: 2.0,
          hintUsed: false,
          cognitiveLevel: "APPLICATION",
          submittedAt: new Date("2026-09-16T09:14:00Z"),
        },
        {
          id: "resp_14",
          attemptId: "att_post_sample_01",
          assessmentItemId: "asmi_14",
          questionId: "qst_06",
          studentAnswer: "-1",
          isCorrect: false,
          scoreAwarded: 0.5,
          points: 2.0,
          hintUsed: false,
          mistakeCategory: "CALCULATION_ERROR",
          cognitiveLevel: "HIGHER_ORDER",
          submittedAt: new Date("2026-09-16T09:18:00Z"),
        },
      ],
    },
  ],
};

export class AssessmentService {
  /**
   * Create formal Assessment (Teacher/Admin only)
   */
  static async createAssessment(
    data: {
      title: string;
      description?: string;
      type: AssessmentType;
      lessonId?: string;
      unitId?: string;
      gradeLevel?: number;
      timeLimitMinutes?: number;
      passingScorePercent?: number;
      questions: Array<{
        questionId: string;
        points?: number;
        cognitiveLevel?: CognitiveLevel;
      }>;
    },
    authorId: string,
    userRole: string
  ): Promise<AssessmentDTO> {
    if (userRole !== "TEACHER" && userRole !== "ADMIN") {
      throw new Error("Forbidden: Only teachers and administrators can create assessments.");
    }

    if (!data.title || data.title.trim().length === 0) {
      throw new Error("Assessment title is required.");
    }

    if (!data.questions || data.questions.length === 0) {
      throw new Error("Assessment must contain at least one question item.");
    }

    const assessmentId = `asm_${Date.now()}`;
    const gradeLevel = data.gradeLevel || 7;
    const passingScorePercent = data.passingScorePercent || 70.0;
    const createdAt = new Date();

    const items = data.questions.map((q, idx) => ({
      id: `asmi_${Date.now()}_${idx}`,
      assessmentId,
      questionId: q.questionId,
      sequenceOrder: idx + 1,
      points: q.points !== undefined ? q.points : 1.0,
      cognitiveLevel: q.cognitiveLevel || "PROCEDURAL",
    }));

    const totalPoints = items.reduce((sum, item) => sum + item.points, 0);

    try {
      if (hasValidDatabaseUrl) {
        const created = await prisma.assessment.create({
          data: {
            id: assessmentId,
            title: data.title.trim(),
            description: data.description,
            type: data.type,
            status: "DRAFT",
            timeLimitMinutes: data.timeLimitMinutes,
            passingScorePercent,
            authorId,
            lessonId: data.lessonId || null,
            unitId: data.unitId || null,
            gradeLevel,
            items: {
              create: items.map((it) => ({
                id: it.id,
                questionId: it.questionId,
                sequenceOrder: it.sequenceOrder,
                points: it.points,
                cognitiveLevel: it.cognitiveLevel,
              })),
            },
          },
          include: {
            items: {
              include: { question: true },
              orderBy: { sequenceOrder: "asc" },
            },
            author: { select: { id: true, name: true } },
          },
        });

        return {
          id: created.id,
          title: created.title,
          description: created.description || undefined,
          type: created.type,
          status: created.status,
          timeLimitMinutes: created.timeLimitMinutes || undefined,
          passingScorePercent: created.passingScorePercent,
          authorId: created.authorId,
          authorName: created.author.name,
          lessonId: created.lessonId || undefined,
          gradeLevel: created.gradeLevel,
          itemCount: created.items.length,
          totalPoints,
          createdAt: created.createdAt.toISOString(),
          updatedAt: created.updatedAt.toISOString(),
        };
      }
    } catch (e) {
      if (process.env.NODE_ENV === "production") {
        throw new Error(`Database error creating assessment: ${e instanceof Error ? e.message : String(e)}`);
      }
      console.warn("createAssessment fallback:", e);
    }

    const newStoreItem: AssessmentStoreItem = {
      id: assessmentId,
      title: data.title.trim(),
      description: data.description,
      type: data.type,
      status: "DRAFT",
      timeLimitMinutes: data.timeLimitMinutes,
      passingScorePercent,
      authorId,
      lessonId: data.lessonId,
      unitId: data.unitId,
      gradeLevel,
      shuffleQuestions: false,
      showFeedbackImmediately: true,
      createdAt,
      updatedAt: createdAt,
      items,
      assignments: [],
    };

    assessmentFallbackStore.assessments.push(newStoreItem);

    return {
      id: newStoreItem.id,
      title: newStoreItem.title,
      description: newStoreItem.description,
      type: newStoreItem.type,
      status: newStoreItem.status,
      timeLimitMinutes: newStoreItem.timeLimitMinutes,
      passingScorePercent: newStoreItem.passingScorePercent,
      authorId: newStoreItem.authorId,
      authorName: "Teacher Santos",
      lessonId: newStoreItem.lessonId,
      gradeLevel: newStoreItem.gradeLevel,
      itemCount: newStoreItem.items.length,
      totalPoints,
      createdAt: newStoreItem.createdAt.toISOString(),
      updatedAt: newStoreItem.updatedAt.toISOString(),
    };
  }

  /**
   * Publish Assessment (Teacher/Admin only)
   */
  static async publishAssessment(assessmentId: string, userId: string, userRole: string): Promise<AssessmentDTO> {
    if (userRole !== "TEACHER" && userRole !== "ADMIN") {
      throw new Error("Forbidden: Teacher or Administrator access required to publish assessments.");
    }

    try {
      if (hasValidDatabaseUrl) {
        const found = await prisma.assessment.findUnique({
          where: { id: assessmentId },
          include: { items: true, author: true },
        });

        if (!found) throw new Error("Assessment not found");
        if (userRole !== "ADMIN" && found.authorId !== userId) {
          throw new Error("Forbidden: You cannot publish an assessment created by another teacher.");
        }

        const updated = await prisma.assessment.update({
          where: { id: assessmentId },
          data: { status: "PUBLISHED" },
          include: { items: true, author: true },
        });

        return {
          id: updated.id,
          title: updated.title,
          description: updated.description || undefined,
          type: updated.type,
          status: updated.status,
          passingScorePercent: updated.passingScorePercent,
          authorId: updated.authorId,
          authorName: updated.author.name,
          gradeLevel: updated.gradeLevel,
          itemCount: updated.items.length,
          totalPoints: updated.items.reduce((s, it) => s + it.points, 0),
          createdAt: updated.createdAt.toISOString(),
          updatedAt: updated.updatedAt.toISOString(),
        };
      }
    } catch (e) {
      if (process.env.NODE_ENV === "production") {
        throw new Error(`Database error publishing assessment: ${e instanceof Error ? e.message : String(e)}`);
      }
      console.warn("publishAssessment fallback:", e);
    }

    const found = assessmentFallbackStore.assessments.find((a) => a.id === assessmentId);
    if (!found) throw new Error("Assessment not found");
    if (userRole !== "ADMIN" && found.authorId !== userId) {
      throw new Error("Forbidden: You cannot publish an assessment created by another teacher.");
    }

    found.status = "PUBLISHED";
    found.updatedAt = new Date();

    return {
      id: found.id,
      title: found.title,
      description: found.description,
      type: found.type,
      status: found.status,
      passingScorePercent: found.passingScorePercent,
      authorId: found.authorId,
      authorName: "Teacher Santos",
      gradeLevel: found.gradeLevel,
      itemCount: found.items.length,
      totalPoints: found.items.reduce((s, it) => s + it.points, 0),
      createdAt: found.createdAt.toISOString(),
      updatedAt: found.updatedAt.toISOString(),
    };
  }

  /**
   * Assign Assessment to Classroom (Teacher/Admin only)
   */
  static async assignAssessment(
    assessmentId: string,
    classroomId: string,
    options: { studentId?: string; dueDate?: Date | string },
    userId: string,
    userRole: string
  ): Promise<{ success: boolean; assignmentId: string }> {
    if (userRole !== "TEACHER" && userRole !== "ADMIN") {
      throw new Error("Forbidden: Teacher or Administrator access required to assign assessments.");
    }

    const assignmentId = `asga_${Date.now()}`;
    const dueDate = options.dueDate ? new Date(options.dueDate) : undefined;

    try {
      if (hasValidDatabaseUrl) {
        const assessment = await prisma.assessment.findUnique({ where: { id: assessmentId } });
        if (!assessment) throw new Error("Assessment not found");
        if (userRole !== "ADMIN" && assessment.authorId !== userId) {
          throw new Error("Forbidden: You cannot assign an assessment you do not own.");
        }

        await prisma.assessmentAssignment.create({
          data: {
            id: assignmentId,
            assessmentId,
            classroomId,
            studentId: options.studentId || null,
            dueDate,
          },
        });

        return { success: true, assignmentId };
      }
    } catch (e) {
      if (process.env.NODE_ENV === "production") {
        throw new Error(`Database error assigning assessment: ${e instanceof Error ? e.message : String(e)}`);
      }
      console.warn("assignAssessment fallback:", e);
    }

    const assessment = assessmentFallbackStore.assessments.find((a) => a.id === assessmentId);
    if (!assessment) throw new Error("Assessment not found");
    if (userRole !== "ADMIN" && assessment.authorId !== userId) {
      throw new Error("Forbidden: You cannot assign an assessment you do not own.");
    }

    assessment.assignments.push({
      id: assignmentId,
      assessmentId,
      classroomId,
      studentId: options.studentId,
      dueDate,
      assignedAt: new Date(),
    });

    return { success: true, assignmentId };
  }

  /**
   * Get Assessment for Student with server-side answer redaction
   */
  static async getAssessmentForStudent(assessmentId: string, studentId: string): Promise<AssessmentDTO> {
    let assessment: any = null;

    try {
      if (hasValidDatabaseUrl) {
        assessment = await prisma.assessment.findUnique({
          where: { id: assessmentId },
          include: {
            items: {
              include: { question: true },
              orderBy: { sequenceOrder: "asc" },
            },
            author: { select: { id: true, name: true } },
          },
        });
      }
    } catch (e) {
      console.warn("getAssessmentForStudent db error:", e);
    }

    if (!assessment) {
      assessment = assessmentFallbackStore.assessments.find((a) => a.id === assessmentId);
    }

    if (!assessment) throw new Error("Assessment not found");

    // Security Gate: Students can only view PUBLISHED assessments
    if (assessment.status !== "PUBLISHED") {
      throw new Error("Forbidden: This assessment is not currently published for student access.");
    }

    // Build items with REDACTED answers
    const items: AssessmentItemDTO[] = (assessment.items || []).map((it: any) => {
      let q = it.question;
      if (!q) {
        q = fallbackStore.questions.find((fq) => fq.id === it.questionId) || {};
      }

      let qData: any = {};
      try {
        qData = typeof q.questionData === "string" ? JSON.parse(q.questionData) : q.questionData || {};
      } catch {
        qData = {};
      }

      return {
        id: it.id,
        assessmentId: it.assessmentId,
        questionId: it.questionId,
        sequenceOrder: it.sequenceOrder,
        points: it.points,
        cognitiveLevel: it.cognitiveLevel || "PROCEDURAL",
        question: {
          id: q.id,
          prompt: q.prompt,
          type: q.type,
          difficulty: q.difficulty || "MEDIUM",
          skillId: q.skillId,
          lessonId: q.lessonId,
          options: qData.options || qData.choices,
          // CRITICAL SECURITY: correctAnswer is strictly redacted!
          correctAnswer: undefined,
          explanation: undefined,
        },
      };
    });

    const totalPoints = items.reduce((sum, it) => sum + it.points, 0);

    return {
      id: assessment.id,
      title: assessment.title,
      description: assessment.description || undefined,
      type: assessment.type,
      status: assessment.status,
      timeLimitMinutes: assessment.timeLimitMinutes || undefined,
      passingScorePercent: assessment.passingScorePercent,
      authorId: assessment.authorId,
      authorName: assessment.author?.name || "Teacher",
      lessonId: assessment.lessonId || undefined,
      gradeLevel: assessment.gradeLevel,
      itemCount: items.length,
      totalPoints,
      items,
      createdAt: assessment.createdAt instanceof Date ? assessment.createdAt.toISOString() : assessment.createdAt,
      updatedAt: assessment.updatedAt instanceof Date ? assessment.updatedAt.toISOString() : assessment.updatedAt,
    };
  }

  /**
   * Start Assessment Attempt for Student
   */
  static async startAssessmentAttempt(
    assessmentId: string,
    studentId: string
  ): Promise<{ attemptId: string; assessmentTitle: string; totalItems: number }> {
    const assessment = await this.getAssessmentForStudent(assessmentId, studentId);
    const attemptId = `att_${Date.now()}`;

    try {
      if (hasValidDatabaseUrl) {
        await prisma.assessmentAttempt.create({
          data: {
            id: attemptId,
            assessmentId,
            studentId,
            assessmentType: assessment.type,
            status: "IN_PROGRESS",
            maxScore: assessment.totalPoints,
          },
        });

        return {
          attemptId,
          assessmentTitle: assessment.title,
          totalItems: assessment.itemCount,
        };
      }
    } catch (e) {
      if (process.env.NODE_ENV === "production") {
        throw new Error(`Database error starting attempt: ${e instanceof Error ? e.message : String(e)}`);
      }
      console.warn("startAssessmentAttempt fallback:", e);
    }

    assessmentFallbackStore.attempts.push({
      id: attemptId,
      assessmentId,
      studentId,
      assessmentType: assessment.type,
      status: "IN_PROGRESS",
      score: 0,
      maxScore: assessment.totalPoints,
      scorePercent: 0,
      isPassed: false,
      startedAt: new Date(),
      responses: [],
    });

    return {
      attemptId,
      assessmentTitle: assessment.title,
      totalItems: assessment.itemCount,
    };
  }

  /**
   * Submit Assessment Attempt (Strict Server-Side Scoring & Deterministic Research Tracking)
   */
  static async submitAssessmentAttempt(
    attemptId: string,
    studentId: string,
    responses: Array<{
      assessmentItemId: string;
      questionId: string;
      studentAnswer: any;
      timeTakenMs?: number;
      hintUsed?: boolean;
    }>
  ): Promise<AssessmentAttemptResultDTO> {
    // 1. Locate attempt record
    let attemptRecord: any = null;

    try {
      if (hasValidDatabaseUrl) {
        attemptRecord = await prisma.assessmentAttempt.findUnique({
          where: { id: attemptId },
          include: {
            assessment: {
              include: {
                items: { include: { question: true } },
              },
            },
          },
        });
      }
    } catch (e) {
      console.warn("submitAssessmentAttempt findUnique db error:", e);
    }

    if (!attemptRecord) {
      attemptRecord = assessmentFallbackStore.attempts.find((a) => a.id === attemptId);
      if (attemptRecord) {
        const asm = assessmentFallbackStore.assessments.find((a) => a.id === attemptRecord.assessmentId);
        attemptRecord = { ...attemptRecord, assessment: asm };
      }
    }

    if (!attemptRecord) throw new Error("Assessment attempt record not found.");

    // Security Gate: Ensure authenticated student is the attempt owner
    if (attemptRecord.studentId !== studentId) {
      throw new Error("Forbidden: You cannot submit an assessment on behalf of another student.");
    }

    if (attemptRecord.status === "SUBMITTED" || attemptRecord.status === "GRADED") {
      throw new Error("Invalid request: This assessment attempt has already been submitted and scored.");
    }

    const assessment = attemptRecord.assessment;
    const items = assessment.items || [];

    // 2. Server-Side Deterministic Grading
    let totalScore = 0;
    let maxScore = 0;
    const scoredResponses: any[] = [];
    const cognitiveBreakdown: Record<CognitiveLevel, { score: number; maxScore: number; accuracy: number }> = {
      KNOWLEDGE: { score: 0, maxScore: 0, accuracy: 0 },
      PROCEDURAL: { score: 0, maxScore: 0, accuracy: 0 },
      APPLICATION: { score: 0, maxScore: 0, accuracy: 0 },
      HIGHER_ORDER: { score: 0, maxScore: 0, accuracy: 0 },
    };
    const skillBreakdown: Record<string, { skillTitle: string; correct: number; total: number; accuracy: number }> =
      {};

    for (const item of items) {
      const q =
        item.question || fallbackStore.questions.find((fq) => fq.id === item.questionId) || {};
      const studentResp = responses.find(
        (r) => r.assessmentItemId === item.id || r.questionId === item.questionId
      );

      const studentAnswer = studentResp ? String(studentResp.studentAnswer) : "";
      const cogLevel: CognitiveLevel = item.cognitiveLevel || "PROCEDURAL";
      const itemPoints = item.points || 1.0;
      maxScore += itemPoints;

      // Evaluate answer via deterministic QuestionValidator
      const validation = QuestionValidator.validate(
        {
          type: q.type,
          prompt: q.prompt,
          explanation: q.explanation,
          correctFeedback: q.correctFeedback,
          incorrectFeedback: q.incorrectFeedback,
          questionData: q.questionData,
        },
        studentAnswer
      );

      const isCorrect = validation.isCorrect;
      const scoreAwarded = isCorrect ? itemPoints : 0;
      totalScore += scoreAwarded;

      // Mistake analysis if incorrect
      let mistakeCategory: any = undefined;
      if (!isCorrect && studentAnswer) {
        const mistakeEval = MistakeAnalyzerService.evaluateAttempt({
          prompt: q.prompt,
          questionData: q.questionData,
          studentAnswer,
          correctAnswer: validation.expectedAnswerDisplay,
          skillId: q.skillId,
        });
        mistakeCategory = mistakeEval.category;
      }

      // Update cognitive breakdown
      cognitiveBreakdown[cogLevel].maxScore += itemPoints;
      cognitiveBreakdown[cogLevel].score += scoreAwarded;

      // Update skill breakdown
      const sId = q.skillId || "general_skill";
      if (!skillBreakdown[sId]) {
        const skillObj = fallbackStore.curriculum.skills.find((s) => s.id === sId);
        skillBreakdown[sId] = {
          skillTitle: skillObj?.title || "Foundational Mathematics",
          correct: 0,
          total: 0,
          accuracy: 0,
        };
      }
      skillBreakdown[sId].total += 1;
      if (isCorrect) skillBreakdown[sId].correct += 1;

      scoredResponses.push({
        id: `resp_${Date.now()}_${item.id}`,
        attemptId,
        assessmentItemId: item.id,
        questionId: item.questionId,
        prompt: q.prompt,
        studentAnswer,
        correctAnswer: validation.expectedAnswerDisplay,
        isCorrect,
        scoreAwarded,
        points: itemPoints,
        cognitiveLevel: cogLevel,
        mistakeCategory,
        feedbackGiven: isCorrect ? validation.feedback : validation.feedback || q.incorrectFeedback,
        timeTakenMs: studentResp?.timeTakenMs || 0,
        hintUsed: !!studentResp?.hintUsed,
      });

      // Also persist to global QuestionAttempt store for historical mastery and practice tracking
      try {
        await dbService.submitQuestionAttempt({
          studentId,
          questionId: item.questionId,
          skillId: q.skillId,
          answer: studentAnswer,
          isCorrect,
          attemptNumber: 1,
          timeTakenMs: studentResp?.timeTakenMs || 0,
          hintUsed: !!studentResp?.hintUsed,
        });
      } catch (err) {
        console.warn("Trace attempt link warning:", err);
      }
    }

    // Compute ratios
    for (const k of Object.keys(cognitiveBreakdown) as CognitiveLevel[]) {
      const b = cognitiveBreakdown[k];
      b.accuracy = b.maxScore > 0 ? Number((b.score / b.maxScore).toFixed(4)) : 0;
    }
    for (const sId of Object.keys(skillBreakdown)) {
      const s = skillBreakdown[sId];
      s.accuracy = s.total > 0 ? Number((s.correct / s.total).toFixed(4)) : 0;
    }

    const scorePercent = maxScore > 0 ? Number(((totalScore / maxScore) * 100).toFixed(1)) : 0;
    const isPassed = scorePercent >= (assessment.passingScorePercent || 70.0);
    const submittedAt = new Date();

    // 3. Persist Graded Attempt
    try {
      if (hasValidDatabaseUrl) {
        await prisma.$transaction([
          prisma.assessmentAttempt.update({
            where: { id: attemptId },
            data: {
              status: "GRADED",
              score: totalScore,
              maxScore,
              scorePercent,
              isPassed,
              submittedAt,
              metadata: JSON.stringify({ cognitiveBreakdown, skillBreakdown }),
            },
          }),
          ...scoredResponses.map((sr) =>
            prisma.assessmentItemResponse.create({
              data: {
                id: sr.id,
                attemptId,
                assessmentItemId: sr.assessmentItemId,
                questionId: sr.questionId,
                studentAnswer: sr.studentAnswer,
                isCorrect: sr.isCorrect,
                scoreAwarded: sr.scoreAwarded,
                timeTakenMs: sr.timeTakenMs,
                hintUsed: sr.hintUsed,
                mistakeCategory: sr.mistakeCategory,
                cognitiveLevel: sr.cognitiveLevel,
                feedbackGiven: sr.feedbackGiven,
                submittedAt,
              },
            })
          ),
        ]);
      }
    } catch (e) {
      if (process.env.NODE_ENV === "production") {
        throw new Error(`Database error saving graded attempt: ${e instanceof Error ? e.message : String(e)}`);
      }
      console.warn("submitAssessmentAttempt fallback update:", e);
    }

    // Update in-memory store
    const localAttempt = assessmentFallbackStore.attempts.find((a) => a.id === attemptId);
    if (localAttempt) {
      localAttempt.status = "GRADED";
      localAttempt.score = totalScore;
      localAttempt.maxScore = maxScore;
      localAttempt.scorePercent = scorePercent;
      localAttempt.isPassed = isPassed;
      localAttempt.submittedAt = submittedAt;
      localAttempt.responses = scoredResponses.map((sr) => ({
        ...sr,
        submittedAt,
      }));
    }

    return {
      id: attemptId,
      assessmentId: assessment.id,
      assessmentTitle: assessment.title,
      assessmentType: assessment.type,
      studentId,
      status: "GRADED",
      score: totalScore,
      maxScore,
      scorePercent,
      isPassed,
      startedAt: attemptRecord.startedAt.toISOString(),
      submittedAt: submittedAt.toISOString(),
      cognitiveBreakdown,
      skillBreakdown,
      responses: scoredResponses,
    };
  }

  /**
   * List Assessments with Scoped Authorization
   */
  static async listAssessments(
    filters: {
      type?: AssessmentType;
      status?: AssessmentStatus;
      gradeLevel?: number;
      lessonId?: string;
    },
    userId: string,
    userRole: string
  ): Promise<AssessmentDTO[]> {
    try {
      if (hasValidDatabaseUrl) {
        const where: any = {};
        if (filters.type) where.type = filters.type;
        if (filters.gradeLevel) where.gradeLevel = filters.gradeLevel;
        if (filters.lessonId) where.lessonId = filters.lessonId;

        // Student scoping: can only view PUBLISHED
        if (userRole === "STUDENT") {
          where.status = "PUBLISHED";
        } else if (filters.status) {
          where.status = filters.status;
        }

        // Teacher scoping: sees their own drafts, or published ones
        if (userRole === "TEACHER") {
          where.OR = [{ authorId: userId }, { status: "PUBLISHED" }];
        }

        const found = await prisma.assessment.findMany({
          where,
          include: {
            items: true,
            author: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: "desc" },
        });

        return found.map((a) => ({
          id: a.id,
          title: a.title,
          description: a.description || undefined,
          type: a.type,
          status: a.status,
          passingScorePercent: a.passingScorePercent,
          authorId: a.authorId,
          authorName: a.author.name,
          gradeLevel: a.gradeLevel,
          itemCount: a.items.length,
          totalPoints: a.items.reduce((s, it) => s + it.points, 0),
          createdAt: a.createdAt.toISOString(),
          updatedAt: a.updatedAt.toISOString(),
        }));
      }
    } catch (e) {
      console.warn("listAssessments db fallback:", e);
    }

    return assessmentFallbackStore.assessments
      .filter((a) => {
        if (userRole === "STUDENT" && a.status !== "PUBLISHED") return false;
        if (filters.type && a.type !== filters.type) return false;
        if (filters.status && a.status !== filters.status) return false;
        if (filters.gradeLevel && a.gradeLevel !== filters.gradeLevel) return false;
        if (filters.lessonId && a.lessonId !== filters.lessonId) return false;
        return true;
      })
      .map((a) => ({
        id: a.id,
        title: a.title,
        description: a.description,
        type: a.type,
        status: a.status,
        passingScorePercent: a.passingScorePercent,
        authorId: a.authorId,
        authorName: "Teacher Santos",
        gradeLevel: a.gradeLevel,
        itemCount: a.items.length,
        totalPoints: a.items.reduce((s, it) => s + it.points, 0),
        createdAt: a.createdAt.toISOString(),
        updatedAt: a.updatedAt.toISOString(),
      }));
  }
}
