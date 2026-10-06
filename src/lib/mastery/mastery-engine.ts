/**
 * Tuklas AI - Mastery Engine Orchestrator
 * Phase 10: Multi-dimensional, Evidence-Based Mastery Lifecycle & Snapshot Management
 */

import { prisma, hasValidDatabaseUrl, fallbackStore, dbService } from "@/lib/db";
import { MASTERY_CONFIG } from "@/config/mastery-learning";
import { MasteryEvidenceCollector } from "./mastery-evidence";
import { MasteryRules } from "./mastery-rules";
import { MasteryExplanationBuilder } from "./mastery-explanation";
import type {
  SkillMasteryDTO,
  SkillMasteryHistoryDTO,
  MasteryLevel,
  MasteryEvaluationResult,
} from "./mastery-types";

export class MasteryEngine {
  /**
   * Evaluate a student's mastery of a skill using multi-source evidence
   */
  static async evaluateSkillMastery(params: {
    studentId: string;
    skillId: string;
    forceRecalculate?: boolean;
    useAIExplanation?: boolean;
  }): Promise<SkillMasteryDTO> {
    const { studentId, skillId, forceRecalculate = false, useAIExplanation = false } = params;

    // 1. Check existing snapshot if fresh and not forced
    if (!forceRecalculate) {
      const existing = await this.getExistingSnapshot(studentId, skillId);
      if (existing) {
        const ageMinutes = (Date.now() - new Date(existing.lastEvaluatedAt).getTime()) / (1000 * 60);
        if (ageMinutes < MASTERY_CONFIG.snapshotCacheMinutes) {
          return existing;
        }
      }
    }

    // 2. Collect multi-dimensional evidence
    const evidence = await MasteryEvidenceCollector.collectEvidence(studentId, skillId);

    // 3. Apply deterministic decision rules
    const outcome = MasteryRules.evaluate(evidence);

    // 4. Generate student-friendly explanation
    let explanation = MasteryExplanationBuilder.generateDeterministicExplanation({
      level: outcome.level,
      skillTitle: evidence.skillTitle,
      evidence,
      flags: outcome.flags,
    });

    if (useAIExplanation) {
      explanation = await MasteryExplanationBuilder.enrichWithAI({
        level: outcome.level,
        skillTitle: evidence.skillTitle,
        evidence,
        flags: outcome.flags,
      });
    }

    // 5. Check if previous snapshot existed to detect state transitions
    const previousSnapshot = await this.getExistingSnapshot(studentId, skillId);
    const previousStatus = previousSnapshot?.status || null;
    const isStatusChanged = previousStatus !== null && previousStatus !== outcome.level;

    // 6. Assemble metadata payload
    const metadataPayload = {
      ruleCode: outcome.ruleCode,
      ruleDescription: outcome.ruleDescription,
      flags: outcome.flags,
      difficulty: evidence.difficultyBreakdown,
      questionTypes: evidence.questionTypeBreakdown,
      explanation,
    };

    // 7. Save or update SkillMastery record
    const savedRecord = await this.saveSkillMasteryRecord({
      studentId,
      skillId,
      status: outcome.level,
      evidenceSummary: outcome.evidenceSummary,
      accuracy: evidence.overallAccuracy,
      recentAccuracy: evidence.recentAccuracy,
      consistencyScore: evidence.consistencyScore,
      applicationScore: evidence.applicationScore,
      attemptCount: evidence.totalAttempts,
      masteryVersion: MASTERY_CONFIG.masteryVersion,
      metadata: JSON.stringify(metadataPayload),
    });

    // 8. If status changed or first initialization, record history audit entry
    if (isStatusChanged) {
      await this.recordHistoryEntry({
        skillMasteryId: savedRecord.id,
        previousStatus,
        newStatus: outcome.level,
        reason: outcome.ruleDescription,
        evidenceSummary: outcome.evidenceSummary,
        masteryVersion: MASTERY_CONFIG.masteryVersion,
        metadata: JSON.stringify(metadataPayload),
      });
    }

    return this.formatMasteryDTO(savedRecord, evidence.skillTitle, evidence.lessonId, evidence.lessonTitle);
  }

