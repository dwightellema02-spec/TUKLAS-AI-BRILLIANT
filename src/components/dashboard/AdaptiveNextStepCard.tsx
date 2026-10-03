import React from "react";
import { Compass, RefreshCw, CheckCircle2, Sparkles, BookOpen } from "lucide-react";
import { AdaptiveRecommendationCard } from "@/components/adaptive/AdaptiveRecommendationCard";
import type { AdaptiveRecommendationDTO } from "@/lib/adaptive/adaptive-types";
import { Button } from "@/components/ui/Button";

export interface AdaptiveNextStepCardProps {
  recommendation: AdaptiveRecommendationDTO | null;
  onStartActivity: (rec: AdaptiveRecommendationDTO) => void;
  onAskTutor?: (rec: AdaptiveRecommendationDTO) => void;
  onDismiss: (recId: string) => void;
  onRefresh: () => void;
  refreshing?: boolean;
}

export function AdaptiveNextStepCard({
  recommendation,
  onStartActivity,
  onAskTutor,
  onDismiss,
  onRefresh,
  refreshing = false,
}: AdaptiveNextStepCardProps) {
  return (
    <div className="mb-8 space-y-3">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center">
            <Compass className="w-3.5 h-3.5" />
          </div>
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">
            Your Next Step (Adaptive Recommendation)
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onRefresh}
            disabled={refreshing}
            className="text-[11px] h-7 px-2 text-slate-500 hover:text-slate-900 gap-1.5"
          >
            <RefreshCw className={`w-3 h-3 ${refreshing ? "animate-spin" : ""}`} />
            <span>Recalculate</span>
          </Button>
        </div>
      </div>

      {recommendation ? (
        <AdaptiveRecommendationCard
          recommendation={recommendation}
          onStartActivity={onStartActivity}
          onAskTutor={onAskTutor}
          onDismiss={onDismiss}
          onRefresh={onRefresh}
          loading={refreshing}
        />
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 text-center shadow-xs">
          <div className="w-10 h-10 rounded-full bg-teal-50 text-teal-600 flex items-center justify-center mx-auto mb-2">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-bold text-slate-900">
            You are currently on track!
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-4">
            No remedial steps are currently required. Continue your lesson path or tackle a practice set to trigger fresh adaptive guidance.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={refreshing}
            className="text-xs"
          >
            Check for Next Recommended Task
          </Button>
        </div>
      )}
    </div>
  );
}
