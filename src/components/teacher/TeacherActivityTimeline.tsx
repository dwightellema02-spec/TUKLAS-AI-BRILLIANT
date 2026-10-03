import React from "react";
import { Clock, CheckCircle2, Award, BookOpen, Sparkles, ArrowRight } from "lucide-react";
import type { TeacherActivityItemDTO } from "@/lib/teacher/teacher-types";

export interface TeacherActivityTimelineProps {
  activities: TeacherActivityItemDTO[];
}

export function TeacherActivityTimeline({ activities }: TeacherActivityTimelineProps) {
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

  const getIcon = (type: string) => {
    switch (type) {
      case "PRACTICE_SUBMITTED":
        return <Award className="w-4 h-4 text-amber-500" />;
      case "LESSON_PUBLISHED":
        return <BookOpen className="w-4 h-4 text-teal-500" />;
      case "MASTERY_IMPROVED":
        return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
      default:
        return <Sparkles className="w-4 h-4 text-blue-500" />;
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200/90 p-5 sm:p-6 shadow-xs mb-8">
      <div className="flex items-center justify-between pb-4 border-b border-slate-100">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
            Classroom Log
          </span>
          <h2 className="text-base sm:text-lg font-black text-slate-900 mt-0.5">
            Recent Class Activity
          </h2>
        </div>
      </div>

      {activities.length === 0 ? (
        <div className="p-8 text-center text-xs text-slate-400">
          No classroom events recorded yet.
        </div>
      ) : (
        <div className="divide-y divide-slate-100 pt-1">
          {activities.map((act) => (
            <div key={act.id} className="py-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                  {getIcon(act.type)}
                </div>
                <div>
                  <span className="text-xs font-bold text-slate-900 block">
                    {act.title}
                  </span>
                  <span className="text-[11px] text-slate-500 line-clamp-1">
                    {act.description}
                  </span>
                </div>
              </div>

              <span className="text-[11px] text-slate-400 shrink-0">
                {formatTimeAgo(act.timestamp)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
