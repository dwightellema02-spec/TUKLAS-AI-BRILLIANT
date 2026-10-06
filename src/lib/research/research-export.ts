/**
 * Tuklas AI - Research Data Export Engine (CSV Generation)
 * Phase 14: Data Export & Standardized Research Formats
 */

import { RESEARCH_CONFIG } from "./research-config";
import type { StudentResearchProfile, PrePostComparisonResult } from "./research-types";

function escapeCsvField(val: unknown): string {
  if (val === null || val === undefined) return "";
  const str = String(val);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export class ResearchExporter {
  /**
   * Export student research metrics to standardized CSV
   */
  static exportMetricsSummaryCsv(profiles: StudentResearchProfile[]): string {
    const headers = [
      "student_id",
      "student_name",
      "grade_level",
      "metric",
      "value",
      "level",
      "confidence",
      "evidence_count",
      "evidence_details",
      "calculation_version",
      "calculated_at",
    ];

    const rows: string[] = [headers.join(",")];

    for (const p of profiles) {
      const metricKeys: Array<keyof StudentResearchProfile["metrics"]> = [
        "accuracy",
        "understanding",
        "application",
        "consistency",
      ];

      for (const k of metricKeys) {
        const m = p.metrics[k];
        const row = [
          escapeCsvField(p.studentId),
          escapeCsvField(p.studentName),
          escapeCsvField(p.gradeLevel || 7),
          escapeCsvField(m.metric),
          escapeCsvField(m.value.toFixed(4)),
          escapeCsvField(m.level),
          escapeCsvField(m.confidence.toFixed(2)),
          escapeCsvField(m.evidenceCount),
          escapeCsvField(m.evidence.details),
          escapeCsvField(m.calculationVersion),
          escapeCsvField(m.calculatedAt),
        ];
        rows.push(row.join(","));
      }
    }

    return rows.join("\n");
  }

  /**
   * Export granular question attempt records for empirical research modeling
   */
  static exportQuestionAttemptsCsv(
    attempts: Array<{
      studentId: string;
      studentName?: string;
      questionId: string;
      skillId?: string | null;
      lessonId?: string | null;
      attemptNumber: number;
      isCorrect: boolean;
      score?: number;
      difficulty?: string | null;
      questionType?: string | null;
      cognitiveLevel?: string | null;
      timeTakenMs?: number | null;
      hintUsed: boolean;
      mistakeCategory?: string | null;
      submittedAt: Date | string;
    }>
  ): string {
    const headers = [
      "student_id",
      "student_name",
      "question_id",
      "skill_id",
      "lesson_id",
      "attempt_number",
      "correct",
      "score",
      "difficulty",
      "question_type",
      "cognitive_level",
      "time_taken_ms",
      "hint_used",
      "mistake_category",
      "timestamp",
    ];

    const rows: string[] = [headers.join(",")];

    for (const a of attempts) {
      const row = [
        escapeCsvField(a.studentId),
        escapeCsvField(a.studentName || ""),
        escapeCsvField(a.questionId),
        escapeCsvField(a.skillId || ""),
        escapeCsvField(a.lessonId || ""),
        escapeCsvField(a.attemptNumber),
        escapeCsvField(a.isCorrect ? "1" : "0"),
        escapeCsvField(a.score !== undefined ? a.score : a.isCorrect ? 1 : 0),
        escapeCsvField(a.difficulty || "MEDIUM"),
        escapeCsvField(a.questionType || "MULTIPLE_CHOICE"),
        escapeCsvField(a.cognitiveLevel || "PROCEDURAL"),
        escapeCsvField(a.timeTakenMs || 0),
        escapeCsvField(a.hintUsed ? "1" : "0"),
        escapeCsvField(a.mistakeCategory || "NONE"),
        escapeCsvField(
          typeof a.submittedAt === "string" ? a.submittedAt : a.submittedAt.toISOString()
        ),
      ];
      rows.push(row.join(","));
    }

    return rows.join("\n");
  }

  /**
   * Export Pre-Test / Post-Test comparison CSV
   */
  static exportPrePostComparisonCsv(comparisons: PrePostComparisonResult[]): string {
    const headers = [
      "student_id",
      "student_name",
      "classroom_id",
      "classroom_name",
      "pre_test_id",
      "pre_test_title",
      "pre_test_score_percent",
      "post_test_id",
      "post_test_title",
      "post_test_score_percent",
      "score_difference_points",
      "relative_growth_percent",
      "observed_trend",
      "calculation_version",
      "calculated_at",
    ];

    const rows: string[] = [headers.join(",")];

    for (const c of comparisons) {
      const row = [
        escapeCsvField(c.studentId || "COHORT"),
        escapeCsvField(c.studentName || "Classroom Cohort"),
        escapeCsvField(c.classroomId || ""),
        escapeCsvField(c.classroomName || ""),
        escapeCsvField(c.preTest.assessmentId),
        escapeCsvField(c.preTest.title),
        escapeCsvField(c.preTest.averageScorePercent === null ? "" : c.preTest.averageScorePercent.toFixed(1)),
        escapeCsvField(c.postTest.assessmentId),
        escapeCsvField(c.postTest.title),
        escapeCsvField(c.postTest.averageScorePercent === null ? "" : c.postTest.averageScorePercent.toFixed(1)),
        escapeCsvField(c.comparison.scoreDifferencePoints === null ? "" : c.comparison.scoreDifferencePoints.toFixed(1)),
        escapeCsvField(c.comparison.relativeGrowthPercent === null ? "" : c.comparison.relativeGrowthPercent.toFixed(1)),
        escapeCsvField(c.comparison.observedTrend),
        escapeCsvField(c.calculationVersion),
        escapeCsvField(c.calculatedAt),
      ];
      rows.push(row.join(","));
    }

    return rows.join("\n");
  }

  // Aliases for compatibility
  static exportMetricsToCsv = ResearchExporter.exportMetricsSummaryCsv;
  static exportRawAttemptsToCsv = ResearchExporter.exportQuestionAttemptsCsv;
  static exportPrePostComparisonToCsv(input: PrePostComparisonResult | PrePostComparisonResult[]): string {
    const list = Array.isArray(input) ? input : [input];
    return ResearchExporter.exportPrePostComparisonCsv(list);
  }
}