  /**
   * Get student's mastery across all skills in curriculum
   */
  static async getStudentMasteries(studentId: string): Promise<SkillMasteryDTO[]> {
    if (hasValidDatabaseUrl) {
      try {
        const records = await prisma.skillMastery.findMany({
          where: { studentId },
          include: {
            skill: { select: { id: true, title: true } },
            history: { orderBy: { createdAt: "desc" }, take: 5 },
          },
          orderBy: { updatedAt: "desc" },
        });

        if (records.length > 0) {
          return records.map((r) => this.formatMasteryDTO(r, r.skill.title));
        }
      } catch (e) {
        if (hasValidDatabaseUrl) throw e; // database mode never falls back to demo data
        console.warn("Prisma error in getStudentMasteries:", e);
      }
    }

    // Fallback store
    const studentMasteries = (fallbackStore.skillMasteries || []).filter(
      (m) => m.studentId === studentId
    );

    return studentMasteries.map((m) => {
      const skill = fallbackStore.curriculum.skills.find((s) => s.id === m.skillId);
      const history = (fallbackStore.skillMasteryHistory || [])
        .filter((h) => h.skillMasteryId === m.id)
        .map((h) => ({
          id: h.id,
          skillMasteryId: h.skillMasteryId,
          previousStatus: h.previousStatus,
          newStatus: h.newStatus,
          reason: h.reason,
          evidenceSummary: h.evidenceSummary,
          masteryVersion: h.masteryVersion,
          createdAt: new Date(h.createdAt).toISOString(),
        }));

      return {
        ...this.formatMasteryDTO(m, skill?.title || "Skill"),
        history,
      };
    });
  }

  /**
   * Get single mastery record for student + skill
   */
  static async getSkillMastery(studentId: string, skillId: string): Promise<SkillMasteryDTO | null> {
    return this.getExistingSnapshot(studentId, skillId);
  }

  /**
   * Retrieve existing snapshot from DB or fallbackStore
   */
  private static async getExistingSnapshot(
    studentId: string,
    skillId: string
  ): Promise<SkillMasteryDTO | null> {
    if (hasValidDatabaseUrl) {
      try {
        const rec = await prisma.skillMastery.findUnique({
          where: { studentId_skillId: { studentId, skillId } },
          include: {
            skill: { select: { id: true, title: true } },
            history: { orderBy: { createdAt: "desc" }, take: 10 },
          },
        });
        if (rec) {
          return this.formatMasteryDTO(rec, rec.skill.title);
        }
      } catch (e) {
        if (hasValidDatabaseUrl) throw e; // database mode never falls back to demo data
        console.warn("Prisma error in getExistingSnapshot:", e);
      }
    }

    const rec = (fallbackStore.skillMasteries || []).find(
      (m) => m.studentId === studentId && m.skillId === skillId
    );
    if (!rec) return null;

    const skill = fallbackStore.curriculum.skills.find((s) => s.id === skillId);
    const history = (fallbackStore.skillMasteryHistory || [])
      .filter((h) => h.skillMasteryId === rec.id)
      .map((h) => ({
        id: h.id,
        skillMasteryId: h.skillMasteryId,
        previousStatus: h.previousStatus,
        newStatus: h.newStatus,
        reason: h.reason,
        evidenceSummary: h.evidenceSummary,
        masteryVersion: h.masteryVersion,
        createdAt: new Date(h.createdAt).toISOString(),
      }));

    return {
      ...this.formatMasteryDTO(rec, skill?.title || "Skill"),
      history,
    };
  }

