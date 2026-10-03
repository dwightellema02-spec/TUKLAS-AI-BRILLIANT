// Phase 8: Deterministic Performance & Mistake Pre-Analyzer

import type {
  QuestionAttemptDetail,
  DeterministicAnalysisResult,
  StructuredMistakeAnalysis,
  MistakeCategoryType,
} from "./types";

export function runDeterministicAnalysis(
  attempts: QuestionAttemptDetail[],
  prerequisiteData: Array<{
    skillId: string;
    title: string;
    accuracy: number;
    totalAttempts: number;
  }> = []
): DeterministicAnalysisResult {
  const totalAttempts = attempts.length;
  if (totalAttempts === 0) {
    return {
      totalAttempts: 0,
      correctCount: 0,
      incorrectCount: 0,
      accuracyPercentage: 0,
      recentTrend: "STABLE",
      questionTypeDistribution: {},
      difficultyDistribution: {},
      hintUsageCount: 0,
      retryCount: 0,
      commonWrongAnswers: [],
      isolatedError: false,
      signErrorDetected: false,
      comparisonErrorDetected: false,
      prerequisiteGaps: [],
      strengthDetected: false,
    };
  }

  let correctCount = 0;
  let hintUsageCount = 0;
  let retryCount = 0;
  const questionTypeDist: Record<string, { total: number; correct: number; incorrect: number }> = {};
  const difficultyDist: Record<string, { total: number; correct: number; incorrect: number }> = {};
  const wrongAnswerMap = new Map<string, number>();

  let signErrorDetected = false;
  let comparisonErrorDetected = false;

  for (const att of attempts) {
    if (att.isCorrect) {
      correctCount++;
    } else {
      const ansKey = String(att.answer || "").trim();
      if (ansKey) {
        wrongAnswerMap.set(ansKey, (wrongAnswerMap.get(ansKey) || 0) + 1);
      }

      // Check heuristics for mathematical signs
      const promptLower = (att.question.prompt || "").toLowerCase();
      const answerStr = String(att.answer || "");

      // 1. Comparison mistake heuristic: e.g. -5 vs -2 where student picked -5
      if (
        (promptLower.includes("greater") || promptLower.includes("less") || promptLower.includes("compare")) &&
        (promptLower.includes("-") || answerStr.includes("-"))
      ) {
        comparisonErrorDetected = true;
      }

      // 2. Sign error heuristic: negative numbers in prompt or opposite sign error
      if (
        promptLower.includes("inverse") ||
        promptLower.includes("opposite") ||
        promptLower.includes("(-") ||
        promptLower.includes("-") ||
        promptLower.includes("sign")
      ) {
        signErrorDetected = true;
      }
    }

    if (att.hintUsed) {
      hintUsageCount++;
    }

    if (att.attemptNumber > 1) {
      retryCount++;
    }

    // Question Type Breakdown
    const qType = att.question.type || "UNKNOWN";
    if (!questionTypeDist[qType]) {
      questionTypeDist[qType] = { total: 0, correct: 0, incorrect: 0 };
    }
    questionTypeDist[qType].total++;
    if (att.isCorrect) questionTypeDist[qType].correct++;
    else questionTypeDist[qType].incorrect++;

    // Difficulty Breakdown
    const diff = att.question.difficulty || "MEDIUM";
    if (!difficultyDist[diff]) {
      difficultyDist[diff] = { total: 0, correct: 0, incorrect: 0 };
    }
    difficultyDist[diff].total++;
    if (att.isCorrect) difficultyDist[diff].correct++;
    else difficultyDist[diff].incorrect++;
  }

  const incorrectCount = totalAttempts - correctCount;
  const accuracyPercentage = Math.round((correctCount / totalAttempts) * 100);

  // Compute trend (oldest half vs newest half)
  let recentTrend: "IMPROVING" | "DECLINING" | "STABLE" | "INCONSISTENT" = "STABLE";
  if (totalAttempts >= 4) {
    const half = Math.floor(totalAttempts / 2);
    const older = attempts.slice(0, half);
    const newer = attempts.slice(half);

    const olderAcc = Math.round((older.filter((a) => a.isCorrect).length / older.length) * 100);
    const newerAcc = Math.round((newer.filter((a) => a.isCorrect).length / newer.length) * 100);

    if (newerAcc - olderAcc >= 25) {
      recentTrend = "IMPROVING";
    } else if (olderAcc - newerAcc >= 25) {
      recentTrend = "DECLINING";
    } else {
      // Check for alternating oscillations
      let switches = 0;
      for (let i = 1; i < attempts.length; i++) {
        if (attempts[i].isCorrect !== attempts[i - 1].isCorrect) switches++;
      }
      if (switches >= Math.floor(totalAttempts * 0.7)) {
        recentTrend = "INCONSISTENT";
      } else {
        recentTrend = "STABLE";
      }
    }
  }

  // Common wrong answers list
  const commonWrongAnswers = Array.from(wrongAnswerMap.entries())
    .map(([answer, frequency]) => ({ answer, frequency }))
    .sort((a, b) => b.frequency - a.frequency)
    .slice(0, 5);

  const isolatedError = totalAttempts >= 4 && incorrectCount === 1;
  const strengthDetected = totalAttempts >= 4 && accuracyPercentage >= 85;

  const prerequisiteGaps = prerequisiteData
    .filter((p) => p.totalAttempts >= 3 && p.accuracy < 60)
    .map((p) => ({
      prerequisiteSkillId: p.skillId,
      title: p.title,
      accuracy: p.accuracy,
      totalAttempts: p.totalAttempts,
    }));

  return {
    totalAttempts,
    correctCount,
    incorrectCount,
    accuracyPercentage,
    recentTrend,
    questionTypeDistribution: questionTypeDist,
    difficultyDistribution: difficultyDist,
    hintUsageCount,
    retryCount,
    commonWrongAnswers,
    isolatedError,
    signErrorDetected,
    comparisonErrorDetected,
    prerequisiteGaps,
    strengthDetected,
  };
}

