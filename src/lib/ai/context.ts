// Phase 7: AI Tutor Context Builder

import { dbService } from "../db";
import type { AITutorContext, AITutorInteractParams, QuestionContextData } from "./types";

export async function buildAITutorContext(params: AITutorInteractParams): Promise<AITutorContext> {
  const { studentId, conversationId, lessonId, skillId, questionId, practiceSessionId, studentQuery, helpLevel = "LEVEL_1_HINT", studentAnswer } = params;

  // 1. Authenticated Student Context
  const user = await dbService.findUserById(studentId);
  const student = {
    id: studentId,
    name: user ? user.name : "Student",
    gradeLevel: user?.gradeLevel || 7,
  };

  // 2. Question Context (if applicable)
  let questionContext: QuestionContextData | undefined = undefined;
  let targetLessonId = lessonId;
  let targetSkillId = skillId;

  if (questionId) {
    const question = await dbService.getQuestionById(questionId);
    if (question) {
      if (!targetLessonId && question.lessonId) targetLessonId = question.lessonId;
      if (!targetSkillId && question.skillId) targetSkillId = question.skillId;

      let choices: Array<{ id: string; text: string }> | undefined = undefined;
      let expectedAnswer: string | undefined = undefined;

      try {
        const qData = JSON.parse(question.questionData);
        if (qData.choices && Array.isArray(qData.choices)) {
          choices = qData.choices.map((c: any) => ({ id: String(c.id), text: String(c.text) }));
        }
        if (qData.correctAnswer !== undefined) {
          expectedAnswer = String(qData.correctAnswer);
        } else if (qData.acceptableAnswers && Array.isArray(qData.acceptableAnswers)) {
          expectedAnswer = qData.acceptableAnswers.join(" or ");
        }
      } catch {
        // Parsing questionData fallback
      }

      questionContext = {
        id: question.id,
        type: question.type,
        prompt: question.prompt,
        difficulty: question.difficulty,
        choices,
        expectedAnswer,
        correctFeedback: question.correctFeedback || undefined,
        incorrectFeedback: question.incorrectFeedback || undefined,
      };
    }
  }

  // 3. Lesson & Curriculum Context
  let lessonContext: { id: string; title: string; description?: string | null } | undefined = undefined;
  let unitTitle: string | undefined = "Integers & Rational Numbers";

  if (targetLessonId) {
    const lesson = await dbService.getLessonById(targetLessonId);
    if (lesson) {
      lessonContext = {
        id: lesson.id,
        title: lesson.title,
        description: lesson.description,
      };
      if (lesson.unit && lesson.unit.title) {
        unitTitle = lesson.unit.title;
      }
    }
  }

  // 4. Skill Context
  let skillContext: { id: string; title: string; description?: string | null } | undefined = undefined;
  if (targetSkillId) {
    const skills = await dbService.getSkills();
    const foundSkill = skills.find((s: any) => s.id === targetSkillId);
    if (foundSkill) {
      skillContext = {
        id: foundSkill.id,
        title: foundSkill.title,
        description: foundSkill.description,
      };
    }
  }

  // 5. Attempt History Context (Load actual student attempts for this question)
  let previousAttempts: any[] = [];
  if (questionId) {
    const attempts = await dbService.getQuestionAttemptsForStudent(studentId, questionId, practiceSessionId);
    previousAttempts = attempts.map((att: any) => ({
      answer: String(att.answer),
      isCorrect: Boolean(att.isCorrect),
      attemptNumber: Number(att.attemptNumber),
      timeTakenMs: att.timeTakenMs || null,
      submittedAt: att.submittedAt ? new Date(att.submittedAt).toISOString() : undefined,
    }));
  }

  // 6. Recent Conversation History (Sliding window of last 6 messages)
  let recentMessages: any[] = [];
  if (conversationId) {
    const messages = await dbService.getAITutorMessages(conversationId, 6);
    recentMessages = messages.map((m: any) => ({
      role: m.role,
      content: m.content,
      messageType: m.messageType,
      createdAt: m.createdAt ? new Date(m.createdAt).toISOString() : undefined,
    }));
  }

  // 7. Check for Recent Mistake Analysis Insight (Phase 8 bridge)
  let mistakeInsight: { category: string; possibleCause?: string | null; pattern?: string | null } | undefined = undefined;
  if (targetSkillId) {
    try {
      const recentAnalysis = await dbService.getLatestMistakeAnalysisForSkill(studentId, targetSkillId);
      if (recentAnalysis && recentAnalysis.confidence >= 0.5) {
        mistakeInsight = {
          category: recentAnalysis.category,
          possibleCause: recentAnalysis.possibleCause,
          pattern: recentAnalysis.pattern,
        };
      }
    } catch (e) {
      console.warn("Failed to retrieve mistake insight for tutor context:", e);
    }
  }

  // 8. Mastery Engine Status (Phase 10 bridge)
  let masteryInsight: { status: string; accuracy: number; recentAccuracy: number; summary?: string } | undefined = undefined;
  if (targetSkillId) {
    try {
      const mastery = await dbService.getSkillMastery(studentId, targetSkillId);
      if (mastery) {
        masteryInsight = {
          status: mastery.status,
          accuracy: Math.round((mastery.accuracy || 0) * 100),
          recentAccuracy: Math.round((mastery.recentAccuracy || 0) * 100),
          summary: mastery.evidenceSummary || undefined,
        };
      }
    } catch (e) {
      console.warn("Failed to retrieve mastery insight for tutor context:", e);
    }
  }

  return {
    student,
    curriculum: {
      subject: "Mathematics",
      grade: 7,
      term: 1,
      unitTitle,
      lessonTitle: lessonContext?.title,
    },
    lesson: lessonContext,
    skill: skillContext,
    question: questionContext,
    studentAnswer,
    previousAttempts,
    recentMessages,
    helpLevel,
    studentQuery,
    practiceSessionId,
    mistakeInsight,
    masteryInsight,
  };
}
