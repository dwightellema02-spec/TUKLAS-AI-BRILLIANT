/**
 * Teacher analytics from evidence (master plan Modules 18 and 19). Pure functions: plain data in, plain data out, so every rule
 * can be tested with made-up students and fixed dates.
 *
 * Principles:
 *  - Every statement carries its numbers ("4 of 10 practice questions right") so a teacher can judge it; nothing is a bare label.
 *  - Too little evidence is never turned into a label (needs a minimum number of answered questions / a finished test).
 *  - A pre-test score is a baseline, not a problem, so it never raises a flag.
 *  - Activity means ANY real activity: lessons, practice, assessments, tutor conversations.
 *  - Nothing is dropped silently: the full ranked list is returned; the screen decides how many to show.
 *  - Suggested actions name the skill or mistake the evidence points to; they are suggestions, not diagnoses.
 */

export type Severity = "HIGH" | "MEDIUM" | "LOW";

export interface StudentEvidence {
  id: string;
  name: string;
  classroomIds: string[];
  classroomName: string;
  enrolledAt?: Date | null;
  lastActivityAt: Date | null;
  lessonsStarted: number;
  lessonsCompleted: number;
  practice: { sessions: number; questions: number; correct: number; recent: Array<{ at: Date; questions: number; correct: number }> };
  assessments: Array<{ assessmentId: string; title: string; type: string; scorePercent: number; isPassed: boolean; submittedAt: Date }>;
  masteries: Array<{ skillId: string; skillTitle: string; status: string; accuracy: number; attemptCount: number }>;
  mistakes: Array<{ category: string; skillId?: string | null; skillTitle?: string }>;
  tutor: { lastAt: Date | null; conversations: number; studentMessages: number; flagged: Array<{ updatedAt: Date; reasons: string[] }> };
}

export interface SupportSignal {
  studentId: string;
  studentName: string;
  classroomName: string;
  signalType: "REPEATED_MISTAKES" | "LOW_ACCURACY" | "LOW_ASSESSMENT" | "INSUFFICIENT_ACTIVITY" | "PERSISTENT_DEVELOPING" | "TUTOR_FLAGGED" | "NOT_STARTED" | "DECLINING";
  severity: Severity;
  /** What the data shows, each with its numbers. */
  evidence: string[];
  /** One-line summary (the first evidence line). */
  details: string;
  skillTitle?: string;
  suggestedAction: string;
}

export const THRESHOLDS = {
  minPracticeQuestions: 5,
  lowAccuracyHigh: 50,
  lowAccuracyMedium: 65,
  minAssessmentSignal: 70,
  assessmentHigh: 50,
  inactiveDays: 14,
  notStartedDays: 3,
  repeatedMistakeCount: 3,
  decliningDrop: 20,
  tutorFlagWindowDays: 14,
};

const DAY = 86_400_000;
const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : null);

export const MISTAKE_LABELS: Record<string, string> = {
  SIGN_ERROR: "sign errors", CALCULATION_ERROR: "calculation slips", CONCEPTUAL_MISUNDERSTANDING: "a concept that is not yet understood",
  PREREQUISITE_GAP: "a gap in an earlier skill", APPLICATION_DIFFICULTY: "trouble applying the idea", PROCEDURAL_ERROR: "steps done in the wrong order",
  READING_OR_INTERPRETATION_ERROR: "misreading the question", INCONSISTENT_PERFORMANCE: "inconsistent results", POSSIBLE_CARELESS_ERROR: "careless errors",
  QUESTION_TYPE_DIFFICULTY: "a question format that is hard for them", UNKNOWN: "an unclear pattern",
};
export const mistakeLabel = (c: string) => MISTAKE_LABELS[c] ?? c.toLowerCase().replace(/_/g, " ");

export function practiceAccuracy(e: StudentEvidence): number | null {
  return e.practice.questions >= THRESHOLDS.minPracticeQuestions ? pct(e.practice.correct, e.practice.questions) : null;
}

/** The latest graded result of each assessment that counts as evidence of learning (not a pre-test). */
function learningAssessments(e: StudentEvidence) {
  const latest = new Map<string, StudentEvidence["assessments"][number]>();
  for (const a of e.assessments) {
    if (a.type === "PRE_TEST") continue;
    const cur = latest.get(a.assessmentId);
    if (!cur || a.submittedAt > cur.submittedAt) latest.set(a.assessmentId, a);
  }
  return Array.from(latest.values());
}

