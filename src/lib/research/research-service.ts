/**
 * Tuklas AI - Core Research Analytics Orchestrator
 * Phase 14 metrics, rebuilt in Phase 29 on real, scoped data only: nothing here is invented. Where there is not
 * enough evidence the result says so (empty lists, null values, INSUFFICIENT_*), and every query is limited to
 * the students the caller is allowed to see.
 */

import { RESEARCH_CONFIG } from "./research-config";
import { AccuracyCalculator } from "./accuracy";
import { UnderstandingCalculator } from "./understanding";
import { ApplicationCalculator } from "./application";
import { ConsistencyCalculator } from "./consistency";
import { ResearchComparisonService } from "./comparison";
import { ResearchData, type ResearchScope, type AttemptRow } from "./research-data";
import type {
  StudentResearchProfile,
  PrePostComparisonResult,
  DifficultSkillEvidence,
  MistakeAggregateItem,
  InterventionObservationItem,
  TimeSeriesDataPoint,
} from "./research-types";

export type { ResearchScope } from "./research-data";

const pct = (n: number) => Number((n * 100).toFixed(1));
const ratio = (num: number, den: number) => (den > 0 ? Number((num / den).toFixed(4)) : 0);

export class ResearchService {
  /**
   * Deterministic research profile for ONE student. The caller must already have authorised access to this student.
   */
  static async getStudentResearchProfile(
    studentId: string,
    filters?: { skillId?: string; lessonId?: string }
  ): Promise<StudentResearchProfile> {
    const scope: ResearchScope = { studentIds: [studentId] };
    const info = (await ResearchData.students([studentId])).get(studentId);
    if (!info) throw new Error("Student not found");

    const attempts = await ResearchData.attempts(scope, filters);
    const checkpoints = await ResearchData.checkpoints(scope, studentId);

    const normalizedAttempts = attempts.map((a) => ({
      isCorrect: a.isCorrect,
      attemptNumber: a.attemptNumber || 1,
      hintUsed: a.hintUsed,
      timeTakenMs: a.timeTakenMs ?? undefined,
      questionId: a.questionId,
      skillId: a.skillId ?? undefined,
      difficulty: a.difficulty as any,
      questionType: a.questionType as any,
      cognitiveLevel: a.cognitiveLevel as any,
      submittedAt: a.submittedAt,
      isAbandoned: false,
    }));

    const accuracy = AccuracyCalculator.calculate({ attempts: normalizedAttempts as any });
    const understanding = UnderstandingCalculator.calculate({
      attempts: normalizedAttempts as any,
      checkpoints: checkpoints.map((c) => ({ isCorrect: c.isCorrect, attempt: c.attempt })),
    });
    const application = ApplicationCalculator.calculate({ attempts: normalizedAttempts as any });
    const consistency = ConsistencyCalculator.calculate({ attempts: normalizedAttempts as any });

    const uniqueSkills = new Set(normalizedAttempts.map((a) => a.skillId).filter(Boolean));
    const mistakes = (await ResearchData.mistakes(scope)).filter((m) => m.category !== "UNKNOWN");
    const counts = new Map<string, number>();
    for (const m of mistakes) counts.set(m.category, (counts.get(m.category) ?? 0) + 1);
    const top = Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0];

