/**
 * Tuklas AI - Assessment Service
 * Phase 14: Comprehensive Assessment Engine (Pre-Test, Post-Test, Diagnostic, Formative, Summative)
 */

import crypto from "crypto";
import { prisma, hasValidDatabaseUrl, dbService, fallbackStore } from "../db";
import { ClassroomRepo } from "../classroom/classroom-repo";
import { ClassroomService } from "../classroom/classroom-service";
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

export class AssessmentError extends Error {
  constructor(message: string, public readonly status: 400 | 401 | 403 | 404 | 409) {
    super(message);
    this.name = "AssessmentError";
  }
}

const ASSESSMENT_TYPES: AssessmentType[] = ["DIAGNOSTIC", "FORMATIVE", "SUMMATIVE", "PRACTICE", "PRE_TEST", "POST_TEST"];
const COGNITIVE_LEVELS: CognitiveLevel[] = ["KNOWLEDGE", "PROCEDURAL", "APPLICATION", "HIGHER_ORDER"];
/** Research instruments: one graded attempt per student, and the student never sees the answers. */
export const isResearchInstrument = (t: string) => t === "PRE_TEST" || t === "POST_TEST";
const MAX_ITEMS = 60;
const TIME_LIMIT_GRACE_MS = 30_000;

const newId = (prefix: string) => `${prefix}_${crypto.randomUUID()}`;
const isStaff = (role: string) => role === "TEACHER" || role === "ADMIN";

interface LoadedAssessment {
  id: string;
  title: string;
  description?: string;
  type: AssessmentType;
  status: AssessmentStatus;
  timeLimitMinutes?: number;
  passingScorePercent: number;
  authorId: string;
  authorName?: string;
  lessonId?: string;
  gradeLevel: number;
  createdAt: Date;
  updatedAt: Date;
  items: Array<{ id: string; assessmentId: string; questionId: string; sequenceOrder: number; points: number; cognitiveLevel: CognitiveLevel; question: any }>;
  assignments: Array<{ id: string; classroomId?: string | null; studentId?: string | null; dueDate?: Date | null }>;
}

async function loadAssessment(id: string): Promise<LoadedAssessment | null> {
  if (hasValidDatabaseUrl) {
    const a = await prisma.assessment.findUnique({
      where: { id },
      include: { items: { include: { question: true }, orderBy: { sequenceOrder: "asc" } }, author: { select: { name: true } }, assignments: true },
    });
    if (!a) return null;
    return {
      id: a.id, title: a.title, description: a.description ?? undefined, type: a.type as AssessmentType, status: a.status as AssessmentStatus,
      timeLimitMinutes: a.timeLimitMinutes ?? undefined, passingScorePercent: a.passingScorePercent, authorId: a.authorId, authorName: a.author?.name,
      lessonId: a.lessonId ?? undefined, gradeLevel: a.gradeLevel, createdAt: a.createdAt, updatedAt: a.updatedAt,
      items: a.items.map((it) => ({ id: it.id, assessmentId: it.assessmentId, questionId: it.questionId, sequenceOrder: it.sequenceOrder, points: it.points, cognitiveLevel: (it.cognitiveLevel ?? "PROCEDURAL") as CognitiveLevel, question: it.question })),
      assignments: a.assignments.map((x) => ({ id: x.id, classroomId: x.classroomId, studentId: x.studentId, dueDate: x.dueDate })),
    };
  }
  const a = assessmentFallbackStore.assessments.find((x) => x.id === id);
  if (!a) return null;
  return {
    id: a.id, title: a.title, description: a.description, type: a.type, status: a.status, timeLimitMinutes: a.timeLimitMinutes, passingScorePercent: a.passingScorePercent,
    authorId: a.authorId, authorName: (fallbackStore.users as any[]).find((u) => u.id === a.authorId)?.name, lessonId: a.lessonId, gradeLevel: a.gradeLevel, createdAt: a.createdAt, updatedAt: a.updatedAt,
    items: a.items.map((it) => ({ ...it, question: (fallbackStore.questions as any[]).find((q) => q.id === it.questionId) ?? {} })),
    assignments: a.assignments.map((x) => ({ id: x.id, classroomId: x.classroomId, studentId: x.studentId, dueDate: x.dueDate })),
  };
}

function toDTO(a: LoadedAssessment, opts: { items?: boolean } = {}): AssessmentDTO {
  const totalPoints = a.items.reduce((s, it) => s + it.points, 0);
  const dto: AssessmentDTO = {
    id: a.id, title: a.title, description: a.description, type: a.type, status: a.status, timeLimitMinutes: a.timeLimitMinutes,
    passingScorePercent: a.passingScorePercent, authorId: a.authorId, authorName: a.authorName, lessonId: a.lessonId, gradeLevel: a.gradeLevel,
    itemCount: a.items.length, totalPoints, createdAt: a.createdAt.toISOString(), updatedAt: a.updatedAt.toISOString(),
  };
  if (opts.items) {
    dto.items = a.items.map((it) => {
      const safe = QuestionValidator.redactQuestionForStudent(it.question ?? {});
      let qd: any = {};
      try { qd = JSON.parse(safe.questionData ?? "{}"); } catch { qd = {}; }
      return {
        id: it.id, assessmentId: it.assessmentId, questionId: it.questionId, sequenceOrder: it.sequenceOrder, points: it.points, cognitiveLevel: it.cognitiveLevel,
        // allow-list view: the choices as id + text only; never the answer key, explanation or feedback
        question: { id: safe.id, prompt: safe.prompt, type: safe.type, difficulty: safe.difficulty ?? "MEDIUM", skillId: safe.skillId, lessonId: safe.lessonId, options: qd.choices, questionData: qd } as any,
      };
    });
  }
  return dto;
}

