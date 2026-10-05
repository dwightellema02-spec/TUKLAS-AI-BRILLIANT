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
  TeacherActivityItemDTO,
} from "./teacher-types";
import type { MasteryLevel } from "@/lib/mastery/mastery-types";

interface StudentBundle {
  user: any;
  progress: any[];
  masteries: any[];
  sessions: any[];
  mistakes: any[];
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

    // 10. Generate "Needs Attention" Support Signals
    const needsAttention = this.generateSupportSignals(enrolledStudents, bundles);

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

    return {
      student: {
        id: studentUser.id,
        name: studentUser.name || "Student",
        email: studentUser.email,
        gradeLevel: studentUser.gradeLevel || 7,
        classrooms,
      },
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
        out.set(id, { user, progress, masteries, sessions, mistakes });
      }
    };
    await Promise.all(Array.from({ length: Math.min(6, Math.max(studentIds.length, 1)) }, worker));
    return out;
  }

  private static lastActivityOf(b: StudentBundle): Date | null {
    const times: number[] = [];
    b.progress.forEach((p: any) => p.lastActivity && times.push(new Date(p.lastActivity).getTime()));
    b.sessions.forEach((s: any) => {
      const t = s.completedAt || s.startedAt;
      if (t) times.push(new Date(t).getTime());
    });
    return times.length > 0 ? new Date(Math.max(...times)) : null;
  }

  /** Practice accuracy (0-100) from real sessions, or null when the student has no scored practice yet. */
  private static accuracyOf(b: StudentBundle): number | null {
    let sum = 0;
    let n = 0;
    b.sessions.forEach((s: any) => {
      if (s.totalQuestions > 0) {
        sum += (s.correctAnswers / s.totalQuestions) * 100;
        n++;
      }
    });
    return n > 0 ? Math.round(sum / n) : null;
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

        // Status is derived only from real evidence. No data means "NO_DATA", never a made-up "ACTIVE".
        let status: StudentListItemDTO["status"] = "ACTIVE";
        const now = Date.now();
        if (!lastAct && overallAccuracy === null) {
          status = "NO_DATA";
        } else if (overallAccuracy !== null && overallAccuracy < 60) {
          status = "NEEDS_SUPPORT";
        } else if (!lastAct || now - lastAct.getTime() > 14 * 24 * 60 * 60 * 1000) {
          status = "INACTIVE";
        }

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

  private static generateSupportSignals(
    students: StudentListItemDTO[],
    bundles: Map<string, StudentBundle>
  ): StudentSupportSignalDTO[] {
    const signals: StudentSupportSignalDTO[] = [];

    students.forEach((s) => {
      const topMistake = (() => {
        const counts: Record<string, number> = {};
        (bundles.get(s.id)?.mistakes ?? []).forEach((ma: any) => {
          const cat = ma.category || "CONCEPTUAL_MISUNDERSTANDING";
          counts[cat] = (counts[cat] ?? 0) + 1;
        });
        const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
        return top ? this.formatMistakeCategory(top[0]) : undefined;
      })();

      if (s.overallAccuracy !== null && s.overallAccuracy < 60) {
        signals.push({
          studentId: s.id,
          studentName: s.name,
          classroomName: s.classrooms[0]?.name || "Classroom",
          signalType: "LOW_ACCURACY",
          severity: "HIGH",
          details: `Practice accuracy is currently ${s.overallAccuracy}%.${topMistake ? ` Most frequent diagnosed pattern: ${topMistake}.` : ""}`,
          skillTitle: s.primaryMastery?.skillTitle,
          suggestedAction: "Recommend foundational practice or conduct 1-on-1 check-in.",
        });
      } else if (s.status === "INACTIVE") {
        signals.push({
          studentId: s.id,
          studentName: s.name,
          classroomName: s.classrooms[0]?.name || "Classroom",
          signalType: "INSUFFICIENT_ACTIVITY",
          severity: "MEDIUM",
          details: "No learning activity recorded in the past 14 days.",
          suggestedAction: "Send friendly reminder or check assignment availability.",
        });
      } else if (s.primaryMastery?.status === "DEVELOPING") {
        signals.push({
          studentId: s.id,
          studentName: s.name,
          classroomName: s.classrooms[0]?.name || "Classroom",
          signalType: "PERSISTENT_DEVELOPING",
          severity: "LOW",
          details: `Showing partial understanding in ${s.primaryMastery.skillTitle}.${topMistake ? ` Most frequent diagnosed pattern: ${topMistake}.` : ""}`,
          skillTitle: s.primaryMastery.skillTitle,
          suggestedAction: "Assign a few medium-difficulty practice questions on this skill.",
        });
      }
    });

    return signals.slice(0, 6);
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
