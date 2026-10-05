/**
 * Tuklas AI - Teacher Management & Analytics Service
 * Phase 12: Real-time Teacher Control Center, Scoped Authorization, and Class Analytics
 */

import { dbService } from "@/lib/db";
import { ClassroomRepo } from "@/lib/classroom/classroom-repo";
import { ClassroomService, ClassroomError } from "@/lib/classroom/classroom-service";
import { MasteryEngine } from "@/lib/mastery/mastery-engine";
import { AdaptiveEngine } from "@/lib/adaptive/adaptive-engine";
import type {
  TeacherDashboardDataDTO,
  ClassSummaryDTO,
  StudentListItemDTO,
  PaginatedStudentsDTO,
  StudentDetailDTO,
  MasteryDistributionDTO,
  DifficultSkillDTO,
  StudentSupportSignalDTO,
  AssessmentPerformanceDTO,
  LessonPerformanceDTO,
  TeacherActivityItemDTO,
} from "./teacher-types";
import type { MasteryLevel } from "@/lib/mastery/mastery-types";
import { AssessmentService } from "@/lib/assessment/assessment-service";
import { buildSupportSignals, buildGroupRecommendations, studentStatus, lastActivity, type StudentEvidence } from "./class-evidence";

interface StudentBundle {
  user: any;
  progress: any[];
  masteries: any[];
  sessions: any[];
  mistakes: any[];
  /** Graded assessment attempts (scores only). */
  assessments: Awaited<ReturnType<typeof AssessmentService.gradedAttemptsForStudents>>;
  tutor: { lastAt: Date | null; conversations: number; studentMessages: number; flagged: Array<{ updatedAt: Date; reasons: string[] }> };
}

