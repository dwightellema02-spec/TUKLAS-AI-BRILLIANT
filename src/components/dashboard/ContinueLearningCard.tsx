import React from "react";
import { BookOpen, ArrowRight, CheckCircle2, Play, Clock, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import type { ContinueLearningDTO } from "@/lib/dashboard/student-dashboard-types";

export interface ContinueLearningCardProps {
  continueData: ContinueLearningDTO;
  onContinue: (lessonId: string, sectionIndex?: number) => void;
  onExplorePath?: () => void;
}

export function ContinueLearningCard({
  continueData,
  onContinue,
  onExplorePath,
}: ContinueLearningCardProps) {
  const {
    state,
    lessonId,
    title,
    description,
    progressPercentage,
    currentSectionIndex,
    totalSections,
    currentSectionTitle,
    ctaLabel,
    estimatedMinutes,
  } = continueData;

  // 1. ALL COMPLETED STATE
  if (state === "COMPLETED") {
    return (
      <div className="rounded-3xl p-6 sm:p-7 bg-gradient-to-br from-emerald-500/10 via-teal-50 to-white border border-emerald-200/80 shadow-xs mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-100/80 px-2.5 py-0.5 rounded-full">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                Unit Complete
              </span>
              <span className="text-xs font-semibold text-emerald-800">
                100% Mastered
              </span>
            </div>
            <h2 className="text-xl font-extrabold text-slate-900">
              You're all caught up!
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 max-w-xl">
              You have completed all published lessons in this unit. Check your active adaptive recommendation below or review earlier lessons to strengthen retention.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {onExplorePath && (
              <Button
                variant="outline"
                size="sm"
                onClick={onExplorePath}
                className="text-xs"
              >
                Curriculum Map
              </Button>
            )}
            <Button
              variant="primary"
              size="sm"
              onClick={() => onContinue(lessonId)}
              className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <span>Review Lessons</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // 2. NO PROGRESS YET (START LEARNING)
  if (state === "NO_PROGRESS") {
    return (
      <div className="rounded-3xl p-6 sm:p-7 bg-gradient-to-br from-blue-600 via-indigo-600 to-teal-700 text-white shadow-md shadow-blue-500/10 mb-8 relative overflow-hidden">
        {/* Subtle decorative background circles */}
        <div className="absolute -right-12 -bottom-12 w-48 h-48 bg-white/10 rounded-full blur-2xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider bg-white/20 text-white backdrop-blur-xs px-2.5 py-0.5 rounded-full border border-white/20">
              <Sparkles className="w-3.5 h-3.5 text-teal-200" />
              Start Learning
            </div>
            <h2 className="text-2xl font-black text-white tracking-tight">
              {title}
            </h2>
            <p className="text-sm text-blue-50/90 leading-relaxed">
              {description}
            </p>
            <div className="flex items-center gap-3 text-xs text-blue-100/80 pt-1">
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                ~{estimatedMinutes || 20} mins
              </span>
              <span>•</span>
              <span>{totalSections} interactive sections</span>
            </div>
          </div>

          <div className="shrink-0">
            <Button
              variant="primary"
              size="lg"
              onClick={() => onContinue(lessonId, 0)}
              className="gap-2 bg-white text-blue-700 hover:bg-blue-50 shadow-md font-bold px-6"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>{ctaLabel || "Start Learning"}</span>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // 3. IN PROGRESS STATE (RESUME EXACT LOCATION)
  return (
    <div className="rounded-3xl p-6 sm:p-7 bg-gradient-to-br from-blue-50/90 via-white to-indigo-50/50 border border-blue-200 shadow-xs mb-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-blue-700 bg-blue-100/90 px-2.5 py-0.5 rounded-full">
              <BookOpen className="w-3.5 h-3.5 text-blue-600" />
              Continue Learning
            </span>
            <Badge variant="info" className="text-[10px] font-bold">
              {progressPercentage}% Completed
            </Badge>
          </div>

          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            {title}
          </h2>

          {/* Exact Resume Step Indicator */}
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
            <span className="font-semibold text-slate-800">
              Resume: Step {currentSectionIndex + 1} of {totalSections}
            </span>
            {currentSectionTitle && (
              <>
                <span>•</span>
                <span className="text-blue-700 font-medium bg-blue-50/80 px-2 py-0.5 rounded-md border border-blue-100">
                  {currentSectionTitle}
                </span>
              </>
            )}
            {estimatedMinutes && (
              <>
                <span>•</span>
                <span className="flex items-center gap-1 text-slate-500">
                  <Clock className="w-3 h-3" />
                  ~{estimatedMinutes}m total
                </span>
              </>
            )}
          </div>
        </div>

        <div className="shrink-0 flex items-center gap-2">
          <Button
            variant="primary"
            size="md"
            onClick={() => onContinue(lessonId, currentSectionIndex)}
            className="gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-xs px-5"
          >
            <span>{ctaLabel || "Continue Lesson"}</span>
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Progress Bar with Steps */}
      <div className="pt-3 border-t border-blue-100/80">
        <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
          <span className="font-medium text-slate-700">Lesson Progress</span>
          <span className="font-bold text-blue-700">{progressPercentage}%</span>
        </div>
        <div className="w-full bg-slate-200/80 rounded-full h-2.5 overflow-hidden">
          <div
            className="bg-gradient-to-r from-blue-600 to-indigo-600 h-2.5 rounded-full transition-all duration-500"
            style={{ width: `${Math.max(5, progressPercentage)}%` }}
          />
        </div>
      </div>
    </div>
  );
}
