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
import { hashString, kindOf, mathText, structureFacts } from "./problems";
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
  /** True when every rich variant failed a guard and the generic safe reply was used (should be rare). */
  usedSafeFallback?: boolean;
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
const dollar = (p: ParsedProblem) => mathText(p);

function ackFor(plan: ResponsePlan, ctx: RealizeContext, seed: number): string {
  const s = ctx.state;
  const att = plan.evaluation.attempted;
  // Strategies whose own wording already carries the acknowledgement.
  if (plan.strategy === "SUGGEST_TEACHER" || plan.strategy === "EMPATHIZE_AND_SHRINK" || plan.strategy === "REDIRECT_OFF_TOPIC" || plan.strategy === "NUDGE_TO_RESPOND") return "";
  const notUsedRecently = (v: string) => !s.recentTutorMessages.some((m) => m.includes(v.slice(0, 24)));
  if (s.language === "TL") return ackTagalog(plan, ctx, seed, notUsedRecently);

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

/**
 * The built-in fallbacks below were written for integer arithmetic (number lines, signs, absolute value). They may only be used when the
 * conversation really is about integers: a parsed integer problem, or an integer lesson/skill. On any other topic (polygons, percentages,
 * rates...) they would teach the wrong thing, so the neutral wording is used instead.
 */
const integerTopic = (ctx: RealizeContext, p?: ParsedProblem) => !!p || /integer|negative|absolute|opposite|number line/i.test(`${ctx.skillTitle ?? ""} ${ctx.lessonTitle ?? ""}`);

function decomposeQuestions(p: ParsedProblem): string[] {
  const k = kindOf(p);
  if (k === "ABS") {
    return [
      `Step 1: where is ${p.a} on the number line, and how many steps away from 0 is it?`,
      `Step 2: can a distance ever be negative?`,
      `Step 3: so what is |${p.a}|?`,
    ];
  }
  if (k === "OPPOSITE") {
    return [
      `Step 1: on the number line, which side of 0 is ${p.a} on, and how far from 0 is it?`,
      `Step 2: the opposite is the same distance on the other side of 0. Which side is that?`,
      `Step 3: so which number is it?`,
    ];
  }
  if (k === "EQUATION") {
    const v = p.variable ?? "x";
    return [
      `Step 1: what operation is being done to ${v} in ${p.display}?`,
      `Step 2: which operation undoes it?`,
      `Step 3: do that to both sides. What is on the right side now?`,
    ];
  }
  if (k === "COMPARE") {
    return [
      `Step 1: picture ${wrap(p.a)} and ${wrap(p.b)} on a number line. Which one is farther to the right?`,
      p.op === ">" || p.op === "<" ? `Step 2: the number farther right is greater. Does that match the statement ${p.display}?` : `Step 2: the number farther right is greater. So which number is ${p.op === "min" ? "less" : "greater"}?`,
    ];
  }
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
  const k = kindOf(p);
  if (k === "ABS") return { text: `Imagine a diver at ${p.a} meters. The depth of the dive is how far the diver is from the surface.`, question: `Is "how far" ever a negative amount, and so what is |${p.a}|?` };
  if (k === "OPPOSITE") return { text: `Gaining ₱${Math.abs(p.a)} and losing ₱${Math.abs(p.a)} undo each other, so they are opposites.`, question: `If ${p.a} describes one of them, what would describe the other?` };
  if (k === "EQUATION") return { text: `Imagine you started with some money, then ${p.op === "x+" ? "received" : "spent"} ₱${Math.abs(p.a)}, and ended with ₱${p.b}.`, question: `How could you work backwards to find what you started with?` };
  if (k === "COMPARE") return { text: `Think about temperatures: ${Math.min(p.a, p.b)}° and ${Math.max(p.a, p.b)}° are two readings, and warmer means greater.`, question: `Which of the two readings is warmer?` };
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

/** One small first question that fits the problem kind. */
function firstStepQuestion(p?: ParsedProblem): string {
  if (!p) return "What is the first thing you notice about the problem?";
  switch (kindOf(p)) {
    case "ABS": return `What does the absolute value of a number measure?`;
    case "OPPOSITE": return `Which side of zero is ${p.a} on?`;
    case "EQUATION": return `What operation is being done to ${p.variable ?? "x"} in ${p.display}?`;
    case "COMPARE": return `On a number line, which of ${wrap(p.a)} and ${wrap(p.b)} is farther to the right?`;
    default: return `To start, are the signs of ${wrap(p.a)} and ${wrap(p.b)} the same or different?`;
  }
}

function smallestStep(p?: ParsedProblem): string {
  if (!p) return "Just this one thing: what numbers or facts does the problem give you?";
  switch (kindOf(p)) {
    case "EQUATION": return `Just this one thing: is ${p.variable ?? "x"} being added to or subtracted from something?`;
    case "COMPARE": return `Just this one thing: on a number line, does ${wrap(p.a)} sit to the left or to the right of 0?`;
    default: return `Just this one thing: is ${p.a} a positive or a negative number?`;
  }
}

function priorQuestion(p?: ParsedProblem): { message: string; question: string } {
  const k = p ? kindOf(p) : "BINARY";
  if (k === "ABS") return { message: "Let's go back to a basic idea: the absolute value of a number is its distance from zero on the number line.", question: "In your own words, what does that distance tell us about the number?" };
  if (k === "OPPOSITE") return { message: "Let's go back to a basic idea: two numbers are opposites when they are the same distance from zero but on different sides.", question: "Can you name a pair of opposite numbers and say what makes them opposites?" };
  if (k === "EQUATION") return { message: "Let's go back to a basic idea: to get a variable alone you undo what was done to it, like undoing a step.", question: "If I add 3 to a number, what would undo that?" };
  if (k === "COMPARE") return { message: "Let's go back to a basic idea: on a number line, numbers get bigger as you move to the right.", question: "Is -3 to the left or the right of -7?" };
  return { message: "Let's go back to a basic idea. A negative number is a number to the left of zero on the number line, and the absolute value of a number is its distance from zero.", question: p ? `What is the absolute value of ${wrap(p.a)}, and what does that tell us about where it sits?` : "In your own words, what does the absolute value of a number tell us?" };
}

function realizeDraft(plan: ResponsePlan, ctx: RealizeContext, seed: number): Draft {
  const draft = realizeDraftEN(plan, ctx, seed);
  return ctx.state.language === "TL" ? tagalogLayer(plan, ctx, seed, draft) : draft;
}

function realizeDraftEN(plan: ResponsePlan, ctx: RealizeContext, seed: number): Draft {
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
      if (p && kindOf(p) !== "BINARY") {
        const pq = priorQuestion(p);
        return { message: lead(pq.message), question: pq.question };
      }
      if (!integerTopic(ctx, p)) {
        return {
          message: lead(`Let's go back to the basics of ${lessonName(ctx)}.`),
          question: pickVariant(["What does the problem tell you, and what is it asking you to find?", "Which idea from the lesson do you think applies here, and why?"], seed, (q) => state.lastTutorQuestion === q),
        };
      }
      const variants: Draft[] = [
        { message: lead("Let's go back to a basic idea. A negative number is a number to the left of zero on the number line, and the absolute value of a number is its distance from zero."), question: p ? `What is the absolute value of ${wrap(p.a)}, and what does that tell us about where it sits?` : "In your own words, what does the absolute value of a number tell us?" },
        { message: lead("Before we calculate, let's check one building block: the sign of a number tells us its direction from zero, and its size tells us how far."), question: p ? `For ${wrap(p.b)}, what is its direction and what is its size?` : "Can you give me a negative number and say what makes it negative?" },
      ];
      return pickVariant(variants, seed, (v) => state.recentTutorMessages.includes(v.message));
    }
    case "VISUAL_NUMBER_LINE": {
      const vk = p ? kindOf(p) : undefined;
      if (p && vk === "ABS") return { message: lead(`Picture a number line and put your finger on ${p.a}. Now count the steps it takes to get back to 0.`), question: "How many steps is that, and can counting steps ever give a negative number?" };
      if (p && vk === "OPPOSITE") return { message: lead(`Picture a number line with a mirror standing at 0. Put one finger on ${p.a}.`), question: `Where would the mirror image of ${p.a} land?` };
      if (p && vk === "EQUATION") return { message: lead(`Picture a balance scale: ${p.display} means the two sides weigh the same, and whatever we do to one side we must do to the other.`), question: `What could you do to both sides so that ${p.variable ?? "x"} is left alone?` };
      if (p && vk === "COMPARE") return { message: lead(`Picture a number line where numbers get bigger as you move to the right. Put your fingers on ${wrap(p.a)} and ${wrap(p.b)}.`), question: "Which of the two is farther to the right?" };
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
      if (!st && !integerTopic(ctx, p)) return { message: lead("Try connecting this to everyday life, such as money, travel or measuring something."), question: "Can you think of a real situation where you would use this idea?" };
      if (!st) return { message: lead("Think of temperatures: above zero is warm, below zero is freezing, and combining them is about which one is bigger."), question: "If it is 5 degrees below zero and warms up by 3 degrees, is it still below zero?" };
      return { message: lead(st.text), question: st.question };
    }
    case "TARGET_MISCONCEPTION": {
      if (!p) return { message: lead("Let's check the idea behind this."), question: "Can you explain in your own words how the signs affect the result?" };
      const binaryP = kindOf(p) === "BINARY";
      const f = binaryP ? structureFacts(p) : undefined;
      switch (plan.diagnosis) {
        case "ABS_KEPT_SIGN":
          return { message: lead(`Remember that absolute value measures a distance from zero.`), question: `Can a distance ever be negative, and so what should |${p.a}| be?` };
        case "OPPOSITE_SAME_NUMBER":
          return { message: lead(`The opposite should land on the other side of zero.`), question: `Which side of zero is ${p.a} on, and where would its mirror image be?` };
        case "EQ_WRONG_INVERSE":
          return { message: lead(`It looks like the same operation was done again instead of being undone.`), question: `Starting from ${p.b}, which operation takes you back to ${p.variable ?? "x"} on its own?` };
        case "COMPARED_MAGNITUDE":
          return { message: lead(`Be careful with negative numbers: a bigger size does not mean a greater value.`), question: `On a number line, which of ${wrap(p.a)} and ${wrap(p.b)} is farther to the right?` };
        case "SIGN_ERROR":
          if (!binaryP) return { message: lead(`You have the right size in mind, so let's look at the sign.`), question: `Should the result be positive or negative here, and how do you know?` };
          return { message: lead(`You have the right size in mind, so let's look at the sign.`), question: `Which of ${wrap(p.a)} and ${wrap(p.b)} is farther from zero, and is that number positive or negative?` };
        case "ADDED_MAGNITUDES":
          return { message: lead(`When one number is positive and the other is negative, they pull against each other, like money you earn and money you owe.`), question: `Do you think the two sizes should add together, or partly cancel each other out?` };
        case "IGNORED_SIGNS":
          return { message: lead(`Let's pay attention to the signs, because they change what happens.`), question: `What sign does each of ${wrap(p.a)} and ${wrap(p.b)} have, and what does that tell us to do?` };
        case "WRONG_OPERATION":
          return { message: lead(`Let's re-read the problem together: ${dollar(p)}.`), question: `Which operation is it asking for, and what does that operation do to the two numbers?` };
        case "CALCULATION_SLIP":
          if (!f) return { message: lead(`You're close. This might just be a small arithmetic slip.`), question: `Try the arithmetic once more, slowly; what do you get?` };
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
      if (!integerTopic(ctx, p)) return { message: lead(`Let's recap ${lessonName(ctx)}.`), question: "In your own words, what is the main idea, and which part feels least clear to you?" };
      return { message: lead(`Let's recap ${lessonName(ctx)}: numbers have a size and a sign, and the sign tells us direction from zero.`), question: "Which part of that feels least clear to you?" };
    }
    case "REDIRECT_TO_THINKING":
      return {
        message: lead("I know it's tempting to just ask for the answer. I'd rather help you find it, so you can do the next one on your own."),
        question: firstStepQuestion(p),
      };
    case "EMPATHIZE_AND_SHRINK":
      return {
        message: lead("It's okay to feel stuck here; this topic is tricky for many people, and you're still trying. Let's make it really small."),
        question: smallestStep(p),
      };
    case "NUDGE_TO_RESPOND":
      return {
        message: "No rush at all.",
        question: pickVariant(["What's your first thought, even if you're not sure?", "If you had to guess the first step, what would it be?"], seed, (q) => state.lastTutorQuestion === q),
      };
    case "SUGGEST_TEACHER":
      return {
        message: lead("This is a tricky spot, and that's completely okay. It's a good idea to ask your teacher or a classmate about it too, and I'll leave a note for your teacher so they know where you need support."),
        question: p ? `Want to try one smaller step with me first? ${smallestStep(p).replace("Just this one thing: ", "")}`.replace("first? ", "first: ") : "Would you like to try one smaller step with me first?",
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
  const usedSafeFallback = best!.violations.includes("ANSWER_DISCLOSED") || best!.violations.includes("EMPTY");
  const final = usedSafeFallback ? guessSafe(plan, ctx.state) : draft;

  return {
    responseType: TYPE_FOR[plan.strategy],
    message: final.message,
    guidingQuestion: final.question,
    hintLevel: Math.max(1, Math.min(5, plan.hintOrdinal || 1)),
    encouragement: encouragementFor(plan),
    nextStep: undefined,
    citedSourceIds: (final as Draft).citedSourceIds ?? [],
    usedSafeFallback,
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


// ---------------------------------------------------------------------------------------------
// Filipino / Taglish layer
//
// Empathy, feedback and framing are phrased in Filipino; mathematical steps stay in English, which is
// how mathematics is commonly taught and discussed in Philippine classrooms (code-switching).
// These strings are a best-effort first version and NEED native-speaker/teacher review.
// ---------------------------------------------------------------------------------------------

function ackTagalog(plan: ResponsePlan, ctx: RealizeContext, seed: number, fresh: (v: string) => boolean): string {
  const s = ctx.state;
  const att = plan.evaluation.attempted;
  if (plan.evaluation.kind === "INCORRECT" && att !== undefined) {
    return pickVariant(
      [`Salamat sa pagsubok ng ${att}.`, `Magaling na sinubukan mo ang ${att}.`, `Nakakatulong ang sagot mong ${att} para makita ko kung paano ka mag-isip.`],
      seed,
      (v) => !fresh(v)
    );
  }
  if (plan.intent === "REASONING" && plan.studentQuote) {
    return pickVariant([`Salamat sa pagpapaliwanag mo ("${plan.studentQuote.slice(0, 80)}").`, `Maganda na ipinaliwanag mo ang iniisip mo ("${plan.studentQuote.slice(0, 80)}").`], seed, (v) => !fresh(v));
  }
  if (plan.intent === "CONFUSED" || plan.intent === "DONT_KNOW") {
    const byLevel: string[][] = [
      ["Okay lang 'yan, marami talagang nahihirapan dito sa simula.", "Walang problema, dahan-dahan lang tayo."],
      ["Hindi pa rin malinaw, at salamat sa pagsasabi. Ipapaliwanag ko sa ibang paraan.", "Salamat sa pagiging tapat na hindi pa malinaw. Susubukan ko ang ibang paraan."],
      ["Mukhang hindi pa rin malinaw, kaya ibang paraan naman ang gagamitin ko.", "Hindi pa rin malinaw, ibig sabihin kailangang baguhin ang paliwanag ko, hindi ikaw."],
      ["Ilang paraan na ang sinubukan natin. Liliitan ko pa lalo ang bawat hakbang.", "Susubukan natin ang isa pang paraan, at sana ito na ang makatulong."],
    ];
    return pickVariant(byLevel[Math.min(Math.max(s.consecutiveConfusion, 1), 4) - 1], seed, (v) => !fresh(v));
  }
  return "";
}

function tagalogLayer(plan: ResponsePlan, ctx: RealizeContext, seed: number, en: Draft): Draft {
  const p = plan.activeProblem;
  const att = plan.evaluation.attempted;
  const ack = ackTagalog(plan, ctx, seed, (v) => !ctx.state.recentTutorMessages.some((m) => m.includes(v.slice(0, 24))));
  const lead = (t: string) => [ack, t].filter(Boolean).join(" ");
  const posed = plan.problemToPose ? dollar(plan.problemToPose) : "";
  const pick = <T,>(arr: T[], used: (v: T) => boolean = () => false) => pickVariant(arr, seed, used);
  const lastQ = ctx.state.lastTutorQuestion;

  switch (plan.strategy) {
    case "EMPATHIZE_AND_SHRINK":
      return { message: lead("Okay lang 'yan, normal na mahirapan sa paksang ito, at sumusubok ka pa rin. Gawin nating napakaliit ang hakbang."), question: en.question };
    case "SUGGEST_TEACHER":
      return { message: "Medyo mahirap ang bahaging ito, at okay lang iyon. Magandang itanong din ito sa guro o sa kaklase mo, at mag-iiwan ako ng tala para sa guro mo.", question: en.question };
    case "NUDGE_TO_RESPOND":
      return { message: "Walang pagmamadali.", question: pick(["Ano ang unang naiisip mo, kahit hindi ka sigurado?", "Kung huhulaan mo ang unang hakbang, ano kaya ito?"], (q) => lastQ === q) };
    case "CELEBRATE_AND_NEXT":
      return { message: `Nalutas mo nang mag-isa ang bagong problema, kaya malinaw na naiintindihan mo ang "${lessonName(ctx)}". Magaling!`, question: "Gusto mo ba ng mas mahirap, isa pang kapareho, o handa ka na sa susunod?" };
    case "CONFIRM_AND_PROBE":
      return {
        message: pick([`Tama, ${att !== undefined ? att + " " : ""}ang sagot! Magaling ang pag-iisip mo.`, `Tama${att !== undefined ? `: ${att}` : ""}! Salamat sa pagtiyaga mo.`], (m) => ctx.state.recentTutorMessages.includes(m)),
        question: pick(["Paano mo nalaman na iyon ang sagot?", "Anong ideya o patakaran ang ginamit mo?", "Maipapaliwanag mo ba ang iniisip mo sa isa o dalawang pangungusap?"], (q) => lastQ === q),
      };
    case "REDIRECT_TO_THINKING":
      return { message: lead("Naiintindihan kong gusto mo nang malaman ang sagot. Tutulungan kitang hanapin ito para kaya mo na sa susunod."), question: en.question };
    case "ASK_FOR_REASONING":
      return { message: lead("Hindi pa iyon ang sagot, pero gusto kong malaman kung paano mo nakuha."), question: pick(["Paano mo ito nakuha, ano ang una mong ginawa?", "Anong mga hakbang ang ginawa mo para makuha ito?"], (q) => lastQ === q) };
    case "ASK_WHAT_THEY_THINK":
      return { message: lead(p ? `Alamin natin kung nasaan ka na sa ${dollar(p)}.` : "Alamin natin kung nasaan ka na."), question: pick(["Ano na ang nasubukan mo, o ano sa tingin mo ang unang hakbang?", "Ano ang una mong gagawin, kahit hindi ka pa sigurado?"], (q) => lastQ === q) };
    case "OPEN_PROBLEM":
      return { message: lead(p ? `Gawin natin ito nang magkasama: ${dollar(p)}. Gagabayan kita, hindi ko ito lulutasin para sa iyo.` : "Gawin natin ito nang magkasama. Gagabayan kita, hindi ko ito lulutasin para sa iyo."), question: "Ano ang napapansin mo sa problema, at ano ang hinihingi nito?" };
    case "TRANSFER_PROBLEM":
      return { message: lead(`Subukan mo ang bago nang mag-isa, walang hint: ${posed}.`), question: "Ano ang sagot mo?" };
    case "SIMPLER_PROBLEM":
      return { message: lead(`Subukan muna natin ang mas madali bago bumalik sa una: ${posed}.`), question: "Ano ang sagot mo dito?" };
    case "HARDER_PROBLEM":
      return { message: lead(`Handa ka na sa mas mahirap na hamon. Subukan ito: ${posed}.`), question: "Ano ang sagot mo?" };
    case "REDIRECT_OFF_TOPIC":
      return { message: "Sa math lesson mo lang kita matutulungan, kaya bumalik tayo roon.", question: p ? `Balik na ba tayo sa ${dollar(p)}?` : `Balik na ba tayo sa ${lessonName(ctx)}?` };
    default: {
      // Math-heavy strategies keep their English content with a Filipino acknowledgement in front.
      return { message: ack && !en.message.startsWith(ack) ? [ack, stripEnglishAck(en.message)].filter(Boolean).join(" ") : en.message, question: en.question, citedSourceIds: en.citedSourceIds };
    }
  }
}

/** Remove the leading English acknowledgement the EN draft added (so it is not doubled in Taglish). */
function stripEnglishAck(message: string): string {
  return message
    .replace(/^(Thanks for trying [^.]*\.|I can see you gave [^.]*\.|Good that you committed to an answer, [^.]*\.|[^.]* is a real attempt, and that helps me see your thinking\.)\s*/i, "")
    .replace(/^(That's okay, a lot of people find this tricky at first\.|No problem, let's slow down together\.|Still unclear, and thanks for telling me\. Let me explain it differently this time\.|Thanks for being honest that it's not clear yet\. Let me try another angle\.|I can tell this is still not clicking, and that's okay\. I'll take a completely different route\.|It's still fuzzy, and that tells me my explanation needs to change, not you\.|We've tried a few ways already\. Let's slow right down and go much smaller\.|Let's try yet another way, because one of them should click\.)\s*/i, "")
    .replace(/^(I like that you explained your thinking \([^)]*\)\.|Thanks for sharing your reasoning \([^)]*\)\.)\s*/i, "");
}