function topMistake(e: StudentEvidence): { category: string; count: number; skillTitle?: string } | null {
  const by = new Map<string, { count: number; skills: Map<string, number> }>();
  for (const m of e.mistakes) {
    const x = by.get(m.category) ?? { count: 0, skills: new Map<string, number>() };
    x.count++;
    if (m.skillTitle) x.skills.set(m.skillTitle, (x.skills.get(m.skillTitle) ?? 0) + 1);
    by.set(m.category, x);
  }
  const top = Array.from(by.entries()).filter(([c]) => c !== "UNKNOWN").sort((a, b) => b[1].count - a[1].count)[0];
  if (!top) return null;
  const skill = Array.from(top[1].skills.entries()).sort((a, b) => b[1] - a[1])[0]?.[0];
  return { category: top[0], count: top[1].count, skillTitle: skill };
}

/** The weakest skill with real evidence (at least 3 attempts), for naming a concrete thing to practise. */
function weakestSkill(e: StudentEvidence): { skillTitle: string; accuracy: number } | null {
  const w = e.masteries.filter((m) => m.attemptCount >= 3 && (m.status === "LEARNING" || m.status === "DEVELOPING")).sort((a, b) => a.accuracy - b.accuracy)[0];
  return w ? { skillTitle: w.skillTitle, accuracy: Math.round(w.accuracy * 100) } : null;
}

export function lastActivity(e: StudentEvidence): Date | null {
  const times = [e.lastActivityAt, e.tutor.lastAt, ...e.assessments.map((a) => a.submittedAt), ...e.practice.recent.map((r) => r.at)].filter((d): d is Date => !!d);
  return times.length ? new Date(Math.max(...times.map((d) => d.getTime()))) : null;
}

