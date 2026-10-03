import React from "react";
import { Sparkles, ArrowRight, Lightbulb, CheckCircle2, BookOpen, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { MathText } from "@/components/ui/MathText";
import type { MistakeAnalysisDTO, MistakeCategoryType } from "@/lib/ai/types";

export interface StudentInsightCardProps {
  insight: MistakeAnalysisDTO;
  onReviewLesson?: (lessonId?: string | null) => void;
  onPracticeAgain?: (skillId?: string | null) => void;
  className?: string;
}

export function StudentInsightCard({
  insight,
  onReviewLesson,
  onPracticeAgain,
  className = "",
}: StudentInsightCardProps) {
  const getCategoryLabel = (category: MistakeCategoryType) => {
    switch (category) {
      case "CONCEPTUAL_MISUNDERSTANDING":
        return "Concept Insight";
      case "SIGN_ERROR":
        return "Sign Rule Practice";
      case "CALCULATION_ERROR":
        return "Calculation Tip";
      case "PREREQUISITE_GAP":
        return "Foundation Builder";
      case "APPLICATION_DIFFICULTY":
        return "Word Problem Tip";
      case "INCONSISTENT_PERFORMANCE":
        return "Execution Strategy";
      case "POSSIBLE_CARELESS_ERROR":
        return "Review & Verify";
      case "QUESTION_TYPE_DIFFICULTY":
        return "Format Guidance";
      default:
        return "Practice Insight";
    }
  };

  const getConfidenceBadge = (confidence: number) => {
    if (confidence >= 0.8) {
      return (
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
          High Pattern Match
        </span>
      );
    }
    if (confidence >= 0.5) {
      return (
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-200">
          Moderate Observation
        </span>
      );
    }
    return (
      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
        Early Observation
      </span>
    );
  };

  return (
    <div
      className={`rounded-2xl border border-emerald-100 bg-gradient-to-br from-white via-white to-emerald-50/30 p-5 sm:p-6 shadow-xs space-y-4 ${className}`}
    >
      {/* Top Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-bold text-slate-900 leading-tight">
                {insight.skillTitle || insight.lessonTitle || "Learning Insight"}
              </h4>
              <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-800 border-emerald-200">
                {getCategoryLabel(insight.category)}
              </Badge>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Analyzed {new Date(insight.createdAt).toLocaleDateString([], { month: "short", day: "numeric" })}
            </p>
          </div>
        </div>

        <div>{getConfidenceBadge(insight.confidence)}</div>
      </div>

      {/* Observation & Pattern */}
      <div className="space-y-2 text-xs sm:text-sm text-slate-700 bg-slate-50/70 p-3.5 rounded-xl border border-slate-100">
        <div className="font-semibold text-slate-900 flex items-center gap-1.5 text-xs text-emerald-800">
          <Lightbulb className="w-3.5 h-3.5 text-emerald-600" />
          <span>What We Noticed:</span>
        </div>
        <p className="leading-relaxed">{insight.pattern || insight.observation}</p>
      </div>

      {/* Recommended Action */}
      <div className="space-y-1.5 text-xs sm:text-sm text-emerald-950 bg-emerald-50/60 p-3.5 rounded-xl border border-emerald-200/70">
        <span className="font-bold text-emerald-900 text-xs flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
          <span>Suggested Practice:</span>
        </span>
        <div className="leading-relaxed">
          <MathText content={insight.recommendation} />
        </div>
      </div>

      {/* Actions */}
      <div className="pt-2 flex flex-wrap items-center gap-2">
        {insight.lessonId && onReviewLesson && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onReviewLesson(insight.lessonId)}
            className="text-xs gap-1.5 border-emerald-200 text-emerald-800 hover:bg-emerald-50"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Review Lesson</span>
          </Button>
        )}

        {onPracticeAgain && (
          <Button
            variant="primary"
            size="sm"
            onClick={() => onPracticeAgain(insight.skillId)}
            className="text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white ml-auto"
          >
            <span>Practice Again</span>
            <RotateCcw className="w-3 h-3" />
          </Button>
        )}
      </div>
    </div>
  );
}
