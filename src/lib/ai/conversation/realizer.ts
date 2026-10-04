/**
 * Phase 23: Local plan realizer.
 *
 * Turns a ResponsePlan into natural language WITHOUT an LLM. It exists so the tutor still follows its
 * pedagogy when the external model is unavailable, and as the safe fallback when LLM output violates the
 * plan. It is template-based: honest about being less fluent than an LLM, but it uses the student's actual
 * numbers, words and mistake, varies its phrasing, and never repeats a recent message.
 */

import type { GroundingSource } from "../../documents/types";
import { fmt } from "./arith";
import { guessSafe } from "./realizer-util";
import { hashString, structureFacts } from "./problems";
import { checkTutorOutput, type Violation } from "./guards";
import type { ConversationState, ParsedProblem, ResponsePlan, TutorStrategy } from "./types";

export interface RealizeContext {
  state: ConversationState; // state AFTER observing the student turn
  lessonTitle?: string;
  skillTitle?: string;
  sources: GroundingSource[];
}

export interface RealizedResponse {
  responseType: "HINT" | "GUIDING_QUESTION" | "EXPLANATION" | "EXAMPLE" | "FEEDBACK" | "CLARIFICATION" | "REDIRECT";
  message: string;
  guidingQuestion: string;
  hintLevel: number;
  encouragement: string;
  nextStep?: string;
  citedSourceIds: string[];
}

const TYPE_FOR: Record<TutorStrategy, RealizedResponse["responseType"]> = {
  OPEN_LESSON: "GUIDING_QUESTION",
  OPEN_PROBLEM: "GUIDING_QUESTION",
  ASK_WHAT_THEY_THINK: "GUIDING_QUESTION",
  ACTIVATE_PRIOR: "EXPLANATION",
  VISUAL_NUMBER_LINE: "HINT",
  DECOMPOSE_STEPS: "HINT",
  WORKED_ANALOGOUS: "EXAMPLE",
  REAL_CONTEXT: "EXPLANATION",
  TARGET_MISCONCEPTION: "HINT",
  ASK_FOR_REASONING: "GUIDING_QUESTION",
  CONFIRM_AND_PROBE: "FEEDBACK",
  TRANSFER_PROBLEM: "GUIDING_QUESTION",
  SIMPLER_PROBLEM: "GUIDING_QUESTION",
  HARDER_PROBLEM: "GUIDING_QUESTION",
  REVIEW_KEY_IDEAS: "EXPLANATION",
  REDIRECT_TO_THINKING: "REDIRECT",
  EMPATHIZE_AND_SHRINK: "GUIDING_QUESTION",
  NUDGE_TO_RESPOND: "GUIDING_QUESTION",
  SUGGEST_TEACHER: "CLARIFICATION",
  REDIRECT_OFF_TOPIC: "REDIRECT",
  CELEBRATE_AND_NEXT: "FEEDBACK",
};

interface Draft {
  message: string;
  question: string;
  citedSourceIds?: string[];
}

const pickVariant = <T,>(variants: T[], seed: number, avoid: (v: T) => boolean): T => {
  for (let i = 0; i < variants.length; i++) {
    const v = variants[(seed + i) % variants.length];
    if (!avoid(v)) return v;
  }
  return variants[seed % variants.length];
};

const wrap = (n: number) => (n < 0 ? `(${n})` : String(n));
const dollar = (p: ParsedProblem) => `$${p.display.replace("×", "\\times").replace("÷", "\\div").replace("−", "-")}$`;

