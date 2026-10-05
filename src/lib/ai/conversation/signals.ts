/**
 * Phase 23/24: Reading the student. Deterministic, inspectable classification of the latest message.
 * Understands English and everyday Filipino/Taglish (the way Grade 7 students actually type).
 * Intentionally conservative: when unsure it returns OTHER so the planner asks a clarifying question
 * rather than assuming.
 *
 * NOTE: the Filipino phrase lists are a best-effort starting set written without a native-speaker review.
 * They must be reviewed and extended with real student messages (see docs/PHASE_24_VERIFICATION.md).
 */

import { findNumberInText, normalizeMath, parseAnyProblem, parseTruth } from "./arith";
import type { StudentIntent, StudentSignal } from "./types";

const OFF_TOPIC = /\b(celebrity|movie|song|recipe|weather|girlfriend|boyfriend|crush|politic|ignore (all )?(previous|prior)|system prompt|act as|jailbreak|\bdan\b|password|api key)\b/i;
const REQUEST_ANSWER = /(what('| i)?s? the answer|give me the answer|just tell me|tell me the answer|answer (please|pls|now)|what do i (put|write|type)|solve (it|this) for me|show me the answer|i want the answer|^\s*answer\s*\??\s*$|the answer is\s*\?|can you (just )?(tell|give) me (the )?(answer|solution)|\bano (po )?(ba )?(ang|yung|yong)? ?(sagot|answer)\b|\bpasagot\b|\bsagutin mo na\b|\bpakisabi (na )?(ang )?sagot\b|\bsabihin mo (na )?(ang )?sagot\b|^\s*sagot( po)?\s*\??\s*$)/i;
const DONT_KNOW = /\b(i (do not|don'?t|dont) know|no idea|idk|i'?m not sure|not sure|no clue|dunno|i can'?t|i cannot|hindi ko (po )?alam|di ko (po )?alam|ewan ko|wala akong (idea|alam)|hindi ako sigurado|di ako sigurado)\b/i;
const CONFUSED = /(confus|(don'?t|do not|dont|didn'?t|did not) (understand|get|follow)|doesn'?t make sense|makes no sense|\blost\b|still (don'?t|do not|dont)|\bhuh\b|unclear|what do you mean|^\s*what\s*\?+\s*$|i('?m| am) (so )?stuck|(hindi|di) ko (po )?(gets|magets|ma-gets|maintindihan|naiintindihan|nakuha|gets pa)|(hindi|di) (ko )?(pa )?(rin )?(gets|maintindihan|malinaw)|\bnalilito\b|\bnaguguluhan\b|\bang labo\b|\bhindi malinaw\b|\bpaki-?ulit\b|\bulitin (mo|po)\b)/i;
const FRUSTRATED = /(this is (so |really |too )?(hard|stupid|dumb|impossible|boring|annoying)|i hate|i give up|\bgive up\b|so annoying|\bugh+\b|\barg+h*\b|frustrat|i'?m (so )?(tired|done)|too hard|\bstupid\b|i can'?t do this|this sucks|\b(ang |sobrang |sobra )?hirap (naman|talaga|po|nito|sobra)\b|\bsobrang hirap\b|\bayoko na\b|\bsuko na\b|\bnakakainis\b|\bpagod na\b|\bnakakapagod\b|\bhindi ko kaya\b|\bdi ko kaya\b)/i;
const REQUEST_EXAMPLE = /(an? example|another (one|example)|show me how|similar (problem|one|question)|sample problem|example please|can i see an example|\bhalimbawa\b|\bpa-?example\b|\bexample po\b|\bmay (iba|isa pa)( pa)? (po )?(bang )?(example|halimbawa)\b|\bpakita (po )?(ng|mo) (example|halimbawa)\b)/i;
const REQUEST_EASIER = /(easier|simpler|simple way|more simply|slow(er| down)|baby steps|explain (it )?(more )?simply|too hard|make it easy|\bmas (madali|simple|payak)\b|\bpasimple\b|\bdahan-?dahan\b|\bmadali lang po\b)/i;
const REQUEST_HARDER = /(harder|more challenging|challenge me|too easy|something difficult|next level|more difficult|\bmas mahirap\b|\bang dali( naman| lang)?\b|\bmadali lang\b|\bsobrang dali\b|\bmas mahirap pa\b)/i;
const REQUEST_REVIEW = /(review|recap|summar(y|ize|ise)|go over|remind me|refresher|what did we (learn|cover)|\bbalik-?aral\b|\bpaalala\b)/i;
const REQUEST_HINT = /(\bhint\b|\bclue\b|help me|a little help|give me a push|point me|\btulong\b|\btulungan (mo )?(ako|po)\b|\bpaki-?hint\b|\bhint po\b|\bclue po\b)/i;
const REQUEST_EXPLANATION = /(explain|\bwhy\b|how (does|do|come|did)|what (is|are|does)|what's|meaning of|define|tell me about|\brule\b|\bpaliwanag\b|\bipaliwanag\b|\bpaki-?explain\b|\bbakit\b|\bpaano (po )?(ba )?(ang|yung|yong|ito|nag)?\b|\bano (po )?(ba )?(ang|yung|yong) (ibig sabihin|ibig)?\b|\bano ang\b|\bano po ang\b|\bano yung\b|\bano ba ang\b)/i;
const GREETING = /^\s*(hi|hello|hey|hiya|yo|good (morning|afternoon|evening)|kumusta|kamusta|magandang (umaga|hapon|gabi)|hello po|hi po|musta)( po| ma'?am| sir)?\b[\s!.,?]*$/i;
const ACKNOWLEDGE = /^\s*(ok(ay)?( po)?|k|sure|yes|yeah|yep|yup|alright|thanks?( you)?|thank you|got it|i see|oh|ah+|cool|right|nice|great|noted|sige( po)?|opo|oo|salamat( po)?|ayos|ah ok(ay)?( po)?|ganun ba|ah talaga)[\s!.,?]*$/i;
const HEDGE = /\b(maybe|i think|i guess|probably|perhaps|not sure|is it|could it be|i believe|um+|hmm+|siguro|baka|parang|yata|ata|ito ba|ba ang sagot|tama ba)\b|\?\s*$/i;
const REASONING = /\b(because|since|so i|then i|first i|i (added|subtracted|multiplied|divided|did|got|took|used|put|counted)|that'?s why|which (is|means|gives)|kasi|dahil|kaya|dinagdagan ko|binawasan ko|ginawa ko|nag-?add ako|nag-?subtract ako|pinagsama ko)\b/i;
const EXPLICIT_ANSWER = /\b(answer is|equals|=|is it|i got|i think it'?s|it'?s|result|ang sagot( ko)? (ay|ko)|sagot ko|ito ba|ba ang sagot|nakuha ko|ang nakuha ko)\b/i;

// Markers that identify Filipino/Taglish text (distinctive words that are not English).
const FILIPINO_MARKERS = /\b(po|opo|ko|mo|hindi|di|ba|naman|kasi|yung|yong|yun|ano|paano|bakit|sige|salamat|lang|gets|ewan|hirap|sagot|tulong|ayoko|suko|tama|mali|dahil|kaya|siguro|baka|nalilito|naguguluhan|maintindihan|halimbawa|paliwanag|kumusta|kamusta|ako|ikaw|namin|natin|talaga|sobra|sobrang|pwede|puwede|pasagot|balik-?aral|dinagdagan|binawasan)\b/i;

function isShort(text: string, maxWords = 6): boolean {
  return text.trim().split(/\s+/).filter(Boolean).length <= maxWords;
}

export function classifyStudentMessage(
  rawText: string | undefined | null,
  opts: {
    hasQuestion: boolean;
    structuredAnswer?: unknown;
    helpLevel?: string;
    /** True when a true/false answer is expected (a comparison problem or a TRUE_FALSE question). */
    expectTruth?: boolean;
  } = { hasQuestion: false }
): StudentSignal {
  const text = (rawText ?? "").trim();
  const norm = normalizeMath(text);
  const language: "EN" | "TL" = FILIPINO_MARKERS.test(text) ? "TL" : "EN";

  // Structured answer from the practice UI always counts as an attempt.
  if (opts.structuredAnswer !== undefined && opts.structuredAnswer !== null && String(opts.structuredAnswer).trim() !== "") {
    const raw = String(opts.structuredAnswer);
    const n = findNumberInText(raw);
    const truth = parseTruth(raw);
    return {
      intent: "ANSWER_ATTEMPT",
      text: text || raw,
      language,
      hedged: false,
      frustrated: false,
      confused: false,
      givesReasoning: false,
      attempt: { raw, number: n, choiceLetter: /^[a-d]$/i.test(raw.trim()) ? raw.trim().toLowerCase() : undefined, truth: opts.expectTruth ? truth : undefined },
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
    return { intent, text: "", language: "EN", hedged: false, frustrated: false, confused: false, givesReasoning: false };
  }

  const frustrated = FRUSTRATED.test(text);
  const confused = CONFUSED.test(text) || DONT_KNOW.test(text);
  const ownProblem = parseAnyProblem(norm);

  // A bare true/false answer when one is expected
  const truth = opts.expectTruth ? parseTruth(text.replace(/\b(ba|siguro|yata|ata|baka|maybe|i think)\b/gi, " ")) : undefined;

  // Attempt extraction
  const number = findNumberInText(norm);
  const letterMatch = /^(?:(?:i (?:choose|pick|think|say|'?ll go with)\s+)?(?:option|letter|choice)?\s*)([a-d])[\s.!?)]*$/i.exec(text) || /\b(?:option|letter|choice)\s+([a-d])\b/i.exec(text);
  const choiceLetter = letterMatch ? letterMatch[1].toLowerCase() : undefined;
  const hedged = HEDGE.test(text);

  const asksAnswer = REQUEST_ANSWER.test(text);
  const explicitAnswer = EXPLICIT_ANSWER.test(text);
  // "because 13 is bigger and positive" mentions a number but is an explanation, not an answer.
  const justExplaining = REASONING.test(text) && !explicitAnswer;
  const looksLikeAttempt =
    (number !== undefined || choiceLetter !== undefined || truth !== undefined) &&
    !asksAnswer &&
    !justExplaining &&
    (isShort(text, 8) || explicitAnswer);

  let intent: StudentIntent = "OTHER";
  if (OFF_TOPIC.test(text)) intent = "OFF_TOPIC";
  else if (asksAnswer) intent = "REQUEST_ANSWER";
  else if (ownProblem && /\b(what|how|solve|compute|calculate|evaluate|find|help|ano|paano|ilan|tulungan|pasolve)\b/i.test(text) && !/\b(answer is|i got|ang sagot|nakuha ko)\b/i.test(text)) intent = "STUDENT_PROBLEM";
  else if (looksLikeAttempt && opts.hasQuestion) intent = "ANSWER_ATTEMPT";
  else if (looksLikeAttempt && !opts.hasQuestion && explicitAnswer) intent = "ANSWER_ATTEMPT";
  else if (REASONING.test(text) && (!isShort(text, 4) || /^\s*(because|kasi|dahil)\b/i.test(text))) intent = "REASONING";
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
    language,
    hedged: hedged && (intent === "ANSWER_ATTEMPT" || intent === "DONT_KNOW"),
    frustrated,
    confused,
    givesReasoning: REASONING.test(text) && (!isShort(text, 4) || /^\s*(because|kasi|dahil)\b/i.test(text)),
  };
  if (intent === "ANSWER_ATTEMPT") signal.attempt = { raw: text, number, choiceLetter, truth };
  if (intent === "STUDENT_PROBLEM" && ownProblem) signal.ownProblem = ownProblem;
  return signal;
}
