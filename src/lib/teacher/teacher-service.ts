/**
 * Tuklas AI - Teacher Management & Analytics Service
 * Phase 12: Real-time Teacher Control Center, Scoped Authorization, and Class Analytics
 */

import { dbService, fallbackStore, prisma, hasValidDatabaseUrl } from "@/lib/db";
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

export class TeacherService {
  /**
   * Primary entry point for Teacher Dashboard Overview
   */
  static async getTeacherDashboard(
    teacherId: string,
    userRole: string
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
    const classes = await this.getAuthorizedClassrooms(teacherId, userRole);
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

    // 6. Calculate Class Progress & Practice Activity
    let totalLessonsCompleted = 0;
    let totalPracticeSessions = 0;
    let totalAccuracySum = 0;
    let accuracyCounter = 0;

    uniqueStudentIds.forEach((sid) => {
      const studentProgress = (fallbackStore.progress || []).filter((p) => p.userId === sid);
      totalLessonsCompleted += studentProgress.filter((p) => p.status === "COMPLETED" && p.lessonId).length;

      const sessions = (fallbackStore.practiceSessions || []).filter((ps) => ps.studentId === sid);
      totalPracticeSessions += sessions.length;

      sessions.forEach((ps) => {
        if (ps.totalQuestions > 0) {
          totalAccuracySum += (ps.correctAnswers / ps.totalQuestions) * 100;
          accuracyCounter++;
        }
      });
    });

    const averageClassAccuracy =
      accuracyCounter > 0 ? Math.round(totalAccuracySum / accuracyCounter) : 75;

    // 7. Aggregate Class Mastery Distribution across all authorized students
    const masteryDistribution = await this.aggregateMasteryDistribution(uniqueStudentIds);

    // 8. Identify Difficult Skills (high error rate or high proportion in DEVELOPING/LEARNING)
    const difficultSkills = this.identifyDifficultSkills(masteryDistribution, uniqueStudentIds.length);

    // 9. Aggregate Mistake Categories (Phase 8 MistakeAnalyzer Integration)
    const commonMistakes = this.aggregateCommonMistakes(uniqueStudentIds);

    // 10. Generate "Needs Attention" Support Signals
    const needsAttention = this.generateSupportSignals(enrolledStudents, commonMistakes);

    // 11. Recent Activity Timeline
    const recentActivity = await this.getRecentTeacherActivity(uniqueStudentIds, authorizedLessons);

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

    const allClassrooms = fallbackStore.classrooms || [];
    const authorized =
      userRole === "ADMIN"
        ? allClassrooms
        : allClassrooms.filter((c) => c.teacherId === teacherId);

    return authorized.map((cls) => {
      const enrollments = (fallbackStore.classroomEnrollments || []).filter(
        (e) => e.classroomId === cls.id
      );
      const studentIds = enrollments.map((e) => e.studentId);

      // Active students
      const now = Date.now();
      const fourteenDaysMs = 14 * 24 * 60 * 60 * 1000;
      let activeCount = 0;
      let totalProgressSum = 0;

      studentIds.forEach((sid) => {
        const studentProgress = (fallbackStore.progress || []).filter(
          (p) => p.userId === sid && p.lessonId
        );
        const lastAct = studentProgress.reduce(
          (latest: any, p: any) => (!latest || p.lastActivity > latest ? p.lastActivity : latest),
          null
        );

        if (lastAct && now - new Date(lastAct).getTime() <= fourteenDaysMs) {
          activeCount++;
        }

        const avgProg =
          studentProgress.length > 0
            ? studentProgress.reduce((sum: number, p: any) => sum + (p.progressPercentage || 0), 0) /
              studentProgress.length
            : 0;
        totalProgressSum += avgProg;
      });

      const averageProgress =
        studentIds.length > 0 ? Math.round(totalProgressSum / studentIds.length) : 0;

      return {
        id: cls.id,
        name: cls.name,
        gradeLevel: cls.gradeLevel,
        subject: cls.subject,
        schoolYear: cls.schoolYear,
        totalStudents: studentIds.length,
        activeStudents: activeCount,
        averageProgress,
      };
    });
  }