function ackFor(plan: ResponsePlan, ctx: RealizeContext, seed: number): string {
  const s = ctx.state;
  const att = plan.evaluation.attempted;
  // Strategies whose own wording already carries the acknowledgement.
  if (plan.strategy === "SUGGEST_TEACHER" || plan.strategy === "EMPATHIZE_AND_SHRINK" || plan.strategy === "REDIRECT_OFF_TOPIC" || plan.strategy === "NUDGE_TO_RESPOND") return "";
  const notUsedRecently = (v: string) => !s.recentTutorMessages.some((m) => m.includes(v.slice(0, 24)));

  if (plan.evaluation.kind === "INCORRECT" && att !== undefined) {
    return pickVariant(
      [`Thanks for trying ${att}.`, `I can see you gave ${att} a go.`, `Good that you committed to an answer, ${att}.`, `${att} is a real attempt, and that helps me see your thinking.`],
      seed,
      (v) => !notUsedRecently(v)
    );
  }
  if (plan.intent === "REASONING" && plan.studentQuote) {
    return pickVariant(
      [`I like that you explained your thinking ("${plan.studentQuote.slice(0, 80)}").`, `Thanks for sharing your reasoning ("${plan.studentQuote.slice(0, 80)}").`],
      seed,
      (v) => !notUsedRecently(v)
    );
  }
  if (plan.intent === "CONFUSED" || plan.intent === "DONT_KNOW") {
    const n = s.consecutiveConfusion;
    const byLevel: string[][] = [
      ["That's okay, a lot of people find this tricky at first.", "No problem, let's slow down together."],
      ["Still unclear, and thanks for telling me. Let me explain it differently this time.", "Thanks for being honest that it's not clear yet. Let me try another angle."],
      ["I can tell this is still not clicking, and that's okay. I'll take a completely different route.", "It's still fuzzy, and that tells me my explanation needs to change, not you."],
      ["We've tried a few ways already. Let's slow right down and go much smaller.", "Let's try yet another way, because one of them should click."],
    ];
    const variants = byLevel[Math.min(Math.max(n, 1), 4) - 1];
    return pickVariant(variants, seed, (v) => !notUsedRecently(v));
  }
  return "";
}

const lessonName = (ctx: RealizeContext) => ctx.skillTitle || ctx.lessonTitle || "this lesson";

function decomposeQuestions(p: ParsedProblem): string[] {
  const f = structureFacts(p);
  if (p.op === "+") {
    return [
      `Step 1: look at the signs of ${wrap(p.a)} and ${wrap(p.b)}. Are they the same or different?`,
      `Step 2: ignoring the signs for a moment, which has the larger size, |${p.a}| or |${p.b}|?`,
      f.sameSigns ? `Step 3: when the signs are the same, do you add the sizes or subtract them?` : `Step 3: when the signs are different, do you add the sizes or subtract the smaller from the larger?`,
      `Step 4: which number "wins", and so what sign should the result have?`,
    ];
  }
  if (p.op === "-") {
    return [
      `Step 1: subtracting ${wrap(p.b)} is the same as adding its opposite. What is the opposite of ${wrap(p.b)}?`,
      `Step 2: so ${p.display} becomes ${wrap(p.a)} + ${wrap(-p.b)}. Are those two signs the same or different?`,
      `Step 3: ignoring signs, which has the larger size, |${p.a}| or |${-p.b}|?`,
      `Step 4: which one "wins", and so what sign should the result have?`,
    ];
  }
  return [
    `Step 1: ignore the signs for a moment. What is |${p.a}| ${p.op === "*" ? "×" : "÷"} |${p.b}|?`,
    `Step 2: are the signs of ${wrap(p.a)} and ${wrap(p.b)} the same or different?`,
    `Step 3: when you ${p.op === "*" ? "multiply" : "divide"} numbers with ${Math.sign(p.a) === Math.sign(p.b) ? "the same" : "different"} signs, what sign does the result take?`,
  ];
}

function story(p: ParsedProblem): { text: string; question: string } | undefined {
  const asAdd = p.op === "-" ? { a: p.a, b: -p.b } : p.op === "+" ? { a: p.a, b: p.b } : undefined;
  if (asAdd) {
    const { a, b } = asAdd;
    if (a >= 0 && b < 0) return { text: `Imagine you have ₱${a} and then you pay back ₱${Math.abs(b)} that you owe.`, question: `Would you end up with money left over or still owing, and why do you think so?` };
    if (a < 0 && b >= 0) return { text: `Imagine you owe ₱${Math.abs(a)} and then you earn ₱${b}.`, question: `After paying what you can, would you still owe, or have money left over, and why?` };
    if (a < 0 && b < 0) return { text: `Imagine you owe ₱${Math.abs(a)} and then you borrow ₱${Math.abs(b)} more.`, question: `Do you owe more or less than before, and why?` };
    return { text: `Imagine you have ₱${a} and earn ₱${b} more.`, question: `Do you have more or less than before, and why?` };
  }
  if (p.op === "*" && p.a < 0 && p.b > 0) return { text: `Imagine you owe ₱${Math.abs(p.a)} to each of ${p.b} friends.`, question: `Is the total you owe more or less than what you owe one friend, and does that make the result positive or negative?` };
  return undefined;
}