/** Active (non-archived) classes the student is enrolled in. */
async function activeClassIdsOf(studentId: string): Promise<Set<string>> {
  const enr = await ClassroomRepo.listEnrollmentsForStudent(studentId);
  const ids = new Set<string>();
  for (const e of enr) {
    const c = await ClassroomRepo.getById(e.classroomId);
    if (c && !c.archivedAt) ids.add(c.id);
  }
  return ids;
}

function assignmentFor(a: LoadedAssessment, studentId: string, classIds: Set<string>) {
  return a.assignments.find((x) => (x.studentId ? x.studentId === studentId && (!x.classroomId || classIds.has(x.classroomId)) : !!x.classroomId && classIds.has(x.classroomId)));
}

async function namesOf(ids: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (ids.length === 0) return out;
  if (hasValidDatabaseUrl) {
    for (const u of await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } })) out.set(u.id, u.name);
  } else {
    for (const u of fallbackStore.users as any[]) if (ids.includes(u.id)) out.set(u.id, u.name);
  }
  return out;
}

async function loadAttempts(where: { assessmentId?: string; studentId?: string }): Promise<any[]> {
  if (hasValidDatabaseUrl) {
    return prisma.assessmentAttempt.findMany({ where, orderBy: [{ startedAt: "asc" }, { id: "asc" }], include: { responses: true } });
  }
  return assessmentFallbackStore.attempts
    .filter((a) => (!where.assessmentId || a.assessmentId === where.assessmentId) && (!where.studentId || a.studentId === where.studentId))
    .sort((x, y) => x.startedAt.getTime() - y.startedAt.getTime());
}

function secondsLeft(a: LoadedAssessment, startedAt: Date): number | null {
  if (!a.timeLimitMinutes) return null;
  return Math.max(0, Math.ceil((startedAt.getTime() + a.timeLimitMinutes * 60_000 - Date.now()) / 1000));
}

function positiveNumber(v: unknown, label: string, min: number, max: number, fallback: number): number {
  if (v === undefined || v === null || v === "") return fallback;
  const n = Number(v);
  if (!Number.isFinite(n) || n < min || n > max) throw new AssessmentError(`${label} must be a number from ${min} to ${max}.`, 400);
  return n;
}

export class AssessmentService {
  /** Create an assessment (Teacher/Admin). Every question must exist and be usable by the author. */
  static async createAssessment(
    data: {
      title: string; description?: string; type: AssessmentType; lessonId?: string; unitId?: string; gradeLevel?: number;
      timeLimitMinutes?: number; passingScorePercent?: number;
      questions: Array<{ questionId: string; points?: number; cognitiveLevel?: CognitiveLevel }>;
    },
    authorId: string,
    userRole: string
  ): Promise<AssessmentDTO> {
    if (!isStaff(userRole)) throw new AssessmentError("Forbidden: Only teachers and administrators can create assessments.", 403);
    const title = typeof data.title === "string" ? data.title.replace(/\s+/g, " ").trim() : "";
    if (title.length < 3 || title.length > 120) throw new AssessmentError("Title must be 3-120 characters.", 400);
    if (data.description !== undefined && (typeof data.description !== "string" || data.description.length > 1000)) throw new AssessmentError("Description must be text of at most 1000 characters.", 400);
    if (!ASSESSMENT_TYPES.includes(data.type)) throw new AssessmentError(`Type must be one of ${ASSESSMENT_TYPES.join(", ")}.`, 400);
    if (!Array.isArray(data.questions) || data.questions.length === 0) throw new AssessmentError("An assessment needs at least one question.", 400);
    if (data.questions.length > MAX_ITEMS) throw new AssessmentError(`An assessment can have at most ${MAX_ITEMS} questions.`, 400);
    const gradeLevel = Math.round(positiveNumber(data.gradeLevel, "Grade level", 1, 12, 7));
    const passingScorePercent = positiveNumber(data.passingScorePercent, "Passing score", 0, 100, 70);
    const timeLimit = data.timeLimitMinutes === undefined || data.timeLimitMinutes === null ? undefined : Math.round(positiveNumber(data.timeLimitMinutes, "Time limit", 1, 300, 60));

    const seen = new Set<string>();
    const assessmentId = newId("asm");
    const items: LoadedAssessment["items"] = [];
    for (const [idx, q] of data.questions.entries()) {
      if (!q || typeof q.questionId !== "string" || !q.questionId) throw new AssessmentError(`Question ${idx + 1} has no questionId.`, 400);
      if (seen.has(q.questionId)) throw new AssessmentError("The same question cannot be used twice in one assessment.", 400);
      seen.add(q.questionId);
      const found: any = await dbService.getQuestionById(q.questionId);
      if (!found) throw new AssessmentError(`Question ${idx + 1} does not exist.`, 404);
      if (userRole !== "ADMIN" && found.createdById && found.createdById !== authorId && found.status !== "PUBLISHED") {
        throw new AssessmentError(`Forbidden: question ${idx + 1} is another teacher's unpublished draft.`, 403);
      }
      const points = positiveNumber(q.points, "Points", 0.5, 100, 1);
      const cog = q.cognitiveLevel ?? "PROCEDURAL";
      if (!COGNITIVE_LEVELS.includes(cog)) throw new AssessmentError(`Question ${idx + 1} has an invalid cognitive level.`, 400);
      items.push({ id: newId("asmi"), assessmentId, questionId: q.questionId, sequenceOrder: idx + 1, points, cognitiveLevel: cog, question: found });
    }
    if (data.lessonId) {
      const lesson = await dbService.getLessonById(String(data.lessonId));
      if (!lesson) throw new AssessmentError("That lesson does not exist.", 404);
    }

    const now = new Date();
    if (hasValidDatabaseUrl) {
      await prisma.assessment.create({
        data: {
          id: assessmentId, title, description: data.description, type: data.type as any, status: "DRAFT", timeLimitMinutes: timeLimit, passingScorePercent, authorId,
          lessonId: data.lessonId || null, unitId: data.unitId || null, gradeLevel,
          items: { create: items.map((it) => ({ id: it.id, questionId: it.questionId, sequenceOrder: it.sequenceOrder, points: it.points, cognitiveLevel: it.cognitiveLevel })) },
        },
      });
    } else {
      assessmentFallbackStore.assessments.push({
        id: assessmentId, title, description: data.description, type: data.type, status: "DRAFT", timeLimitMinutes: timeLimit, passingScorePercent, authorId, lessonId: data.lessonId, unitId: data.unitId,
        gradeLevel, shuffleQuestions: false, showFeedbackImmediately: true, createdAt: now, updatedAt: now,
        items: items.map(({ question: _q, ...rest }) => rest), assignments: [],
      });
    }
    return toDTO((await loadAssessment(assessmentId))!);
  }

