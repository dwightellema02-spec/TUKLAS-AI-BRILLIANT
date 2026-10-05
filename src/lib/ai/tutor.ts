// Phase 7: AI Tutor Core Service Orchestrator

import { dbService } from "../db";
import { buildAITutorContext } from "./context";
import { buildTutorSystemPrompt, buildTutorUserPrompt } from "./prompts";
import { getAIProvider, LocalTutorEngine } from "./provider";
import { validateTutorOutput } from "./validators";
import type {
  AITutorInteractParams,
  TutorAPIResponse,
  AITutorMessageType,
  AITutorContext,
  TutorAIRequest,
} from "./types";
import { classifyStudentMessage } from "./conversation/signals";
import { evaluateAttempt, resolveExpectedAnswerText } from "./conversation/evaluate";
import { parseAnyProblem, findNumberInText } from "./conversation/arith";
import { observeStudentTurn, parseState, recordTutorTurn, serializeState, summarizeEvaluation, summarizeState } from "./conversation/state";
import { planResponse } from "./conversation/planner";
import { checkTutorOutput, type Violation } from "./conversation/guards";
import { realizePlan } from "./conversation/realizer";
import type { ConversationState, ParsedProblem, ResponsePlan } from "./conversation/types";

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

// In-memory sliding window rate-limiter per student
const rateLimitMap = new Map<string, RateLimitRecord>();
const MAX_REQUESTS_PER_MINUTE = 20;
const WINDOW_DURATION_MS = 60 * 1000;

export class AITutorService {
  /** Test hook: inject a provider (e.g. a scripted LLM stand-in). Never set in production code. */
  static providerOverride: import("./types").AIProvider | null = null;

  /**
   * Check and increment rate limit for a student
   */
  static checkRateLimit(studentId: string): { allowed: boolean; remaining: number; resetInSeconds: number } {
    const now = Date.now();
    const record = rateLimitMap.get(studentId);

    if (!record || now > record.resetAt) {
      rateLimitMap.set(studentId, { count: 1, resetAt: now + WINDOW_DURATION_MS });
      return {
        allowed: true,
        remaining: MAX_REQUESTS_PER_MINUTE - 1,
        resetInSeconds: Math.ceil(WINDOW_DURATION_MS / 1000),
      };
    }

    if (record.count >= MAX_REQUESTS_PER_MINUTE) {
      return {
        allowed: false,
        remaining: 0,
        resetInSeconds: Math.max(1, Math.ceil((record.resetAt - now) / 1000)),
      };
    }

    record.count += 1;
    return {
      allowed: true,
      remaining: MAX_REQUESTS_PER_MINUTE - record.count,
      resetInSeconds: Math.max(1, Math.ceil((record.resetAt - now) / 1000)),
    };
  }

  /**
   * Reset rate limit state (useful after test suites or administrative resets)
   */
  static resetRateLimit(studentId?: string): void {
    if (studentId) {
      rateLimitMap.delete(studentId);
    } else {
      rateLimitMap.clear();
    }
  }