  /**
   * Save or update SkillMastery row
   */
  private static async saveSkillMasteryRecord(data: {
    studentId: string;
    skillId: string;
    status: MasteryLevel;
    evidenceSummary: string;
    accuracy: number;
    recentAccuracy: number;
    consistencyScore: number;
    applicationScore: number;
    attemptCount: number;
    masteryVersion: string;
    metadata: string;
  }) {
    if (hasValidDatabaseUrl) {
      try {
        const saved = await prisma.skillMastery.upsert({
          where: {
            studentId_skillId: { studentId: data.studentId, skillId: data.skillId },
          },
          create: {
            studentId: data.studentId,
            skillId: data.skillId,
            status: data.status,
            evidenceSummary: data.evidenceSummary,
            accuracy: data.accuracy,
            recentAccuracy: data.recentAccuracy,
            consistencyScore: data.consistencyScore,
            applicationScore: data.applicationScore,
            attemptCount: data.attemptCount,
            masteryVersion: data.masteryVersion,
            metadata: data.metadata,
            lastEvaluatedAt: new Date(),
          },
          update: {
            status: data.status,
            evidenceSummary: data.evidenceSummary,
            accuracy: data.accuracy,
            recentAccuracy: data.recentAccuracy,
            consistencyScore: data.consistencyScore,
            applicationScore: data.applicationScore,
            attemptCount: data.attemptCount,
            masteryVersion: data.masteryVersion,
            metadata: data.metadata,
            lastEvaluatedAt: new Date(),
          },
        });
        return saved;
      } catch (e) {
        if (hasValidDatabaseUrl) throw e; // database mode never falls back to demo data
        console.warn("Prisma error in saveSkillMasteryRecord:", e);
      }
    }

    if (!fallbackStore.skillMasteries) {
      fallbackStore.skillMasteries = [];
    }

    const existingIdx = fallbackStore.skillMasteries.findIndex(
      (m) => m.studentId === data.studentId && m.skillId === data.skillId
    );

    const record = {
      id: existingIdx >= 0 ? fallbackStore.skillMasteries[existingIdx].id : `mstr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      ...data,
      lastEvaluatedAt: new Date(),
      createdAt: existingIdx >= 0 ? fallbackStore.skillMasteries[existingIdx].createdAt : new Date(),
      updatedAt: new Date(),
    };

    if (existingIdx >= 0) {
      fallbackStore.skillMasteries[existingIdx] = record;
    } else {
      fallbackStore.skillMasteries.push(record);
    }

    return record;
  }

  /**
   * Record historical transition
   */
  private static async recordHistoryEntry(data: {
    skillMasteryId: string;
    previousStatus: MasteryLevel | null;
    newStatus: MasteryLevel;
    reason: string;
    evidenceSummary: string;
    masteryVersion: string;
    metadata: string;
  }) {
    if (hasValidDatabaseUrl) {
      try {
        await prisma.skillMasteryHistory.create({
          data: {
            skillMasteryId: data.skillMasteryId,
            previousStatus: data.previousStatus,
            newStatus: data.newStatus,
            reason: data.reason,
            evidenceSummary: data.evidenceSummary,
            masteryVersion: data.masteryVersion,
            metadata: data.metadata,
          },
        });
        return;
      } catch (e) {
        if (hasValidDatabaseUrl) throw e; // database mode never falls back to demo data
        console.warn("Prisma error in recordHistoryEntry:", e);
      }
    }

    if (!fallbackStore.skillMasteryHistory) {
      fallbackStore.skillMasteryHistory = [];
    }

    fallbackStore.skillMasteryHistory.push({
      id: `mstr_hist_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      ...data,
      createdAt: new Date(),
    });
  }

  /**
   * Format DB or Store record into SkillMasteryDTO
   */
  private static formatMasteryDTO(
    record: any,
    skillTitle?: string,
    lessonId?: string,
    lessonTitle?: string
  ): SkillMasteryDTO {
    let parsedMeta: any = {};
    if (typeof record.metadata === "string") {
      try {
        parsedMeta = JSON.parse(record.metadata);
      } catch {
        parsedMeta = {};
      }
    } else if (typeof record.metadata === "object" && record.metadata !== null) {
      parsedMeta = record.metadata;
    }

    const explanation = parsedMeta.explanation || {
      level: record.status as MasteryLevel,
      summary: `Current mastery level: ${record.status}`,
      why: record.evidenceSummary || "Evaluated based on completed practice attempts.",
      nextStep: "Continue targeted practice to reinforce this skill.",
      encouragement: "Keep working steadily toward mathematical understanding!",
    };

    const historyDTO: SkillMasteryHistoryDTO[] = (record.history || []).map((h: any) => ({
      id: h.id,
      skillMasteryId: h.skillMasteryId,
      previousStatus: h.previousStatus,
      newStatus: h.newStatus,
      reason: h.reason,
      evidenceSummary: h.evidenceSummary,
      masteryVersion: h.masteryVersion,
      createdAt: new Date(h.createdAt).toISOString(),
    }));

    return {
      id: record.id,
      studentId: record.studentId,
      studentName: record.student?.name,
      skillId: record.skillId,
      skillTitle: skillTitle || record.skill?.title || "Skill",
      lessonId: lessonId || record.lessonId,
      lessonTitle: lessonTitle || record.lessonTitle,
      status: record.status as MasteryLevel,
      evidenceSummary: record.evidenceSummary || "",
      accuracy: record.accuracy || 0.0,
      recentAccuracy: record.recentAccuracy || 0.0,
      consistencyScore: record.consistencyScore || 0.0,
      applicationScore: record.applicationScore || 0.0,
      attemptCount: record.attemptCount || 0,
      masteryVersion: record.masteryVersion || MASTERY_CONFIG.masteryVersion,
      lastEvaluatedAt: new Date(record.lastEvaluatedAt || record.updatedAt || Date.now()).toISOString(),
      explanation,
      metadata: {
        ruleCode: parsedMeta.ruleCode,
        ruleDescription: parsedMeta.ruleDescription,
        flags: parsedMeta.flags,
        difficulty: parsedMeta.difficulty,
        questionTypes: parsedMeta.questionTypes,
      },
      history: historyDTO,
    };
  }
}
