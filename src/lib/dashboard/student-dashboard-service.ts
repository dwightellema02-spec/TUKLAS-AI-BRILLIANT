/**
 * Tuklas AI - Student Dashboard Service
 * Phase 11: Real-time Personalized Learning Environment
 *
 * Implements deterministic data aggregation answering the 5 core student questions:
 * 1. What am I learning?
 * 2. Where did I stop? (exact step/section resume location)
 * 3. What should I do next? (active adaptive recommendation)
 * 4. How am I progressing? (skills, accuracy, mastery distribution, unit progress)
 * 5. Where can I get help? (integrated AI Tutor & contextual prompts)
 */

import { dbService, fallbackStore, prisma, hasValidDatabaseUrl } from "@/lib/db";
import { AdaptiveEngine } from "@/lib/adaptive/adaptive-engine";
import { MasteryEngine } from "@/lib/mastery/mastery-engine";
import type {
  StudentDashboardDataDTO,
  ContinueLearningDTO,
  RecentActivityItemDTO,
  QuickHelpTopicDTO,
  ProgressSummaryDTO,
} from "./student-dashboard-types";
import type { MasteryLevel } from "@/lib/mastery/mastery-types";

export class StudentDashboardService {
  /**
   * Primary entry point to fetch complete student dashboard payload
   */
  static async getStudentDashboard(studentId: string): Promise<StudentDashboardDataDTO> {
    // 1. Load Student Profile
    const studentUser = (await dbService.findUserById(studentId)) || {
      id: studentId,
      name: "Student",
      email: "student@tuklas.ai",
      role: "STUDENT",
      gradeLevel: 7,
    };

    // 2. Load Learning Path & Curriculum Structure
    const pathData = await dbService.getStudentLearningPath(studentId);
    const learningPathNodes = pathData?.learningPath || [];
    const curriculumUnit = pathData?.curriculum?.unit || {
      id: "unt_01",
      title: "Numbers and Algebraic Expressions",
      description: "DepEd MATATAG Grade 7 Mathematics Term 1",
      totalLessons: learningPathNodes.length || 3,
      completedLessons: 0,
      progressPercentage: 0,
    };

    // 3. Resolve "Continue Learning" & Exact Resume Location
    const continueLearning = await this.resolveContinueLearning(studentId, learningPathNodes);

    // 4. Resolve "Your Next Step" (Phase 9 Adaptive Learning Recommendation)
    let adaptiveRecommendation = null;
    try {
      adaptiveRecommendation = await AdaptiveEngine.generateAdaptiveRecommendation({
        studentId,
        skillId: continueLearning.lessonId ? undefined : "skl_01",
        trigger: "STUDENT_REQUESTED",
        forceRefresh: false,
      });
    } catch (err) {
      console.warn("Could not retrieve adaptive recommendation for student dashboard:", err);
    }

    // 5. Resolve "Current Progress" & Mastery Engine Distribution
    const progressSummary = await this.resolveProgressSummary(studentId, learningPathNodes);

    // 6. Resolve "Recent Activity" (Practice Sessions, Questions, Checkpoints)
    const recentActivity = await this.resolveRecentActivity(studentId);

    // 7. Curated Quick Help Topics (DepEd MATATAG Grade 7 Mathematics)
    const quickHelpTopics: QuickHelpTopicDTO[] = [
      {
        id: "qhelp_01",
        topic: "Adding Integers with Different Signs",
        prompt: "Can you explain how to add positive and negative integers using a number line or visual counters?",
        category: "PROCEDURE",
      },
      {
        id: "qhelp_02",
        topic: "Why Subtracting a Negative is Adding",
        prompt: "Why does subtracting a negative number give the same result as adding a positive number?",
        category: "CONCEPT",
      },
      {
        id: "qhelp_03",
        topic: "Absolute Value & Distance",
        prompt: "What is absolute value, and why can distance from zero never be negative?",
        category: "CONCEPT",
      },
      {
        id: "qhelp_04",
        topic: "Real-world Elevation & Temperature",
        prompt: "Give me a real-world example of integers using Philippine sea depths or Baguio temperatures.",
        category: "APPLICATION",
      },
    ];

    return {
      student: {
        id: studentUser.id,
        name: studentUser.name || "Student",
        email: studentUser.email,
        role: studentUser.role || "STUDENT",
        gradeLevel: studentUser.gradeLevel || 7,
      },
      curriculum: {
        subject: pathData?.curriculum?.subject || "Mathematics",
        grade: pathData?.curriculum?.grade || "Grade 7",
        term: pathData?.curriculum?.term || "Term 1",
        unit: {
          id: curriculumUnit.id || "unt_01",
          title: curriculumUnit.title || "Numbers and Algebraic Expressions",
          description: curriculumUnit.description || "Foundational number concepts under MATATAG",
          totalLessons: curriculumUnit.totalLessons || learningPathNodes.length,
          completedLessons: curriculumUnit.completedLessons || 0,
          progressPercentage: curriculumUnit.progressPercentage || 0,
        },
      },
      continueLearning,
      adaptiveRecommendation,
      progressSummary,
      recentActivity,
      quickHelpTopics,
    };
  }

