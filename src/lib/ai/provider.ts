// Phase 7: AI Provider Abstraction

import { GoogleGenAI } from "@google/genai";
import type { AIProvider, TutorAIRequest, TutorAIResponseRaw } from "./types";

/**
 * Default Gemini model. Override with AI_MODEL. The name is validated for shape only;
 * a rejected/unknown model surfaces as a provider error and triggers the local fallback.
 */
export const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";
const MODEL_NAME_PATTERN = /^[a-z0-9][a-z0-9.\-]{2,63}$/;

export function resolveGeminiModel(requested?: string): string {
  const candidate = (requested || process.env.AI_MODEL || "").trim();
  if (!candidate) return DEFAULT_GEMINI_MODEL;
  if (!MODEL_NAME_PATTERN.test(candidate)) {
    console.warn(`Invalid AI_MODEL "${candidate}" ignored; using ${DEFAULT_GEMINI_MODEL}.`);
    return DEFAULT_GEMINI_MODEL;
  }
  return candidate;
}

export class GeminiAIProvider implements AIProvider {
  readonly name = "gemini";
  readonly defaultModel = DEFAULT_GEMINI_MODEL;
  private ai: GoogleGenAI;
  private model: string;

  constructor(apiKey?: string, model?: string) {
    const key = apiKey || process.env.GEMINI_API_KEY || process.env.AI_API_KEY;
    if (!key) {
      throw new Error("Gemini API key is required but neither GEMINI_API_KEY nor AI_API_KEY was provided.");
    }
    this.ai = new GoogleGenAI({ apiKey: key });
    this.model = resolveGeminiModel(model);
  }

  async generateTutorResponse(request: TutorAIRequest): Promise<TutorAIResponseRaw> {
    const timeoutMs = request.timeoutMs || 15000;

    const generatePromise = this.ai.models.generateContent({
      model: this.model,
      contents: request.userPrompt,
      config: {
        systemInstruction: request.systemPrompt,
        maxOutputTokens: request.maxTokens || 600,
        temperature: request.temperature !== undefined ? request.temperature : 0.4,
        responseMimeType: "application/json",
      },
    });

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("AI Tutor request timed out after 15 seconds.")), timeoutMs)
    );

    const response = await Promise.race([generatePromise, timeoutPromise]);
    const responseText = response.text || "";

    return {
      text: responseText,
      tokenUsage: {
        promptTokens: response.usageMetadata?.promptTokenCount,
        completionTokens: response.usageMetadata?.candidatesTokenCount,
        totalTokens: response.usageMetadata?.totalTokenCount,
      },
      provider: this.name,
      model: this.model,
    };
  }
}

