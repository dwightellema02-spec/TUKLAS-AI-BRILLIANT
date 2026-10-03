/**
 * Phase 9: Prerequisite Checker
 *
 * Traverses the database-stored skill prerequisite DAG to evaluate whether
 * a student's difficulty stems from unmastered prerequisite concepts.
 */

import { dbService } from "../db";
import { ADAPTIVE_CONFIG } from "@/config/adaptive-learning";
import type { SkillEvidence } from "./adaptive-types";

export class PrerequisiteChecker {
  /**
   * Evaluates prerequisite skills for a given target skill and student
   */
  static async evaluatePrerequisites(
    studentId: string,
    skillId: string
  ): Promise<SkillEvidence> {
    // 1. Fetch current skill metadata
    const skill = await dbService.getSkillById(skillId);
    const skillTitle = skill?.title || "Active Skill";

    // 2. Fetch official DAG prerequisites stored in database
    const dbPrerequisites = await dbService.getSkillPrerequisites(skillId);

    // 3. For each prerequisite, inspect the student's historical attempts
    const analyzedPrerequisites = await Promise.all(
      dbPrerequisites.map(async (prereq) => {
        const attempts = await dbService.getDetailedAttemptsForStudent({
          studentId,
          skillId: prereq.prerequisiteSkillId,
          limit: ADAPTIVE_CONFIG.recentAttemptWindow,
        });

        const totalAttempts = attempts.length;
        const correctCount = attempts.filter((a: any) => a.isCorrect).length;
        const accuracy = totalAttempts > 0 ? correctCount / totalAttempts : 0;

        // Weak if attempts exist and accuracy is below threshold, or if 0 attempts recorded
        const isWeak =
          totalAttempts > 0
            ? accuracy < ADAPTIVE_CONFIG.prerequisiteWeaknessThreshold
            : false;

        return {
          prerequisiteSkillId: prereq.prerequisiteSkillId,
          prerequisiteTitle: prereq.prerequisiteSkillTitle || "Foundational Skill",
          accuracy,
          attemptCount: totalAttempts,
          isWeak,
        };
      })
    );

    return {
      skillId,
      skillTitle,
      lessonId: skill?.lessons?.[0]?.lessonId || null,
      lessonTitle: skill?.lessons?.[0]?.lesson?.title || null,
      prerequisites: analyzedPrerequisites,
    };
  }

  /**
   * Find the most critical weak prerequisite that needs student attention
   */
  static identifyWeakestPrerequisite(skillEvidence: SkillEvidence): {
    prerequisiteSkillId: string;
    prerequisiteTitle: string;
    accuracy: number;
  } | null {
    const weakList = skillEvidence.prerequisites.filter((p) => p.isWeak);
    if (weakList.length === 0) return null;

    // Sort by lowest accuracy
    weakList.sort((a, b) => a.accuracy - b.accuracy);
    return {
      prerequisiteSkillId: weakList[0].prerequisiteSkillId,
      prerequisiteTitle: weakList[0].prerequisiteTitle,
      accuracy: weakList[0].accuracy,
    };
  }
}