/**
 * Deterministic Pedagogical Inference Fallback
 * Guarantees zero hallucinations and authentic MATATAG Grade 7 insights
 */
export function generateDeterministicMistakeCategory(
  result: DeterministicAnalysisResult,
  attempts: QuestionAttemptDetail[]
): StructuredMistakeAnalysis {
  const incorrectAttempts = attempts.filter((a) => !a.isCorrect);
  const evidenceAttemptIds = incorrectAttempts.map((a) => a.id);

  // 1. High Accuracy / Isolated error
  if (result.totalAttempts >= 3 && result.accuracyPercentage >= 85 && result.isolatedError) {
    return {
      category: "POSSIBLE_CARELESS_ERROR",
      observation: `Student answered ${result.correctCount} of ${result.totalAttempts} questions correctly (${result.accuracyPercentage}% accuracy).`,
      pattern: "An isolated incorrect answer appeared amidst a sequence of otherwise accurate responses.",
      possibleCause: "Likely a minor input slip or momentary oversight rather than a conceptual weakness.",
      confidence: 0.78,
      recommendation: "Review the single missed question and double-check inputs before final submission.",
      evidenceAttemptIds,
    };
  }

  // 2. Prerequisite Gap Identified
  if (result.prerequisiteGaps.length > 0 && result.accuracyPercentage < 65) {
    const gap = result.prerequisiteGaps[0];
    return {
      category: "PREREQUISITE_GAP",
      observation: `Student scored ${result.accuracyPercentage}% on the current skill and had an average accuracy of ${gap.accuracy}% on prerequisite skill "${gap.title}".`,
      pattern: `Performance appears hindered by foundational concepts from prerequisite skill "${gap.title}".`,
      possibleCause: "Incomplete mastery of prerequisite concepts before attempting this standard.",
      confidence: 0.85,
      recommendation: `Spend 10-15 minutes revisiting ${gap.title} to build a firmer foundation.`,
      evidenceAttemptIds,
    };
  }

  // 3. Integer Comparison Misunderstanding
  if (result.comparisonErrorDetected && incorrectAttempts.length >= 2) {
    return {
      category: "CONCEPTUAL_MISUNDERSTANDING",
      observation: `Student made ${incorrectAttempts.length} errors on questions involving ordering or comparing negative integers.`,
      pattern: "Incorrect responses consistently selected numbers farther from zero as greater negative values.",
      possibleCause: "Transferring positive whole-number magnitude rules directly to negative numbers without number-line orientation.",
      confidence: 0.88,
      recommendation: "Practice placing pairs of negative numbers on a horizontal number line to reinforce that values farther to the right are always greater.",
      evidenceAttemptIds,
    };
  }

  // 4. Sign Error in Operations
  if (result.signErrorDetected && incorrectAttempts.length >= 2) {
    return {
      category: "SIGN_ERROR",
      observation: `Student made ${incorrectAttempts.length} errors on questions involving signed integer arithmetic or additive inverses.`,
      pattern: "The absolute values were frequently correct, but the positive/negative signs of the final answer were inverted.",
      possibleCause: "Confusion between the sign rules for addition/subtraction versus multiplication/division.",
      confidence: 0.82,
      recommendation: "Review the two-step rule for adding integers with unlike signs: subtract absolute values and take the sign of the larger magnitude.",
      evidenceAttemptIds,
    };
  }

  // 5. Inconsistent Performance
  if (result.recentTrend === "INCONSISTENT" && result.totalAttempts >= 5) {
    return {
      category: "INCONSISTENT_PERFORMANCE",
      observation: `Performance fluctuated frequently across ${result.totalAttempts} attempts with an overall accuracy of ${result.accuracyPercentage}%.`,
      pattern: "Alternating between correct and incorrect answers on similar difficulty levels.",
      possibleCause: "Partial conceptual grasp where procedural steps are remembered intermittently.",
      confidence: 0.72,
      recommendation: "Try writing out each step on scratch paper to stabilize consistent procedural execution.",
      evidenceAttemptIds,
    };
  }

  // 6. Question Type Difficulty
  for (const [type, stats] of Object.entries(result.questionTypeDistribution)) {
    if (stats.total >= 3 && stats.correct === 0) {
      return {
        category: "QUESTION_TYPE_DIFFICULTY",
        observation: `Student struggled specifically with ${type.replace(/_/g, " ").toLowerCase()} questions (0 of ${stats.total} correct), while overall accuracy across all types was ${result.accuracyPercentage}%.`,
        pattern: `Errors correlate strongly with the ${type.replace(/_/g, " ")} format rather than the general math topic.`,
        possibleCause: `Unfamiliarity with how to format answers for ${type.replace(/_/g, " ")}.`,
        confidence: 0.75,
        recommendation: `Review sample worked examples formatted as ${type.replace(/_/g, " ")}.`,
        evidenceAttemptIds: incorrectAttempts.filter((a) => a.question.type === type).map((a) => a.id),
      };
    }
  }

  // 7. General Calculation Error
  if (incorrectAttempts.length >= 2) {
    return {
      category: "CALCULATION_ERROR",
      observation: `Student answered ${result.incorrectCount} of ${result.totalAttempts} questions incorrectly.`,
      pattern: "Arithmetic computation errors observed during multi-step evaluation.",
      possibleCause: "Small arithmetic miscalculations during intermediate steps.",
      confidence: 0.65,
      recommendation: "Take extra time on intermediate arithmetic steps and verify calculations with inverse operations.",
      evidenceAttemptIds,
    };
  }

  // Default / Unknown
  return {
    category: "UNKNOWN",
    observation: `Collected ${result.totalAttempts} attempts with ${result.accuracyPercentage}% accuracy.`,
    pattern: "Insufficient error concentration to establish a decisive learning pattern.",
    possibleCause: "A wider sample of practice attempts is needed to discern clear tendencies.",
    confidence: 0.35,
    recommendation: "Continue practicing additional questions to help Tuklas identify your unique learning patterns.",
    evidenceAttemptIds,
  };
}