export class TeacherService {
  /**
   * Primary entry point for Teacher Dashboard Overview
   */
  static async getTeacherDashboard(
    teacherId: string,
    userRole: string,
    options: { classId?: string } = {}
  ): Promise<TeacherDashboardDataDTO> {
    const isStaff = userRole === "TEACHER" || userRole === "ADMIN";
    if (!isStaff) {
      throw new Error("Unauthorized: Teacher or Administrator access required.");
    }

    // 1. Load Teacher Profile
    const teacherUser = (await dbService.findUserById(teacherId)) || {
      id: teacherId,
      name: "Teacher",
      email: "teacher@tuklas.ai",
      role: userRole,
    };

    // 2. Load Authorized Classrooms
    let classes = await this.getAuthorizedClassrooms(teacherId, userRole);
    if (options.classId) {
      // Scope every metric to one class, but only if the caller may see it.
      if (!classes.some((c) => c.id === options.classId)) throw new Error("Forbidden: You do not have access to this class.");
      classes = classes.filter((c) => c.id === options.classId);
    }
    const authorizedClassIds = classes.map((c) => c.id);

    // 3. Load Authorized Enrolled Students
    const enrolledStudents = await this.getEnrolledStudentsForClasses(authorizedClassIds);
    const uniqueStudentIds = Array.from(new Set(enrolledStudents.map((s) => s.id)));

    // 4. Calculate Activity Metrics
    const now = Date.now();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    const fourteenDaysMs = 14 * 24 * 60 * 60 * 1000;

    let recentlyActiveCount = 0;
    let activeCount = 0;
    let inactiveCount = 0;

    enrolledStudents.forEach((student) => {
      if (student.lastActivityAt) {
        const timeDiff = now - new Date(student.lastActivityAt).getTime();
        if (timeDiff <= sevenDaysMs) {
          recentlyActiveCount++;
          activeCount++;
        } else if (timeDiff <= fourteenDaysMs) {
          activeCount++;
        } else {
          inactiveCount++;
        }
      } else {
        inactiveCount++;
      }
    });

    // 5. Lessons Count (Scoped to Teacher unless Admin)
    const allLessons = await dbService.getLessons();
    const authorizedLessons =
      userRole === "ADMIN"
        ? allLessons
        : allLessons.filter((l: any) => l.authorId === teacherId || l.status === "PUBLISHED");

    const publishedLessonsCount = authorizedLessons.filter((l: any) => l.status === "PUBLISHED").length;
    const draftLessonsCount = authorizedLessons.filter((l: any) => l.status === "DRAFT" || l.status === "IN_REVIEW").length;

    // 6. Calculate Class Progress & Practice Activity (from real records; null when there is no data)
    const bundles = await this.loadBundles(uniqueStudentIds);
    let totalLessonsCompleted = 0;
    let totalPracticeSessions = 0;
    let totalAccuracySum = 0;
    let accuracyCounter = 0;

    uniqueStudentIds.forEach((sid) => {
      const b = bundles.get(sid);
      if (!b) return;
      totalLessonsCompleted += b.progress.filter((p: any) => p.status === "COMPLETED" && p.lessonId).length;
      totalPracticeSessions += b.sessions.length;
      b.sessions.forEach((ps: any) => {
        if (ps.totalQuestions > 0) {
          totalAccuracySum += (ps.correctAnswers / ps.totalQuestions) * 100;
          accuracyCounter++;
        }
      });
    });

    const averageClassAccuracy = accuracyCounter > 0 ? Math.round(totalAccuracySum / accuracyCounter) : null;

    // 7. Aggregate Class Mastery Distribution across all authorized students
    const masteryDistribution = await this.aggregateMasteryDistribution(uniqueStudentIds);

    // 8. Identify Difficult Skills (high error rate or high proportion in DEVELOPING/LEARNING)
    const difficultSkills = this.identifyDifficultSkills(masteryDistribution, bundles);

    // 9. Aggregate Mistake Categories (Phase 8 MistakeAnalyzer Integration)
    const commonMistakes = this.aggregateCommonMistakes(bundles);

    // 10. Evidence-based support signals, group recommendations, assessment and lesson performance
    const skillTitles = new Map<string, string>(((await dbService.getSkills()) as any[]).map((sk) => [sk.id, sk.title]));
    const enrollments = await ClassroomRepo.listEnrollments(authorizedClassIds);
    const classNames = new Map(classes.map((c) => [c.id, c.name]));
    const evidence: StudentEvidence[] = uniqueStudentIds
      .filter((sid) => bundles.get(sid))
      .map((sid) => {
        const mine = enrollments.filter((e) => e.studentId === sid);
        return this.toEvidence(sid, bundles.get(sid)!, {
          classroomIds: mine.map((e) => e.classroomId),
          classroomName: classNames.get(mine[0]?.classroomId) || "Classroom",
          enrolledAt: mine.length ? new Date(Math.min(...mine.map((e) => new Date(e.enrolledAt).getTime()))) : null,
          skillTitles,
        });
      });
    const needsAttention = buildSupportSignals(evidence, new Date()) as StudentSupportSignalDTO[];
    const dataNotes: string[] = [];
    const link = await dbService.countAttemptsBySkillLink(uniqueStudentIds);
    if (link.unlinked > 0 && link.unlinked >= link.linked) {
      dataNotes.push(`${link.unlinked} of ${link.linked + link.unlinked} answers come from questions that are not linked to a skill. Skill-level views (mastery, difficult skills, recommendations) cannot use them: choose a skill when you create a question.`);
    }
    const groupRecommendations = buildGroupRecommendations(evidence);
    const assessmentPerformance = await this.assessmentPerformance(authorizedClassIds, enrollments, bundles);
    const lessonPerformance = await this.lessonPerformance(authorizedClassIds, enrollments, bundles);

    // 11. Recent Activity Timeline
    const recentActivity = await this.getRecentTeacherActivity(uniqueStudentIds, authorizedLessons, bundles);

    return {
      teacher: {
        id: teacherUser.id,
        name: teacherUser.name || "Educator",
        email: teacherUser.email,
        role: teacherUser.role || "TEACHER",
      },
      stats: {
        totalStudents: uniqueStudentIds.length,
        activeStudents: activeCount,
        recentlyActiveStudents: recentlyActiveCount,
        inactiveStudents: inactiveCount,
        publishedLessonsCount,
        draftLessonsCount,
        activeClassesCount: classes.length,
      },
      classes,
      classProgress: {
        lessonsCompletedTotal: totalLessonsCompleted,
        practiceSessionsTotal: totalPracticeSessions,
        averageClassAccuracy,
      },
      masteryDistribution,
      difficultSkills,
      commonMistakes,
      needsAttention,
      needsAttentionTotal: needsAttention.length,
      dataNotes,
      groupRecommendations,
      assessmentPerformance,
      lessonPerformance,
      classFilter: options.classId ? { id: options.classId, name: classes[0]?.name ?? "" } : undefined,
      recentActivity,
    };
  }

