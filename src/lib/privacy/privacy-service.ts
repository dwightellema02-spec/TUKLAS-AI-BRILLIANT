/**
 * Phase 43: student-data privacy. Consent records, access (export) and erasure.
 * Database mode is complete; the in-memory demo store supports consent and a profile-level export only.
 */
import { hasValidDatabaseUrl, prisma, fallbackStore, savePersistedUsers, dbService } from "../db";
import { PRIVACY_NOTICE_VERSION } from "../../config/privacy-notice";
import { ClassroomService } from "../classroom/classroom-service";

export class PrivacyError extends Error {
  constructor(message: string, public readonly status: 400 | 403 | 404 | 409) { super(message); this.name = "PrivacyError"; }
}
export interface Actor { userId: string; role: string }

export interface PrivacyState { accepted: boolean; needsAcceptance: boolean; version: string; acceptedVersion: string | null; guardianConsent: boolean | null }

const memUser = (id: string) => fallbackStore.users.find((u) => u.id === id) as any;

export const PrivacyService = {
  async acceptNotice(userId: string): Promise<void> {
    const now = new Date();
    if (hasValidDatabaseUrl) { await prisma.user.update({ where: { id: userId }, data: { privacyNoticeVersion: PRIVACY_NOTICE_VERSION, privacyAcceptedAt: now } }); return; }
    const u = memUser(userId); if (!u) throw new PrivacyError("Account not found", 404);
    u.privacyNoticeVersion = PRIVACY_NOTICE_VERSION; u.privacyAcceptedAt = now; savePersistedUsers();
  },

  async getState(userId: string): Promise<PrivacyState> {
    const u: any = hasValidDatabaseUrl ? await prisma.user.findUnique({ where: { id: userId }, select: { role: true, privacyNoticeVersion: true, guardianConsentAt: true } }) : memUser(userId);
    const accepted = !!u?.privacyNoticeVersion;
    return {
      accepted, acceptedVersion: u?.privacyNoticeVersion ?? null, version: PRIVACY_NOTICE_VERSION,
      needsAcceptance: u?.privacyNoticeVersion !== PRIVACY_NOTICE_VERSION,
      guardianConsent: u?.role === "STUDENT" ? !!u?.guardianConsentAt : null,
    };
  },

  /** A teacher (of a class the student is in) or an administrator records, or withdraws, the guardian's consent. */
  async setGuardianConsent(actor: Actor, studentId: unknown, given: unknown): Promise<{ studentId: string; guardianConsent: boolean }> {
    if (actor.role !== "TEACHER" && actor.role !== "ADMIN") throw new PrivacyError("Forbidden: Teacher or Administrator access required.", 403);
    if (typeof studentId !== "string" || !studentId) throw new PrivacyError("Choose a student.", 400);
    if (typeof given !== "boolean") throw new PrivacyError("given must be true or false.", 400);
    const student: any = await dbService.findUserById(studentId);
    if (!student || student.role !== "STUDENT") throw new PrivacyError("Student not found", 404);
    if (!(await ClassroomService.isTeacherAuthorizedForStudent(actor.userId, studentId, actor.role))) throw new PrivacyError("Forbidden: this student is not in one of your classes.", 403);
    const when = given ? new Date() : null;
    if (hasValidDatabaseUrl) await prisma.user.update({ where: { id: studentId }, data: { guardianConsentAt: when, guardianConsentRecordedBy: given ? actor.userId : null } });
    else { const u = memUser(studentId); u.guardianConsentAt = when; u.guardianConsentRecordedBy = given ? actor.userId : null; savePersistedUsers(); }
    return { studentId, guardianConsent: given };
  },

  /** Everything held about one person, as plain data. Never includes the password hash or session internals. */
  async exportUserData(userId: string) {
    if (!hasValidDatabaseUrl) {
      const u = memUser(userId); if (!u) throw new PrivacyError("Account not found", 404);
      const progress = await dbService.getStudentProgress(userId).catch(() => []);
      return { format: "tuklas-data-export-v1", exportedAt: new Date().toISOString(), note: "Demo mode: only the profile and learning progress are included.", profile: { id: u.id, name: u.name, email: u.email, role: u.role, gradeLevel: u.gradeLevel ?? null, createdAt: u.createdAt, privacyNoticeVersion: u.privacyNoticeVersion ?? null, privacyAcceptedAt: u.privacyAcceptedAt ?? null, guardianConsentAt: u.guardianConsentAt ?? null }, learningProgress: progress };
    }
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, email: true, role: true, gradeLevel: true, createdAt: true, updatedAt: true, disabledAt: true, privacyNoticeVersion: true, privacyAcceptedAt: true, guardianConsentAt: true } });
    if (!user) throw new PrivacyError("Account not found", 404);
    const w = { where: { OR: [{ userId }] } } as any;
    const [enrollments, classesTaught, progress, lessonSessions, checkpointAttempts, practiceSessions, questionAttempts, conversations, mistakes, masteries, assessmentAttempts, recommendations, research, authoredLessons, authoredQuestions, authoredPracticeSets] = await Promise.all([
      prisma.classroomEnrollment.findMany({ where: { studentId: userId }, select: { enrolledAt: true, source: true, classroom: { select: { name: true, gradeLevel: true, schoolYear: true } } } }),
      prisma.classroom.findMany({ where: { teacherId: userId }, select: { name: true, gradeLevel: true, schoolYear: true, createdAt: true, archivedAt: true, _count: { select: { enrollments: true } } } }),
      prisma.studentProgress.findMany({ where: { userId } }),
      prisma.lessonSession.findMany({ where: { userId } }),
      prisma.checkpointAttempt.findMany({ where: { userId } }),
      prisma.practiceSession.findMany({ where: { studentId: userId } }),
      prisma.questionAttempt.findMany({ where: { studentId: userId } }),
      prisma.aITutorConversation.findMany({ where: { studentId: userId }, include: { messages: { orderBy: { createdAt: "asc" } } } }),
      prisma.mistakeAnalysis.findMany({ where: { studentId: userId } }),
      prisma.skillMastery.findMany({ where: { studentId: userId } }),
      prisma.assessmentAttempt.findMany({ where: { studentId: userId }, include: { responses: true } }),
      prisma.adaptiveRecommendation.findMany({ where: { studentId: userId } }),
      prisma.researchMetricRecord.findMany({ where: { studentId: userId } }),
      prisma.lesson.findMany({ where: { authorId: userId }, select: { id: true, title: true, status: true, createdAt: true } }),
      prisma.question.findMany({ where: { createdById: userId }, select: { id: true, prompt: true, status: true, createdAt: true } }),
      prisma.practiceSet.findMany({ where: { createdById: userId }, select: { id: true, title: true, status: true, createdAt: true } }),
    ]);
    void w;
    const data = {
      format: "tuklas-data-export-v1", exportedAt: new Date().toISOString(),
      note: "Everything this system holds about this account. Passwords are stored only in scrambled form and are not included.",
      profile: user,
      classesJoined: enrollments, classesTaught,
      learningProgress: progress, lessonSessions, checkpointAttempts, practiceSessions, questionAttempts,
      tutorConversations: conversations, mistakeAnalyses: mistakes, skillMastery: masteries, assessmentAttempts, adaptiveRecommendations: recommendations, researchMetrics: research,
      contentAuthored: { lessons: authoredLessons, questions: authoredQuestions, practiceSets: authoredPracticeSets },
    };
    return data;
  },

  /**
   * Erase an account and everything linked to it. Students: the account and all their learning data (it is linked by foreign keys that delete
   * with the account). Staff: refused while they still teach classes or own assessments (that would delete other people's data); their
   * lessons, questions and practice sets stay, without the author's name.
   */
  async eraseUser(actor: Actor, userId: string, confirmEmail: unknown): Promise<{ role: string }> {
    if (actor.role !== "ADMIN") throw new PrivacyError("Forbidden: Administrator access required.", 403);
    const user: any = await dbService.findUserById(userId);
    if (!user) throw new PrivacyError("Account not found", 404);
    if (typeof confirmEmail !== "string" || confirmEmail.trim().toLowerCase() !== String(user.email).toLowerCase()) throw new PrivacyError("Type the account's email address to confirm the erasure.", 400);
    if (user.id === actor.userId) throw new PrivacyError("You cannot erase your own account. Ask another administrator.", 409);
    if (user.role === "ADMIN") {
      const admins = hasValidDatabaseUrl ? await prisma.user.count({ where: { role: "ADMIN", disabledAt: null } }) : fallbackStore.users.filter((u) => u.role === "ADMIN" && !u.disabledAt).length;
      if (admins <= 1) throw new PrivacyError("This is the last administrator.", 409);
    }
    if (!hasValidDatabaseUrl) {
      fallbackStore.users = fallbackStore.users.filter((u) => u.id !== userId);
      for (const k of ["classroomEnrollments", "lessonUnlocks"] as const) (fallbackStore as any)[k] = ((fallbackStore as any)[k] as any[]).filter((r) => r.studentId !== userId);
      savePersistedUsers();
      return { role: user.role };
    }
    if (user.role !== "STUDENT") {
      const [classes, assessments] = await Promise.all([prisma.classroom.count({ where: { teacherId: userId } }), prisma.assessment.count({ where: { authorId: userId } })]);
      if (classes > 0) throw new PrivacyError(`This account still teaches ${classes} class(es). Archive or hand them over first: erasing the account would delete every enrolled student's class record.`, 409);
      if (assessments > 0) throw new PrivacyError(`This account still owns ${assessments} assessment(s), whose results belong to students. Remove or reassign them first.`, 409);
    }
    await prisma.$transaction([
      // authored content stays, without the author
      prisma.lesson.updateMany({ where: { authorId: userId }, data: { authorId: null } }),
      prisma.question.updateMany({ where: { createdById: userId }, data: { createdById: null } }),
      prisma.question.updateMany({ where: { reviewedById: userId }, data: { reviewedById: null } }),
      prisma.practiceSet.updateMany({ where: { createdById: userId }, data: { createdById: null } }),
      prisma.unit.updateMany({ where: { createdById: userId }, data: { createdById: null } }),
      prisma.competency.updateMany({ where: { createdById: userId }, data: { createdById: null } }),
      prisma.skill.updateMany({ where: { createdById: userId }, data: { createdById: null } }),
      prisma.lessonUnlock.deleteMany({ where: { OR: [{ studentId: userId }, { createdById: userId }] } }),
      prisma.user.delete({ where: { id: userId } }),
    ]);
    return { role: user.role };
  },
};
