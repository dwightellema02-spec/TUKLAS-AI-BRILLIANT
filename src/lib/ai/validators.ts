// Phase 7: AI Output Validation & Sanitization

import type {
  AITutorContext,
  StructuredTutorResponse,
  AITutorMessageType,
  StructuredMistakeAnalysis,
  MistakeCategoryType,
} from "./types";

const VALID_RESPONSE_TYPES: AITutorMessageType[] = [
  "QUESTION",
  "HINT",
  "GUIDING_QUESTION",
  "EXPLANATION",
  "EXAMPLE",
  "FEEDBACK",
  "CLARIFICATION",
  "REDIRECT",
];

// Patterns that indicate potential prompt injection leakage or system internal echoes
const FORBIDDEN_LEAK_PATTERNS = [
  /AI_API_KEY/i,
  /GEMINI_API_KEY/i,
  /system\s*prompt/i,
  /internal\s*instructions/i,
  /passwordHash/i,
  /DATABASE_URL/i,
  /postgres(?:ql)?:\/\/\S+/i,
  /\bAIza[0-9A-Za-z_\-]{20,}/,
  /\bsk-[A-Za-z0-9_\-]{20,}/,
  /AUTH_SECRET/i,
  /BEGIN (?:RSA |EC )?PRIVATE KEY/,
];

export function validateTutorOutput(rawText: string, context: AITutorContext): StructuredTutorResponse {
  if (!rawText || typeof rawText !== "string" || rawText.trim().length === 0) {
    return generateFallbackTutorResponse(context);
  }

  // 1. Check for sensitive pattern leakage
  for (const pattern of FORBIDDEN_LEAK_PATTERNS) {
    if (pattern.test(rawText)) {
      return {
        responseType: "REDIRECT",
        message: "Let's focus on your mathematics lesson and work through the problem step by step.",
        guidingQuestion: "What is the first step you should take here?",
        hintLevel: 1,
        encouragement: "Let's keep going!",
      };
    }
  }

  // 2. Extract JSON payload
  let jsonString = rawText.trim();
  const jsonBlockMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (jsonBlockMatch && jsonBlockMatch[1]) {
    jsonString = jsonBlockMatch[1].trim();
  }

  // Also try finding the outermost { ... }
  const firstBrace = jsonString.indexOf("{");
  const lastBrace = jsonString.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    jsonString = jsonString.substring(firstBrace, lastBrace + 1);
  }

  try {
    const parsed = JSON.parse(jsonString);

    if (parsed && typeof parsed === "object") {
      let responseType: AITutorMessageType = "HINT";
      if (parsed.responseType && VALID_RESPONSE_TYPES.includes(parsed.responseType as AITutorMessageType)) {
        responseType = parsed.responseType as AITutorMessageType;
      }

      let message = "";
      if (typeof parsed.message === "string" && parsed.message.trim().length > 0) {
        message = sanitizeMessage(parsed.message.trim());
      } else {
        message = "Let's review this concept together step by step.";
      }

      const guidingQuestion =
        typeof parsed.guidingQuestion === "string" && parsed.guidingQuestion.trim().length > 0
          ? sanitizeMessage(parsed.guidingQuestion.trim())
          : undefined;

      const hintLevel = typeof parsed.hintLevel === "number" ? parsed.hintLevel : 1;
      const encouragement =
        typeof parsed.encouragement === "string" ? sanitizeMessage(parsed.encouragement.trim()) : "You can do this!";
      const nextStep = typeof parsed.nextStep === "string" ? sanitizeMessage(parsed.nextStep.trim()) : undefined;

      const citedSourceIds = Array.isArray(parsed.citedSourceIds)
        ? parsed.citedSourceIds.filter((x: unknown): x is string => typeof x === "string")
        : [];

      return enforceGrounding(
        { responseType, message, guidingQuestion, hintLevel, encouragement, nextStep, citedSourceIds },
        context
      );
    }
  } catch {
    // JSON parsing failed; if the rawText looks like natural text, use it safely
    if (rawText.length > 10 && rawText.length < 1500 && !rawText.includes("{") && !rawText.includes("```")) {
      return enforceGrounding(
        {
          responseType: "HINT",
          message: sanitizeMessage(rawText.trim()),
          hintLevel: 1,
          encouragement: "Keep trying!",
        },
        context
      );
    }
  }

  return generateFallbackTutorResponse(context);
}

