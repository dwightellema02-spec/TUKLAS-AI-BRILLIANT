/**
 * Phase 23: Reading the student. Deterministic, inspectable classification of the latest message.
 * Intentionally conservative: when unsure it returns OTHER so the planner asks a clarifying question
 * rather than assuming.
 */

import { findNumberInText, normalizeMath, parseBinaryProblem } from "./arith";
import type { StudentIntent, StudentSignal } from "./types";

const OFF_TOPIC = /\b(celebrity|movie|song|recipe|weather|girlfriend|boyfriend|politic|ignore (all )?(previous|prior)|system prompt|act as|jailbreak|\bdan\b|password|api key)\b/i;
const REQUEST_ANSWER = /(what('| i)?s? the answer|give me the answer|just tell me|tell me the answer|answer (please|pls|now)|what do i (put|write|type)|solve (it|this) for me|show me the answer|i want the answer|^\s*answer\s*\??\s*$|the answer is\s*\?|can you (just )?(tell|give) me (the )?(answer|solution))/i;
const DONT_KNOW = /\b(i (do not|don'?t|dont) know|no idea|idk|i'?m not sure|not sure|no clue|dunno|i can'?t|i cannot)\b/i;
const CONFUSED = /(confus|(don'?t|do not|dont|didn'?t|did not) (understand|get|follow)|doesn'?t make sense|makes no sense|\blost\b|still (don'?t|do not|dont)|\bhuh\b|unclear|what do you mean|^\s*what\s*\?+\s*$|i('?m| am) (so )?stuck)/i;
const FRUSTRATED = /(this is (so |really |too )?(hard|stupid|dumb|impossible|boring|annoying)|i hate|i give up|\bgive up\b|so annoying|\bugh+\b|\barg+h*\b|frustrat|i'?m (so )?(tired|done)|too hard|\bstupid\b|i can'?t do this|this sucks)/i;
const REQUEST_EXAMPLE = /(an? example|another (one|example)|show me how|similar (problem|one|question)|sample problem|example please|can i see an example)/i;
const REQUEST_EASIER = /(easier|simpler|simple way|more simply|slow(er| down)|baby steps|explain (it )?(more )?simply|too hard|make it easy)/i;
const REQUEST_HARDER = /(harder|more challenging|challenge me|too easy|something difficult|next level|more difficult)/i;
const REQUEST_REVIEW = /(review|recap|summar(y|ize|ise)|go over|remind me|refresher|what did we (learn|cover))/i;
const REQUEST_HINT = /(\bhint\b|\bclue\b|help me|a little help|give me a push|point me)/i;
const REQUEST_EXPLANATION = /(explain|\bwhy\b|how (does|do|come|did)|what (is|are|does)|what's|meaning of|define|tell me about|\brule\b)/i;
const GREETING = /^\s*(hi|hello|hey|hiya|yo|good (morning|afternoon|evening)|kumusta)\b[\s!.,?]*$/i;
const ACKNOWLEDGE = /^\s*(ok(ay)?|k|sure|yes|yeah|yep|yup|alright|thanks?( you)?|thank you|got it|i see|oh|ah+|cool|right|nice|great|noted|sige|opo)[\s!.,?]*$/i;
const HEDGE = /\b(maybe|i think|i guess|probably|perhaps|not sure|is it|could it be|i believe|um+|hmm+)\b|\?\s*$/i;
const REASONING = /\b(because|since|so i|then i|first i|i (added|subtracted|multiplied|divided|did|got|took|used|put|counted)|that'?s why|which (is|means|gives))\b/i;

function isShort(text: string, maxWords = 6): boolean {
  return text.trim().split(/\s+/).filter(Boolean).length <= maxWords;
}

export function classifyStudentMessage(
  rawText: string | undefined | null,
  opts: {
    hasQuestion: boolean;
    structuredAnswer?: unknown;
    helpLevel?: string;
  } = { hasQuestion: false }
): StudentSignal {
  const text = (rawText ?? "").trim();
  const norm = normalizeMath(text);

  // Structured answer from the practice UI always counts as an attempt.
  if (opts.structuredAnswer !== undefined && opts.structuredAnswer !== null && String(opts.structuredAnswer).trim() !== "") {
    const raw = String(opts.structuredAnswer);
    const n = findNumberInText(raw);
    return {
      intent: "ANSWER_ATTEMPT",
      text: text || raw,
      hedged: false,
      frustrated: false,
      confused: false,
      givesReasoning: false,
      attempt: { raw, number: n, choiceLetter: /^[a-d]$/i.test(raw.trim()) ? raw.trim().toLowerCase() : undefined },
    };
  }

  // Button press: no text, intent comes from the requested help level.
  if (text.length === 0) {
    const level = opts.helpLevel ?? "LEVEL_1_HINT";
    const intent: StudentIntent =
      level === "CONCEPT_EXPLANATION" || level === "FULL_EXPLANATION"
        ? "REQUEST_EXPLANATION"
        : level === "WORKED_EXAMPLE"
          ? "REQUEST_EXAMPLE"
          : "REQUEST_HINT";
    return { intent, text: "", hedged: false, frustrated: false, confused: false, givesReasoning: false };
  }

  const frustrated = FRUSTRATED.test(text);
  const confused = CONFUSED.test(text) || DONT_KNOW.test(text);
  const ownProblem = parseBinaryProblem(norm);

  // Attempt extraction
  const number = findNumberInText(norm);
  const letterMatch = /^(?:(?:i (?:choose|pick|think|say|'?ll go with)\s+)?(?:option|letter|choice)?\s*)([a-d])[\s.!?)]*$/i.exec(text) || /\b(?:option|letter|choice)\s+([a-d])\b/i.exec(text);
  const choiceLetter = letterMatch ? letterMatch[1].toLowerCase() : undefined;
  const hedged = HEDGE.test(text);

  const asksAnswer = REQUEST_ANSWER.test(text);
  const explicitAnswer = /\b(answer is|equals|=|is it|i got|i think it'?s|it'?s|result)\b/i.test(text);
  // "because 13 is bigger and positive" mentions a number but is an explanation, not an answer.
  const justExplaining = REASONING.test(text) && !explicitAnswer;
  const looksLikeAttempt =
    (number !== undefined || choiceLetter !== undefined) &&
    !asksAnswer &&
    !justExplaining &&
    (isShort(text, 8) || explicitAnswer);

  let intent: StudentIntent = "OTHER";
  if (OFF_TOPIC.test(text)) intent = "OFF_TOPIC";
  else if (asksAnswer) intent = "REQUEST_ANSWER";
  else if (ownProblem && /\b(what|how|solve|compute|calculate|evaluate|find|help)\b/i.test(text) && !/\b(answer is|i got)\b/i.test(text)) intent = "STUDENT_PROBLEM";
  else if (looksLikeAttempt && opts.hasQuestion) intent = "ANSWER_ATTEMPT";
  else if (looksLikeAttempt && !opts.hasQuestion && /\b(answer is|i got|equals|=|is it)\b/i.test(text)) intent = "ANSWER_ATTEMPT";
  else if (REASONING.test(text) && (!isShort(text, 4) || /^\s*because\b/i.test(text))) intent = "REASONING";
  else if (REQUEST_EXAMPLE.test(text)) intent = "REQUEST_EXAMPLE";
  else if (REQUEST_EASIER.test(text)) intent = "REQUEST_EASIER";
  else if (REQUEST_HARDER.test(text)) intent = "REQUEST_HARDER";
  else if (REQUEST_REVIEW.test(text)) intent = "REQUEST_REVIEW";
  else if (REQUEST_HINT.test(text)) intent = "REQUEST_HINT";
  else if (CONFUSED.test(text)) intent = "CONFUSED";
  else if (DONT_KNOW.test(text)) intent = "DONT_KNOW";
  else if (frustrated) intent = "FRUSTRATED";
  else if (GREETING.test(text)) intent = "GREETING";
  else if (ACKNOWLEDGE.test(text)) intent = "ACKNOWLEDGE";
  else if (REQUEST_EXPLANATION.test(text)) intent = "REQUEST_EXPLANATION";
  else if (number !== undefined && isShort(text, 3) && opts.hasQuestion) intent = "ANSWER_ATTEMPT";

  const signal: StudentSignal = {
    intent,
    text,
    hedged: hedged && (intent === "ANSWER_ATTEMPT" || intent === "DONT_KNOW"),
    frustrated,
    confused,
    givesReasoning: REASONING.test(text) && (!isShort(text, 4) || /^\s*because\b/i.test(text)),
  };
  if (intent === "ANSWER_ATTEMPT") signal.attempt = { raw: text, number, choiceLetter };
  if (intent === "STUDENT_PROBLEM" && ownProblem) signal.ownProblem = ownProblem;
  return signal;
}