function wantsLessonHelp(text: string): boolean {
  return /\b(explain|what is|what are|what does|meaning|define|rule|how (do|does|to)|lesson|notes?|pdf|document|worksheet|handout|module|example|understand|confus|don'?t get|stuck)\b/i.test(text);
}

/** Pick the sentence(s) in a source that best overlap the student's words. */
function bestExcerpt(sourceText: string, query: string): string {
  const qTokens = new Set(
    query.toLowerCase().match(/[a-z]{3,}|-?\d+/g) ?? []
  );
  const sentences = sourceText.replace(/\s+/g, " ").match(/[^.!?]+[.!?]*/g) ?? [sourceText];
  let best = sentences[0] ?? sourceText;
  let bestScore = -1;
  for (const sentence of sentences) {
    const toks = sentence.toLowerCase().match(/[a-z]{3,}|-?\d+/g) ?? [];
    const score = toks.filter((t) => qTokens.has(t)).length;
    if (score > bestScore) {
      bestScore = score;
      best = sentence;
    }
  }
  return best.trim().slice(0, 400);
}

/**
 * Extractive, source-grounded Socratic response used by the local engine.
 * It quotes only retrieved text, cites it, and turns it into a guiding question. It never invents content.
 */
function groundedLocalResponse(request: TutorAIRequest, provider: string, model: string): TutorAIResponseRaw {
  const top = request.grounding!.sources[0];
  const excerpt = bestExcerpt(top.text, request.studentQuery ?? "");
  const origin =
    top.origin === "TEACHER_NOTE" ? "your teacher's note" : top.origin === "DOCUMENT" ? `"${top.title}"` : "your lesson";
  return {
    text: JSON.stringify({
      responseType: "EXPLANATION",
      message: `Here is what ${origin} says (${top.sectionLabel}): "${excerpt}"`,
      guidingQuestion: "In your own words, what is the main idea in that line, and how could it help with this problem?",
      hintLevel: 1,
      encouragement: "Reading the lesson closely is a great strategy!",
      nextStep: "Restate the idea in your own words, then try the first step.",
      citedSourceIds: [top.sourceId],
    }),
    provider,
    model,
  };
}

/**
 * High-quality Local Pedagogical Tutor Engine.
 * Used for reliable fallback, offline operation, test suites, or when external API quota/keys are pending.
 * Adheres strictly to DepEd MATATAG Grade 7 Mathematics pedagogy and Socratic guidance.
 */
export class LocalTutorEngine implements AIProvider {
  readonly name = "local-pedagogical-engine";
  readonly defaultModel = "tuklas-pedagogical-v1";

  async generateTutorResponse(request: TutorAIRequest): Promise<TutorAIResponseRaw> {
    // Keyword heuristics must see the student's context, never quoted source text (which is untrusted data).
    const prompt = request.userPrompt
      .replace(/=== SOURCE MATERIAL[\s\S]*?=== END SOURCE MATERIAL ===/g, "")
      .toLowerCase();
    const grounded = (request.grounding?.sources.length ?? 0) > 0;
    let responseType = "HINT";
    let message = "";
    let guidingQuestion = "";
    let hintLevel = 1;
    let encouragement = "You can do this!";
    let nextStep = "Think about the signs and positions on the number line.";

    // 1. Off-topic & integrity detection
    if (
      prompt.includes("celebrity") ||
      prompt.includes("movie") ||
      prompt.includes("song") ||
      prompt.includes("recipe") ||
      prompt.includes("weather") ||
      prompt.includes("ignore previous") ||
      prompt.includes("system prompt")
    ) {
      return {
        text: JSON.stringify({
          responseType: "REDIRECT",
          message: "Let's focus on your Grade 7 mathematics lesson. I'm here to help you master integers and math concepts!",
          guidingQuestion: "Would you like a hint on the current problem?",
          hintLevel: 1,
          encouragement: "Let's solve this math problem together!",
        }),
        provider: this.name,
        model: this.defaultModel,
      };
    }

    // 2. Direct answer requests
    if (prompt.includes("give me the answer") || prompt.includes("what is the answer") || prompt.includes("just tell me")) {
      return {
        text: JSON.stringify({
          responseType: "REDIRECT",
          message: "I want to help you understand how to solve this yourself so you'll ace your exams! Let's take it step by step.",
          guidingQuestion: "First, what are the two numbers and operation involved in this question?",
          hintLevel: 1,
          encouragement: "Let's figure it out together!",
          nextStep: "Identify the signs of the numbers first.",
        }),
        provider: this.name,
        model: this.defaultModel,
      };
    }

    // 3. Question specific heuristics: Comparing integers (-5 vs -2 or similar)
    if (prompt.includes("-5") && prompt.includes("-2")) {
      if (prompt.includes("level_2") || prompt.includes("stronger")) {
        responseType = "HINT";
        message = "Remember the number line rule: between two negative numbers, the number that is closer to zero has a greater value. $-2$ is closer to zero than $-5$.";
        guidingQuestion = "So between $-5$ and $-2$, which one is greater?";
        hintLevel = 2;
        encouragement = "Almost there!";
      } else {
        responseType = "HINT";
        message = "Think about where $-5$ and $-2$ are located on a horizontal number line. Numbers farther to the right are always greater.";
        guidingQuestion = "Which number is farther to the right: $-5$ or $-2$?";
        hintLevel = 1;
        encouragement = "Picture a number line in your mind!";
      }
    } else if (prompt.includes("-8") && prompt.includes("13")) {
      // Adding integers with different signs (-8 + 13)
      responseType = "HINT";
      message = "When adding integers with different signs (a negative and a positive), subtract the smaller absolute value from the larger absolute value, then keep the sign of the number with the larger absolute value.";
      guidingQuestion = "What is $13 - 8$, and is $13$ positive or negative?";
      hintLevel = 1;
      encouragement = "Break it down into absolute values!";
      nextStep = "Calculate 13 - 8 and assign the sign of 13.";
    } else if (prompt.includes("multiplication") || prompt.includes("multiply") || prompt.includes("product") || prompt.includes("divide") || prompt.includes("division")) {
      // Integer multiplication / division rules
      responseType = "EXPLANATION";
      message = "Here is the sign rule for multiplication and division: If the two numbers have the same sign (both positive or both negative), the result is positive ($+ \\times + = +$ and $- \\times - = +$). If they have different signs, the result is negative ($+ \\times - = -$ and $- \\times + = -$).";
      guidingQuestion = "Do the numbers in your problem have the same sign or different signs?";
      hintLevel = 1;
      encouragement = "Remember: Same signs give positive, different signs give negative!";
    } else if (grounded && (wantsLessonHelp(request.studentQuery ?? "") || /requested support level: concept_explanation/.test(prompt))) {
      return groundedLocalResponse(request, this.name, this.defaultModel);
    } else if (prompt.includes("concept") || prompt.includes("explain")) {
      responseType = "EXPLANATION";
      message = "In mathematics, integers consist of positive whole numbers, negative whole numbers, and zero. Numbers to the left of zero on a number line have negative signs, and numbers to the right are positive.";
      guidingQuestion = "Can you describe whether the number in your problem represents a gain (positive) or a loss (negative)?";
      hintLevel = 1;
      encouragement = "Building strong conceptual foundations is key!";
    } else {
      // Default supportive Socratic nudge (grounded in lesson material when any was retrieved)
      if (grounded) return groundedLocalResponse(request, this.name, this.defaultModel);
      responseType = "HINT";
      message = "Let's look at the given problem step by step. Start by identifying what type of numbers are in the problem and which mathematical rule applies.";
      guidingQuestion = "What is the very first step or operation you need to perform?";
      hintLevel = 1;
      encouragement = "Take your time, you've got this!";
      nextStep = "Focus on the first operation or comparison.";
    }

    const payload = {
      responseType,
      message,
      guidingQuestion,
      hintLevel,
      encouragement,
      nextStep,
    };

    return {
      text: JSON.stringify(payload),
      tokenUsage: { promptTokens: 50, completionTokens: 80, totalTokens: 130 },
      provider: this.name,
      model: this.defaultModel,
    };
  }
}

/**
 * Provider factory function.
 * Selects the provider based on configuration and environment keys.
 */
export function getAIProvider(): AIProvider {
  const configuredProvider = (process.env.AI_PROVIDER || "").toLowerCase().trim();
  const apiKey = process.env.GEMINI_API_KEY || process.env.AI_API_KEY;

  if (configuredProvider === "local" || configuredProvider === "mock") {
    return new LocalTutorEngine();
  }

  // If Gemini provider is explicitly selected or if an API key is available
  if (apiKey && (configuredProvider === "" || configuredProvider === "gemini")) {
    try {
      return new GeminiAIProvider(apiKey);
    } catch (e) {
      console.warn("Failed to initialize GeminiAIProvider, falling back to LocalTutorEngine:", e);
      return new LocalTutorEngine();
    }
  }

  // Fallback to local pedagogical engine if no external API key is provided
  return new LocalTutorEngine();
}