// -------------------------------------------------------------
// PHASE 22: GROUNDING ENFORCEMENT (hallucination protection)
// -------------------------------------------------------------

// Phrases that attribute content to a specific attached resource.
const DOCUMENT_CLAIM = /\b(?:the|your|this|that)\s+(?:pdf|docx?|document|worksheet|handout|module|las|activity sheet|learning activity sheet|file|teacher'?s? (?:notes?|materials?|handout))\b[^.?!\n]{0,40}\b(?:says?|said|states?|stated|shows?|showed|explains?|explained|mentions?|mentioned|describes?|described|lists?|contains?|defines?)\b|\baccording to (?:the|your|this)\s+(?:pdf|docx?|document|worksheet|handout|module|las|activity sheet|file|teacher)/i;
const VIDEO_CLAIM = /\b(?:in|from|the)\s+(?:the|this|that|your)\s+(?:video|mathisipan|youtube)\b[^.?!\n]{0,40}\b(?:says?|said|shows?|showed|explains?|explained|mentions?|mentioned|demonstrates?|demonstrated|teaches?)\b|\b(?:as|when) (?:you|we) (?:saw|watched) in the video\b|\bthe video (?:says?|said|shows?|showed|explains?|explained|mentions?|mentioned|demonstrates?)\b/i;

const HONEST_NO_SOURCE_MESSAGE =
  "I can't see that part of your learning materials, so I don't want to guess what it says. Let's use the idea behind it instead.";

/**
 * Verifies the model's source citations against what was actually retrieved and blocks claims
 * about resources the tutor never had access to. Pure function of (response, context).
 */
export function enforceGrounding(
  response: StructuredTutorResponse,
  context: AITutorContext
): StructuredTutorResponse {
  const sources = context.grounding?.sources ?? [];
  const validIds = new Set(sources.map((s) => s.sourceId));

  // 1. Keep only citations that exist; also harvest inline markers like [S1] / (S2).
  const inline = [...response.message.matchAll(/[\[(]\s*(S\d+)\s*[\])]/g)].map((m) => m[1]);
  const cited = [...new Set([...(response.citedSourceIds ?? []), ...inline])].filter((id) => validIds.has(id));

  // Remove inline markers (the UI renders citations separately) so students never see raw ids.
  let message = response.message.replace(/\s*[\[(]\s*S\d+\s*[\])]/g, "");
  let guidingQuestion = response.guidingQuestion?.replace(/\s*[\[(]\s*S\d+\s*[\])]/g, "");

  // 2. Resource-attribution claims without supporting retrieved source => replace with an honest message.
  const claimText = `${message} ${guidingQuestion ?? ""}`;
  const claimsDocument = DOCUMENT_CLAIM.test(claimText);
  const claimsVideo = VIDEO_CLAIM.test(claimText);
  // No video transcript exists in this phase: any claim about video content is unsupported.
  const unsupportedDocumentClaim = claimsDocument && cited.length === 0;

  if (unsupportedDocumentClaim || claimsVideo) {
    message = HONEST_NO_SOURCE_MESSAGE;
    return {
      ...response,
      responseType: "CLARIFICATION",
      message,
      guidingQuestion: "Which step of the problem would you like to think through first?",
      citedSourceIds: [],
    };
  }

  return { ...response, message, guidingQuestion, citedSourceIds: cited };
}

/**
 * What may reach a student's screen from the model: plain text and LaTeX only. Markup, links and images are removed
 * (a tutor has no reason to send them, and a link or tracking image in a tutor message is how a tricked model would
 * pull a child off the platform or leak the conversation).
 */
export function sanitizeMessage(text: string): string {
  let t = text
    .replace(/[\u0000-\u0008\u000B-\u000C\u000E-\u001F\u200B-\u200F\u2060\uFEFF]/g, "")
    // elements whose content is code or hidden: drop with their content
    .replace(/<\s*(script|style|iframe|object|embed|svg|template|noscript)\b[\s\S]*?<\s*\/\s*\1\s*>/gi, " ")
    // any other known tag (opening, closing or self-closing); "a<b and c>d" in maths is not a known tag
    .replace(/<\/?\s*(?:script|style|iframe|object|embed|svg|template|noscript|img|link|meta|form|input|button|html|head|body|div|span|br|hr|table|thead|tbody|tr|td|th|ul|ol|li|h[1-6]|video|audio|source|math|em|strong|font|center|marquee|base|frame|frameset|applet)\b[^>]*>/gi, " ")
    .replace(/<\/?\s*(?:a|b|i|u|p)(?:\s+[a-z\-]+\s*=[^>]*)?\s*\/?>/gi, " ")
    // markdown images and links: keep the words, drop the target
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\((?:[^)]*)\)/g, "$1")
    // bare addresses
    .replace(/\b(?:https?|ftp|file|data|javascript|vbscript):[^\s)]*/gi, " ")
    .replace(/\bwww\.[^\s)]+/gi, " ")
    .replace(/[ \t]{2,}/g, " ");
  return t.trim().slice(0, 2000); // Cost/DoS safeguard: limit single message length
}

