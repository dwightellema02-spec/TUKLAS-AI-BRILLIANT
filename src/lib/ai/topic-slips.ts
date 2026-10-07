/**
 * Phase 44: recognising the usual slips on the Grade 7 Term 1 topics (polygons and angles, percentages, money, rates).
 * The tutor's coaching module (Phase 40) already knows, for each kind of problem, which wrong values the common mistakes produce (computed from
 * the problem's own numbers). The mistake analyzer reuses that: a wrong answer that equals a known slip's value is evidence of THAT slip, not of
 * a vague "calculation error". Nothing here states a correct answer.
 */
import { coachFor, slipFor } from "./conversation/coaching";
import type { QuestionAttemptDetail } from "./types";

/** What each kind of problem is about, in a teacher's words. */
export const TOPIC_LABELS: Record<string, string> = {
  "names-count": "naming polygons by their number of sides",
  "ext-total": "the sum of the exterior angles of a polygon",
  "construct-angle": "the central angle for drawing a regular polygon",
  "construct-side": "side lengths for drawing a regular polygon",
  complementary: "complementary angles",
  supplementary: "supplementary angles and linear pairs",
  vertical: "vertical angles",
  ray: "angles formed by rays",
  "ratio-angles": "angles given as a ratio",
  "ext-int": "an interior angle and its adjacent exterior angle",
  "angle-sum": "the interior angle sum of a polygon",
  "each-interior": "each interior angle of a regular polygon",
  "each-exterior": "each exterior angle of a regular polygon",
  "sides-from-sum": "finding the number of sides from an angle sum",
  "missing-angle": "a missing angle of a polygon",
  "pct-change": "percentage increase and decrease",
  "pct-new": "the new value after a percentage change",
  discount: "discounts and sale prices",
  "commission-tax": "commission and sales tax",
  interest: "simple interest",
  budget: "budgets and percentages of income",
  "unit-rate": "unit rates",
  "speed-distance-time": "speed, distance and time",
  "rate-scale": "rates and scaling",
};

export interface TopicSlipFinding {
  attemptId: string;
  kind: string;
  label: string;
  message: string;
  idea: string;
}

/** The incorrect numeric attempts whose wrong value matches a known slip for that kind of problem. */
export function findTopicSlips(attempts: QuestionAttemptDetail[]): TopicSlipFinding[] {
  const out: TopicSlipFinding[] = [];
  for (const a of attempts) {
    if (a.isCorrect) continue;
    const typed = Number(String(a.answer ?? "").replace(/[,₱%\s]/g, ""));
    if (!Number.isFinite(typed) || String(a.answer ?? "").trim() === "") continue;
    const coach = coachFor({ prompt: a.question.prompt ?? "", type: a.question.type });
    if (!coach) continue;
    const hit = slipFor(coach, typed);
    if (!hit) continue;
    out.push({ attemptId: a.id, kind: coach.kind, label: TOPIC_LABELS[coach.kind] ?? coach.kind, message: hit.message, idea: coach.idea.message });
  }
  return out;
}