  /**
   * Determine exact Continue Learning state & resume position
   */
  private static async resolveContinueLearning(
    studentId: string,
    nodes: any[]
  ): Promise<ContinueLearningDTO> {
    const totalLessons = nodes.length;
    const completedNodes = nodes.filter((n) => n.state === "COMPLETED");
    const inProgressNode = nodes.find((n) => n.state === "IN_PROGRESS");
    const firstAvailableNode = nodes.find((n) => n.state === "AVAILABLE");

    // Case 1: All lessons completed
    if (completedNodes.length === totalLessons && totalLessons > 0) {
      const lastCompleted = completedNodes[completedNodes.length - 1];
      return {
        state: "COMPLETED",
        lessonId: lastCompleted?.lessonId || "lsn_01",
        title: "All Unit Lessons Completed!",
        description: "You have completed all lessons in this unit. Check your next adaptive recommendation or reinforce skills.",
        progressPercentage: 100,
        currentSectionIndex: 0,
        totalSections: lastCompleted?.contentBlockCount || 1,
        completedBlockIds: [],
        ctaLabel: "Review Lessons",
        estimatedMinutes: 0,
      };
    }

    // Case 2: In-Progress Lesson (Resume exact block/section)
    if (inProgressNode) {
      const lessonId = inProgressNode.lessonId;
      const lessonData: any = await dbService.getLessonById(lessonId);
      const sessionData = await dbService.getLessonSession(studentId, lessonId);

      const blocks = lessonData?.contentBlocks || [];
      const totalSections = Math.max(1, blocks.length);
      const currentSectionIndex = Math.min(
        sessionData?.currentSectionIndex ?? 0,
        Math.max(0, totalSections - 1)
      );

      const currentBlock = blocks[currentSectionIndex];
      const currentSectionTitle = currentBlock?.title || `Section ${currentSectionIndex + 1}`;

      return {
        state: "IN_PROGRESS",
        lessonId,
        title: inProgressNode.title,
        description: inProgressNode.description || "Continue where you left off.",
        progressPercentage: inProgressNode.progressPercentage || Math.round(((currentSectionIndex + 1) / totalSections) * 100),
        currentSectionIndex,
        totalSections,
        currentSectionTitle,
        completedBlockIds: sessionData?.completedBlockIds || [],
        lastActivityAt: sessionData?.lastActivityAt?.toISOString(),
        ctaLabel: "Continue Lesson",
        estimatedMinutes: inProgressNode.estimatedMinutes || 20,
      };
    }

    // Case 3: Available first lesson (No progress yet or next available)
    const targetNode = firstAvailableNode || nodes[0];
    if (targetNode) {
      const hasAnyProgress = completedNodes.length > 0;
      const lessonData: any = await dbService.getLessonById(targetNode.lessonId);
      const blocks = lessonData?.contentBlocks || [];

      return {
        state: hasAnyProgress ? "IN_PROGRESS" : "NO_PROGRESS",
        lessonId: targetNode.lessonId,
        title: targetNode.title,
        description: targetNode.description || "Begin this interactive MATATAG lesson.",
        progressPercentage: 0,
        currentSectionIndex: 0,
        totalSections: Math.max(1, blocks.length),
        currentSectionTitle: blocks[0]?.title || "Introduction",
        completedBlockIds: [],
        ctaLabel: hasAnyProgress ? "Start Next Lesson" : "Start Learning",
        estimatedMinutes: targetNode.estimatedMinutes || 20,
      };
    }

    // Fallback safe placeholder
    return {
      state: "NO_PROGRESS",
      lessonId: "lsn_01",
      title: "Grade 7 Mathematics - Term 1",
      description: "Begin your learning journey with integers and real-world representations.",
      progressPercentage: 0,
      currentSectionIndex: 0,
      totalSections: 4,
      completedBlockIds: [],
      ctaLabel: "Start Learning",
      estimatedMinutes: 20,
    };
  }