  /**
   * Retrieve authorized classes for teacher
   */
  static async getAuthorizedClassrooms(teacherId: string, userRole: string): Promise<ClassSummaryDTO[]> {
    const isStaff = userRole === "TEACHER" || userRole === "ADMIN";
    if (!isStaff) throw new Error("Unauthorized");

    const authorized = await ClassroomRepo.listForTeacher(userRole === "ADMIN" ? null : teacherId);
    const enrollments = await ClassroomRepo.listEnrollments(authorized.map((c) => c.id));
    const bundles = await this.loadBundles(Array.from(new Set(enrollments.map((e) => e.studentId))));
    const now = Date.now();
    const fourteenDaysMs = 14 * 24 * 60 * 60 * 1000;

    return authorized.map((cls) => {
      const studentIds = enrollments.filter((e) => e.classroomId === cls.id).map((e) => e.studentId);
      let activeCount = 0;
      let totalProgressSum = 0;

      studentIds.forEach((sid) => {
        const b = bundles.get(sid);
        const lastAct = b ? this.lastActivityOf(b) : null;
        if (lastAct && now - new Date(lastAct).getTime() <= fourteenDaysMs) activeCount++;
        const lessonProgress = (b?.progress ?? []).filter((p: any) => p.lessonId);
        totalProgressSum += lessonProgress.length > 0 ? lessonProgress.reduce((sum: number, p: any) => sum + (p.progressPercentage || 0), 0) / lessonProgress.length : 0;
      });

      return {
        id: cls.id,
        name: cls.name,
        gradeLevel: cls.gradeLevel,
        subject: cls.subject,
        schoolYear: cls.schoolYear,
        totalStudents: studentIds.length,
        activeStudents: activeCount,
        averageProgress: studentIds.length > 0 ? Math.round(totalProgressSum / studentIds.length) : 0,
      };
    });
  }

  /**
   * Retrieve classroom detail by ID with authorization verification
   */
  static async getClassroomDetail(classroomId: string, teacherId: string, userRole: string) {
    // Ownership is enforced by the classroom service (404 missing, 403 not yours).
    let cls;
    try {
      cls = await ClassroomService.getManageable({ userId: teacherId, role: userRole }, classroomId);
    } catch (e) {
      if (e instanceof ClassroomError) throw new Error(e.status === 404 ? "Classroom not found" : `Forbidden: ${e.message.replace(/^Forbidden:\s*/, "")}`);
      throw e;
    }
    cls = await ClassroomService.ensureJoinCode(cls);

    const enrollments = await ClassroomRepo.listEnrollments([classroomId]);
    const studentIds = enrollments.map((e) => e.studentId);
    const students = await this.getEnrolledStudentsForClasses([classroomId]);
    const masteryDistribution = await this.aggregateMasteryDistribution(studentIds);
    const assignments = await ClassroomRepo.listAssignments([classroomId]);

    return {
      classroom: cls,
      students,
      masteryDistribution,
      assignments,
      totalStudents: studentIds.length,
    };
  }

  /**
   * Search and paginate authorized students
   */
  static async getAuthorizedStudentsPaginated(
    teacherId: string,
    userRole: string,
    options: { search?: string; classId?: string; page?: number; limit?: number } = {}
  ): Promise<PaginatedStudentsDTO> {
    const { search = "", classId, page = 1, limit = 20 } = options;

    const classes = await this.getAuthorizedClassrooms(teacherId, userRole);
    let targetClassIds = classes.map((c) => c.id);

    if (classId) {
      if (!targetClassIds.includes(classId)) {
        throw new Error("Forbidden: You do not have access to this class.");
      }
      targetClassIds = [classId];
    }

    let allStudents = await this.getEnrolledStudentsForClasses(targetClassIds);

    // Search filter
    if (search.trim().length > 0) {
      const q = search.toLowerCase().trim();
      allStudents = allStudents.filter(
        (s) => s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q)
      );
    }

    const total = allStudents.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const startIndex = (page - 1) * limit;
    const paginated = allStudents.slice(startIndex, startIndex + limit);