  /**
   * Main interaction entrypoint
   */
  static async interact(params: AITutorInteractParams): Promise<TutorAPIResponse> {
    const { studentId, studentQuery, questionId, practiceSessionId } = params;

    // 1. Rate Limit Enforcement
    const rateLimit = this.checkRateLimit(studentId);
    if (!rateLimit.allowed) {
      throw new Error(
        `Rate limit exceeded. Please wait ${rateLimit.resetInSeconds} seconds before asking the AI Tutor again.`
      );
    }

    // 2. Teacher Settings Check
    const settings = await dbService.getTeacherAISettings();
    if (!settings.aiTutorEnabled) {
      throw new Error("The AI Tutor is currently disabled by your instructor. Please continue your lesson.");
    }

    // 3. Input Sanitization & Guard
    if (studentQuery && studentQuery.length > 1000) {
      throw new Error("Student query exceeds the maximum allowed length of 1000 characters.");
    }

    // 4. Resolve or Create Conversation
    const conversation = await dbService.getOrCreateAITutorConversation({
      studentId,
      lessonId: params.lessonId,
      skillId: params.skillId,
      questionId: params.questionId,
      practiceSessionId: params.practiceSessionId,
    });

    // 5. If student submitted a specific query or question, record their message
    if (studentQuery && studentQuery.trim().length > 0) {
      await dbService.saveAITutorMessage({
        conversationId: conversation.id,
        role: "STUDENT",
        content: studentQuery.trim(),
        messageType: "QUESTION",
      });
    }

    // 6. Build Rich Educational Context
    const context = await buildAITutorContext({
      ...params,
      conversationId: conversation.id,
    });

    // 7. Phase 23: read the student, update conversation state, decide the pedagogical move
    const conversationState = parseState((conversation as { stateJson?: string | null }).stateJson, context.masteryInsight?.status);
    const turn = this.planTurn(context, conversationState, params);
    context.conversation = {
      stateSummary: summarizeState(turn.state),
      evaluationSummary: summarizeEvaluation(turn.plan.evaluation),
      plan: turn.plan,
    };

    // 8. Generate prompts
    const systemPrompt = buildTutorSystemPrompt();
    const userPrompt = buildTutorUserPrompt(context);

    // 9. Generate (LLM or local realizer), verify against the plan, retry once, then fall back to the realizer
    const generated = await this.generateVerified({ context, turn, systemPrompt, userPrompt, studentQuery });
    const structured = generated.structured;
    const rawResponse = generated.raw;

    // 10. Persist Tutor Message and the new conversation state
    const nextState = recordTutorTurn(turn.state, turn.plan, structured.message, structured.guidingQuestion);
    await dbService.saveAITutorConversationState(conversation.id, studentId, serializeState(nextState));

    const savedTutorMessage = await dbService.saveAITutorMessage({
      conversationId: conversation.id,
      role: "TUTOR",
      content: structured.message,
      messageType: structured.responseType,
      hintLevel: structured.hintLevel,
      guidingQuestion: structured.guidingQuestion,
      metadata: JSON.stringify({
        encouragement: structured.encouragement,
        nextStep: structured.nextStep,
        citedSourceIds: structured.citedSourceIds ?? [],
        groundedSourceCount: context.grounding.sources.length,
        provider: rawResponse.provider,
        model: rawResponse.model,
        pedagogy: {
          strategy: turn.plan.strategy,
          rationale: turn.plan.rationale,
          intent: turn.plan.intent,
          evaluation: turn.plan.evaluation.kind,
          diagnosis: turn.plan.diagnosis,
          scaffold: turn.plan.scaffold,
          phase: turn.plan.phase,
          needsTeacherAttention: turn.plan.needsTeacherAttention,
          guardViolations: generated.violations,
          usedPlanFallback: generated.usedFallback,
        },
      }),
    });

    // 11. Record hint usage on QuestionAttempt for research analytics
    if (questionId) {
      await dbService.markHintUsedOnQuestionAttempt(studentId, questionId, practiceSessionId);
    }

    return {
      success: true,
      conversationId: conversation.id,
      message: {
        id: savedTutorMessage.id,
        role: "TUTOR",
        content: savedTutorMessage.content,
        messageType: savedTutorMessage.messageType as AITutorMessageType,
        hintLevel: savedTutorMessage.hintLevel,
        guidingQuestion: savedTutorMessage.guidingQuestion,
        encouragement: structured.encouragement,
        createdAt: new Date(savedTutorMessage.createdAt).toISOString(),
        citations: (structured.citedSourceIds ?? [])
          .map((id) => context.grounding.sources.find((s) => s.sourceId === id))
          .filter((s): s is NonNullable<typeof s> => Boolean(s))
          .map((s) => ({ sourceId: s.sourceId, title: s.title, sectionLabel: s.sectionLabel, page: s.pageStart })),
      },
      pedagogy: {
        strategy: turn.plan.strategy,
        evaluation: turn.plan.evaluation.kind,
        phase: turn.plan.phase,
      },
      providerInfo: {
        provider: rawResponse.provider,
        model: rawResponse.model,
      },
      rateLimit: {
        remaining: rateLimit.remaining,
        resetInSeconds: rateLimit.resetInSeconds,
      },
    };
  }

  /**
   * Read the student's message, pick the active problem, evaluate any attempt deterministically, update
   * conversation state, and plan the next tutor move.
   */
  static planTurn(
    context: AITutorContext,
    prevState: ConversationState,
    params: AITutorInteractParams
  ): { state: ConversationState; plan: ResponsePlan; signal: ReturnType<typeof classifyStudentMessage> } {
    const q = context.question;
    const signal = classifyStudentMessage(params.studentQuery, {
      expectTruth: q?.type === "TRUE_FALSE" || prevState.pendingTransfer?.problem.op === ">" || prevState.pendingTransfer?.problem.op === "<" || prevState.baseProblem?.op === ">" || prevState.baseProblem?.op === "<",
      // An answer is expected whenever there is a lesson question, a pending tutor problem, or a student-typed problem.
      hasQuestion: !!q || !!prevState.pendingTransfer || (!!prevState.baseProblem && prevState.activeProblemSource === "STUDENT"),
      structuredAnswer: params.studentAnswer,
      helpLevel: params.helpLevel,
    });

    // Which problem is the student working on right now?
    const questionProblem = q ? problemFromQuestion(q.prompt, q.expectedAnswer, q.choices) : undefined;
    let activeProblem: ParsedProblem | undefined;
    let source: "QUESTION" | "STUDENT" | "TUTOR" | undefined;
    if (signal.intent === "STUDENT_PROBLEM" && signal.ownProblem) {
      activeProblem = signal.ownProblem;
      source = "STUDENT";
    } else if (prevState.pendingTransfer) {
      activeProblem = prevState.pendingTransfer.problem;
      source = "TUTOR";
    } else if (prevState.baseProblem && prevState.activeProblemSource === "STUDENT") {
      // A problem the student typed themselves stays the focus until they solve it.
      activeProblem = prevState.baseProblem;
      source = "STUDENT";
    } else if (questionProblem) {
      activeProblem = questionProblem;
      source = "QUESTION";
    }

    const evaluation = evaluateAttempt(
      signal,
      activeProblem,
      source === "QUESTION" || !activeProblem ? (q ? { type: q.type, choices: q.choices, expectedAnswer: q.expectedAnswer } : undefined) : undefined
    );

    const state = observeStudentTurn(prevState, signal, evaluation, { problem: activeProblem, source });
    const plan = planResponse({
      state,
      signal,
      evaluation,
      problem: activeProblem,
      masteryStatus: context.masteryInsight?.status,
      hasSources: context.grounding.sources.length > 0,
      topicText: [context.curriculum.lessonTitle, context.skill?.title, q?.prompt].filter(Boolean).join(" "),
    });

    // Non-arithmetic question (e.g. multiple choice about a concept): still protect the expected answer text.
    if (!activeProblem && q && evaluation.kind !== "CORRECT") {
      const text = resolveExpectedAnswerText({ type: q.type, choices: q.choices, expectedAnswer: q.expectedAnswer });
      if (text && text.trim().length > 0) {
        plan.protectedAnswer = text;
        plan.protectedAnswerAliases = [text];
      }
    }
    return { state, plan, signal };
  }

