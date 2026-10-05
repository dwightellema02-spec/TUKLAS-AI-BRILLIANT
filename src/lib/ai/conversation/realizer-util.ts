import type { ConversationState, ResponsePlan } from "./types";

/** Minimal response that cannot disclose anything: used only when every richer variant failed a guard. */
export function guessSafe(plan: ResponsePlan, state: ConversationState): { message: string; question: string } {
  const alt = state.turn % 2 === 0;
  return {
    message: alt ? "Let's slow down and look at this together." : "Let's think about this step by step.",
    question: alt ? "What is the very first thing you notice about the problem?" : "What do you think the first step should be?",
  };
}