  /** Author (or admin) opens a draft for students. Idempotent. */
  static async publishAssessment(assessmentId: string, userId: string, userRole: string): Promise<AssessmentDTO> {
    if (!isStaff(userRole)) throw new AssessmentError("Forbidden: Teacher or Administrator access required to publish assessments.", 403);
    const a = await loadAssessment(assessmentId);
    if (!a) throw new AssessmentError("Assessment not found", 404);
    if (userRole !== "ADMIN" && a.authorId !== userId) throw new AssessmentError("Forbidden: You cannot publish an assessment created by another teacher.", 403);
    if (a.items.length === 0) throw new AssessmentError("An assessment with no questions cannot be published.", 409);
    if (a.status === "ARCHIVED") throw new AssessmentError("An archived assessment cannot be published again.", 409);
    if (a.status !== "PUBLISHED") {
      if (hasValidDatabaseUrl) await prisma.assessment.update({ where: { id: assessmentId }, data: { status: "PUBLISHED" } });
      else { const f = assessmentFallbackStore.assessments.find((x) => x.id === assessmentId)!; f.status = "PUBLISHED"; f.updatedAt = new Date(); }
    }
    return toDTO((await loadAssessment(assessmentId))!);
  }

  /** Author (or admin) takes an assessment away from students. Results are kept; an archived assessment cannot be reopened. */
  static async archiveAssessment(assessmentId: string, userId: string, userRole: string): Promise<AssessmentDTO> {
    if (!isStaff(userRole)) throw new AssessmentError("Forbidden: Teacher or Administrator access required.", 403);
    const a = await loadAssessment(assessmentId);
    if (!a) throw new AssessmentError("Assessment not found", 404);
    if (userRole !== "ADMIN" && a.authorId !== userId) throw new AssessmentError("Forbidden: You cannot archive an assessment created by another teacher.", 403);
    if (a.status !== "ARCHIVED") {
      if (hasValidDatabaseUrl) await prisma.assessment.update({ where: { id: assessmentId }, data: { status: "ARCHIVED" } });
      else { const f = assessmentFallbackStore.assessments.find((x) => x.id === assessmentId)!; f.status = "ARCHIVED"; f.updatedAt = new Date(); }
    }
    return toDTO((await loadAssessment(assessmentId))!);
  }

  /** Assign a published assessment to one of the author's classes (optionally to one enrolled student). */
  static async assignAssessment(
    assessmentId: string,
    classroomId: string,
    options: { studentId?: string; dueDate?: Date | string },
    userId: string,
    userRole: string
  ): Promise<{ success: boolean; assignmentId: string }> {
    if (!isStaff(userRole)) throw new AssessmentError("Forbidden: Teacher or Administrator access required to assign assessments.", 403);
    const a = await loadAssessment(assessmentId);
    if (!a) throw new AssessmentError("Assessment not found", 404);
    if (userRole !== "ADMIN" && a.authorId !== userId) throw new AssessmentError("Forbidden: You cannot assign an assessment you do not own.", 403);
    if (a.status !== "PUBLISHED") throw new AssessmentError("Publish the assessment before assigning it.", 409);
    if (typeof classroomId !== "string" || !classroomId) throw new AssessmentError("classroomId is required.", 400);
    await ClassroomService.getManageable({ userId, role: userRole }, classroomId); // 404 / 403 for a class that is missing or not theirs
    if (options.studentId !== undefined && options.studentId !== null && options.studentId !== "") {
      const enr = await ClassroomRepo.listEnrollments([classroomId]);
      if (!enr.some((e) => e.studentId === options.studentId)) throw new AssessmentError("That student is not enrolled in this class.", 400);
    }
    let dueDate: Date | undefined;
    if (options.dueDate !== undefined && options.dueDate !== null && options.dueDate !== "") {
      dueDate = new Date(options.dueDate as any);
      if (Number.isNaN(dueDate.getTime())) throw new AssessmentError("dueDate is not a valid date.", 400);
    }
    const studentId = options.studentId || undefined;
    if (a.assignments.some((x) => x.classroomId === classroomId && (x.studentId ?? undefined) === studentId)) {
      throw new AssessmentError("This assessment is already assigned to that class.", 409);
    }
    const assignmentId = newId("asga");
    if (hasValidDatabaseUrl) {
      await prisma.assessmentAssignment.create({ data: { id: assignmentId, assessmentId, classroomId, studentId: studentId ?? null, dueDate } });
    } else {
      assessmentFallbackStore.assessments.find((x) => x.id === assessmentId)!.assignments.push({ id: assignmentId, assessmentId, classroomId, studentId, dueDate, assignedAt: new Date() });
    }
    return { success: true, assignmentId };
  }

