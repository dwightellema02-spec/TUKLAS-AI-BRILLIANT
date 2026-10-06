import React, { useState } from "react";
import { HelpCircle, CheckCircle2, AlertCircle, RefreshCw } from "lucide-react";
import { MathText } from "@/components/ui/MathText";
import { Button } from "@/components/ui/Button";

export interface GradingResult {
  isCorrect: boolean;
  feedback: string;
  /** Present only when the student answered correctly. */
  correctAnswer?: string;
}

export interface CheckpointBlockProps {
  blockId: string;
  title?: string;
  content: string; // Question prompt or description
  metadata?: string; // JSON with options[], correctAnswer, explanation
  /** Local grading (teacher preview, where the answer key is available). */
  onAttempt?: (blockId: string, answer: string, isCorrect: boolean, feedback: string) => void;
  /** Server grading (students): the answer key never reaches the browser before the student answers. */
  onSubmitAnswer?: (blockId: string, answer: string) => Promise<GradingResult>;
  previousAttempt?: { answer: string; isCorrect: boolean; feedback?: string };
  readOnly?: boolean;
}

export function CheckpointBlock({
  blockId,
  title,
  content,
  metadata,
  onAttempt,
  onSubmitAnswer,
  previousAttempt,
  readOnly = false,
}: CheckpointBlockProps) {
  let parsed: {
    question?: string;
    options?: string[];
    correctAnswer?: string;
    explanation?: string;
  } = {};

  if (metadata) {
    try {
      parsed = JSON.parse(metadata);
    } catch {}
  }

  const question = parsed.question || content;
  const options = Array.isArray(parsed.options) ? parsed.options : [];
  const configured = options.length >= 2;

  const [selectedOption, setSelectedOption] = useState<string>(previousAttempt?.answer || "");
  const [submitted, setSubmitted] = useState<boolean>(!!previousAttempt);
  const [isCorrect, setIsCorrect] = useState<boolean>(previousAttempt?.isCorrect ?? false);
  const [feedback, setFeedback] = useState<string>(previousAttempt?.feedback ?? parsed.explanation ?? "");
  // The answer that may be highlighted: in local mode the key itself; from the server only once found.
  const [revealedAnswer, setRevealedAnswer] = useState<string | undefined>(
    onSubmitAnswer ? (previousAttempt?.isCorrect ? previousAttempt.answer : undefined) : parsed.correctAnswer
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!selectedOption || readOnly || pending) return;
    setError(null);
    if (onSubmitAnswer) {
      setPending(true);
      try {
        const graded = await onSubmitAnswer(blockId, selectedOption);
        setIsCorrect(graded.isCorrect);
        setFeedback(graded.feedback);
        setRevealedAnswer(graded.isCorrect ? graded.correctAnswer ?? selectedOption : undefined);
        setSubmitted(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not check your answer. Please try again.");
      } finally {
        setPending(false);
      }
      return;
    }
    if (parsed.correctAnswer === undefined) return;
    const correct = selectedOption.trim() === parsed.correctAnswer.trim();
    setIsCorrect(correct);
    setFeedback(parsed.explanation ?? "");
    setSubmitted(true);
    if (onAttempt) onAttempt(blockId, selectedOption, correct, parsed.explanation ?? "");
  };

  const handleRetry = () => {
    if (readOnly) return;
    setSubmitted(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
          <HelpCircle className="w-5 h-5" />
        </div>
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 block">
            Concept Checkpoint
          </span>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            {title || "Quick Check for Understanding"}
          </h2>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7 shadow-xs space-y-5">
        <div className="text-base sm:text-lg font-semibold text-slate-900 leading-snug">
          <MathText content={question} />
        </div>

        {!configured && (
          <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-3">
            This question is not set up yet (it needs at least two answer choices and a correct answer).
          </p>
        )}

        {/* Options Selection */}
        <div className="space-y-2.5">
          {options.map((opt, idx) => {
            const isSelected = selectedOption === opt;
            const isTargetCorrect = revealedAnswer !== undefined && opt.trim() === revealedAnswer.trim();

            let optionStyle =
              "border-slate-200 bg-slate-50 hover:bg-slate-100/80 text-slate-800";
            if (submitted) {
              if (isTargetCorrect) {
                optionStyle = "border-emerald-500 bg-emerald-50/70 text-emerald-950 font-semibold";
              } else if (isSelected && !isTargetCorrect) {
                optionStyle = "border-red-400 bg-red-50/70 text-red-950 line-through";
              }
            } else if (isSelected) {
              optionStyle = "border-blue-500 bg-blue-50/80 text-blue-950 font-semibold ring-2 ring-blue-100";
            }

            return (
              <label
                key={idx}
                className={`flex items-center gap-3.5 p-3.5 sm:p-4 rounded-xl border text-sm sm:text-base cursor-pointer transition-all ${optionStyle}`}
              >
                <input
                  type="radio"
                  name={`checkpoint_${blockId}`}
                  value={opt}
                  checked={isSelected}
                  disabled={submitted || readOnly}
                  onChange={() => setSelectedOption(opt)}
                  className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                />
                <div className="flex-1">
                  <MathText content={opt} />
                </div>
              </label>
            );
          })}
        </div>

        {/* Action Button */}
        {!submitted ? (
          <div className="pt-2 space-y-2">
            {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
            <Button
              variant="primary"
              disabled={!selectedOption || readOnly || pending || !configured}
              onClick={handleSubmit}
              className="gap-2"
            >
              <span>{pending ? "Checking..." : "Submit Answer"}</span>
            </Button>
          </div>
        ) : (
          <div className="space-y-4 pt-2">
            {/* Feedback alert */}
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
                  {isCorrect ? "Correct! Excellent reasoning." : "Not quite, but good effort!"}
                </span>
                <div className="text-xs sm:text-sm text-slate-700">
                  <MathText content={feedback} />
                </div>
              </div>
            </div>

            {!isCorrect && !readOnly && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleRetry}
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