    return {
      students: paginated,
      total,
      page,
      totalPages,
      limit,
    };
  }

  /**
   * Deep student inspection detail with IDOR verification
   */
  static async getStudentDetail(
    studentId: string,
    teacherId: string,
    userRole: string
  ): Promise<StudentDetailDTO> {
    if (userRole !== "TEACHER" && userRole !== "ADMIN") {
      throw new Error("Unauthorized: Teacher or Administrator access required.");
    }

    // 1. STRICT IDOR CHECK: the student must be enrolled in an active class taught by this teacher
    const isAuthorized = await this.isTeacherAuthorizedForStudent(teacherId, studentId, userRole);
    if (!isAuthorized) {
      throw new Error("Forbidden: You are not authorized to view this student's records.");
    }

    const studentUser = await dbService.findUserById(studentId);
    if (!studentUser) throw new Error("Student not found");

    // Classrooms (active classes only)
    const studentEnrollments = await ClassroomRepo.listEnrollmentsForStudent(studentId);
    const classrooms: Array<{ id: string; name: string }> = [];
    for (const e of studentEnrollments) {
      const cls = await ClassroomRepo.getById(e.classroomId);
      if (cls && !cls.archivedAt && (userRole === "ADMIN" || cls.teacherId === teacherId)) classrooms.push({ id: cls.id, name: cls.name });
    }

    // Learning Path & Current Lesson
    const pathData = await dbService.getStudentLearningPath(studentId);
    const learningPathNodes = (pathData?.learningPath || []).map((node: any) => ({
      lessonId: node.lessonId,
      title: node.title,
      state: node.state,
      progressPercentage: node.progressPercentage || 0,
    }));

    const activeNode = learningPathNodes.find(
      (n) => n.state === "IN_PROGRESS" || n.state === "AVAILABLE"
    );

    const currentLesson = activeNode
      ? {
          id: activeNode.lessonId,
          title: activeNode.title,
          progressPercentage: activeNode.progressPercentage,
        }
      : null;

    // Phase 10 Mastery Engine Evaluation
    const masteriesRaw = await MasteryEngine.getStudentMasteries(studentId);
    const masteries = masteriesRaw.map((m) => ({
      skillId: m.skillId,
      skillTitle: m.skillTitle,
      status: m.status,
      accuracy: Math.round(m.accuracy * 100),
      recentAccuracy: Math.round(m.recentAccuracy * 100),
      attemptCount: m.attemptCount,
      consistencyScore: Math.round(m.consistencyScore * 100),
      summary: m.explanation?.summary || m.evidenceSummary,
    }));

    // Phase 8 Mistake Analyzer patterns
    const studentMistakes = (await dbService.getMistakeAnalysesForStudent(studentId, { limit: 100, includeOutdated: true })) as any[];

    const mistakePatternsMap = new Map<string, any>();
    studentMistakes.forEach((ma) => {
      const cat = ma.category || "CONCEPTUAL_MISUNDERSTANDING";
      if (!mistakePatternsMap.has(cat)) {
        mistakePatternsMap.set(cat, {
          category: cat,
          categoryLabel: this.formatMistakeCategory(cat),
          count: 0,
          examples: [],
          suggestedRemediation: ma.recommendation,
        });
      }
      const entry = mistakePatternsMap.get(cat);
      entry.count++;
      if (ma.observation && entry.examples.length < 3) {
        entry.examples.push(ma.observation);
      }
    });

    // Phase 9 Adaptive Recommendations
    const recHistory = await dbService.getStudentAdaptiveHistory(studentId, { limit: 5 });

    // Practice Sessions
    const practiceSessions = await dbService.getStudentPracticeHistory(studentId);
    const recentPractice = practiceSessions.slice(0, 5).map((ps: any) => ({
      id: ps.id,
      title: ps.practiceSet?.title || "Practice Set",
      score: `${ps.correctAnswers}/${ps.totalQuestions}`,
      accuracy:
        ps.totalQuestions > 0 ? Math.round((ps.correctAnswers / ps.totalQuestions) * 100) : 0,
      status: ps.status,
      completedAt: ps.completedAt ? new Date(ps.completedAt).toISOString() : undefined,
    }));

    // Phase 36: assessments, tutor use and the evidence-based support signal for this student
    const bundle = (await this.loadBundles([studentId])).get(studentId)!;
    const skillTitles = new Map<string, string>(((await dbService.getSkills()) as any[]).map((sk) => [sk.id, sk.title]));
    const evidence = this.toEvidence(studentId, bundle, { classroomIds: classrooms.map((c) => c.id), classroomName: classrooms[0]?.name || "Classroom", skillTitles });
    const support = (buildSupportSignals([evidence], new Date())[0] as StudentSupportSignalDTO | undefined) ?? null;
    const latestByAssessment = new Map<string, (typeof bundle.assessments)[number]>();
    for (const a of bundle.assessments) { const cur = latestByAssessment.get(a.assessmentId); if (!cur || new Date(a.submittedAt) > new Date(cur.submittedAt)) latestByAssessment.set(a.assessmentId, a); }
    const assessmentResults = Array.from(latestByAssessment.values()).map((a) => ({ assessmentId: a.assessmentId, title: a.title, type: a.type, scorePercent: a.scorePercent, isPassed: a.isPassed, submittedAt: new Date(a.submittedAt).toISOString() }));

    return {
      student: {
        id: studentUser.id,
        name: studentUser.name || "Student",
        email: studentUser.email,
        gradeLevel: studentUser.gradeLevel || 7,
        classrooms,
      },
      assessmentResults,
      support,
      tutorUse: { conversations: bundle.tutor.conversations, studentMessages: bundle.tutor.studentMessages, lastAt: bundle.tutor.lastAt ? new Date(bundle.tutor.lastAt).toISOString() : null, flaggedConversations: bundle.tutor.flagged.length },
      currentLesson,
      learningPathNodes,
      masteries,
      mistakePatterns: Array.from(mistakePatternsMap.values()),
      adaptiveRecommendations: recHistory,
      recentPractice,
    };
  }

  /**
   * Verify if teacher is authorized to access a given student: an admin, or a teacher with the student
   * enrolled in one of their ACTIVE (non-archived) classes. Database-backed.
   */
  static async isTeacherAuthorizedForStudent(
    teacherId: string,
    studentId: string,
    userRole: string
  ): Promise<boolean> {
    return ClassroomService.isTeacherAuthorizedForStudent(teacherId, studentId, userRole);
  }

  /**
   * Create an assignment for a class (ownership, lesson/practice-set existence and publication are enforced).
   */
  static async createAssignment(
    teacherId: string,
    data: {
      classroomId: string;
      title: string;
      description?: string;
      lessonId?: string;
      practiceSetId?: string;
      dueDate?: string;
    },
    userRole: string
  ) {
    return ClassroomService.createAssignment({ userId: teacherId, role: userRole }, data.classroomId, data);
  }

  // -------------------------------------------------------------
  // DATA LOADING (database or in-memory, through dbService)
  // -------------------------------------------------------------

  /** Everything the analytics need for a set of students, fetched through the persistence layer. */
  private static async loadBundles(studentIds: string[]): Promise<Map<string, StudentBundle>> {
    const out = new Map<string, StudentBundle>();
    const queue = [...studentIds];
    const worker = async () => {
      while (queue.length > 0) {
        const id = queue.shift()!;
        const [user, progress, masteries, sessions, mistakes] = await Promise.all([
          dbService.findUserById(id),
          dbService.getStudentProgress(id) as Promise<any[]>,
          dbService.getStudentSkillMasteries(id) as Promise<any[]>,
          dbService.getStudentPracticeHistory(id) as Promise<any[]>,
          dbService.getMistakeAnalysesForStudent(id, { limit: 100, includeOutdated: true }) as Promise<any[]>,
        ]);
        out.set(id, { user, progress, masteries, sessions, mistakes, assessments: [], tutor: { lastAt: null, conversations: 0, studentMessages: 0, flagged: [] } });
      }
    };
    await Promise.all(Array.from({ length: Math.min(6, Math.max(studentIds.length, 1)) }, worker));
    // assessments and tutor use: one query each for the whole group
    const [attempts, tutor] = await Promise.all([AssessmentService.gradedAttemptsForStudents(studentIds), dbService.getTutorActivityForStudents(studentIds)]);
    for (const a of attempts) out.get(a.studentId)?.assessments.push(a);
    for (const [id, t] of tutor) { const b = out.get(id); if (b) b.tutor = t; }
    return out;
  }

  private static lastActivityOf(b: StudentBundle): Date | null {
    const times: number[] = [];
    b.progress.forEach((p: any) => p.lastActivity && times.push(new Date(p.lastActivity).getTime()));
    b.sessions.forEach((s: any) => {
      const t = s.completedAt || s.startedAt;
      if (t) times.push(new Date(t).getTime());
    });
    b.assessments.forEach((a) => a.submittedAt && times.push(new Date(a.submittedAt).getTime()));
    if (b.tutor.lastAt) times.push(new Date(b.tutor.lastAt).getTime());
    return times.length > 0 ? new Date(Math.max(...times)) : null;
  }

  /** The plain evidence record the analytics rules work on (see class-evidence.ts). */
  private static toEvidence(id: string, b: StudentBundle, ctx: { classroomIds: string[]; classroomName: string; enrolledAt?: Date | null; skillTitles: Map<string, string> }): StudentEvidence {
    const sessions = b.sessions.filter((x: any) => x.totalQuestions > 0);
    return {
      id,
      name: b.user?.name || "Student",
      classroomIds: ctx.classroomIds,
      classroomName: ctx.classroomName,
      enrolledAt: ctx.enrolledAt ?? null,
      lastActivityAt: this.lastActivityOf(b), // lessons, practice, assessments and tutor use
      lessonsStarted: b.progress.filter((p: any) => p.lessonId).length,
      lessonsCompleted: b.progress.filter((p: any) => p.lessonId && p.status === "COMPLETED").length,
      practice: {
        sessions: sessions.length,
        questions: sessions.reduce((n: number, x: any) => n + x.totalQuestions, 0),
        correct: sessions.reduce((n: number, x: any) => n + (x.correctAnswers || 0), 0),
        recent: sessions.map((x: any) => ({ at: new Date(x.completedAt || x.startedAt), questions: x.totalQuestions, correct: x.correctAnswers || 0 })),
      },
      assessments: b.assessments.map((a) => ({ assessmentId: a.assessmentId, title: a.title, type: a.type, scorePercent: a.scorePercent, isPassed: a.isPassed, submittedAt: new Date(a.submittedAt) })),
      masteries: b.masteries.map((m: any) => ({ skillId: m.skillId, skillTitle: m.skill?.title || ctx.skillTitles.get(m.skillId) || "Skill", status: String(m.status), accuracy: Number(m.accuracy) || 0, attemptCount: Number(m.attemptCount ?? m.totalAttempts ?? 0) })),
      mistakes: b.mistakes.map((m: any) => ({ category: m.category || "UNKNOWN", skillId: m.skillId ?? null, skillTitle: m.skill?.title || (m.skillId ? ctx.skillTitles.get(m.skillId) : undefined) })),
      tutor: b.tutor,
    };
  }

  /** Practice accuracy (0-100) from real sessions, or null when the student has no scored practice yet. */
  private static accuracyOf(b: StudentBundle): number | null {
    let questions = 0;
    let correct = 0;
    b.sessions.forEach((s: any) => {
      if (s.totalQuestions > 0) {
        questions += s.totalQuestions;
        correct += s.correctAnswers || 0;
      }
    });
    return questions > 0 ? Math.round((correct / questions) * 100) : null;
  }

  // -------------------------------------------------------------
  // HELPER CALCULATORS
  // -------------------------------------------------------------

  private static async getEnrolledStudentsForClasses(classIds: string[]): Promise<StudentListItemDTO[]> {
    const enrollments = await ClassroomRepo.listEnrollments(classIds);
    const classes = new Map<string, { id: string; name: string }>();
    for (const id of classIds) {
      const c = await ClassroomRepo.getById(id);
      if (c) classes.set(id, { id: c.id, name: c.name });
    }
    const bundles = await this.loadBundles(Array.from(new Set(enrollments.map((e) => e.studentId))));
    const skills = (await dbService.getSkills()) as any[];

    const studentMap = new Map<string, StudentListItemDTO>();

    for (const enr of enrollments) {
      const studentId = enr.studentId;
      const cls = classes.get(enr.classroomId);
      const b = bundles.get(studentId);
      const studentUser = b?.user;
      if (!studentUser) continue;

      if (!studentMap.has(studentId)) {
        const progressList = b!.progress.filter((p: any) => p.lessonId);
        const inProgress = progressList.find((p: any) => p.status === "LEARNING" || p.progressPercentage < 100);
        const lastLesson = inProgress || progressList[0];

        let currentLessonObj = null;
        if (lastLesson && lastLesson.lessonId) {
          const lesson = (await dbService.getLessonById(String(lastLesson.lessonId))) as any;
          currentLessonObj = {
            id: String(lastLesson.lessonId),
            title: lesson?.title || lastLesson.lesson?.title || "Lesson",
            progressPercentage: lastLesson.progressPercentage || 0,
            state: (lastLesson.status === "COMPLETED" ? "COMPLETED" : "IN_PROGRESS") as "COMPLETED" | "IN_PROGRESS" | "NOT_STARTED",
          };
        }

        const primaryM = b!.masteries[0] || null;
        const skill = primaryM ? skills.find((s) => s.id === primaryM.skillId) : null;
        const lastAct = this.lastActivityOf(b!);
        const overallAccuracy = this.accuracyOf(b!);

        // Status is derived only from real evidence (lessons, practice, assessments, tutor use). No data means "NO_DATA".
        const status: StudentListItemDTO["status"] = studentStatus(
          this.toEvidence(studentId, b!, { classroomIds: [], classroomName: "", skillTitles: new Map() }),
          new Date()
        );

        studentMap.set(studentId, {
          id: studentId,
          name: studentUser.name || "Student",
          email: studentUser.email,
          gradeLevel: studentUser.gradeLevel || 7,
          classrooms: cls ? [{ id: cls.id, name: cls.name }] : [],
          currentLesson: currentLessonObj,
          primaryMastery: primaryM
            ? {
                skillId: primaryM.skillId,
                skillTitle: primaryM.skill?.title || skill?.title || "Skill",
                status: primaryM.status as MasteryLevel,
              }
            : null,
          overallAccuracy,
          lastActivityAt: lastAct ? lastAct.toISOString() : null,
          lastActivityDisplay: this.formatRelativeTime(lastAct),
          status,
        });
      } else {
        const existing = studentMap.get(studentId)!;
        if (cls && !existing.classrooms.some((c) => c.id === cls.id)) {
          existing.classrooms.push({ id: cls.id, name: cls.name });
        }
      }
    }

    return Array.from(studentMap.values());
  }

  private static async aggregateMasteryDistribution(studentIds: string[]): Promise<MasteryDistributionDTO[]> {
    const allSkills = (await dbService.getSkills()) as any[];
    const bundles = await this.loadBundles(studentIds);
    const results: MasteryDistributionDTO[] = [];

    for (const skill of allSkills) {
      const counts = { MASTERED: 0, PROFICIENT: 0, DEVELOPING: 0, LEARNING: 0, NOT_STARTED: 0 };
      let evaluated = 0;
      for (const sid of studentIds) {
        const masteryRec = bundles.get(sid)?.masteries.find((m: any) => m.skillId === skill.id);
        const status: MasteryLevel = (masteryRec?.status as MasteryLevel) || "NOT_STARTED";
        counts[status] = (counts[status] ?? 0) + 1;
        evaluated++;
      }
      results.push({ skillId: skill.id, skillTitle: skill.title, counts, totalEvaluated: evaluated });
    }
    return results;
  }

  /**
   * Skills many students are struggling with. Every number here comes from real mastery/mistake records;
   * nothing is estimated or defaulted.
   */
  private static identifyDifficultSkills(
    distributions: MasteryDistributionDTO[],
    bundles: Map<string, StudentBundle>
  ): DifficultSkillDTO[] {
    const difficult: DifficultSkillDTO[] = [];

    distributions.forEach((d) => {
      const withEvidence = d.totalEvaluated - d.counts.NOT_STARTED;
      const strugglingCount = d.counts.DEVELOPING + d.counts.LEARNING;
      if (withEvidence < 2) return; // too little evidence to call a skill "difficult"
      const strugglingRate = strugglingCount / withEvidence;
      if (strugglingRate < 0.3 && d.counts.LEARNING < 2) return;

      const accuracies: number[] = [];
      const mistakeCounts: Record<string, number> = {};
      bundles.forEach((b) => {
        const m = b.masteries.find((x: any) => x.skillId === d.skillId);
        if (m && typeof m.accuracy === "number") accuracies.push(m.accuracy * 100);
        b.mistakes.filter((ma: any) => ma.skillId === d.skillId).forEach((ma: any) => {
          const cat = ma.category || "CONCEPTUAL_MISUNDERSTANDING";
          mistakeCounts[cat] = (mistakeCounts[cat] ?? 0) + 1;
        });
      });
      const topMistake = Object.entries(mistakeCounts).sort((a, b) => b[1] - a[1])[0]?.[0];

      difficult.push({
        skillId: d.skillId,
        skillTitle: d.skillTitle,
        developingOrLearningCount: strugglingCount,
        totalStudents: withEvidence,
        averageAccuracy: accuracies.length > 0 ? Math.round(accuracies.reduce((a, b) => a + b, 0) / accuracies.length) : null,
        commonMistakeCategory: topMistake,
        reason: `${strugglingCount} of ${withEvidence} students with evidence are still learning or developing this skill.`,
      });
    });

    return difficult.slice(0, 4);
  }

  private static aggregateCommonMistakes(bundles: Map<string, StudentBundle>) {
    const countsMap: Record<string, number> = {};
    bundles.forEach((b) => {
      b.mistakes.forEach((ma: any) => {
        const cat = ma.category || "CONCEPTUAL_MISUNDERSTANDING";
        countsMap[cat] = (countsMap[cat] || 0) + 1;
      });
    });

    return Object.entries(countsMap)
      .map(([category, count]) => ({ category, label: this.formatMistakeCategory(category), count }))
      .filter((m) => m.count > 0)
      .sort((a, b) => b.count - a.count);
  }

  /** How each assessment assigned to these classes went (scores of each student's latest graded attempt). */
  private static async assessmentPerformance(
    classIds: string[],
    enrollments: Array<{ classroomId: string; studentId: string }>,
    bundles: Map<string, StudentBundle>
  ): Promise<AssessmentPerformanceDTO[]> {
    const assigned = await AssessmentService.assignmentsForClasses(classIds);
    const byAssessment = new Map<string, { title: string; type: string; status: string; students: Set<string> }>();
    for (const a of assigned) {
      const g = byAssessment.get(a.assessmentId) ?? { title: a.title, type: a.type, status: a.status, students: new Set<string>() };
      if (a.studentId) g.students.add(a.studentId);
      else for (const e of enrollments) if (e.classroomId === a.classroomId) g.students.add(e.studentId);
      byAssessment.set(a.assessmentId, g);
    }
    const out: AssessmentPerformanceDTO[] = [];
    for (const [assessmentId, g] of byAssessment) {
      const latest = new Map<string, { scorePercent: number; isPassed: boolean; at: number }>();
      for (const sid of g.students) {
        for (const a of bundles.get(sid)?.assessments ?? []) {
          if (a.assessmentId !== assessmentId) continue;
          const at = new Date(a.submittedAt).getTime();
          const cur = latest.get(sid);
          if (!cur || at > cur.at) latest.set(sid, { scorePercent: a.scorePercent, isPassed: a.isPassed, at });
        }
      }
      const scores = Array.from(latest.values());
      out.push({
        assessmentId, title: g.title, type: g.type, status: g.status, assigned: g.students.size, completed: scores.length,
        meanScorePercent: scores.length ? Math.round((scores.reduce((n, x) => n + x.scorePercent, 0) / scores.length) * 10) / 10 : null,
        passRate: scores.length ? Math.round((scores.filter((x) => x.isPassed).length / scores.length) * 100) / 100 : null,
      });
    }
    return out.sort((a, b) => a.title.localeCompare(b.title));
  }

  /** How the class is doing in the lessons that were assigned to it or that its students have started. */
  private static async lessonPerformance(
    classIds: string[],
    enrollments: Array<{ classroomId: string; studentId: string }>,
    bundles: Map<string, StudentBundle>
  ): Promise<LessonPerformanceDTO[]> {
    const studentIds = new Set(enrollments.map((e) => e.studentId));
    const lessonIds = new Set<string>();
    for (const a of await ClassroomRepo.listAssignments(classIds, { status: "PUBLISHED" })) if (a.lessonId) lessonIds.add(a.lessonId);
    bundles.forEach((b, sid) => { if (studentIds.has(sid)) b.progress.forEach((p: any) => p.lessonId && lessonIds.add(String(p.lessonId))); });
    const out: LessonPerformanceDTO[] = [];
    for (const lessonId of lessonIds) {
      let started = 0, completed = 0, q = 0, c = 0;
      studentIds.forEach((sid) => {
        const b = bundles.get(sid);
        if (!b) return;
        const p = b.progress.find((x: any) => String(x.lessonId) === lessonId);
        if (p) { started++; if (p.status === "COMPLETED" || (p.progressPercentage ?? 0) >= 100) completed++; }
        b.sessions.forEach((x: any) => { if (String(x.lessonId) === lessonId && x.totalQuestions > 0) { q += x.totalQuestions; c += x.correctAnswers || 0; } });
      });
      const lesson = (await dbService.getLessonById(lessonId)) as any;
      out.push({ lessonId, title: lesson?.title || "Lesson", studentsStarted: started, studentsCompleted: completed, totalStudents: studentIds.size, practiceAccuracy: q > 0 ? Math.round((c / q) * 100) : null, practiceQuestions: q });
    }
    return out.sort((a, b) => b.studentsStarted - a.studentsStarted || a.title.localeCompare(b.title));
  }

  private static async getRecentTeacherActivity(
    studentIds: string[],
    lessons: any[],
    bundles: Map<string, StudentBundle>
  ): Promise<TeacherActivityItemDTO[]> {
    const items: TeacherActivityItemDTO[] = [];

    // 1. Practice sessions of the teacher's students
    bundles.forEach((b, sid) => {
      if (!studentIds.includes(sid)) return;
      b.sessions.forEach((ps: any) => {
        if (ps.status !== "COMPLETED") return;
        const when = ps.completedAt || ps.startedAt;
        if (!when) return;
        items.push({
          id: `tact_ps_${ps.id}`,
          type: "PRACTICE_SUBMITTED",
          title: "Practice Completed",
          description: `${b.user?.name || "Student"} scored ${ps.correctAnswers}/${ps.totalQuestions} on ${ps.practiceSet?.title || "a practice set"}`,
          studentName: b.user?.name,
          timestamp: new Date(when).toISOString(),
          badge: "Practice",
        });
      });
    });

    // 2. Lesson publishing events
    lessons.forEach((l) => {
      if (l.status === "PUBLISHED") {
        items.push({
          id: `tact_lsn_${l.id}`,
          type: "LESSON_PUBLISHED",
          title: "Lesson Published",
          description: `"${l.title}" is live and accessible to enrolled students.`,
          timestamp: new Date(l.updatedAt || l.createdAt || Date.now()).toISOString(),
          badge: "Content",
        });
      }
    });

    items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return items.slice(0, 8);
  }

  private static formatMistakeCategory(cat: string): string {
    switch (cat) {
      case "SIGN_ERROR":
        return "Sign & Inverse Errors";
      case "PROCEDURAL_ERROR":
        return "Procedural & Order Steps";
      case "CONCEPTUAL_MISUNDERSTANDING":
        return "Conceptual Misunderstanding";
      case "PREREQUISITE_GAP":
        return "Prerequisite Number Line Gap";
      case "CALCULATION_ERROR":
        return "Arithmetic / Calculation Error";
      default:
        return cat.replace(/_/g, " ");
    }
  }

  private static formatRelativeTime(date: any): string {
    if (!date) return "Never";
    try {
      const diffSec = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
      if (diffSec < 60) return "Just now";
      if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
      if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
      if (diffSec < 604800) return `${Math.floor(diffSec / 86400)}d ago`;
      return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" });
    } catch {
      return "Recent";
    }
  }
}