/** One entry per student who needs a look, strongest first. Students with no concern are not listed. */
export function buildSupportSignals(students: StudentEvidence[], now: Date = new Date()): SupportSignal[] {
  const out: SupportSignal[] = [];
  const T = THRESHOLDS;

  for (const e of students) {
    const ev: Array<{ type: SupportSignal["signalType"]; severity: Severity; text: string; skill?: string }> = [];
    const last = lastActivity(e);
    const acc = practiceAccuracy(e);
    const weak = weakestSkill(e);
    const mistake = topMistake(e);

    if (acc !== null) {
      const text = `Practice: ${e.practice.correct} of ${e.practice.questions} questions right (${acc}%) over ${e.practice.sessions} session${e.practice.sessions === 1 ? "" : "s"}.`;
      if (acc < T.lowAccuracyHigh) ev.push({ type: "LOW_ACCURACY", severity: "HIGH", text, skill: weak?.skillTitle });
      else if (acc < T.lowAccuracyMedium) ev.push({ type: "LOW_ACCURACY", severity: "MEDIUM", text, skill: weak?.skillTitle });
    }

    // a clear drop across recent practice sessions: the last two sessions against everything before them
    const rec = [...e.practice.recent].sort((a, b) => a.at.getTime() - b.at.getTime());
    if (rec.length >= 4) {
      const lastTwo = rec.slice(-2), before = rec.slice(0, -2);
      const q2 = lastTwo.reduce((s, r) => s + r.questions, 0), c2 = lastTwo.reduce((s, r) => s + r.correct, 0);
      const q1 = before.reduce((s, r) => s + r.questions, 0), c1 = before.reduce((s, r) => s + r.correct, 0);
      if (q2 >= 4 && q1 >= 4) {
        const a2 = pct(c2, q2)!, a1 = pct(c1, q1)!;
        if (a1 - a2 >= T.decliningDrop) ev.push({ type: "DECLINING", severity: "MEDIUM", text: `Recent practice has dropped: ${a2}% in the last two sessions against ${a1}% before.` });
      }
    }

    for (const a of learningAssessments(e)) {
      const text = `${a.title}: scored ${Math.round(a.scorePercent)}%${a.isPassed ? "" : " (below the pass mark)"}.`;
      if (a.scorePercent < T.assessmentHigh) ev.push({ type: "LOW_ASSESSMENT", severity: "HIGH", text });
      else if (a.scorePercent < T.minAssessmentSignal && !a.isPassed) ev.push({ type: "LOW_ASSESSMENT", severity: "MEDIUM", text });
    }

    if (mistake && mistake.count >= T.repeatedMistakeCount) {
      ev.push({ type: "REPEATED_MISTAKES", severity: "MEDIUM", text: `The same pattern was diagnosed ${mistake.count} times: ${mistakeLabel(mistake.category)}${mistake.skillTitle ? ` (mostly in ${mistake.skillTitle})` : ""}.`, skill: mistake.skillTitle });
    }

    const developing = e.masteries.filter((m) => m.attemptCount >= 3 && (m.status === "LEARNING" || m.status === "DEVELOPING"));
    if (developing.length >= 2 && acc !== null && acc < 75) {
      ev.push({ type: "PERSISTENT_DEVELOPING", severity: "LOW", text: `Still learning or developing ${developing.length} skills: ${developing.slice(0, 3).map((m) => `${m.skillTitle} (${Math.round(m.accuracy * 100)}%)`).join(", ")}.`, skill: developing[0].skillTitle });
    }

    const recentFlags = e.tutor.flagged.filter((f) => now.getTime() - f.updatedAt.getTime() <= T.tutorFlagWindowDays * DAY);
    if (recentFlags.length > 0) {
      const reasons = Array.from(new Set(recentFlags.flatMap((f) => f.reasons))).slice(0, 3).join("; ");
      ev.push({ type: "TUTOR_FLAGGED", severity: "HIGH", text: `The AI tutor flagged ${recentFlags.length} conversation${recentFlags.length === 1 ? "" : "s"} for you in the last ${T.tutorFlagWindowDays} days: ${reasons}.` });
    }

    if (last && now.getTime() - last.getTime() > T.inactiveDays * DAY) {
      ev.push({ type: "INSUFFICIENT_ACTIVITY", severity: "MEDIUM", text: `No activity for ${Math.floor((now.getTime() - last.getTime()) / DAY)} days (last: ${last.toISOString().slice(0, 10)}).` });
    } else if (!last) {
      const since = e.enrolledAt ? Math.floor((now.getTime() - e.enrolledAt.getTime()) / DAY) : null;
      if (since === null || since >= T.notStartedDays) ev.push({ type: "NOT_STARTED", severity: "LOW", text: `Joined${since !== null ? ` ${since} day${since === 1 ? "" : "s"} ago` : ""} but has not done any lesson, practice, assessment or tutor chat yet.` });
    }

    if (ev.length === 0) continue;
    const rank = { HIGH: 3, MEDIUM: 2, LOW: 1 } as const;
    ev.sort((a, b) => rank[b.severity] - rank[a.severity]);
    const primary = ev[0];
    const skill = ev.find((x) => x.skill)?.skill ?? weak?.skillTitle;

    const actions: string[] = [];
    if (ev.some((x) => x.type === "TUTOR_FLAGGED")) actions.push("Check in with the student: the tutor could not resolve their difficulty. Their conversation is in their profile.");
    if (ev.some((x) => x.type === "LOW_ACCURACY" || x.type === "LOW_ASSESSMENT" || x.type === "REPEATED_MISTAKES")) {
      if (mistake && mistake.count >= T.repeatedMistakeCount) actions.push(`Give a few short ${skill ? `${skill} ` : ""}questions aimed at ${mistakeLabel(mistake.category)}, and ask them to explain one step aloud.`);
      else if (skill) actions.push(`Re-teach and practise ${skill} with easier questions first.`);
      else actions.push("Review the last practice together to find where the steps go wrong.");
    }
    if (ev.some((x) => x.type === "DECLINING")) actions.push("Ask what changed (difficulty, time, confidence) before assigning more work.");
    if (ev.some((x) => x.type === "INSUFFICIENT_ACTIVITY")) actions.push("Check access (device, connection) and remind them of the open assignment.");
    if (ev.some((x) => x.type === "NOT_STARTED")) actions.push("Confirm they can sign in and see the class assignment.");
    if (actions.length === 0 && skill) actions.push(`Assign a few medium-difficulty ${skill} questions.`);
    if (actions.length === 0) actions.push("Keep an eye on their next practice.");

    out.push({
      studentId: e.id, studentName: e.name, classroomName: e.classroomName, signalType: primary.type, severity: primary.severity,
      evidence: ev.map((x) => x.text), details: primary.text, skillTitle: skill, suggestedAction: actions.slice(0, 2).join(" "),
    });
  }

  const rank = { HIGH: 3, MEDIUM: 2, LOW: 1 } as const;
  return out.sort((a, b) => rank[b.severity] - rank[a.severity] || b.evidence.length - a.evidence.length || a.studentName.localeCompare(b.studentName));
}