  /** The questions a student sees: published + assigned to them only, with no answer key. */
  static async getAssessmentForStudent(assessmentId: string, studentId: string): Promise<AssessmentDTO> {
    const a = await loadAssessment(assessmentId);
    if (!a || a.status !== "PUBLISHED") throw new AssessmentError("Assessment not found", 404);
    const assignment = assignmentFor(a, studentId, await activeClassIdsOf(studentId));
    if (!assignment) throw new AssessmentError("Assessment not found", 404); // same answer as a missing one: no existence oracle
    return toDTO(a, { items: true });
  }

  /** Starts (or resumes) an attempt. Research instruments allow one graded attempt per student. */
  static async startAssessmentAttempt(assessmentId: string, studentId: string): Promise<{ attemptId: string; assessmentTitle: string; totalItems: number; startedAt: string; secondsLeft: number | null; resumed: boolean }> {
    const a = await loadAssessment(assessmentId);
    if (!a || a.status !== "PUBLISHED" || !assignmentFor(a, studentId, await activeClassIdsOf(studentId))) throw new AssessmentError("Assessment not found", 404);
    const mine = await loadAttempts({ assessmentId, studentId });
    const open = mine.find((x) => x.status === "IN_PROGRESS");
    const view = (att: any, resumed: boolean) => ({ attemptId: att.id, assessmentTitle: a.title, totalItems: a.items.length, startedAt: new Date(att.startedAt).toISOString(), secondsLeft: secondsLeft(a, new Date(att.startedAt)), resumed });
    if (open) return view(open, true);
    if (isResearchInstrument(a.type) && mine.length > 0) throw new AssessmentError("You have already completed this assessment. It can only be taken once.", 409);

    const attemptId = newId("att");
    const totalPoints = a.items.reduce((s, it) => s + it.points, 0);
    if (hasValidDatabaseUrl) {
      await prisma.assessmentAttempt.create({ data: { id: attemptId, assessmentId, studentId, assessmentType: a.type as any, status: "IN_PROGRESS", maxScore: totalPoints } });
      // two simultaneous starts: among the attempts that compete (all of them for a once-only test, otherwise the open ones)
      // the earliest wins and the other is removed
      const all = await loadAttempts({ assessmentId, studentId });
      const contenders = all.filter((x) => isResearchInstrument(a.type) || x.status === "IN_PROGRESS");
      const winner = contenders[0];
      if (winner && winner.id !== attemptId) {
        await prisma.assessmentAttempt.delete({ where: { id: attemptId } }).catch(() => undefined);
        return view(winner, true);
      }
      return view(all.find((x) => x.id === attemptId), false);
    }
    const rec = { id: attemptId, assessmentId, studentId, assessmentType: a.type, status: "IN_PROGRESS" as const, score: 0, maxScore: totalPoints, scorePercent: 0, isPassed: false, startedAt: new Date(), responses: [] as any[] };
    assessmentFallbackStore.attempts.push(rec);
    return view(rec, false);
  }

