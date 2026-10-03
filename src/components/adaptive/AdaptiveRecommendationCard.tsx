import React from "react";
import {
  Sparkles,
  Compass,
  ArrowRight,
  RotateCcw,
  BookOpen,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  X,
  Target,
  TrendingUp,
  TrendingDown,
  Layers,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import type { AdaptiveRecommendationDTO, AdaptiveDecisionType } from "@/lib/adaptive/adaptive-types";

export interface AdaptiveRecommendationCardProps {
  recommendation: AdaptiveRecommendationDTO;
  onStartActivity?: (rec: AdaptiveRecommendationDTO) => void;
  onAskTutor?: (rec: AdaptiveRecommendationDTO) => void;
  onDismiss?: (recommendationId: string) => void;
  onRefresh?: () => void;
  loading?: boolean;
  className?: string;
}

export function AdaptiveRecommendationCard({
  recommendation,
  onStartActivity,
  onAskTutor,
  onDismiss,
  onRefresh,
  loading = false,
  className = "",
}: AdaptiveRecommendationCardProps) {
  const { decisionType, confidence, targetDifficulty, explanation } = recommendation;

  const getDecisionBadge = (decision: AdaptiveDecisionType) => {
    switch (decision) {
      case "PRACTICE_HARDER":
        return {
          label: "Advance Challenge",
          variant: "success" as const,
          icon: TrendingUp,
          bgClass: "from-emerald-50/80 via-white to-teal-50/50 border-emerald-200",
          accentColor: "text-emerald-700",
        };
      case "PRACTICE_EASIER":
        return {
          label: "Foundational Practice",
          variant: "warning" as const,
          icon: TrendingDown,
          bgClass: "from-amber-50/80 via-white to-orange-50/50 border-amber-200",
          accentColor: "text-amber-700",
        };
      case "REVIEW_PREREQUISITE":
        return {
          label: "Review Prerequisite",
          variant: "info" as const,
          icon: Layers,
          bgClass: "from-blue-50/80 via-white to-indigo-50/50 border-blue-200",
          accentColor: "text-blue-700",
        };
      case "REMEDIATE":
        return {
          label: "Concept Remediation",
          variant: "warning" as const,
          icon: AlertCircle,
          bgClass: "from-rose-50/70 via-white to-amber-50/40 border-rose-200",
          accentColor: "text-rose-700",
        };
      case "PRACTICE_SAME_DIFFICULTY":
      default:
        return {
          label: "Keep Practicing",
          variant: "info" as const,
          icon: Compass,
          bgClass: "from-teal-50/80 via-white to-slate-50 border-teal-200",
          accentColor: "text-teal-700",
        };
    }
  };

  const badgeConfig = getDecisionBadge(decisionType);
  const IconComponent = badgeConfig.icon;

  return (
    <div
      className={`rounded-2xl border bg-gradient-to-br p-5 sm:p-6 shadow-xs space-y-4 transition-all ${badgeConfig.bgClass} ${className}`}
    >
      {/* Top Meta Bar */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-white shadow-2xs border border-slate-200/80 flex items-center justify-center shrink-0">
            <IconComponent className={`w-5 h-5 ${badgeConfig.accentColor}`} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Adaptive Next Step
              </span>
              <Badge variant={badgeConfig.variant} className="text-[10px] uppercase font-bold">
                {badgeConfig.label}
              </Badge>
              {targetDifficulty && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-700">
                  Target: {targetDifficulty}
                </span>
              )}
            </div>
            <h3 className="text-base sm:text-lg font-extrabold text-slate-900 mt-0.5">
              {recommendation.skillTitle || recommendation.lessonTitle || "Recommended Learning Step"}
            </h3>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              disabled={loading}
              title="Recalculate recommendation"
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-white/80 transition-colors cursor-pointer"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            </button>
          )}
          {onDismiss && (
            <button
              type="button"
              onClick={() => onDismiss(recommendation.id)}
              title="Dismiss recommendation"
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-white/80 transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Explanation & Motivation */}
      <div className="space-y-2 bg-white/80 rounded-xl p-4 border border-slate-100/80 text-xs sm:text-sm">
        <p className="text-slate-800 font-medium leading-relaxed">
          {explanation?.message || recommendation.reason}
        </p>

        {explanation?.reason && (
          <div className="text-slate-500 flex items-start gap-1.5 pt-1 border-t border-slate-100">
            <span className="font-semibold text-slate-700 shrink-0">Why:</span>
            <span>{explanation.reason}</span>
          </div>
        )}

        {explanation?.encouragement && (
          <div className="text-emerald-700 font-medium flex items-center gap-1.5 pt-0.5 text-[11px] sm:text-xs">
            <Sparkles className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span>{explanation.encouragement}</span>
          </div>
        )}
      </div>

      {/* Recommended Activity Details & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
        <div className="text-xs text-slate-600">
          <span className="font-bold text-slate-800">Action: </span>
          <span>{recommendation.recommendedActivityTitle || explanation?.nextStep || "Complete guided practice"}</span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {onAskTutor && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onAskTutor(recommendation)}
              className="gap-1.5 text-xs bg-white text-teal-800 border-teal-200 hover:bg-teal-50"
            >
              <Sparkles className="w-3.5 h-3.5 text-teal-600" />
              <span>Ask AI Tutor</span>
            </Button>
          )}

          {onStartActivity && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => onStartActivity(recommendation)}
              className="gap-1.5 text-xs font-bold"
            >
              <span>Start Activity</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
