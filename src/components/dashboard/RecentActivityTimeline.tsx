import React from "react";
import {
  Clock,
  CheckCircle2,
  XCircle,
  Award,
  BookOpen,
  ArrowRight,
  HelpCircle,
  Sparkles,
} from "lucide-react";
import type { RecentActivityItemDTO } from "@/lib/dashboard/student-dashboard-types";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

export interface RecentActivityTimelineProps {
  activities: RecentActivityItemDTO[];
  onNavigateItem: (url: string) => void;
  onViewAll?: () => void;
}

export function RecentActivityTimeline({
  activities,
  onNavigateItem,
  onViewAll,
}: RecentActivityTimelineProps) {
  const formatTimeAgo = (isoString: string) => {
    try {
      const date = new Date(isoString);
      const diffSec = Math.floor((Date.now() - date.getTime()) / 1000);

      if (diffSec < 60) return "Just now";
      if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
      if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
      if (diffSec < 604800) return `${Math.floor(diffSec / 86400)}d ago`;

      return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    } catch {
      return "Recent";
    }
  };

  const getActivityIcon = (act: RecentActivityItemDTO) => {
    switch (act.type) {
      case "PRACTICE_SESSION":
        return <Award className="w-4 h-4 text-amber-500" />;
      case "CHECKPOINT":
        return act.isCorrect ? (
          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
        ) : (
          <HelpCircle className="w-4 h-4 text-amber-500" />
        );
      case "QUESTION_ATTEMPT":
        return act.isCorrect ? (
          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
        ) : (
          <XCircle className="w-4 h-4 text-red-500" />
        );
      case "AI_TUTOR_SESSION":
        return <Sparkles className="w-4 h-4 text-indigo-500" />;
      default:
        return <BookOpen className="w-4 h-4 text-blue-500" />;
    }
  };

  return (
    <div className="mb-8 space-y-3">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <Clock className="w-3.5 h-3.5" />
          </div>
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">
            Recent Learning Activity
          </h2>
        </div>
        {onViewAll && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onViewAll}
            className="text-xs text-blue-600 hover:text-blue-800"
          >
            Practice History
          </Button>
        )}
      </div>

      {activities.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center shadow-xs">
          <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-2">
            <Clock className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-bold text-slate-700">No activity recorded yet</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
            Complete your first interactive lesson or answer practice questions to see your progress timeline here.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100 shadow-xs overflow-hidden">
          {activities.map((act) => (
            <div
              key={act.id}
              onClick={() => act.url && onNavigateItem(act.url)}
              className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/80 transition-colors ${
                act.url ? "cursor-pointer group" : ""
              }`}
            >
              <div className="flex items-start sm:items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center shrink-0 mt-0.5 sm:mt-0">
                  {getActivityIcon(act)}
                </div>

                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                      {act.title}
                    </span>
                    {act.score && (
                      <span className="text-[11px] font-bold text-slate-600 bg-slate-100 px-2 py-0.2 rounded-md">
                        {act.score}
                      </span>
                    )}
                    {act.accuracy !== undefined && (
                      <Badge
                        variant={act.accuracy >= 80 ? "success" : act.accuracy >= 60 ? "info" : "warning"}
                        className="text-[10px]"
                      >
                        {act.accuracy}%
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 line-clamp-1">
                    {act.description}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 text-xs text-slate-400 pl-11 sm:pl-0">
                <span>{formatTimeAgo(act.timestamp)}</span>
                {act.actionLabel && (
                  <span className="text-blue-600 font-semibold group-hover:underline flex items-center gap-1">
                    {act.actionLabel}
                    <ArrowRight className="w-3 h-3" />
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