  /** Server-side grading. Atomically claims the attempt so it can be graded only once. */
  static async submitAssessmentAttempt(
    attemptId: string,
    studentId: string,
    responses: Array<{ assessmentItemId?: string; questionId?: string; studentAnswer: any; timeTakenMs?: number; hintUsed?: boolean }>
  ): Promise<AssessmentAttemptResultDTO> {
    if (!Array.isArray(responses) || responses.length > MAX_ITEMS * 2) throw new AssessmentError("responses must be a list of answers.", 400);
    const attempts = hasValidDatabaseUrl
      ? await prisma.assessmentAttempt.findUnique({ where: { id: attemptId } }).then((x) => (x ? [x] : []))
      : assessmentFallbackStore.attempts.filter((x) => x.id === attemptId);
    const attempt: any = attempts[0];
    if (!attempt) throw new AssessmentError("Assessment attempt not found.", 404);
    if (attempt.studentId !== studentId) throw new AssessmentError("Forbidden: You cannot submit an assessment on behalf of another student.", 403);
    if (attempt.status !== "IN_PROGRESS") throw new AssessmentError("This attempt has already been submitted.", 409);
    const a = await loadAssessment(attempt.assessmentId);
    if (!a) throw new AssessmentError("Assessment not found", 404);

    // claim the attempt: exactly one concurrent submit can move IN_PROGRESS -> SUBMITTED
    const submittedAt = new Date();
    if (hasValidDatabaseUrl) {
      const claim = await prisma.assessmentAttempt.updateMany({ where: { id: attemptId, status: "IN_PROGRESS" }, data: { status: "SUBMITTED", submittedAt } });
      if (claim.count !== 1) throw new AssessmentError("This attempt has already been submitted.", 409);
    } else {
      attempt.status = "SUBMITTED";
    }

    try {
      const startedAt = new Date(attempt.startedAt);
      const timedOut = !!a.timeLimitMinutes && submittedAt.getTime() - startedAt.getTime() > a.timeLimitMinutes * 60_000 + TIME_LIMIT_GRACE_MS;
      let totalScore = 0, maxScore = 0;
      const scored: any[] = [];
      const cognitive: Record<CognitiveLevel, { score: number; maxScore: number; accuracy: number }> = {
        KNOWLEDGE: { score: 0, maxScore: 0, accuracy: 0 }, PROCEDURAL: { score: 0, maxScore: 0, accuracy: 0 },
        APPLICATION: { score: 0, maxScore: 0, accuracy: 0 }, HIGHER_ORDER: { score: 0, maxScore: 0, accuracy: 0 },
      };
      const skills: Record<string, { skillTitle: string; correct: number; total: number; accuracy: number }> = {};

      for (const item of a.items) {
        const q = item.question ?? {};
        const given = responses.find((r) => r && (r.assessmentItemId === item.id || (!r.assessmentItemId && r.questionId === item.questionId)));
        const raw = given?.studentAnswer;
        // Only matching/ordering take structured answers; everything else must be text or a number. An array or object
        // for a single-answer question is not an answer (String(["a"]) would otherwise read as "a").
        const structured = q.type === "MATCHING" || q.type === "ORDERING";
        const answerForGrading: any =
          raw === undefined || raw === null ? "" :
          typeof raw === "string" ? raw.slice(0, 1000) :
          typeof raw === "number" || typeof raw === "boolean" ? String(raw) :
          structured && typeof raw === "object" ? raw : "";
        let answerText = "";
        try { answerText = typeof answerForGrading === "string" ? answerForGrading : JSON.stringify(answerForGrading).slice(0, 2000); } catch { answerText = ""; }
        maxScore += item.points;
        let validation: { isCorrect: boolean; expectedAnswerDisplay: string; feedback?: string };
        try {
          validation = QuestionValidator.validate(
            { type: q.type, prompt: q.prompt, explanation: q.explanation, correctFeedback: q.correctFeedback, incorrectFeedback: q.incorrectFeedback, questionData: q.questionData },
            answerForGrading
          ) as any;
        } catch {
          validation = { isCorrect: false, expectedAnswerDisplay: "" };
        }
        const isCorrect = !!validation.isCorrect && answerText.trim() !== "";
        const scoreAwarded = isCorrect ? item.points : 0;
        totalScore += scoreAwarded;
        let mistakeCategory: any;
        if (!isCorrect && answerText.trim()) {
          mistakeCategory = MistakeAnalyzerService.evaluateAttempt({ prompt: q.prompt, questionData: q.questionData, studentAnswer: answerText, correctAnswer: validation.expectedAnswerDisplay, skillId: q.skillId }).category;
        }
        cognitive[item.cognitiveLevel].maxScore += item.points;
        cognitive[item.cognitiveLevel].score += scoreAwarded;
        const sId = q.skillId || "general_skill";
        if (!skills[sId]) skills[sId] = { skillTitle: (fallbackStore.curriculum.skills as any[]).find((s) => s.id === sId)?.title || "General skills", correct: 0, total: 0, accuracy: 0 };
        skills[sId].total += 1;
        if (isCorrect) skills[sId].correct += 1;
        const timeTakenMs = Math.max(0, Math.min(Number(given?.timeTakenMs) || 0, 6 * 3600_000));
        scored.push({
          id: newId("resp"), attemptId, assessmentItemId: item.id, questionId: item.questionId, prompt: q.prompt, studentAnswer: answerText,
          correctAnswer: validation.expectedAnswerDisplay, isCorrect, scoreAwarded, points: item.points, cognitiveLevel: item.cognitiveLevel, mistakeCategory,
          feedbackGiven: validation.feedback || (isCorrect ? q.correctFeedback : q.incorrectFeedback) || undefined, timeTakenMs, hintUsed: !!given?.hintUsed,
        });
        try {
          await dbService.submitQuestionAttempt({ studentId, questionId: item.questionId, skillId: q.skillId, answer: answerText, isCorrect, attemptNumber: 1, timeTakenMs, hintUsed: !!given?.hintUsed });
        } catch (err) {
          console.warn("Could not link assessment answer to question history:", err instanceof Error ? err.message : err);
        }
      }
      for (const k of Object.keys(cognitive) as CognitiveLevel[]) cognitive[k].accuracy = cognitive[k].maxScore > 0 ? Number((cognitive[k].score / cognitive[k].maxScore).toFixed(4)) : 0;
      for (const k of Object.keys(skills)) skills[k].accuracy = skills[k].total > 0 ? Number((skills[k].correct / skills[k].total).toFixed(4)) : 0;
      const scorePercent = maxScore > 0 ? Number(((totalScore / maxScore) * 100).toFixed(1)) : 0;
      const isPassed = scorePercent >= a.passingScorePercent;
      const timeTakenMs = submittedAt.getTime() - startedAt.getTime();
      const metadata = JSON.stringify({ cognitiveBreakdown: cognitive, skillBreakdown: skills, timedOut });

      if (hasValidDatabaseUrl) {
        await prisma.$transaction([
          prisma.assessmentAttempt.update({ where: { id: attemptId }, data: { status: "GRADED", score: totalScore, maxScore, scorePercent, isPassed, timeTakenMs: Math.min(timeTakenMs, 2_000_000_000), metadata } }),
          ...scored.map((sr) => prisma.assessmentItemResponse.create({
            data: { id: sr.id, attemptId, assessmentItemId: sr.assessmentItemId, questionId: sr.questionId, studentAnswer: sr.studentAnswer, isCorrect: sr.isCorrect, scoreAwarded: sr.scoreAwarded, timeTakenMs: sr.timeTakenMs, hintUsed: sr.hintUsed, mistakeCategory: sr.mistakeCategory, cognitiveLevel: sr.cognitiveLevel, feedbackGiven: sr.feedbackGiven, submittedAt },
          })),
        ]);
      } else {
        Object.assign(attempt, { status: "GRADED", score: totalScore, maxScore, scorePercent, isPassed, submittedAt, timeTakenMs, metadata, responses: scored.map((sr) => ({ ...sr, submittedAt })) });
      }
      return AssessmentService.buildResult(a, { id: attemptId, studentId, startedAt, submittedAt, score: totalScore, maxScore, scorePercent, isPassed, timeTakenMs, cognitive, skills, timedOut, responses: scored });
    } catch (e) {
      // grading failed after the claim: give the attempt back so the student can try to submit again
      if (hasValidDatabaseUrl) await prisma.assessmentAttempt.updateMany({ where: { id: attemptId, status: "SUBMITTED" }, data: { status: "IN_PROGRESS", submittedAt: null } }).catch(() => undefined);
      else attempt.status = "IN_PROGRESS";
      throw e;
    }
  }

