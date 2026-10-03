/**
 * Tuklas AI - Skill Mastery Card Component
 * Summarizes student evidence & status for a single skill
 */

import React from "react";
import { ArrowRight, BarChart2, Sparkles, AlertCircle, Clock } from "lucide-react";
import { MasteryBadge } from "./MasteryBadge";
import { Button } from "@/components/ui/Button";
import type { SkillMasteryDTO } from "@/lib/mastery/mastery-types";

interface SkillMasteryCardProps {
  mastery: SkillMasteryDTO;
  onInspectEvidence?: (mastery: SkillMasteryDTO) => void;
  onPracticeSkill?: (skillId: string) => void;
  className?: string;
}

export function SkillMasteryCard({
  mastery,
  onInspectEvidence,
  onPracticeSkill,
  className = "",
}: SkillMasteryCardProps) {
  const {
    skillTitle,
    lessonTitle,
    status,
    accuracy,
    recentAccuracy,
    consistencyScore,
    applicationScore,
    attemptCount,
    explanation,
    metadata,
  } = mastery;

  const accuracyPct = Math.round(accuracy * 100);
  const recentPct = Math.round(recentAccuracy * 100);
  const consistencyPct = Math.round(consistencyScore * 100);
  const applicationPct = Math.round(applicationScore * 100);

  return (
    <div
      className={`rounded-2xl border bg-white p-5 shadow-xs hover:shadow-md transition-all space-y-4 border-slate-200/90 ${className}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          {lessonTitle && (
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
              {lessonTitle}
            </span>
          )}
          <h3 className="text-base font-bold text-slate-900 leading-snug">{skillTitle}</h3>
        </div>
        <MasteryBadge level={status} size="md" />
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-center">
        <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
            Overall Accuracy
          </span>
          <span className="text-base font-extrabold text-slate-900">{accuracyPct}%</span>
          <span className="text-[10px] text-slate-400 block">{attemptCount} attempts</span>
        </div>

        <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
            Recent Window
          </span>
          <span className="text-base font-extrabold text-blue-600">{recentPct}%</span>
          <span className="text-[10px] text-slate-400 block">Last 5 questions</span>
        </div>

        <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
            Consistency
          </span>
          <span className="text-base font-extrabold text-teal-700">{consistencyPct}%</span>
          <span className="text-[10px] text-slate-400 block">Stability index</span>
        </div>

        <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
            Application
          </span>
          <span className="text-base font-extrabold text-indigo-600">{applicationPct}%</span>
          <span className="text-[10px] text-slate-400 block">Higher-order</span>
        </div>
      </div>

      {/* Pedagogical Explanation */}
      <div className="p-3.5 rounded-xl bg-slate-50/70 border border-slate-100 text-xs space-y-1">
        <p className="text-slate-700 font-medium leading-relaxed">
          {explanation?.summary || mastery.evidenceSummary}
        </p>
        {explanation?.why && (
          <p className="text-slate-500 text-[11px] leading-relaxed">
            <span className="font-semibold text-slate-600">Why: </span>
            {explanation.why}
          </p>
        )}
      </div>

      {/* Warning flags if any */}
      {metadata?.flags?.prerequisiteConcern && (
        <div className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50/80 px-3 py-1.5 rounded-lg border border-amber-200">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>Prerequisite weakness detected. Recommended to review foundational concepts.</span>
        </div>
      )}

      {/* Footer Actions */}
      <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100">
        <span className="text-[11px] text-slate-400 flex items-center gap-1">
          <Clock className="w-3 h-3" />
          <span>Evaluated: {new Date(mastery.lastEvaluatedAt).toLocaleDateString()}</span>
        </span>

        <div className="flex items-center gap-2">
          {onInspectEvidence && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onInspectEvidence(mastery)}
              className="text-xs gap-1 cursor-pointer"
            >
              <BarChart2 className="w-3.5 h-3.5" />
              <span>Evidence Detail</span>
            </Button>
          )}

          {onPracticeSkill && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => onPracticeSkill(mastery.skillId)}
              className="text-xs gap-1 cursor-pointer"
            >
              <span>Practice</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