export function generateFallbackTutorResponse(context: AITutorContext): StructuredTutorResponse {
  const targetSkill = context.skill?.title || context.lesson?.title || "this math concept";

  if (context.helpLevel === "LEVEL_1_HINT") {
    return {
      responseType: "HINT",
      message: `Take a moment to review the rule for ${targetSkill}. Remember that every positive and negative number has a position on the number line.`,
      guidingQuestion: "Which direction on the number line represents greater values?",
      hintLevel: 1,
      encouragement: "Take it one step at a time!",
      nextStep: "Identify the signs of the numbers first.",
    };
  }

  if (context.helpLevel === "LEVEL_2_HINT") {
    return {
      responseType: "HINT",
      message: `On a standard number line, numbers farther to the right are always greater than numbers to the left. For negative numbers, numbers closer to zero have a larger value.`,
      guidingQuestion: "Between the two numbers, which one is closer to zero or farther to the right?",
      hintLevel: 2,
      encouragement: "You're getting closer!",
    };
  }

  if (context.helpLevel === "GUIDING_QUESTION") {
    return {
      responseType: "GUIDING_QUESTION",
      message: `Let's break this down. What are the signs of the numbers involved in this problem?`,
      guidingQuestion: "Are both numbers positive, both negative, or different signs?",
      hintLevel: 1,
      encouragement: "Focus on the signs first!",
    };
  }

  if (context.helpLevel === "CONCEPT_EXPLANATION") {
    return {
      responseType: "EXPLANATION",
      message: `In Grade 7 Mathematics, integers include all positive whole numbers, zero, and negative whole numbers ($... -3, -2, -1, 0, 1, 2, 3 ...$). When comparing integers, any positive number is greater than any negative number. Between two negative numbers, the one with the smaller absolute value is greater.`,
      guidingQuestion: "How does this rule apply to the numbers in your problem?",
      hintLevel: 2,
      encouragement: "Reviewing the concept helps build strong fundamentals!",
    };
  }

  return {
    responseType: "HINT",
    message: `Let's look at this step by step. What operation or property do you think applies here for ${targetSkill}?`,
    guidingQuestion: "Can you identify what the question is asking you to find?",
    hintLevel: 1,
    encouragement: "You're doing great — let's solve it together!",
  };
}

// -------------------------------------------------------------
// PHASE 8: MISTAKE ANALYSIS VALIDATOR
// -------------------------------------------------------------