  private static buildResult(a: LoadedAssessment, r: { id: string; studentId: string; startedAt: Date; submittedAt: Date; score: number; maxScore: number; scorePercent: number; isPassed: boolean; timeTakenMs: number; cognitive: any; skills: any; timedOut: boolean; responses: any[] }): AssessmentAttemptResultDTO {
    const hidden = isResearchInstrument(a.type);
    return {
      id: r.id, assessmentId: a.id, assessmentTitle: a.title, assessmentType: a.type, studentId: r.studentId, status: "GRADED", score: r.score, maxScore: r.maxScore, scorePercent: r.scorePercent,
      isPassed: r.isPassed, timeTakenMs: r.timeTakenMs, startedAt: r.startedAt.toISOString(), submittedAt: r.submittedAt.toISOString(), cognitiveBreakdown: r.cognitive, skillBreakdown: r.skills,
      timedOut: r.timedOut, answersHidden: hidden,
      // a pre/post test never shows which answers were right or what the key is: seeing it would contaminate the other test
      responses: hidden ? [] : r.responses.map((x) => ({ id: x.id, questionId: x.questionId, prompt: x.prompt, studentAnswer: x.studentAnswer, correctAnswer: x.correctAnswer, isCorrect: x.isCorrect, scoreAwarded: x.scoreAwarded, points: x.points, cognitiveLevel: x.cognitiveLevel, mistakeCategory: x.mistakeCategory, feedbackGiven: x.feedbackGiven })),
    };
  }

  /** A student's own graded attempt (owner only). */
  static async getAttemptResult(attemptId: string, studentId: string): Promise<AssessmentAttemptResultDTO> {
    const att: any = hasValidDatabaseUrl
      ? await prisma.assessmentAttempt.findUnique({ where: { id: attemptId }, include: { responses: { include: { assessmentItem: { include: { question: true } } } } } })
      : assessmentFallbackStore.attempts.find((x) => x.id === attemptId);
    if (!att || att.studentId !== studentId) throw new AssessmentError("Attempt not found", 404);
    if (att.status !== "GRADED") throw new AssessmentError("This attempt has not been submitted yet.", 409);
    const a = await loadAssessment(att.assessmentId);
    if (!a) throw new AssessmentError("Assessment not found", 404);
    let meta: any = {};
    try { meta = JSON.parse(att.metadata ?? "{}"); } catch { meta = {}; }
    const responses = (att.responses ?? []).map((x: any) => {
      const q = a.items.find((it) => it.id === x.assessmentItemId)?.question ?? {};
      const v = QuestionValidator.validate({ type: q.type, prompt: q.prompt, explanation: q.explanation, questionData: q.questionData }, "");
      return { id: x.id, questionId: x.questionId, prompt: q.prompt ?? x.prompt, studentAnswer: x.studentAnswer, correctAnswer: x.correctAnswer ?? v.expectedAnswerDisplay, isCorrect: x.isCorrect, scoreAwarded: x.scoreAwarded, points: x.points ?? a.items.find((it) => it.id === x.assessmentItemId)?.points ?? 0, cognitiveLevel: x.cognitiveLevel ?? "PROCEDURAL", mistakeCategory: x.mistakeCategory ?? undefined, feedbackGiven: x.feedbackGiven ?? undefined };
    });
    const empty = { KNOWLEDGE: { score: 0, maxScore: 0, accuracy: 0 }, PROCEDURAL: { score: 0, maxScore: 0, accuracy: 0 }, APPLICATION: { score: 0, maxScore: 0, accuracy: 0 }, HIGHER_ORDER: { score: 0, maxScore: 0, accuracy: 0 } };
    return AssessmentService.buildResult(a, { id: att.id, studentId, startedAt: new Date(att.startedAt), submittedAt: new Date(att.submittedAt ?? att.startedAt), score: att.score, maxScore: att.maxScore, scorePercent: att.scorePercent, isPassed: att.isPassed, timeTakenMs: att.timeTakenMs ?? 0, cognitive: meta.cognitiveBreakdown ?? empty, skills: meta.skillBreakdown ?? {}, timedOut: !!meta.timedOut, responses });
  }