  /**
   * Call the provider, verify the output against the plan, retry once with the violations spelled out,
   * and finally fall back to the deterministic realizer so a bad model response can never reach the student.
   */
  static async generateVerified(args: {
    context: AITutorContext;
    turn: { state: ConversationState; plan: ResponsePlan };
    systemPrompt: string;
    userPrompt: string;
    studentQuery?: string;
  }) {
    const { context, turn, systemPrompt, studentQuery } = args;
    const provider = this.providerOverride ?? getAIProvider();
    const baseRequest = (userPrompt: string): TutorAIRequest => ({
      systemPrompt,
      userPrompt,
      maxTokens: 500,
      temperature: 0.4,
      timeoutMs: 12000,
      grounding: context.grounding,
      studentQuery,
      plan: turn.plan,
      conversationState: turn.state,
      lessonTitle: context.curriculum.lessonTitle,
      skillTitle: context.skill?.title,
    });

    const attempt = async (userPrompt: string, p = provider) => {
      let raw: { text: string; provider: string; model: string };
      try {
        raw = await p.generateTutorResponse(baseRequest(userPrompt));
      } catch (providerError) {
        console.warn("Primary AI provider failed, activating local pedagogical engine fallback:", providerError);
        raw = await new LocalTutorEngine().generateTutorResponse(baseRequest(userPrompt));
      }
      const structured = validateTutorOutput(raw.text, context);
      const violations = checkTutorOutput({ message: structured.message, guidingQuestion: structured.guidingQuestion }, turn.plan, turn.state);
      return { raw, structured, violations };
    };

    let result = await attempt(args.userPrompt);
    let allViolations: Violation[] = [...result.violations];

    if (result.violations.length > 0) {
      const retryPrompt = `${args.userPrompt}\n\n### CORRECTION REQUIRED\nYour previous reply broke these rules: ${result.violations.join(", ")}. Write a new reply that follows the TUTORING PLAN and every rule. Do not mention this correction.`;
      result = await attempt(retryPrompt);
      allViolations = [...allViolations, ...result.violations.map((v) => `RETRY_${v}` as Violation)];
    }

    let usedFallback = false;
    if (result.violations.length > 0) {
      const realized = realizePlan(turn.plan, {
        state: turn.state,
        lessonTitle: context.curriculum.lessonTitle,
        skillTitle: context.skill?.title,
        sources: context.grounding.sources,
      });
      const structured = validateTutorOutput(
        JSON.stringify({ ...realized, nextStep: undefined }),
        context
      );
      result = { raw: { text: "", provider: "tuklas-plan-realizer", model: "tuklas-plan-realizer-v1" }, structured, violations: [] };
      usedFallback = true;
    }
    return { raw: result.raw, structured: result.structured, violations: allViolations, usedFallback };
  }
}

/** Builds a computable problem from a question record, only if the parsed expression agrees with the stored answer. */
function problemFromQuestion(
  prompt: string,
  expectedAnswer: string | undefined,
  choices?: Array<{ id: string; text: string }>
): ParsedProblem | undefined {
  const parsed = parseAnyProblem(prompt);
  if (!parsed) return undefined;
  if (expectedAnswer === undefined || expectedAnswer === "") return parsed;
  if (parsed.op === ">" || parsed.op === "<") {
    const e = String(expectedAnswer).trim().toLowerCase();
    if (e === "true" || e === "false") return (e === "true") === (parsed.expected === 1) ? parsed : undefined;
    return parsed;
  }
  const byId = choices?.find((c) => c.id === expectedAnswer);
  const expectedNum = findNumberInText(byId ? byId.text : expectedAnswer);
  // If the record's answer disagrees with the expression we parsed (the prompt may contain other numbers), do not guess.
  if (expectedNum !== undefined && expectedNum !== parsed.expected) return undefined;
  return parsed;
}