const VALID_MISTAKE_CATEGORIES: MistakeCategoryType[] = [
  "CALCULATION_ERROR",
  "CONCEPTUAL_MISUNDERSTANDING",
  "PREREQUISITE_GAP",
  "APPLICATION_DIFFICULTY",
  "SIGN_ERROR",
  "PROCEDURAL_ERROR",
  "READING_OR_INTERPRETATION_ERROR",
  "INCONSISTENT_PERFORMANCE",
  "POSSIBLE_CARELESS_ERROR",
  "QUESTION_TYPE_DIFFICULTY",
  "UNKNOWN",
];

export function validateMistakeAnalysisOutput(
  rawText: string,
  validAttemptIds: string[],
  fallback: StructuredMistakeAnalysis
): StructuredMistakeAnalysis {
  if (!rawText || typeof rawText !== "string" || rawText.trim().length === 0) {
    return fallback;
  }

  // 1. Check for sensitive pattern leakage
  for (const pattern of FORBIDDEN_LEAK_PATTERNS) {
    if (pattern.test(rawText)) {
      return fallback;
    }
  }

  // 2. Extract JSON payload
  let jsonString = rawText.trim();
  const jsonBlockMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (jsonBlockMatch && jsonBlockMatch[1]) {
    jsonString = jsonBlockMatch[1].trim();
  }

  const firstBrace = jsonString.indexOf("{");
  const lastBrace = jsonString.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    jsonString = jsonString.substring(firstBrace, lastBrace + 1);
  }

  try {
    const parsed = JSON.parse(jsonString);

    if (parsed && typeof parsed === "object") {
      // Validate category
      let category: MistakeCategoryType = fallback.category;
      if (
        parsed.category &&
        VALID_MISTAKE_CATEGORIES.includes(parsed.category as MistakeCategoryType)
      ) {
        category = parsed.category as MistakeCategoryType;
      }

      // Validate & sanitize observation
      const observation =
        typeof parsed.observation === "string" && parsed.observation.trim().length > 0
          ? sanitizeMessage(parsed.observation.trim())
          : fallback.observation;

      // Validate & sanitize pattern
      const pattern =
        typeof parsed.pattern === "string" && parsed.pattern.trim().length > 0
          ? sanitizeMessage(parsed.pattern.trim())
          : fallback.pattern;

      // Validate & sanitize possibleCause
      const possibleCause =
        typeof parsed.possibleCause === "string" && parsed.possibleCause.trim().length > 0
          ? sanitizeMessage(parsed.possibleCause.trim())
          : fallback.possibleCause;

      // Validate confidence (must be between 0.0 and 1.0)
      let confidence = fallback.confidence;
      if (typeof parsed.confidence === "number" && !isNaN(parsed.confidence)) {
        confidence = Math.max(0.0, Math.min(1.0, Number(parsed.confidence.toFixed(2))));
      }

      // Validate & sanitize recommendation
      const recommendation =
        typeof parsed.recommendation === "string" && parsed.recommendation.trim().length > 0
          ? sanitizeMessage(parsed.recommendation.trim())
          : fallback.recommendation;

      // VALIDATE EVIDENCE: AI MUST NOT INVENT ATTEMPTS
      // Only retain attempt IDs that actually exist in the supplied validAttemptIds set
      const validIdSet = new Set(validAttemptIds);
      let evidenceAttemptIds: string[] = [];

      if (Array.isArray(parsed.evidenceAttemptIds)) {
        evidenceAttemptIds = parsed.evidenceAttemptIds
          .map((id: any) => String(id).trim())
          .filter((id: string) => validIdSet.has(id));
      }

      // If AI didn't return any valid IDs, default to fallback's valid IDs
      if (evidenceAttemptIds.length === 0) {
        evidenceAttemptIds = fallback.evidenceAttemptIds;
      }

      return {
        category,
        observation,
        pattern,
        possibleCause,
        confidence,
        recommendation,
        evidenceAttemptIds,
      };
    }
  } catch {
    // JSON parse failed, use safe fallback
  }

  return fallback;
}