/** The sentences of `text` that best overlap the student's words (so the quoted excerpt answers their question). */
function bestSentences(text: string, query: string, count: number, maxChars: number): string {
  const sentences = (text.replace(/\s+/g, " ").match(/[^.!?]+[.!?]?/g) ?? [text]).map((x) => x.trim()).filter(Boolean);
  const qTokens = new Set((query.toLowerCase().match(/[a-z]{3,}|-?\d+/g) ?? []).filter((t) => !["what", "does", "the", "say", "about", "how", "can", "you", "explain", "with", "and", "for"].includes(t)));
  const scored = sentences.map((sentence, i) => ({
    sentence,
    i,
    score: (sentence.toLowerCase().match(/[a-z]{3,}|-?\d+/g) ?? []).filter((t) => qTokens.has(t)).length,
  }));
  const chosen = [...scored].sort((a, b) => b.score - a.score || a.i - b.i).slice(0, count).sort((a, b) => a.i - b.i);
  return chosen.map((c) => c.sentence).join(" ").slice(0, maxChars);
}

function realizeDraft(plan: ResponsePlan, ctx: RealizeContext, seed: number): Draft {
  const p = plan.activeProblem;
  const ack = ackFor(plan, ctx, seed);
  const lead = (text: string) => [ack, text].filter(Boolean).join(" ");
  const state = ctx.state;
  const top = ctx.sources[0];

  switch (plan.strategy) {
    case "OPEN_PROBLEM":
      return {
        message: lead(p ? `Let's work on ${dollar(p)} together, and I'll guide you rather than solve it for you.` : `Let's work on this together, and I'll guide you rather than solve it for you.`),
        question: pickVariant(
          ["What do you notice about the numbers, and what do you think the problem is asking you to do?", "Before calculating anything, what is the first thing you notice about this problem?"],
          seed,
          (q) => state.lastTutorQuestion === q
        ),
      };
    case "OPEN_LESSON": {
      const intro = top
        ? `Welcome! Today's lesson, ${ctx.lessonTitle ?? "this lesson"}, covers this idea from your materials: "${top.text.replace(/\s+/g, " ").slice(0, 200)}"`
        : `Welcome! Today we're working on ${lessonName(ctx)}.`;
      return { message: intro, question: `What do you already know about ${lessonName(ctx)}?`, citedSourceIds: top ? [top.sourceId] : [] };
    }
    case "ASK_WHAT_THEY_THINK":
      return {
        message: lead(p ? `Let's figure out where you are with ${dollar(p)}.` : `Let's figure out where you are.`),
        question: pickVariant(
          ["What have you tried so far, or what do you think the first step is?", "What is the very first thing you would do, even if you're unsure?", "Which part feels clear, and which part feels fuzzy?"],
          seed,
          (q) => state.lastTutorQuestion === q
        ),
      };
    case "ACTIVATE_PRIOR": {
      const variants: Draft[] = [
        { message: lead("Let's go back to a basic idea. A negative number is a number to the left of zero on the number line, and the absolute value of a number is its distance from zero."), question: p ? `What is the absolute value of ${wrap(p.a)}, and what does that tell us about where it sits?` : "In your own words, what does the absolute value of a number tell us?" },
        { message: lead("Before we calculate, let's check one building block: the sign of a number tells us its direction from zero, and its size tells us how far."), question: p ? `For ${wrap(p.b)}, what is its direction and what is its size?` : "Can you give me a negative number and say what makes it negative?" },
      ];
      return pickVariant(variants, seed, (v) => state.recentTutorMessages.includes(v.message));
    }
    case "VISUAL_NUMBER_LINE": {
      if (!p || p.op === "*" || p.op === "/") return realizeDraft({ ...plan, strategy: "DECOMPOSE_STEPS" }, ctx, seed);
      const moveRight = p.op === "+" ? p.b >= 0 : p.b < 0;
      const verb = p.op === "+" ? "Adding" : "Subtracting";
      return {
        message: lead(`Picture a number line and put your finger on ${p.a}. ${verb} ${wrap(p.b)} means moving ${moveRight ? "right" : "left"} by ${Math.abs(p.b)} steps${p.op === "-" ? ` (because subtracting ${p.b < 0 ? "a negative moves you the opposite way" : "moves you left"})` : ""}.`),
        question: "As you move, do you cross zero, and will you end up on the left or the right side of it?",
      };
    }
    case "DECOMPOSE_STEPS": {
      if (!p) return { message: lead("Let's break it into small steps."), question: "What is the first small thing you could figure out?" };
      const qs = decomposeQuestions(p);
      const done = state.hintsGiven.filter((h) => h.strategy === "DECOMPOSE_STEPS").length;
      const idx = Math.min(done, qs.length - 1);
      const prefix = plan.intent === "REASONING" ? "Let's build on that one small step at a time." : "Let's take it one small step at a time.";
      return { message: lead(prefix), question: qs[idx].replace(/^Step \d+: /, `Step ${idx + 1}: `) };
    }
    case "WORKED_ANALOGOUS": {
      const ex = plan.example;
      if (!ex) return { message: lead("Let's look at how a similar problem is solved."), question: "What would you try first on yours?" };
      const steps = ex.steps.map((s, i) => `${i + 1}. ${s}`).join(" ");
      return {
        message: lead(`Here's a similar problem with different numbers, worked out: ${dollar(ex.problem)}. ${steps}`),
        question: p ? `What is the same and what is different in ${dollar(p)}?` : "How would you start a problem like that?",
      };
    }
    case "REAL_CONTEXT": {
      const st = p ? story(p) : undefined;
      if (!st) return { message: lead("Think of temperatures: above zero is warm, below zero is freezing, and combining them is about which one is bigger."), question: "If it is 5 degrees below zero and warms up by 3 degrees, is it still below zero?" };
      return { message: lead(st.text), question: st.question };
    }
    case "TARGET_MISCONCEPTION": {
      if (!p) return { message: lead("Let's check the idea behind this."), question: "Can you explain in your own words how the signs affect the result?" };
      const f = structureFacts(p);
      switch (plan.diagnosis) {
        case "SIGN_ERROR":
          return { message: lead(`You have the right size in mind, so let's look at the sign.`), question: `Which of ${wrap(p.a)} and ${wrap(p.b)} is farther from zero, and is that number positive or negative?` };
        case "ADDED_MAGNITUDES":
          return { message: lead(`When one number is positive and the other is negative, they pull against each other, like money you earn and money you owe.`), question: `Do you think the two sizes should add together, or partly cancel each other out?` };
        case "IGNORED_SIGNS":
          return { message: lead(`Let's pay attention to the signs, because they change what happens.`), question: `What sign does each of ${wrap(p.a)} and ${wrap(p.b)} have, and what does that tell us to do?` };
        case "WRONG_OPERATION":
          return { message: lead(`Let's re-read the problem together: ${dollar(p)}.`), question: `Which operation is it asking for, and what does that operation do to the two numbers?` };
        case "CALCULATION_SLIP":
          return { message: lead(`You're close. This might just be a small arithmetic slip.`), question: f.sameSigns ? `Re-check just the adding of the sizes ${f.absA} and ${f.absB}; what do you get?` : `Re-check just the subtracting of the sizes ${f.largerAbs} and ${f.smallerAbs}; what do you get?` };
        default:
          return { message: lead(`Let's look at how the numbers in ${dollar(p)} interact.`), question: `Can you walk me through what you did first?` };
      }
    }
    case "ASK_FOR_REASONING":
      return {
        message: lead(`That isn't it yet, but I'm curious how you got there.`),
        question: pickVariant(["Can you walk me through what you did first?", "What steps did you take to get that number?"], seed, (q) => state.lastTutorQuestion === q),
      };
    case "CONFIRM_AND_PROBE": {
      const att = plan.evaluation.attempted;
      return {
        message: pickVariant(
          [`Yes, ${att !== undefined ? att + " " : ""}is correct! I like how you worked that through.`, `That's right${att !== undefined ? `: ${att}` : ""}. Nice thinking!`, `Correct${att !== undefined ? `, ${att}` : ""}! You stuck with it.`],
          seed,
          (m) => state.recentTutorMessages.includes(m)
        ),
        question: pickVariant(["How did you know that was the answer?", "What rule or idea did you use to get there?", "Could you explain your thinking in a sentence or two?"], seed, (q) => state.lastTutorQuestion === q),
      };
    }
    case "TRANSFER_PROBLEM":
      return {
        message: lead(`Let's see if you can do a new one on your own, no hints this time: ${plan.problemToPose ? dollar(plan.problemToPose) : ""}.`),
        question: "What do you get?",
      };
    case "SIMPLER_PROBLEM":
      return {
        message: lead(`Let's try an easier one on the same idea, to build up to the first: ${plan.problemToPose ? dollar(plan.problemToPose) : ""}.`),
        question: "What do you get for this one?",
      };
    case "HARDER_PROBLEM":
      return {
        message: lead(`Ready for more of a challenge. Try this one: ${plan.problemToPose ? dollar(plan.problemToPose) : ""}.`),
        question: "What answer do you get?",
      };
    case "REVIEW_KEY_IDEAS": {
      if (top) {
        const excerpt = bestSentences(top.text, plan.studentQuote ?? "", 2, 320);
        return { message: lead(`Here is the key idea from ${top.origin === "TEACHER_NOTE" ? "your teacher's note" : `"${top.title}"`} (${top.sectionLabel}): "${excerpt}"`), question: "In your own words, what is the main idea, and where might you use it?", citedSourceIds: [top.sourceId] };
      }
      return { message: lead(`Let's recap ${lessonName(ctx)}: numbers have a size and a sign, and the sign tells us direction from zero.`), question: "Which part of that feels least clear to you?" };
    }
    case "REDIRECT_TO_THINKING":
      return {
        message: lead("I know it's tempting to just ask for the answer. I'd rather help you find it, so you can do the next one on your own."),
        question: p ? `To start, are the signs of ${wrap(p.a)} and ${wrap(p.b)} the same or different?` : "What is the first thing you notice about the problem?",
      };
    case "EMPATHIZE_AND_SHRINK":
      return {
        message: lead("It's okay to feel stuck here; this topic is tricky for many people, and you're still trying. Let's make it really small."),
        question: p ? `Just this one thing: is ${p.a} a positive or a negative number?` : "Just this one thing: can you name any negative number?",
      };
    case "NUDGE_TO_RESPOND":
      return {
        message: "No rush at all.",
        question: pickVariant(["What's your first thought, even if you're not sure?", "If you had to guess the first step, what would it be?"], seed, (q) => state.lastTutorQuestion === q),
      };
    case "SUGGEST_TEACHER":
      return {
        message: lead("This is a tricky spot, and that's completely okay. It's a good idea to ask your teacher or a classmate about it too, and I'll leave a note for your teacher so they know where you need support."),
        question: p ? `Want to try one smaller step with me first: is ${p.a} positive or negative?` : "Would you like to try one smaller step with me first?",
      };
    case "REDIRECT_OFF_TOPIC":
      return { message: "I can only help with your math lesson, so let's keep our focus there.", question: p ? `Shall we get back to ${dollar(p)}?` : `Shall we get back to ${lessonName(ctx)}?` };
    case "CELEBRATE_AND_NEXT":
      return {
        message: `You solved a brand-new problem all by yourself, which shows you really understand \"${lessonName(ctx)}\". Great work!`,
        question: "Would you like a harder one, another one like it, or are you ready to move on?",
      };
  }
}

