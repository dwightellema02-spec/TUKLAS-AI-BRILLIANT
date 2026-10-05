/**
 * Tuklas AI - Teacher AI Assistant Service
 * Phase 12: Read-only, Scoped Pedagogical Query Assistant
 *
 * Grounded strictly in authorized class and student data. Never hallucinates statistics.
 */

import { GoogleGenAI } from "@google/genai";
import { TeacherService } from "./teacher-service";
import { resolveGeminiModel } from "../ai/provider";
import type { TeacherAIQueryResponse } from "./teacher-types";

export class TeacherAIService {
  /**
   * Process a teacher's pedagogical inquiry grounded exclusively in authorized data
   */
  static async queryTeacherAssistant(params: {
    teacherId: string;
    userRole: string;
    prompt: string;
    classId?: string;
  }): Promise<TeacherAIQueryResponse> {
    const { teacherId, userRole, prompt, classId } = params;

    // 1. Retrieve authorized dashboard analytics (scoped to one class when asked, after an ownership check)
    const dashboard = await TeacherService.getTeacherDashboard(teacherId, userRole, { classId });
    const selectedClass = classId ? dashboard.classes[0]?.name ?? "Selected class" : "All Assigned Classes";
    const pct = (n: number | null | undefined) => (n === null || n === undefined ? "no data yet" : `${n}%`);

    const groundedContext = {
      totalStudents: dashboard.stats.totalStudents,
      activeStudents: dashboard.stats.activeStudents,
      inactiveStudents: dashboard.stats.inactiveStudents,
      averageClassAccuracy: pct(dashboard.classProgress.averageClassAccuracy),
      lessonsCompleted: dashboard.classProgress.lessonsCompletedTotal,
      practiceSessions: dashboard.classProgress.practiceSessionsTotal,
      difficultSkills: dashboard.difficultSkills.map((d) => ({
        skillTitle: d.skillTitle,
        strugglingStudents: d.developingOrLearningCount,
        studentsWithEvidence: d.totalStudents,
        averageAccuracy: pct(d.averageAccuracy),
        reason: d.reason,
      })),
      commonMistakes: dashboard.commonMistakes.map((m) => `${m.label} (${m.count} occurrences)`),
      studentsNeedingAttention: dashboard.needsAttention.map((s) => ({
        student: s.studentName,
        issue: s.details,
        severity: s.severity,
      })),
      selectedClass,
    };

    const apiKey = process.env.GEMINI_API_KEY || process.env.AI_API_KEY;

    if (apiKey) {
      try {
        const ai = new GoogleGenAI({ apiKey });
        const systemPrompt = `You are the Tuklas AI Teacher Assistant for Grade 7 Mathematics under the DepEd MATATAG curriculum.
You assist teachers by interpreting real classroom analytics and suggesting evidence-based teaching interventions.

CRITICAL RULES:
1. ONLY use the verified grounded metrics provided below. NEVER invent, extrapolate, or alter any numerical statistics, student names, or percentages. If a metric says "no data yet", say that the data is not available yet; do not estimate it.
2. If there are no students or no activity, say so plainly and suggest how to get data (enrol students, assign a lesson).
3. Keep your response professional, constructive, and actionable. Suggest at most 3 specific pedagogical strategies that follow from the data.
4. Never assume authority to change grades or publish content automatically.`;

        const userPrompt = `Teacher Query: "${prompt}"

Current Grounded Classroom Data:
${JSON.stringify(groundedContext, null, 2)}

Provide a clear, scannable response summarizing key patterns that are actually present in this data.`;

        const response = await ai.models.generateContent({
          model: resolveGeminiModel(),
          contents: userPrompt,
          config: { systemInstruction: systemPrompt, maxOutputTokens: 600, temperature: 0.3 },
        });

        const text = response.text || "";
        if (text.trim().length > 0) {
          // The model's wording is used as-is; actions are derived only from what the data shows.
          return { answer: text, groundedMetrics: groundedContext, suggestedActions: this.actionsFromData(dashboard) };
        }
      } catch (err) {
        console.warn("Gemini Teacher AI assistant failed, falling back to deterministic synthesis:", err);
      }
    }

    // 2. Deterministic synthesis: every sentence below is built from real values or states that none exist.
    const p = prompt.toLowerCase();
    let answer = "";

    if (dashboard.stats.totalStudents === 0) {
      answer = `${selectedClass} has no enrolled students yet, so there are no analytics to interpret. Add students to a class (by email or by sharing the class code) and assign a lesson; insights appear once they start working.`;
    } else if (p.includes("difficult") || p.includes("struggle") || p.includes("hard")) {
      const top = dashboard.difficultSkills[0];
      answer = top
        ? `In ${selectedClass}, the skill with the clearest struggle signal is **${top.skillTitle}**: ${top.developingOrLearningCount} of ${top.totalStudents} students with evidence are still learning or developing it (average mastery accuracy: ${pct(top.averageAccuracy)}).${top.commonMistakeCategory ? ` The most frequent diagnosed pattern for this skill is **${top.commonMistakeCategory.replace(/_/g, " ").toLowerCase()}**.` : ""}`
        : `No skill currently meets the threshold for "difficult" (at least 2 students with evidence and 30% still learning/developing). This may simply mean students have not produced enough evidence yet.`;
    } else if (p.includes("support") || p.includes("help") || p.includes("attention")) {
      const highNeed = dashboard.needsAttention.filter((n) => n.severity === "HIGH");
      answer = dashboard.needsAttention.length > 0
        ? `There are **${dashboard.needsAttention.length} student support signals** in ${selectedClass}; ${highNeed.length} are high priority: ${dashboard.needsAttention.map((s) => `${s.studentName} (${s.details})`).join("; ")}.`
        : `No student currently has a support signal in ${selectedClass}. That reflects the data available (${dashboard.classProgress.practiceSessionsTotal} practice sessions so far), not a guarantee that everyone is doing well.`;
    } else if (p.includes("mistake") || p.includes("misconception")) {
      const [m1, m2] = dashboard.commonMistakes;
      answer = m1
        ? `Diagnosed mistakes in ${selectedClass} are led by **${m1.label}** (${m1.count} instances)${m2 ? `, then **${m2.label}** (${m2.count})` : ""}.`
        : `No mistake analyses have been recorded for ${selectedClass} yet.`;
    } else {
      answer = `${selectedClass} has **${dashboard.stats.totalStudents} enrolled students**, **${dashboard.stats.activeStudents}** active in the last 14 days. Class practice accuracy: **${pct(dashboard.classProgress.averageClassAccuracy)}** across ${dashboard.classProgress.practiceSessionsTotal} practice sessions; ${dashboard.classProgress.lessonsCompletedTotal} lessons completed in total.`;
    }

    return { answer, groundedMetrics: groundedContext, suggestedActions: this.actionsFromData(dashboard) };
  }

  /** Suggestions that follow from the data actually present (never boilerplate about topics the data does not mention). */
  private static actionsFromData(dashboard: Awaited<ReturnType<typeof TeacherService.getTeacherDashboard>>): string[] {
    const actions: string[] = [];
    if (dashboard.stats.totalStudents === 0) {
      actions.push("Add students to a class or share its class code so they can join.");
      return actions;
    }
    if (dashboard.needsAttention.length > 0) actions.push("Open the flagged students' profiles and plan a short check-in.");
    if (dashboard.difficultSkills[0]) actions.push(`Plan a short small-group review of "${dashboard.difficultSkills[0].skillTitle}".`);
    if (dashboard.commonMistakes[0]) actions.push(`Address the most frequent diagnosed pattern (${dashboard.commonMistakes[0].label}) in the next lesson.`);
    if (dashboard.stats.inactiveStudents > 0) actions.push(`${dashboard.stats.inactiveStudents} student(s) have no recent activity: check that an assignment is available to them.`);
    if (actions.length === 0) actions.push("Assign a lesson or practice set to generate more evidence.");
    return actions.slice(0, 3);
  }
}