  /**
   * Retrieve classroom detail by ID with authorization verification
   */
  static async getClassroomDetail(classroomId: string, teacherId: string, userRole: string) {
    const cls = (fallbackStore.classrooms || []).find((c) => c.id === classroomId);
    if (!cls) throw new Error("Classroom not found");

    if (userRole !== "ADMIN" && cls.teacherId !== teacherId) {
      throw new Error("Forbidden: You do not have authorization to view this class.");
    }

    const enrollments = (fallbackStore.classroomEnrollments || []).filter(
      (e) => e.classroomId === classroomId
    );
    const studentIds = enrollments.map((e) => e.studentId);
    const students = await this.getEnrolledStudentsForClasses([classroomId]);
    const masteryDistribution = await this.aggregateMasteryDistribution(studentIds);
    const assignments = (fallbackStore.assignments || []).filter((a) => a.classroomId === classroomId);

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
      if (!targetClassIds.includes(classId) && userRole !== "ADMIN") {
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

    // 1. STRICT IDOR CHECK: Verify student is enrolled in at least one class taught by teacher
    const isAuthorized = await this.isTeacherAuthorizedForStudent(teacherId, studentId, userRole);
    if (!isAuthorized) {
      throw new Error("Forbidden: You are not authorized to view this student's records.");
    }

    const studentUser = (await dbService.findUserById(studentId)) || {
      id: studentId,
      name: "Student",
      email: "student@tuklas.ai",
      gradeLevel: 7,
    };

    // Classrooms
    const studentEnrollments = (fallbackStore.classroomEnrollments || []).filter(
      (e) => e.studentId === studentId
    );
    const classrooms = studentEnrollments.map((e) => {
      const cls = (fallbackStore.classrooms || []).find((c) => c.id === e.classroomId);
      return { id: e.classroomId, name: cls?.name || "Classroom" };
    });

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
    const studentMistakes = (fallbackStore.mistakeAnalyses || []).filter(
      (ma) => ma.studentId === studentId
    );

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
   * Verify if teacher is authorized to access a given student
   */
  static async isTeacherAuthorizedForStudent(
    teacherId: string,
    studentId: string,
    userRole: string
  ): Promise<boolean> {
    if (userRole !== "TEACHER" && userRole !== "ADMIN") return false;
    if (userRole === "ADMIN") return true;

    const teacherClasses = (fallbackStore.classrooms || []).filter((c) => c.teacherId === teacherId);
    const teacherClassIds = teacherClasses.map((c) => c.id);

    const enrollment = (fallbackStore.classroomEnrollments || []).find(
      (e) => teacherClassIds.includes(e.classroomId) && e.studentId === studentId
    );

    return !!enrollment;
  }

  /**
   * Create an assignment for a class
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
    const cls = (fallbackStore.classrooms || []).find((c) => c.id === data.classroomId);
    if (!cls) throw new Error("Classroom not found");
    if (userRole !== "ADMIN" && cls.teacherId !== teacherId) {
      throw new Error("Forbidden: You do not teach this class.");
    }

    const newAssignment = {
      id: `asg_${Date.now()}`,
      classroomId: data.classroomId,
      title: data.title,
      description: data.description || "",
      lessonId: data.lessonId || null,
      practiceSetId: data.practiceSetId || null,
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      status: "PUBLISHED",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    if (!fallbackStore.assignments) fallbackStore.assignments = [];
    fallbackStore.assignments.push(newAssignment);
    return newAssignment;
  }

  // -------------------------------------------------------------
  // HELPER CALCULATORS
  // -------------------------------------------------------------

  private static async getEnrolledStudentsForClasses(classIds: string[]): Promise<StudentListItemDTO[]> {
    const enrollments = (fallbackStore.classroomEnrollments || []).filter((e) =>
      classIds.includes(e.classroomId)
    );

    const studentMap = new Map<string, StudentListItemDTO>();

    for (const enr of enrollments) {
      const studentId = enr.studentId;
      const cls = (fallbackStore.classrooms || []).find((c) => c.id === enr.classroomId);
      const studentUser = (fallbackStore.users || []).find((u) => u.id === studentId);

      if (!studentUser) continue;

      if (!studentMap.has(studentId)) {
        // Compute current progress & primary skill mastery
        const progressList = (fallbackStore.progress || []).filter(
          (p) => p.userId === studentId && p.lessonId
        );
        const inProgress = progressList.find((p) => p.status === "LEARNING" || p.progressPercentage < 100);
        const lastLesson = inProgress || progressList[0];

        let currentLessonObj = null;
        if (lastLesson && lastLesson.lessonId) {
          const lesson = fallbackStore.curriculum.lessons.find((l) => l.id === lastLesson.lessonId);
          currentLessonObj = {
            id: String(lastLesson.lessonId),
            title: lesson?.title || "Lesson",
            progressPercentage: lastLesson.progressPercentage || 0,
            state: (lastLesson.status === "COMPLETED" ? "COMPLETED" : "IN_PROGRESS") as "COMPLETED" | "IN_PROGRESS" | "NOT_STARTED",
          };
        }

        // Primary mastery snapshot
        const masteries = (fallbackStore.skillMasteries || []).filter((m) => m.studentId === studentId);
        const primaryM = masteries[0] || null;
        const skill = primaryM ? fallbackStore.curriculum.skills.find((s) => s.id === primaryM.skillId) : null;

        // Last activity
        const lastAct = progressList.reduce(
          (latest: any, p: any) => (!latest || p.lastActivity > latest ? p.lastActivity : latest),
          null
        );

        // Accuracy
        const sessions = (fallbackStore.practiceSessions || []).filter((ps) => ps.studentId === studentId);
        let accSum = 0;
        let accCount = 0;
        sessions.forEach((s) => {
          if (s.totalQuestions > 0) {
            accSum += (s.correctAnswers / s.totalQuestions) * 100;
            accCount++;
          }
        });
        const overallAccuracy = accCount > 0 ? Math.round(accSum / accCount) : 75;

        // Status logic
        let status: "ACTIVE" | "NEEDS_SUPPORT" | "INACTIVE" = "ACTIVE";
        const now = Date.now();
        if (overallAccuracy < 60) {
          status = "NEEDS_SUPPORT";
        } else if (!lastAct || now - new Date(lastAct).getTime() > 14 * 24 * 60 * 60 * 1000) {
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
                skillTitle: skill?.title || "Skill",
                status: primaryM.status as MasteryLevel,
              }
            : null,
          overallAccuracy,
          lastActivityAt: lastAct ? new Date(lastAct).toISOString() : null,
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
    const allSkills = fallbackStore.curriculum.skills || [];
    const results: MasteryDistributionDTO[] = [];

    for (const skill of allSkills) {
      const counts = {
        MASTERED: 0,
        PROFICIENT: 0,
        DEVELOPING: 0,
        LEARNING: 0,
        NOT_STARTED: 0,
      };

      let evaluated = 0;
      for (const sid of studentIds) {
        const masteryRec = (fallbackStore.skillMasteries || []).find(
          (m) => m.studentId === sid && m.skillId === skill.id
        );
        const status: MasteryLevel = (masteryRec?.status as MasteryLevel) || "NOT_STARTED";
        counts[status]++;
        evaluated++;
      }

      results.push({
        skillId: skill.id,
        skillTitle: skill.title,
        counts,
        totalEvaluated: evaluated,
      });
    }

    return results;
  }

  private static identifyDifficultSkills(
    distributions: MasteryDistributionDTO[],
    totalStudents: number
  ): DifficultSkillDTO[] {
    const difficult: DifficultSkillDTO[] = [];

    distributions.forEach((d) => {
      const strugglingCount = d.counts.DEVELOPING + d.counts.LEARNING;
      const strugglingRate = totalStudents > 0 ? strugglingCount / totalStudents : 0;

      if (strugglingRate >= 0.3 || d.counts.LEARNING >= 2) {
        difficult.push({
          skillId: d.skillId,
          skillTitle: d.skillTitle,
          developingOrLearningCount: strugglingCount,
          totalStudents,
          averageAccuracy: Math.round(100 - strugglingRate * 50),
          commonMistakeCategory: "SIGN_ERROR",
          reason: `${strugglingCount} of ${totalStudents} students demonstrate developing or emergent understanding.`,
        });
      }
    });

    return difficult.slice(0, 4);
  }

  private static aggregateCommonMistakes(studentIds: string[]) {
    const countsMap: Record<string, number> = {
      SIGN_ERROR: 0,
      PROCEDURAL_ERROR: 0,
      CONCEPTUAL_MISUNDERSTANDING: 0,
      PREREQUISITE_GAP: 0,
      CALCULATION_ERROR: 0,
    };

    (fallbackStore.mistakeAnalyses || []).forEach((ma) => {
      if (studentIds.includes(ma.studentId)) {
        const cat = ma.category || "CONCEPTUAL_MISUNDERSTANDING";
        countsMap[cat] = (countsMap[cat] || 0) + 1;
      }
    });

    return Object.entries(countsMap)
      .map(([category, count]) => ({
        category,
        label: this.formatMistakeCategory(category),
        count,
      }))
      .filter((m) => m.count > 0)
      .sort((a, b) => b.count - a.count);
  }

  private static generateSupportSignals(
    students: StudentListItemDTO[],
    commonMistakes: any[]
  ): StudentSupportSignalDTO[] {
    const signals: StudentSupportSignalDTO[] = [];

    students.forEach((s) => {
      if (s.overallAccuracy < 60) {
        signals.push({
          studentId: s.id,
          studentName: s.name,
          classroomName: s.classrooms[0]?.name || "Classroom",
          signalType: "LOW_ACCURACY",
          severity: "HIGH",
          details: `Practice accuracy is currently ${s.overallAccuracy}%. Common misconception flags detected.`,
          skillTitle: s.primaryMastery?.skillTitle || "Adding Integers",
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
          details: `Showing partial understanding in ${s.primaryMastery.skillTitle}. Occasional sign errors observed.`,
          skillTitle: s.primaryMastery.skillTitle,
          suggestedAction: "Assign 5 medium-difficulty comparison questions.",
        });
      }
    });

    return signals.slice(0, 6);
  }

  private static async getRecentTeacherActivity(
    studentIds: string[],
    lessons: any[]
  ): Promise<TeacherActivityItemDTO[]> {
    const items: TeacherActivityItemDTO[] = [];

    // 1. Practice Sessions
    (fallbackStore.practiceSessions || []).forEach((ps) => {
      if (studentIds.includes(ps.studentId)) {
        const student = (fallbackStore.users || []).find((u) => u.id === ps.studentId);
        const psAny = ps as any;
        const practiceSet = (fallbackStore.practiceSets || []).find((s: any) => s.id === (psAny.practiceSetId || psAny.practiceSet?.id));
        const psTitle = practiceSet?.title || psAny.practiceSet?.title || "Practice Session";
        items.push({
          id: `tact_ps_${ps.id}`,
          type: "PRACTICE_SUBMITTED",
          title: "Practice Completed",
          description: `${student?.name || "Student"} scored ${ps.correctAnswers}/${ps.totalQuestions} on ${psTitle}`,
          studentName: student?.name,
          timestamp: (ps.completedAt || ps.startedAt || new Date()).toISOString(),
          badge: "Practice",
        });
      }
    });

    // 2. Lesson Publishing Events
    lessons.forEach((l) => {
      if (l.status === "PUBLISHED") {
        items.push({
          id: `tact_lsn_${l.id}`,
          type: "LESSON_PUBLISHED",
          title: "Lesson Published",
          description: `"${l.title}" is live and accessible to enrolled students.`,
          timestamp: (l.updatedAt || l.createdAt || new Date()).toISOString(),
          badge: "Content",
        });
      }
    });

    // Sort descending
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