export function realizePlan(plan: ResponsePlan, ctx: RealizeContext): RealizedResponse {
  const base = hashString(`${ctx.state.turn}|${plan.strategy}|${plan.intent}`);
  // Try several seeds so phrasing varies and any variant that would violate a guard is skipped.
  let best: { draft: Draft; violations: Violation[] } | undefined;
  for (let i = 0; i < 6; i++) {
    const draft = realizeDraft(plan, ctx, base + i);
    const violations = checkTutorOutput({ message: draft.message, guidingQuestion: draft.question }, plan, ctx.state);
    if (violations.length === 0) {
      best = { draft, violations };
      break;
    }
    if (!best || violations.length < best.violations.length) best = { draft, violations };
  }
  const draft = best!.draft;
  // Last-resort safe response if a violation persists (e.g. an operand coincides with the answer).
  const final =
    best!.violations.includes("ANSWER_DISCLOSED") || best!.violations.includes("EMPTY")
      ? guessSafe(plan, ctx.state)
      : draft;

  return {
    responseType: TYPE_FOR[plan.strategy],
    message: final.message,
    guidingQuestion: final.question,
    hintLevel: Math.max(1, Math.min(5, plan.hintOrdinal || 1)),
    encouragement: encouragementFor(plan),
    nextStep: undefined,
    citedSourceIds: (final as Draft).citedSourceIds ?? [],
  };
}

function encouragementFor(plan: ResponsePlan): string {
  switch (plan.strategy) {
    case "CONFIRM_AND_PROBE":
    case "CELEBRATE_AND_NEXT": return "Great thinking!";
    case "EMPATHIZE_AND_SHRINK":
    case "SUGGEST_TEACHER": return "You're not alone in this, and every try counts.";
    case "TRANSFER_PROBLEM": return "You can do this!";
    default: return "Keep thinking it through!";
  }
}

export { fmt };
