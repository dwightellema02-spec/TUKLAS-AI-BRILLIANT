/**
 * Tuklas AI - Pre-Test / Post-Test Research Comparison Service
 * Phase 14: Non-Causal Deterministic Comparative Analytics
 */

import { RESEARCH_CONFIG } from "./research-config";
import type { PrePostComparisonResult } from "./research-types";

export interface PrePostComparisonInput {
  studentId?: string;
  studentName?: string;
  classroomId?: string;
  classroomName?: string;
  preTest: {
    assessmentId: string;
    title: string;
    totalStudents?: number;
    averageScorePercent: number;
    completedAt?: string;
    skills?: Array<{ skillId: string; skillTitle: string; accuracy: number }>;
  };
  postTest: {
    assessmentId: string;
    title: string;
    totalStudents?: number;
    averageScorePercent: number;
    completedAt?: string;
    skills?: Array<{ skillId: string; skillTitle: string; accuracy: number }>;
  };
}

export class ResearchComparisonService {
  /**
   * Compare pre-test and post-test performance deterministically without fabricating causal claims
   */
  static compare(input: PrePostComparisonInput): PrePostComparisonResult {
    const preScore = Number(input.preTest.averageScorePercent.toFixed(1));
    const postScore = Number(input.postTest.averageScorePercent.toFixed(1));

    // Observed difference in percentage points (e.g. 86.0 - 72.0 = +14.0 points)
    const diffPoints = Number((postScore - preScore).toFixed(1));

    // Relative growth percentage
    const relativeGrowth =
      preScore > 0 ? Number((((postScore - preScore) / preScore) * 100).toFixed(1)) : 0;

    let observedTrend: "IMPROVEMENT" | "MAINTAINED" | "DECLINE" | "INSUFFICIENT_DATA" = "MAINTAINED";
    let description = "";

    if (diffPoints > 2.0) {
      observedTrend = "IMPROVEMENT";
      description = `Observed difference shows an increase of +${diffPoints} percentage points from pre-test (${preScore}%) to post-test (${postScore}%).`;
    } else if (diffPoints < -2.0) {
      observedTrend = "DECLINE";
      description = `Observed difference shows a decrease of ${diffPoints} percentage points from pre-test (${preScore}%) to post-test (${postScore}%).`;
    } else {
      observedTrend = "MAINTAINED";
      description = `Observed performance remained steady with a slight variation of ${diffPoints > 0 ? "+" : ""}${diffPoints} percentage points between pre-test and post-test.`;
    }

    // Build skill-by-skill breakdown if available
    const skillBreakdown: Array<{
      skillId: string;
      skillTitle: string;
      preAccuracy: number;
      postAccuracy: number;
      pointChange: number;
    }> = [];

    const preSkills = input.preTest.skills || [];
    const postSkills = input.postTest.skills || [];

    const allSkillIds = Array.from(
      new Set([...preSkills.map((s) => s.skillId), ...postSkills.map((s) => s.skillId)])
    );

    for (const sId of allSkillIds) {
      const pre = preSkills.find((s) => s.skillId === sId);
      const post = postSkills.find((s) => s.skillId === sId);
      const pAcc = pre ? Number((pre.accuracy * 100).toFixed(1)) : 0;
      const ptAcc = post ? Number((post.accuracy * 100).toFixed(1)) : 0;
      const change = Number((ptAcc - pAcc).toFixed(1));

      skillBreakdown.push({
        skillId: sId,
        skillTitle: post?.skillTitle || pre?.skillTitle || sId,
        preAccuracy: pAcc,
        postAccuracy: ptAcc,
        pointChange: change,
      });
    }

    return {
      studentId: input.studentId,
      studentName: input.studentName,
      classroomId: input.classroomId,
      classroomName: input.classroomName,
      preTest: {
        assessmentId: input.preTest.assessmentId,
        title: input.preTest.title,
        totalStudents: input.preTest.totalStudents || 1,
        averageScorePercent: preScore,
        completedAt: input.preTest.completedAt,
      },
      postTest: {
        assessmentId: input.postTest.assessmentId,
        title: input.postTest.title,
        totalStudents: input.postTest.totalStudents || 1,
        averageScorePercent: postScore,
        completedAt: input.postTest.completedAt,
      },
      comparison: {
        scoreDifferencePoints: diffPoints,
        relativeGrowthPercent: relativeGrowth,
        observedTrend,
        description,
      },
      skillBreakdown,
      calculatedAt: new Date().toISOString(),
      calculationVersion: RESEARCH_CONFIG.version,
    };
  }

  /**
   * High-level helper to compare pre-test and post-test for a given classroom
   */
  static async comparePrePostTests(params?: {
    classroomId?: string;
    preTestId?: string;
    postTestId?: string;
  }): Promise<PrePostComparisonResult> {
    const { ResearchService } = await import("./research-service");
    return ResearchService.getPrePostComparison(
      params?.preTestId || "asm_pre_01",
      params?.postTestId || "asm_post_01",
      params?.classroomId
    );
  }
}

export const PrePostComparator = ResearchComparisonService;