export interface GroupRecommendation {
  skillTitle: string;
  skillId: string;
  students: Array<{ id: string; name: string }>;
  studentCount: number;
  withEvidence: number;
  commonMistake?: { category: string; label: string; count: number };
  evidence: string;
  suggestedAction: string;
}

/**
 * Skills that several students share difficulty with, from real mastery records. At least 3 students (or at least a third
 * of those with evidence, and at least 2): a single struggling student belongs in "needs attention", not here.
 */
export function buildGroupRecommendations(students: StudentEvidence[]): GroupRecommendation[] {
  const by = new Map<string, { skillTitle: string; weak: Array<{ id: string; name: string; accuracy: number }>; withEvidence: number }>();
  for (const e of students) {
    for (const m of e.masteries) {
      if (m.attemptCount < 3) continue;
      const g = by.get(m.skillId) ?? { skillTitle: m.skillTitle, weak: [], withEvidence: 0 };
      g.withEvidence++;
      if (m.status === "LEARNING" || m.status === "DEVELOPING") g.weak.push({ id: e.id, name: e.name, accuracy: m.accuracy });
      by.set(m.skillId, g);
    }
  }
  const out: GroupRecommendation[] = [];
  for (const [skillId, g] of by) {
    const n = g.weak.length;
    if (!(n >= 3 || (n >= 2 && n / g.withEvidence >= 1 / 3))) continue;
    const counts = new Map<string, number>();
    for (const e of students) if (g.weak.some((w) => w.id === e.id)) for (const m of e.mistakes) if (m.skillId === skillId && m.category !== "UNKNOWN") counts.set(m.category, (counts.get(m.category) ?? 0) + 1);
    const top = Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0];
    const mean = Math.round((g.weak.reduce((s, w) => s + w.accuracy, 0) / n) * 100);
    out.push({
      skillId, skillTitle: g.skillTitle, students: g.weak.map(({ id, name }) => ({ id, name })), studentCount: n, withEvidence: g.withEvidence,
      commonMistake: top ? { category: top[0], label: mistakeLabel(top[0]), count: top[1] } : undefined,
      evidence: `${n} of ${g.withEvidence} students with evidence are still learning or developing ${g.skillTitle} (their average accuracy on it is ${mean}%).${top ? ` The most common diagnosed pattern is ${mistakeLabel(top[0])} (${top[1]} time${top[1] === 1 ? "" : "s"}).` : ""}`,
      suggestedAction: `Consider a short whole-group review of ${g.skillTitle}${top ? `, with attention to ${mistakeLabel(top[0])}` : ""}, then a small practice set; the named students can start there.`,
    });
  }
  return out.sort((a, b) => b.studentCount - a.studentCount || a.skillTitle.localeCompare(b.skillTitle));
}

export interface StudentStatus { status: "ACTIVE" | "NEEDS_SUPPORT" | "INACTIVE" | "NO_DATA"; }

/** Status for the student list, from the same evidence as the signals (activity includes assessments and tutor use). */
export function studentStatus(e: StudentEvidence, now: Date = new Date()): StudentStatus["status"] {
  const last = lastActivity(e);
  if (!last) return "NO_DATA";
  const acc = practiceAccuracy(e);
  const lowAssessment = learningAssessments(e).some((a) => a.scorePercent < THRESHOLDS.assessmentHigh);
  if ((acc !== null && acc < THRESHOLDS.lowAccuracyMedium) || lowAssessment || e.tutor.flagged.some((f) => now.getTime() - f.updatedAt.getTime() <= THRESHOLDS.tutorFlagWindowDays * DAY)) return "NEEDS_SUPPORT";
  if (now.getTime() - last.getTime() > THRESHOLDS.inactiveDays * DAY) return "INACTIVE";
  return "ACTIVE";
}
