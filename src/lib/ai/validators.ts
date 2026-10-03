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

      return {
        responseType,
        message,
        guidingQuestion,
        hintLevel,
        encouragement,
        nextStep,
      };
    }
  } catch {
    // JSON parsing failed; if the rawText looks like natural text, use it safely
    if (rawText.length > 10 && rawText.length < 1500 && !rawText.includes("{") && !rawText.includes("```")) {
      return {
        responseType: "HINT",
        message: sanitizeMessage(rawText.trim()),
        hintLevel: 1,
        encouragement: "Keep trying!",
      };
    }
  }

  return generateFallbackTutorResponse(context);
}

function sanitizeMessage(text: string): string {
  // Strip control characters, keep standard printable text and common markdown/math
  return text
    .replace(/[\u0000-\u0008\u000B-\u000C\u000E-\u001F]/g, "")
    .slice(0, 2000); // Cost/DoS safeguard: limit single message length
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

