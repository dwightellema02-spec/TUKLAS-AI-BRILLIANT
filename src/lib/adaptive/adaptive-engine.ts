/**
 * Phase 9: Adaptive Learning Engine - Master Orchestrator
 *
 * Implements the core end-to-end adaptive loop:
 * Evidence Collection -> Prerequisite DAG -> Deterministic Rules -> AI Explanation -> Recommendation Storage
 */

import { dbService } from "../db";
import { EvidenceCollector } from "./evidence-collector";
import { AdaptiveDecisionRules } from "./decision-rules";
import { RecommendationBuilder } from "./recommendation-builder";
import type {
  AdaptiveRecommendationDTO,
  GenerateRecommendationParams,
  TeacherOverrideParams,
  AdaptiveDecisionType,
} from "./adaptive-types";

export class AdaptiveEngine {
  /**
   * Main entry point to generate or retrieve an active adaptive recommendation
   */
  static async generateAdaptiveRecommendation(
    params: GenerateRecommendationParams
  ): Promise<AdaptiveRecommendationDTO> {
    const { studentId, forceRefresh = false } = params;

    // 1. Resolve skillId if not explicitly provided
    let targetSkillId = params.skillId;
    let targetLessonId = params.lessonId;

    if (!targetSkillId) {
      // Find active or next recommended skill from student's learning path
      const pathData = await dbService.getStudentLearningPath(studentId);
      const activeNode =
        pathData?.learningPath?.find(
          (n: any) => n.state === "IN_PROGRESS" || n.state === "AVAILABLE"
        ) || pathData?.learningPath?.[0];

      if (activeNode) {
        targetLessonId = activeNode.lessonId;
        const lesson: any = await dbService.getLessonById(activeNode.lessonId);
        targetSkillId = lesson?.skills?.[0]?.skillId || lesson?.skillIds?.[0] || "skl_01";
      } else {
        targetSkillId = "skl_01";
      }
    }

    const resolvedSkillId = targetSkillId || "skl_01";

    // 2. Check for existing active, unexpired recommendation (unless forced)
    if (!forceRefresh) {
      const active = await dbService.getActiveAdaptiveRecommendation(studentId, resolvedSkillId);
      if (active) {
        return this.formatRecommendationDTO(active);
      }
    }

    // 3. Collect comprehensive multimodal student evidence
    const bundle = await EvidenceCollector.collectEvidence({
      studentId,
      skillId: resolvedSkillId,
      lessonId: targetLessonId,
    });

    // 4. Apply deterministic prioritized rules
    const decision = AdaptiveDecisionRules.evaluate(bundle);

    // 5. Build structured recommendation with remediation target & explanation
    const { recommendationPayload } = await RecommendationBuilder.buildRecommendation({
      bundle,
      decision,
      useAI: true,
    });

    // 6. Supersede prior active recommendations for this student & skill
    await dbService.supersedeActiveRecommendations(studentId, targetSkillId);

    // 7. Persist to database
    const saved = await dbService.createAdaptiveRecommendation(recommendationPayload);

    return this.formatRecommendationDTO(saved);
  }

  /**
   * Retrieve active recommendation for student
   */
  static async getActiveRecommendation(
    studentId: string,
    skillId?: string
  ): Promise<AdaptiveRecommendationDTO | null> {
    const active = await dbService.getActiveAdaptiveRecommendation(studentId, skillId);
    if (!active) return null;
    return this.formatRecommendationDTO(active);
  }

  /**
   * Mark recommendation as completed after student finishes the target activity
   */
  static async completeRecommendation(
    recommendationId: string,
    studentId: string
  ): Promise<AdaptiveRecommendationDTO | null> {
    const updated = await dbService.updateAdaptiveRecommendationStatus(
      recommendationId,
      studentId,
      "COMPLETED"
    );
    if (!updated) return null;
    return this.formatRecommendationDTO(updated);
  }

  /**
   * Dismiss an active recommendation
   */
  static async dismissRecommendation(
    recommendationId: string,
    studentId: string
  ): Promise<AdaptiveRecommendationDTO | null> {
    const updated = await dbService.updateAdaptiveRecommendationStatus(
      recommendationId,
      studentId,
      "DISMISSED"
    );
    if (!updated) return null;
    return this.formatRecommendationDTO(updated);
  }

  /**
   * Teacher override with full audit trail
   */
  static async applyTeacherOverride(
    params: TeacherOverrideParams
  ): Promise<AdaptiveRecommendationDTO | null> {
    const {
      recommendationId,
      teacherId,
      overrideDecision,
      reason,
      targetDifficulty,
      recommendedActivityType,
      recommendedActivityId,
    } = params;

    const existing = await dbService.getAdaptiveRecommendationById(recommendationId);
    if (!existing) {
      throw new Error(`Adaptive recommendation with ID ${recommendationId} was not found.`);
    }

    // Record teacher audit override
    await dbService.createAdaptiveOverrideRecord({
      recommendationId,
      teacherId,
      originalDecision: existing.decisionType as AdaptiveDecisionType,
      overrideDecision,
      reason,
    });

    // Update recommendation state to reflect teacher decision
    const updated = await dbService.applyTeacherOverrideToRecommendation(recommendationId, {
      decisionType: overrideDecision,
      reason: `Teacher Override: ${reason}`,
      source: "TEACHER_OVERRIDE",
      targetDifficulty: targetDifficulty || existing.targetDifficulty,
      recommendedActivityType: recommendedActivityType || existing.recommendedActivityType,
      recommendedActivityId: recommendedActivityId || existing.recommendedActivityId,
    });

    if (!updated) return null;
    return this.formatRecommendationDTO(updated);
  }

  /**
   * Helper to format DB record into safe DTO
   */
  private static formatRecommendationDTO(record: any): AdaptiveRecommendationDTO {
    let parsedMetadata: any = {};
    if (record.metadata) {
      try {
        parsedMetadata =
          typeof record.metadata === "string" ? JSON.parse(record.metadata) : record.metadata;
      } catch {
        parsedMetadata = {};
      }
    }

    return {
      id: record.id,
      studentId: record.studentId,
      studentName: record.student?.name || record.studentName || undefined,
      skillId: record.skillId,
      skillTitle: record.skill?.title || record.skillTitle || undefined,
      lessonId: record.lessonId,
      lessonTitle: record.lesson?.title || record.lessonTitle || undefined,
      decisionType: record.decisionType,
      reason: record.reason,
      evidenceSummary: record.evidenceSummary || "",
      confidence: record.confidence,
      recommendedActivityType: record.recommendedActivityType,
      recommendedActivityId: record.recommendedActivityId,
      recommendedActivityTitle: parsedMetadata.activityTitle,
      recommendedPracticeSetId: parsedMetadata.practiceSetId,
      source: record.source,
      status: record.status,
      targetDifficulty: record.targetDifficulty,
      explanation: parsedMetadata.explanation,
      metadata: parsedMetadata,
      createdAt: new Date(record.createdAt).toISOString(),
      updatedAt: new Date(record.updatedAt).toISOString(),
      expiresAt: record.expiresAt ? new Date(record.expiresAt).toISOString() : null,
      overrides: record.overrides?.map((o: any) => ({
        id: o.id,
        teacherId: o.teacherId,
        teacherName: o.teacher?.name || "Teacher",
        originalDecision: o.originalDecision,
        overrideDecision: o.overrideDecision,
        reason: o.reason,
        createdAt: new Date(o.createdAt).toISOString(),
      })),
    };
  }
}