  /** What a student can do: assessments assigned to them, with their own progress. */
  static async listForStudent(studentId: string): Promise<Array<AssessmentDTO & { dueDate?: string; progress: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED"; attemptId?: string; scorePercent?: number; isPassed?: boolean; canStart: boolean; answersHidden: boolean }>> {
    const classIds = await activeClassIdsOf(studentId);
    const published: LoadedAssessment[] = [];
    if (hasValidDatabaseUrl) {
      const rows = await prisma.assessment.findMany({
        where: { status: "PUBLISHED", assignments: { some: { OR: [{ studentId }, { studentId: null, classroomId: { in: Array.from(classIds) } }] } } },
        select: { id: true },
        orderBy: { createdAt: "desc" },
      });
      for (const r of rows) { const a = await loadAssessment(r.id); if (a) published.push(a); }
    } else {
      for (const x of [...assessmentFallbackStore.assessments].reverse()) {
        if (x.status !== "PUBLISHED") continue;
        const a = await loadAssessment(x.id);
        if (a) published.push(a);
      }
    }
    const attempts = await loadAttempts({ studentId });
    const out = [];
    for (const a of published) {
      const asg = assignmentFor(a, studentId, classIds);
      if (!asg) continue;
      const mine = attempts.filter((x) => x.assessmentId === a.id);
      const open = mine.find((x) => x.status === "IN_PROGRESS");
      const done = mine.filter((x) => x.status === "GRADED");
      const last = done[done.length - 1];
      out.push({
        ...toDTO(a), dueDate: asg.dueDate ? new Date(asg.dueDate).toISOString() : undefined,
        progress: open ? ("IN_PROGRESS" as const) : done.length > 0 ? ("COMPLETED" as const) : ("NOT_STARTED" as const),
        attemptId: open?.id ?? last?.id, scorePercent: last?.scorePercent, isPassed: last?.isPassed,
        canStart: !!open || !(isResearchInstrument(a.type) && mine.length > 0), answersHidden: isResearchInstrument(a.type),
      });
    }
    return out;
  }

  /** Phase 36: graded attempts for a set of students (for teacher analytics). One query; no answers, only scores. */
  static async gradedAttemptsForStudents(studentIds: string[]): Promise<Array<{ studentId: string; assessmentId: string; title: string; type: AssessmentType; scorePercent: number; isPassed: boolean; submittedAt: Date; skillBreakdown: Record<string, { skillTitle: string; correct: number; total: number }> }>> {
    if (studentIds.length === 0) return [];
    const parse = (m: string | null | undefined) => { try { return (JSON.parse(m ?? "{}").skillBreakdown ?? {}) as Record<string, { skillTitle: string; correct: number; total: number }>; } catch { return {}; } };
    if (hasValidDatabaseUrl) {
      const rows = await prisma.assessmentAttempt.findMany({ where: { studentId: { in: studentIds }, status: "GRADED" }, include: { assessment: { select: { title: true } } }, orderBy: { submittedAt: "asc" } });
      return rows.map((r) => ({ studentId: r.studentId, assessmentId: r.assessmentId, title: r.assessment.title, type: r.assessmentType as AssessmentType, scorePercent: r.scorePercent, isPassed: r.isPassed, submittedAt: r.submittedAt ?? r.startedAt, skillBreakdown: parse(r.metadata) }));
    }
    return assessmentFallbackStore.attempts
      .filter((a) => studentIds.includes(a.studentId) && a.status === "GRADED")
      .map((a) => ({ studentId: a.studentId, assessmentId: a.assessmentId, title: assessmentFallbackStore.assessments.find((x) => x.id === a.assessmentId)?.title ?? "Assessment", type: a.assessmentType, scorePercent: a.scorePercent, isPassed: a.isPassed, submittedAt: a.submittedAt ?? a.startedAt, skillBreakdown: parse((a as any).metadata) }));
  }

  /** Phase 36: published/archived assessments assigned to any of these classes (whole class or one student). */
  static async assignmentsForClasses(classIds: string[]): Promise<Array<{ assessmentId: string; title: string; type: AssessmentType; status: AssessmentStatus; classroomId: string; studentId?: string; itemCount: number }>> {
    if (classIds.length === 0) return [];
    if (hasValidDatabaseUrl) {
      const rows = await prisma.assessmentAssignment.findMany({ where: { classroomId: { in: classIds }, assessment: { status: { in: ["PUBLISHED", "ARCHIVED"] } } }, include: { assessment: { select: { title: true, type: true, status: true, _count: { select: { items: true } } } } } });
      return rows.map((r) => ({ assessmentId: r.assessmentId, title: r.assessment.title, type: r.assessment.type as AssessmentType, status: r.assessment.status as AssessmentStatus, classroomId: r.classroomId as string, studentId: r.studentId ?? undefined, itemCount: r.assessment._count.items }));
    }
    const out: Array<{ assessmentId: string; title: string; type: AssessmentType; status: AssessmentStatus; classroomId: string; studentId?: string; itemCount: number }> = [];
    for (const a of assessmentFallbackStore.assessments) {
      if (a.status !== "PUBLISHED" && a.status !== "ARCHIVED") continue;
      for (const x of a.assignments) if (x.classroomId && classIds.includes(x.classroomId)) out.push({ assessmentId: a.id, title: a.title, type: a.type, status: a.status, classroomId: x.classroomId, studentId: x.studentId, itemCount: a.items.length });
    }
    return out;
  }

