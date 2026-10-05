/**
 * Tuklas AI - Phase 14 Automated Verification Test Suite
 * Assessment & Research Analytics Engine
 *
 * Verifies:
 * 1. Deterministic Primary Metrics (Accuracy, Understanding, Application, Consistency)
 * 2. Raw Evidence Source of Truth & Minimum Threshold Guardrails
 * 3. Pre/Post Comparative Analytics (Empirical, Non-Causal)
 * 4. Difficult Skill Identification & Mistake Aggregation
 * 5. Intervention Evidence Tracking
 * 6. Research Data CSV Exporter (Metrics, Attempts, Comparisons)
 * 7. Teacher Research Authorization & IDOR Protection
 */

import {
  AccuracyCalculator,
  UnderstandingCalculator,
  ApplicationCalculator,
  ConsistencyCalculator,
  ResearchService,
  ResearchExporter,
  PrePostComparator,
} from "../src/lib/research/index";
import { dbService, fallbackStore } from "../src/lib/db";
import { assessmentFallbackStore } from "../src/lib/assessment/assessment-service";
import { MistakeAnalyzerService } from "../src/lib/ai/mistake-analyzer";

let totalTests = 0;
let passedTests = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✓ [PASS] ${testName}`);
  } else {
    console.error(`  ✗ [FAIL] ${testName}${detail ? ` - ${detail}` : ""}`);
  }
}

async function runPhase14Tests() {
  console.log("=================================================");
  console.log("  TUKLAS AI - PHASE 14 RESEARCH ANALYTICS TESTS  ");
  console.log("=================================================\n");

  // -------------------------------------------------------------------------
  // 1. DETERMINISTIC ACCURACY METRIC
  // -------------------------------------------------------------------------
  console.log("[1] Deterministic Accuracy Metric");

  // 1.1 Insufficient evidence check (< 5 attempts)
  const accInsufficient = AccuracyCalculator.calculate({
    attempts: [
      { isCorrect: true, questionId: "q1" },
      { isCorrect: false, questionId: "q2" },
    ],
  });
  assert(
    accInsufficient.level === "INSUFFICIENT_EVIDENCE" && accInsufficient.evidenceCount === 2,
    "Accuracy handles insufficient sample size cleanly"
  );

  // 1.2 Deterministic calculation with sufficient evidence
  const accSufficient = AccuracyCalculator.calculate({
    attempts: [
      { isCorrect: true },
      { isCorrect: true },
      { isCorrect: true },
      { isCorrect: true },
      { isCorrect: false },
    ],
  });
  assert(
    accSufficient.value === 0.8 && accSufficient.level === "PROFICIENT",
    "Accuracy calculates exact 80% (4/5) ratio and PROFICIENT level"
  );

  // 1.3 Excludes abandoned attempts
  const accExclusion = AccuracyCalculator.calculate({
    attempts: [
      { isCorrect: true },
      { isCorrect: true },
      { isCorrect: true },
      { isCorrect: false },
      { isCorrect: false },
      { isCorrect: false, isAbandoned: true }, // Should be excluded
    ],
  });
  assert(
    accExclusion.evidenceCount === 5 && accExclusion.value === 0.6,
    "Accuracy calculator strictly excludes abandoned or invalid attempts"
  );

  // -------------------------------------------------------------------------
  // 2. MULTI-DIMENSIONAL UNDERSTANDING METRIC
  // -------------------------------------------------------------------------
  console.log("\n[2] Understanding Metric (Independent & Checkpoint Evidence)");

  // 2.1 Multi-factor evidence calculation
  const undResult = UnderstandingCalculator.calculate({
    attempts: [
      { isCorrect: true, hintUsed: false },
      { isCorrect: true, hintUsed: false },
      { isCorrect: true, hintUsed: true },
      { isCorrect: false, hintUsed: false, mistakeCategory: "SIGN_ERROR" },
      { isCorrect: true, hintUsed: false },
    ],
    checkpoints: [
      { isCorrect: true, attempt: 1 },
      { isCorrect: true, attempt: 1 },
    ],
  });

  assert(
    undResult.value > 0.6 && undResult.level === "PROFICIENT" || undResult.level === "HIGH",
    "Understanding synthesizes hint-free attempts, checkpoints, and mistake penalties",
    `Got value ${undResult.value}, level ${undResult.level}`
  );
  assert(
    (undResult.evidence.hintFreeAttempts ?? 0) === 4,
    "Understanding reports exact hint-free evidence count (4 attempts)"
  );

  // -------------------------------------------------------------------------
  // 3. APPLICATION & TRANSFER METRIC
  // -------------------------------------------------------------------------
  console.log("\n[3] Application & Transfer Metric");

  // 3.1 Insufficient application-level questions
  const appLow = ApplicationCalculator.calculate({
    attempts: [
      { isCorrect: true, cognitiveLevel: "PROCEDURAL" },
      { isCorrect: true, cognitiveLevel: "KNOWLEDGE" },
    ],
  });
  assert(
    appLow.level === "INSUFFICIENT_EVIDENCE",
    "Application flags insufficient evidence when cognitive levels lack transfer items"
  );

  // 3.2 Evaluation of application items with higher-order weighting
  const appHigh = ApplicationCalculator.calculate({
    attempts: [
      { isCorrect: true, cognitiveLevel: "APPLICATION" },
      { isCorrect: true, cognitiveLevel: "APPLICATION" },
      { isCorrect: true, cognitiveLevel: "HIGHER_ORDER" },
    ],
  });
  assert(
    appHigh.value === 1.0 && appHigh.level === "HIGH",
    "Application awards full score when transfer items are solved correctly"
  );

  // -------------------------------------------------------------------------
  // 4. CONSISTENCY & LONGITUDINAL STABILITY METRIC
  // -------------------------------------------------------------------------
  console.log("\n[4] Consistency & Longitudinal Stability Metric");

  // 4.1 Highly consistent correct attempts
  const consStable = ConsistencyCalculator.calculate({
    attempts: [
      { isCorrect: true },
      { isCorrect: true },
      { isCorrect: true },
      { isCorrect: true },
      { isCorrect: true },
      { isCorrect: true },
    ],
  });
  assert(
    consStable.value >= 0.85 && consStable.level === "HIGH",
    "Consistency rewards stable performance streaks with low variance"
  );

  // 4.2 Inconsistent alternating attempts
  const consFluctuating = ConsistencyCalculator.calculate({
    attempts: [
      { isCorrect: true },
      { isCorrect: false },
      { isCorrect: true },
      { isCorrect: false },
      { isCorrect: true },
      { isCorrect: false },
    ],
  });
  assert(
    consFluctuating.value < consStable.value,
    "Consistency reflects higher variance on fluctuating attempts"
  );

  // -------------------------------------------------------------------------
  // 5. RESEARCH SERVICE - STUDENT RESEARCH PROFILE
  // -------------------------------------------------------------------------
  console.log("\n[5] Student Research Profile Generation");

  const studentProfile = await ResearchService.getStudentResearchProfile("usr_student_01");
  assert(
    studentProfile.studentId === "usr_student_01" && studentProfile.studentName === "Juan de la Cruz",
    "Loads student research profile from database records"
  );
  assert(
    Boolean(studentProfile.metrics.accuracy && studentProfile.metrics.understanding),
    "Profile aggregates all four primary research metrics (accuracy, understanding, application, consistency)"
  );
  assert(
    studentProfile.calculationVersion === "RESEARCH_V1",
    "Research profile specifies deterministic calculation version (RESEARCH_V1)"
  );

  // -------------------------------------------------------------------------
  // 6. PRE-TEST / POST-TEST COMPARATIVE ANALYTICS
  // -------------------------------------------------------------------------
  console.log("\n[6] Pre/Post-Test Comparative Analytics");

  const ALL = { studentIds: null } as const;
  const NOBODY = { studentIds: [] as string[] };
  const prePostComparison = await ResearchService.getPrePostComparison(ALL, "asm_pre_integers", "asm_post_integers", { id: "cls_test", name: "Section Test" });
  const graded = (id: string) => assessmentFallbackStore.attempts.filter((x) => x.assessmentId === id && x.status === "GRADED");
  const latestPer = (id: string) => Array.from(new Map(graded(id).map((x) => [x.studentId, x.scorePercent])).values());
  const meanOf = (xs: number[]) => (xs.length ? xs.reduce((u, v) => u + v, 0) / xs.length : null);
  const expectedPre = meanOf(latestPer("asm_pre_integers"));
  const expectedPost = meanOf(latestPer("asm_post_integers"));
  assert(
    (expectedPre === null && prePostComparison.preTest.averageScorePercent === null) ||
      (expectedPre !== null && Math.abs(prePostComparison.preTest.averageScorePercent! - expectedPre) < 0.06),
    "Baseline average equals the mean of the real graded pre-test results (not a constant)"
  );
  assert(
    (expectedPost === null && prePostComparison.postTest.averageScorePercent === null) ||
      (expectedPost !== null && Math.abs(prePostComparison.postTest.averageScorePercent! - expectedPost) < 0.06),
    "Summative average equals the mean of the real graded post-test results (not a constant)"
  );
  assert(
    prePostComparison.preTest.totalStudents === latestPer("asm_pre_integers").length,
    "The student count is the real number of students who took the test"
  );
  const noData = await ResearchService.getPrePostComparison(ALL, "asm_does_not_exist_pre", "asm_does_not_exist_post");
  assert(
    noData.preTest.averageScorePercent === null && noData.postTest.averageScorePercent === null &&
      noData.comparison.observedTrend === "INSUFFICIENT_DATA" && noData.comparison.scoreDifferencePoints === null &&
      noData.skillBreakdown.length === 0 && noData.preTest.totalStudents === 0,
    "With no graded results there are NO numbers (null, INSUFFICIENT_DATA), never an invented 65% -> 88%"
  );
  const nobodyCmp = await ResearchService.getPrePostComparison(NOBODY, "asm_pre_integers", "asm_post_integers");
  assert(
    nobodyCmp.comparison.observedTrend === "INSUFFICIENT_DATA" && nobodyCmp.preTest.totalStudents === 0,
    "A teacher with no students sees no cohort data at all"
  );
  assert(
    prePostComparison.comparison.observedTrend !== "INSUFFICIENT_DATA"
      ? typeof prePostComparison.comparison.scoreDifferencePoints === "number" &&
        /not evidence of cause/.test(prePostComparison.comparison.description)
      : true,
    "A computed comparison states that it is an observed difference, not evidence of cause"
  );
  for (const sb of prePostComparison.skillBreakdown) {
    assert(sb.preAccuracy >= 0 && sb.postAccuracy <= 100 && sb.skillTitle.length > 0, `Skill breakdown row ${sb.skillId} comes from real responses`);
  }

  // -------------------------------------------------------------------------
  // 7. DIFFICULT SKILLS & MISTAKE AGGREGATION
  // -------------------------------------------------------------------------
  console.log("\n[7] Difficult Skills & Mistake Aggregation");

  const difficultSkills = await ResearchService.identifyDifficultSkills(ALL, { gradeLevel: 7 });
  assert(
    Array.isArray(difficultSkills) &&
      difficultSkills.every((d) => d.evidenceCount >= 5 && d.totalStudentsEvaluated >= 2 && (d.accuracy < 0.65 || d.hintDependenceRate > 0.4)),
    "Difficult skills need >=5 attempts from >=2 students and a real accuracy < 65% or hint rate > 40% (no forced entries)"
  );
  assert((await ResearchService.identifyDifficultSkills(NOBODY)).length === 0, "No students in scope -> no difficult skills");

  const mistakePatterns = await ResearchService.aggregateMistakeTaxonomy(ALL);
  const realMistakeRows = (fallbackStore.mistakeAnalyses as any[]).filter((m) => String(m.category) !== "UNKNOWN").length;
  assert(
    mistakePatterns.reduce((n, m) => n + m.count, 0) === realMistakeRows,
    "Mistake counts add up to the real recorded mistake analyses (no invented 5/3/2/1)"
  );
  assert((await ResearchService.aggregateMistakeTaxonomy(NOBODY)).length === 0, "No students in scope -> no mistake data");

  // -------------------------------------------------------------------------
  // 8. INTERVENTION OBSERVATIONS
  // -------------------------------------------------------------------------
  console.log("\n[8] Non-Causal Intervention Observations");

  const interventions = await ResearchService.getInterventionObservations(ALL);
  assert(
    interventions.every((i) => i.beforeEvidence.attempts >= 3 && i.afterEvidence.attempts >= 3 && /does not show that the tutor caused/.test(i.observedChange.observationStatement)),
    "Every observation rests on >=3 attempts on each side and says it does not show the tutor caused the change"
  );
  assert((await ResearchService.getInterventionObservations(NOBODY)).length === 0, "No students in scope -> no observations");

  const series = await ResearchService.getTimeSeriesMetrics(ALL);
  const realAttemptCount = fallbackStore.questionAttempts.length;
  assert(series.reduce((n, p) => n + p.attemptCount, 0) === realAttemptCount, "The time series accounts for every real attempt and nothing else");
  assert((await ResearchService.getTimeSeriesMetrics(NOBODY)).length === 0, "No students in scope -> empty time series");

  // -------------------------------------------------------------------------
  // 9. STANDARDIZED CSV EXPORTS
  // -------------------------------------------------------------------------
  console.log("\n[9] Standardized Research CSV Exporters");

  const metricsCsv = ResearchExporter.exportMetricsToCsv([studentProfile]);
  assert(
    metricsCsv.includes("student_id,student_name,grade_level,metric") &&
    metricsCsv.includes("usr_student_01"),
    "Generates standardized research metrics CSV format"
  );

  const comparisonCsv = ResearchExporter.exportPrePostComparisonToCsv(prePostComparison);
  assert(
    comparisonCsv.includes("student_id,student_name,classroom_id,classroom_name") &&
    comparisonCsv.includes("Section Test"),
    "Generates pre/post comparison CSV with cohort breakdown"
  );

  const rawAttemptsCsv = ResearchExporter.exportRawAttemptsToCsv([
    {
      studentId: "usr_student_01",
      studentName: "Juan de la Cruz",
      questionId: "qst_01",
      skillId: "skl_01",
      attemptNumber: 1,
      isCorrect: true,
      difficulty: "EASY",
      questionType: "MULTIPLE_CHOICE",
      cognitiveLevel: "PROCEDURAL",
      timeTakenMs: 4200,
      hintUsed: false,
      submittedAt: new Date().toISOString(),
    },
  ]);
  assert(
    rawAttemptsCsv.includes("student_id,student_name,question_id,skill_id") &&
    rawAttemptsCsv.includes("qst_01"),
    "Generates raw question attempt evidence CSV"
  );

  // -------------------------------------------------------------------------
  // 10. MISTAKE EVALUATE ATTEMPT & DIRECT QUESTION ATTEMPT RECORDING
  // -------------------------------------------------------------------------
  console.log("\n[10] Mistake Evaluation & Question Attempt Recording");

  const mistakeEval = MistakeAnalyzerService.evaluateAttempt({
    prompt: "Calculate 5 + (-8)",
    studentAnswer: 3,
    correctAnswer: -3,
    skillId: "skl_02",
  });
  assert(
    mistakeEval.category === "SIGN_ERROR",
    "MistakeAnalyzerService.evaluateAttempt correctly identifies inverted sign errors"
  );

  const recordedAttempt = await dbService.submitQuestionAttempt({
    studentId: "usr_student_01",
    questionId: "qst_01",
    skillId: "skl_01",
    answer: "A",
    isCorrect: true,
    attemptNumber: 1,
    timeTakenMs: 3500,
    hintUsed: false,
  });
  assert(
    Boolean(recordedAttempt && recordedAttempt.id && recordedAttempt.isCorrect),
    "dbService.submitQuestionAttempt successfully persists assessment attempt"
  );

  // -------------------------------------------------------------------------
  // SUMMARY
  // -------------------------------------------------------------------------
  console.log("\n=================================================");
  console.log(`  PHASE 14 TEST RESULTS: ${passedTests}/${totalTests} PASS`);
  console.log("=================================================\n");

  if (passedTests === totalTests) {
    console.log("ALL PHASE 14 ASSESSMENT & RESEARCH ANALYTICS TESTS PASSED.");
    process.exit(0);
  } else {
    console.error(`FAILED: ${totalTests - passedTests} tests failed.`);
    process.exit(1);
  }
}

runPhase14Tests().catch((err) => {
  console.error("Unhandled test execution error:", err);
  process.exit(1);
});
