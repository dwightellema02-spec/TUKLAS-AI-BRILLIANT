import React, { useState } from "react";
import { HelpCircle, CheckCircle2, AlertCircle, Lightbulb, RefreshCw } from "lucide-react";
import { MathText } from "@/components/ui/MathText";
import { Button } from "@/components/ui/Button";

export interface QuestionBlockProps {
  blockId: string;
  title?: string;
  content: string; // Question prompt
  metadata?: string; // JSON with question, options[], correctAnswer, explanation, hint
  onAttempt?: (blockId: string, answer: string, isCorrect: boolean, feedback: string) => void;
  previousAttempt?: { answer: string; isCorrect: boolean; feedback?: string };
  readOnly?: boolean;
}

export function QuestionBlock({
  blockId,
  title,
  content,
  metadata,
  onAttempt,
  previousAttempt,
  readOnly = false,
}: QuestionBlockProps) {
  let parsed: {
    question?: string;
    options?: string[];
    correctAnswer?: string;
    explanation?: string;
    hint?: string;
  } = {};

  if (metadata) {
    try {
      parsed = JSON.parse(metadata);
    } catch {}
  }

  const question = parsed.question || content || "Evaluate the given expression.";
  const options = parsed.options || ["Positive", "Negative", "Zero"];
  const correctAnswer = parsed.correctAnswer || "Negative";
  const explanation =
    parsed.explanation ||
    "Since the value lies to the left of 0 on the number line, it is a negative integer.";
  const hint = parsed.hint || "Recall that numbers to the left of zero have minus signs.";

  const [selectedAnswer, setSelectedAnswer] = useState<string>(previousAttempt?.answer || "");
  const [submitted, setSubmitted] = useState<boolean>(!!previousAttempt);
  const [isCorrect, setIsCorrect] = useState<boolean>(previousAttempt?.isCorrect ?? false);
  const [showHint, setShowHint] = useState<boolean>(false);

  const handleSubmit = () => {
    if (!selectedAnswer || readOnly) return;
    const correct = selectedAnswer.trim().toLowerCase() === correctAnswer.trim().toLowerCase();
    setIsCorrect(correct);
    setSubmitted(true);

    if (onAttempt) {
      onAttempt(blockId, selectedAnswer, correct, explanation);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">
            <HelpCircle className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 block">
              Active Question
            </span>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              {title || "Check Your Understanding"}
            </h2>
          </div>
        </div>

        {hint && (
          <button
            type="button"
            onClick={() => setShowHint(!showHint)}
            className="text-xs text-amber-700 hover:text-amber-800 font-semibold flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 transition-colors"
          >
            <Lightbulb className="w-3.5 h-3.5" />
            <span>{showHint ? "Hide Hint" : "Get Hint"}</span>
          </button>
        )}
      </div>

      {showHint && (
        <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200/80 text-xs sm:text-sm text-amber-900 flex items-start gap-2.5 animate-in fade-in duration-200">
          <Lightbulb className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold block mb-0.5">Instructional Hint:</span>
            <MathText content={hint} />
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7 shadow-xs space-y-5">
        <div className="text-base sm:text-lg font-semibold text-slate-900 leading-snug">
          <MathText content={question} />
        </div>

        {/* Options */}
        <div className="space-y-2.5">
          {options.map((opt, idx) => {
            const isSelected = selectedAnswer === opt;
            const isTarget = opt.trim().toLowerCase() === correctAnswer.trim().toLowerCase();

            let style = "border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-800";
            if (submitted) {
              if (isTarget) {
                style = "border-emerald-500 bg-emerald-50 text-emerald-950 font-semibold";
              } else if (isSelected && !isTarget) {
                style = "border-red-400 bg-red-50 text-red-950";
              }
            } else if (isSelected) {
              style = "border-blue-500 bg-blue-50 text-blue-950 font-semibold ring-2 ring-blue-100";
            }

            return (
              <label
                key={idx}
                className={`flex items-center gap-3.5 p-3.5 sm:p-4 rounded-xl border text-sm sm:text-base cursor-pointer transition-all ${style}`}
              >
                <input
                  type="radio"
                  name={`question_${blockId}`}
                  value={opt}
                  checked={isSelected}
                  disabled={submitted || readOnly}
                  onChange={() => setSelectedAnswer(opt)}
                  className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                />
                <div className="flex-1">
                  <MathText content={opt} />
                </div>
              </label>
            );
          })}
        </div>

        {!submitted ? (
          <div className="pt-2">
            <Button
              variant="primary"
              disabled={!selectedAnswer || readOnly}
              onClick={handleSubmit}
              className="gap-2"
            >
              <span>Submit Answer</span>
            </Button>
          </div>
        ) : (
          <div className="space-y-4 pt-2">
            <div
              className={`p-4 rounded-xl border flex items-start gap-3 text-sm ${
                isCorrect
                  ? "bg-emerald-50 border-emerald-200 text-emerald-950"
                  : "bg-amber-50 border-amber-200 text-amber-950"
              }`}
            >
              {isCorrect ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              )}
              <div className="space-y-1">
                <span className="font-bold block">
                  {isCorrect ? "Correct!" : "Incorrect"}
                </span>
                <div className="text-xs sm:text-sm text-slate-700">
                  <MathText content={explanation} />
                </div>
              </div>
            </div>

            {!isCorrect && !readOnly && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSubmitted(false)}
                className="gap-1.5 text-xs"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Try Again</span>
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