  /**
   * Aggregate multi-dimensional skill masteries & progress summary
   */
  private static async resolveProgressSummary(
    studentId: string,
    nodes: any[]
  ): Promise<ProgressSummaryDTO> {
    const masteries = await MasteryEngine.getStudentMasteries(studentId);

    const counts: Record<MasteryLevel, number> = {
      NOT_STARTED: 0,
      LEARNING: 0,
      DEVELOPING: 0,
      PROFICIENT: 0,
      MASTERED: 0,
    };

    let totalAccuracySum = 0;
    let accuracyCount = 0;
    let totalAttempts = 0;

    masteries.forEach((m) => {
      if (counts[m.status] !== undefined) {
        counts[m.status]++;
      }
      if (m.attemptCount > 0) {
        totalAccuracySum += m.accuracy;
        accuracyCount++;
      }
      totalAttempts += m.attemptCount;
    });

    const overallAccuracy =
      accuracyCount > 0 ? Math.round((totalAccuracySum / accuracyCount) * 100) : 0;

    const completedLessonsCount = nodes.filter((n) => n.state === "COMPLETED").length;
    const totalLessonsCount = nodes.length;

    const skillsSummary = masteries.map((m) => ({
      id: m.skillId,
      title: m.skillTitle,
      status: m.status,
      accuracy: Math.round(m.accuracy * 100),
      recentAccuracy: Math.round(m.recentAccuracy * 100),
      attemptCount: m.attemptCount,
      consistencyScore: Math.round(m.consistencyScore * 100),
    }));

    return {
      totalSkills: masteries.length,
      masteryCounts: counts,
      overallAccuracy,
      totalAttempts,
      completedLessonsCount,
      totalLessonsCount,
      skills: skillsSummary,
    };
  }

  /**
   * Retrieve and assemble recent activity timeline
   */
  private static async resolveRecentActivity(studentId: string): Promise<RecentActivityItemDTO[]> {
    const items: RecentActivityItemDTO[] = [];

    // 1. Practice Sessions
    try {
      const practiceSessions = await dbService.getStudentPracticeHistory(studentId);
      practiceSessions.slice(0, 5).forEach((ps: any) => {
        const accuracyPct = ps.totalQuestions > 0 ? Math.round((ps.correctAnswers / ps.totalQuestions) * 100) : 0;
        const isDone = ps.status === "COMPLETED";

        items.push({
          id: `act_ps_${ps.id}`,
          type: "PRACTICE_SESSION",
          title: ps.practiceSet?.title || "Practice Session",
          description: isDone
            ? `Completed practice set with ${ps.correctAnswers}/${ps.totalQuestions} correct`
            : "In-progress practice session",
          score: `${ps.correctAnswers}/${ps.totalQuestions}`,
          accuracy: accuracyPct,
          statusBadge: isDone ? "COMPLETED" : "IN_PROGRESS",
          timestamp: (ps.completedAt || ps.startedAt || new Date()).toISOString(),
          url: `/student/practice/${ps.practiceSetId}`,
          actionLabel: isDone ? "Review Practice" : "Resume Practice",
        });
      });
    } catch (e) {
      console.warn("Recent practice sessions error:", e);
    }

    // 2. Fallback store question attempts or prisma attempts
    try {
      const attempts = fallbackStore.questionAttempts
        .filter((a) => a.studentId === studentId)
        .sort((a, b) => b.submittedAt.getTime() - a.submittedAt.getTime())
        .slice(0, 5);

      attempts.forEach((att) => {
        const q = fallbackStore.questions.find((quest) => quest.id === att.questionId);
        const skill = q ? fallbackStore.curriculum.skills.find((s) => s.id === q.skillId) : null;

        items.push({
          id: `act_att_${att.id}`,
          type: "QUESTION_ATTEMPT",
          title: skill?.title || "Practice Question",
          description: q ? q.prompt.slice(0, 60) + (q.prompt.length > 60 ? "..." : "") : "Question evaluated",
          isCorrect: att.isCorrect,
          statusBadge: att.isCorrect ? "CORRECT" : "RETRY_NEEDED",
          timestamp: att.submittedAt.toISOString(),
          url: q?.lessonId ? `/student/lessons/${q.lessonId}` : "/student/practice-history",
          actionLabel: "View Question",
        });
      });
    } catch (e) {
      console.warn("Recent question attempts error:", e);
    }

    // 3. Checkpoint attempts
    try {
      const checkpoints = fallbackStore.checkpointAttempts
        .filter((c) => c.userId === studentId)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, 3);

      checkpoints.forEach((chk) => {
        const lesson = fallbackStore.curriculum.lessons.find((l) => l.id === chk.lessonId);
        items.push({
          id: `act_chk_${chk.id}`,
          type: "CHECKPOINT",
          title: lesson?.title ? `${lesson.title} Checkpoint` : "Lesson Checkpoint",
          description: chk.isCorrect ? "Successfully passed concept checkpoint" : "Attempted concept checkpoint",
          isCorrect: chk.isCorrect,
          statusBadge: chk.isCorrect ? "PASSED" : "NEEDS_REVIEW",
          timestamp: chk.createdAt.toISOString(),
          url: `/student/lessons/${chk.lessonId}`,
          actionLabel: "Open Lesson",
        });
      });
    } catch (e) {
      console.warn("Recent checkpoints error:", e);
    }

    // Sort all recent events chronologically descending
    items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return items.slice(0, 8);
  }
}
