import React, { useState } from "react";
import { BookOpen, Eye, EyeOff, CheckCircle } from "lucide-react";
import { MathText } from "@/components/ui/MathText";
import { Button } from "@/components/ui/Button";

export interface ExampleBlockProps {
  title?: string;
  content: string; // Plain markdown or formatted with Problem, Steps, Answer
  metadata?: string; // JSON with problem, steps[], answer
}

export function ExampleBlock({ title, content, metadata }: ExampleBlockProps) {
  const [showAnswer, setShowAnswer] = useState(false);

  let parsed: { problem?: string; steps?: string[]; answer?: string } = {};
  if (metadata) {
    try {
      parsed = JSON.parse(metadata);
    } catch {}
  }

  // Parse if structured metadata is missing but content contains "Problem:", "Solution:" or "Answer:"
  let problem = parsed.problem || "";
  let steps: string[] = parsed.steps || [];
  let answer = parsed.answer || "";

  if (!problem && content) {
    const problemMatch = content.match(/Problem:\s*([\s\S]*?)(?=Steps:|Solution:|Answer:|$)/i);
    const stepsMatch = content.match(/(?:Steps|Solution):\s*([\s\S]*?)(?=Answer:|$)/i);
    const answerMatch = content.match(/Answer:\s*([\s\S]*?)$/i);

    if (problemMatch || answerMatch) {
      problem = problemMatch ? problemMatch[1].trim() : "";
      if (stepsMatch) {
        steps = stepsMatch[1]
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean);
      }
      answer = answerMatch ? answerMatch[1].trim() : "";
    } else {
      // Fallback: entire content is problem statement
      problem = content;
    }
  }

  return (
    <div className="space-y-4">
      {title && (
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center shrink-0">
            <BookOpen className="w-4 h-4" />
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            {title}
          </h2>
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs divide-y divide-slate-100">
        {/* 1. Problem Statement */}
        <div className="p-5 sm:p-6 bg-slate-50/60">
          <span className="text-[11px] font-bold uppercase tracking-wider text-teal-800 block mb-2">
            Worked Example Problem
          </span>
          <div className="text-base sm:text-lg font-medium text-slate-900 leading-relaxed">
            <MathText content={problem || content} />
          </div>
        </div>

        {/* 2. Step-by-Step Guidance */}
        {steps.length > 0 && (
          <div className="p-5 sm:p-6 space-y-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
              Step-by-Step Solution
            </span>
            <div className="space-y-3">
              {steps.map((step, idx) => (
                <div key={idx} className="flex items-start gap-3 text-sm text-slate-700">
                  <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                    {idx + 1}
                  </span>
                  <div className="flex-1">
                    <MathText content={step.replace(/^(?:Step\s*\d+:|•|\*|-)\s*/i, "")} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 3. Progressive Reveal Answer */}
        {answer && (
          <div className="p-5 sm:p-6 bg-teal-50/30">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-teal-800 block">
                  Final Result
                </span>
                <p className="text-xs text-slate-500">
                  Verify your answer after working through the steps.
                </p>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAnswer(!showAnswer)}
                className="gap-2 text-xs self-start sm:self-auto border-teal-300 text-teal-800 hover:bg-teal-50"
              >
                {showAnswer ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                <span>{showAnswer ? "Hide Answer" : "Reveal Answer"}</span>
              </Button>
            </div>

            {showAnswer && (
              <div className="mt-4 p-4 rounded-xl bg-white border border-teal-200 text-slate-900 shadow-2xs animate-in fade-in slide-in-from-top-1 duration-200 flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-teal-600 shrink-0 mt-0.5" />
                <div className="font-semibold text-base sm:text-lg">
                  <MathText content={answer} />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