    return {
      studentId,
      studentName: info.name,
      gradeLevel: info.gradeLevel ?? undefined,
      metrics: { accuracy, understanding, application, consistency },
      attemptCount: normalizedAttempts.length,
      skillsEvaluated: uniqueSkills.size,
      difficultSkillCount: accuracy.value < RESEARCH_CONFIG.difficultSkillCriteria.lowAccuracyThreshold && accuracy.evidenceCount >= RESEARCH_CONFIG.thresholds.minAttemptsForAccuracy ? 1 : 0,
      topMisconception: top?.[0],
      calculatedAt: new Date().toISOString(),
      calculationVersion: RESEARCH_CONFIG.version,
    };
  }

  /**
   * Pre-test vs post-test for the students in scope: averages and skill accuracies come from the graded responses.
   * With no graded result on a side, that side is null and the trend is INSUFFICIENT_DATA.
   */
  static async getPrePostComparison(
    scope: ResearchScope,
    preTestId: string,
    postTestId: string,
    classroom?: { id: string; name: string }
  ): Promise<PrePostComparisonResult> {
    const [pre, post, skillTitles] = await Promise.all([
      ResearchData.assessmentResults(preTestId, scope),
      ResearchData.assessmentResults(postTestId, scope),
      ResearchData.skillTitles(),
    ]);
    const mean = (xs: number[]) => (xs.length > 0 ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
    const skillAccuracy = (responses: Array<{ skillId: string | null; isCorrect: boolean }>) => {
      const by = new Map<string, { n: number; c: number }>();
      for (const r of responses) {
        if (!r.skillId) continue;
        const e = by.get(r.skillId) ?? { n: 0, c: 0 };
        e.n++; if (r.isCorrect) e.c++;
        by.set(r.skillId, e);
      }
      return Array.from(by.entries()).map(([skillId, e]) => ({ skillId, skillTitle: skillTitles.get(skillId) ?? skillId, accuracy: ratio(e.c, e.n) }));
    };

    const result = ResearchComparisonService.compare({
      classroomId: classroom?.id,
      classroomName: classroom?.name,
      preTest: {
        assessmentId: preTestId,
        title: pre.title ?? preTestId,
        totalStudents: pre.perStudent.length,
        averageScorePercent: mean(pre.perStudent.map((p) => p.scorePercent)),
        skills: skillAccuracy(pre.responses),
      },
      postTest: {
        assessmentId: postTestId,
        title: post.title ?? postTestId,
        totalStudents: post.perStudent.length,
        averageScorePercent: mean(post.perStudent.map((p) => p.scorePercent)),
        skills: skillAccuracy(post.responses),
      },
    });
    const both = pre.perStudent.filter((p) => post.perStudent.some((q) => q.studentId === p.studentId)).length;
    if (result.comparison.observedTrend !== "INSUFFICIENT_DATA") {
      result.comparison.description += ` Based on ${pre.perStudent.length} pre-test and ${post.perStudent.length} post-test result(s); ${both} student(s) took both. This is an observed difference, not evidence of cause.`;
    }
    return result;
  }

  /**
   * Skills where the students in scope show low accuracy or heavy hint use. Needs enough evidence: at least
   * minAttemptsToFlag attempts from at least minStudentsForClassroomAggregate students.
   */
  static async getDifficultSkills(scope: ResearchScope, filters?: { gradeLevel?: number }): Promise<DifficultSkillEvidence[]> {
    const [attempts, mistakes, masteries, titles] = await Promise.all([
      ResearchData.attempts(scope),
      ResearchData.mistakes(scope),
      ResearchData.masteries(scope),
      ResearchData.skillTitles(),
    ]);
    const C = RESEARCH_CONFIG.difficultSkillCriteria;
    const bySkill = new Map<string, AttemptRow[]>();
    for (const a of attempts) if (a.skillId) bySkill.set(a.skillId, [...(bySkill.get(a.skillId) ?? []), a]);

    const results: DifficultSkillEvidence[] = [];
    for (const [skillId, rows] of bySkill) {
      const students = new Set(rows.map((r) => r.studentId));
      if (rows.length < C.minAttemptsToFlag || students.size < RESEARCH_CONFIG.thresholds.minStudentsForClassroomAggregate) continue;

      const accuracy = ratio(rows.filter((r) => r.isCorrect).length, rows.length);
      const hintRate = ratio(rows.filter((r) => r.hintUsed).length, rows.length);
      const lowAccuracy = accuracy < C.lowAccuracyThreshold;
      const highHint = hintRate > C.highHintRateThreshold;
      if (!lowAccuracy && !highHint) continue;

      let affected = 0;
      for (const sid of students) {
        const mine = rows.filter((r) => r.studentId === sid);
        if (ratio(mine.filter((r) => r.isCorrect).length, mine.length) < C.lowAccuracyThreshold) affected++;
      }
      const mk = mistakes.filter((m) => m.skillId === skillId && m.category !== "UNKNOWN");
      const mc = new Map<string, number>();
      for (const m of mk) mc.set(m.category, (mc.get(m.category) ?? 0) + 1);
      const dist = { notStarted: 0, learning: 0, developing: 0, proficient: 0, mastered: 0 };
      for (const m of masteries.filter((x) => x.skillId === skillId)) {
        const key = ({ NOT_STARTED: "notStarted", LEARNING: "learning", DEVELOPING: "developing", PROFICIENT: "proficient", MASTERED: "mastered" } as Record<string, keyof typeof dist>)[m.status];
        if (key) dist[key]++;
      }
      results.push({
        skillId,
        skillTitle: titles.get(skillId) ?? skillId,
        gradeLevel: filters?.gradeLevel ?? 7,
        accuracy,
        evidenceCount: rows.length,
        affectedStudentCount: affected,
        totalStudentsEvaluated: students.size,
        primaryMisconceptions: Array.from(mc.entries()).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([category, count]) => ({ category, count, percentage: pct(count / mk.length) })),
        hintDependenceRate: hintRate,
        masteryDistribution: dist,
        flagReason: lowAccuracy
          ? `Accuracy across ${students.size} students (${pct(accuracy)}%) is below the ${pct(C.lowAccuracyThreshold)}% baseline.`
          : `${pct(hintRate)}% of attempts used a hint, above the ${pct(C.highHintRateThreshold)}% threshold.`,
      });
    }
    return results.sort((a, b) => a.accuracy - b.accuracy);
  }

  /** Mistake categories recorded by the mistake analyzer for the students in scope. */
  static async getMistakeAnalytics(scope: ResearchScope): Promise<MistakeAggregateItem[]> {
    const [mistakes, attempts] = await Promise.all([ResearchData.mistakes(scope), ResearchData.attempts(scope)]);
    const rows = mistakes.filter((m) => m.category !== "UNKNOWN");
    if (rows.length === 0) return [];
    const byCat = new Map<string, typeof rows>();
    for (const m of rows) byCat.set(m.category, [...(byCat.get(m.category) ?? []), m]);
    const wrongBySkill = new Map<string, Set<string>>();
    for (const a of attempts) {
      if (!a.isCorrect && a.skillId && a.prompt) wrongBySkill.set(a.skillId, new Set([...(wrongBySkill.get(a.skillId) ?? []), a.prompt]));
    }
    return Array.from(byCat.entries()).map(([category, items]) => {
      const skills = new Set(items.map((i) => i.skillId).filter(Boolean) as string[]);
      const prompts = Array.from(new Set(Array.from(skills).flatMap((s) => Array.from(wrongBySkill.get(s) ?? [])))).slice(0, 3);
      const latest = [...items].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).find((i) => i.recommendation);
      return {
        category,
        count: items.length,
        percentage: pct(items.length / rows.length),
        affectedStudentCount: new Set(items.map((i) => i.studentId)).size,
        affectedSkillCount: skills.size,
        sampleQuestionPrompts: prompts,
        recommendedPedagogicalAction: latest?.recommendation ?? "",
      };
    }).sort((a, b) => b.count - a.count);
  }

  /**
   * Before/after observations around AI tutor conversations: a student's accuracy on the skill before vs after
   * the conversation, shown only when there are at least 3 attempts on each side. Strictly descriptive.
   */
  static async getInterventionObservations(scope: ResearchScope): Promise<InterventionObservationItem[]> {
    const [convs, attempts, titles] = await Promise.all([ResearchData.tutorConversations(scope), ResearchData.attempts(scope), ResearchData.skillTitles()]);
    const names = await ResearchData.students(Array.from(new Set(convs.map((c) => c.studentId))));
    const MIN = 3;
    const out: InterventionObservationItem[] = [];
    for (const c of convs) {
      if (!c.skillId) continue;
      const mine = attempts.filter((a) => a.studentId === c.studentId && a.skillId === c.skillId);
      const before = mine.filter((a) => a.submittedAt < c.createdAt);
      const after = mine.filter((a) => a.submittedAt >= c.createdAt);
      if (before.length < MIN || after.length < MIN) continue;
      const bAcc = ratio(before.filter((a) => a.isCorrect).length, before.length);
      const aAcc = ratio(after.filter((a) => a.isCorrect).length, after.length);
      const change = Number(((aAcc - bAcc) * 100).toFixed(1));
      out.push({
        interventionType: "AI_TUTOR_CONVERSATION",
        studentId: c.studentId,
        studentName: names.get(c.studentId)?.name ?? "Unknown student",
        skillId: c.skillId,
        skillTitle: titles.get(c.skillId) ?? c.skillId,
        timestamp: c.createdAt.toISOString(),
        beforeEvidence: { accuracy: bAcc, attempts: before.length, description: `${before.filter((a) => a.isCorrect).length} correct out of ${before.length} attempts before the tutor conversation.` },
        afterEvidence: { accuracy: aAcc, attempts: after.length, description: `${after.filter((a) => a.isCorrect).length} correct out of ${after.length} attempts after the tutor conversation.` },
        observedChange: {
          pointChange: change,
          observationStatement: `Accuracy on this skill was ${change >= 0 ? "+" : ""}${change} percentage points different after the conversation than before. Other things changed over the same time, so this does not show that the tutor caused it.`,
        },
      });
    }
    return out.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }

  /** Accuracy per calendar day (UTC) for the students in scope. */
  static async getTimeSeriesMetrics(scope: ResearchScope): Promise<TimeSeriesDataPoint[]> {
    const attempts = await ResearchData.attempts(scope);
    const byDay = new Map<string, AttemptRow[]>();
    for (const a of attempts) {
      const day = a.submittedAt.toISOString().slice(0, 10);
      byDay.set(day, [...(byDay.get(day) ?? []), a]);
    }
    return Array.from(byDay.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([date, rows]) => ({
      date,
      accuracy: ratio(rows.filter((r) => r.isCorrect).length, rows.length),
      understanding: null,
      application: null,
      consistency: null,
      attemptCount: rows.length,
      activeStudents: new Set(rows.map((r) => r.studentId)).size,
    }));
  }

  // Aliases for compatibility
  static identifyDifficultSkills = ResearchService.getDifficultSkills;
  static aggregateMistakeTaxonomy = ResearchService.getMistakeAnalytics;
}