  /** Staff listing: admins see everything; a teacher sees their own. */
  static async listAssessments(filters: { type?: AssessmentType; status?: AssessmentStatus; gradeLevel?: number; lessonId?: string }, userId: string, userRole: string): Promise<AssessmentDTO[]> {
    if (!isStaff(userRole)) throw new AssessmentError("Forbidden: Teacher or Administrator access required.", 403);
    let rows: LoadedAssessment[] = [];
    if (hasValidDatabaseUrl) {
      const where: any = {};
      if (userRole !== "ADMIN") where.authorId = userId;
      if (filters.type) where.type = filters.type;
      if (filters.status) where.status = filters.status;
      if (filters.gradeLevel) where.gradeLevel = filters.gradeLevel;
      if (filters.lessonId) where.lessonId = filters.lessonId;
      for (const r of await prisma.assessment.findMany({ where, select: { id: true }, orderBy: { createdAt: "desc" } })) { const a = await loadAssessment(r.id); if (a) rows.push(a); }
    } else {
      for (const x of [...assessmentFallbackStore.assessments].reverse()) {
        if (userRole !== "ADMIN" && x.authorId !== userId) continue;
        if (filters.type && x.type !== filters.type) continue;
        if (filters.status && x.status !== filters.status) continue;
        if (filters.gradeLevel && x.gradeLevel !== filters.gradeLevel) continue;
        if (filters.lessonId && x.lessonId !== filters.lessonId) continue;
        const a = await loadAssessment(x.id);
        if (a) rows.push(a);
      }
    }
    return rows.map((a) => ({ ...toDTO(a), assignedClassIds: Array.from(new Set(a.assignments.map((x) => x.classroomId).filter(Boolean))) as string[] })) as AssessmentDTO[];
  }

  /** Author/admin view of how an assessment went: per student (including those who have not started) and per question. */
  static async getResults(assessmentId: string, userId: string, userRole: string) {
    if (!isStaff(userRole)) throw new AssessmentError("Forbidden: Teacher or Administrator access required.", 403);
    const a = await loadAssessment(assessmentId);
    if (!a) throw new AssessmentError("Assessment not found", 404);
    if (userRole !== "ADMIN" && a.authorId !== userId) throw new AssessmentError("Forbidden: You can only see results for your own assessments.", 403);
    const classIds = Array.from(new Set(a.assignments.map((x) => x.classroomId).filter(Boolean))) as string[];
    const enrolments = await ClassroomRepo.listEnrollments(classIds);
    const direct = new Set(a.assignments.filter((x) => x.studentId).map((x) => x.studentId as string));
    const wholeClass = new Set(a.assignments.filter((x) => !x.studentId).map((x) => x.classroomId as string));
    const roster = new Set<string>();
    for (const e of enrolments) if (wholeClass.has(e.classroomId) || direct.has(e.studentId)) roster.add(e.studentId);
    const attempts = await loadAttempts({ assessmentId });
    for (const t of attempts) if (roster.has(t.studentId) === false && direct.has(t.studentId)) roster.add(t.studentId);
    const names = await namesOf(Array.from(roster));
    const students = Array.from(roster).map((sid) => {
      const mine = attempts.filter((x) => x.studentId === sid);
      const graded = mine.filter((x) => x.status === "GRADED");
      const last = graded[graded.length - 1];
      return { studentId: sid, name: names.get(sid) ?? "Student", status: mine.some((x) => x.status === "IN_PROGRESS") ? "IN_PROGRESS" : last ? "COMPLETED" : "NOT_STARTED", attempts: graded.length, scorePercent: last?.scorePercent ?? null, isPassed: last ? last.isPassed : null, submittedAt: last?.submittedAt ? new Date(last.submittedAt).toISOString() : null };
    }).sort((x, y) => x.name.localeCompare(y.name));
    const done = students.filter((s) => s.scorePercent !== null);
    const itemStats = a.items.map((it) => {
      let n = 0, right = 0;
      for (const t of attempts) {
        if (t.status !== "GRADED") continue;
        const r = (t.responses ?? []).find((x: any) => x.assessmentItemId === it.id);
        if (r) { n++; if (r.isCorrect) right++; }
      }
      return { itemId: it.id, questionId: it.questionId, prompt: it.question?.prompt ?? "", answered: n, accuracy: n > 0 ? Number((right / n).toFixed(3)) : null };
    });
    const mean = done.length ? Number((done.reduce((s, x) => s + (x.scorePercent as number), 0) / done.length).toFixed(1)) : null;
    return {
      assessment: toDTO(a),
      summary: { assigned: students.length, completed: done.length, inProgress: students.filter((s) => s.status === "IN_PROGRESS").length, notStarted: students.filter((s) => s.status === "NOT_STARTED").length, meanScorePercent: mean, passRate: done.length ? Number((done.filter((s) => s.isPassed).length / done.length).toFixed(3)) : null },
      students, items: itemStats,
    };
  }
}
