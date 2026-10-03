import React from "react";
import { Award, Layers, TrendingUp, CheckCircle2, ChevronRight, BarChart2, ShieldCheck } from "lucide-react";
import { MasteryBadge } from "@/components/mastery/MasteryBadge";
import type { ProgressSummaryDTO, UnitProgressDTO } from "@/lib/dashboard/student-dashboard-types";
import { Button } from "@/components/ui/Button";

export interface ProgressOverviewSectionProps {
  unit: UnitProgressDTO;
  progressSummary: ProgressSummaryDTO;
  onNavigateSkill: (skillId: string) => void;
  onViewAllSkills?: () => void;
}

export function ProgressOverviewSection({
  unit,
  progressSummary,
  onNavigateSkill,
  onViewAllSkills,
}: ProgressOverviewSectionProps) {
  const { masteryCounts, overallAccuracy, totalAttempts, skills } = progressSummary;

  return (
    <div className="mb-8 space-y-4">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <BarChart2 className="w-3.5 h-3.5" />
          </div>
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">
            Current Learning Progress & Skill Mastery
          </h2>
        </div>
        {onViewAllSkills && (
          <button
            onClick={onViewAllSkills}
            className="text-xs text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1"
          >
            <span>View Learning Path</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Top 2 Summary Cards: Unit Progress + Overall Accuracy */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Unit Completion Card */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Unit Curriculum
            </span>
            <span className="text-xs font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">
              {unit.progressPercentage}% Complete
            </span>
          </div>

          <div>
            <h3 className="text-sm font-bold text-slate-900 line-clamp-1">
              {unit.title}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {unit.completedLessons} of {unit.totalLessons} lessons finished
            </p>
          </div>

          <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-500"
              style={{ width: `${unit.progressPercentage}%` }}
            />
          </div>
        </div>

        {/* Practice Accuracy & Attempts */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Evidence-Based Performance
            </span>
            <span className="text-xs font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
              {overallAccuracy}% Accuracy
            </span>
          </div>

          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900">
              {totalAttempts}
            </span>
            <span className="text-xs text-slate-500">
              practice question attempts evaluated
            </span>
          </div>

          <div className="flex items-center gap-4 text-xs text-slate-500 pt-1 border-t border-slate-100">
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
              Multi-source signals
            </span>
            <span>•</span>
            <span className="text-slate-600 font-medium">Phase 10 Evaluated</span>
          </div>
        </div>
      </div>

      {/* Mastery Status Breakdown Counters */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
        <div className="bg-white rounded-xl border border-emerald-200/80 p-3 text-center shadow-2xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 block">
            Mastered
          </span>
          <span className="text-xl font-extrabold text-emerald-700">
            {masteryCounts.MASTERED || 0}
          </span>
        </div>

        <div className="bg-white rounded-xl border border-blue-200/80 p-3 text-center shadow-2xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 block">
            Proficient
          </span>
          <span className="text-xl font-extrabold text-blue-700">
            {masteryCounts.PROFICIENT || 0}
          </span>
        </div>

        <div className="bg-white rounded-xl border border-amber-200/80 p-3 text-center shadow-2xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 block">
            Developing
          </span>
          <span className="text-xl font-extrabold text-amber-700">
            {masteryCounts.DEVELOPING || 0}
          </span>
        </div>

        <div className="bg-white rounded-xl border border-purple-200/80 p-3 text-center shadow-2xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700 block">
            Learning
          </span>
          <span className="text-xl font-extrabold text-purple-700">
            {masteryCounts.LEARNING || 0}
          </span>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-3 text-center shadow-2xs col-span-2 sm:col-span-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
            Not Started
          </span>
          <span className="text-xl font-extrabold text-slate-700">
            {masteryCounts.NOT_STARTED || 0}
          </span>
        </div>
      </div>

      {/* Grid of Key Skills with Mastery Status */}
      {skills.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          {skills.map((skill) => (
            <div
              key={skill.id}
              onClick={() => onNavigateSkill(skill.id)}
              className="p-4 rounded-2xl border border-slate-200 bg-white hover:border-blue-300 hover:shadow-xs transition-all cursor-pointer group space-y-2.5"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-bold text-slate-900 group-hover:text-blue-600 transition-colors line-clamp-1">
                  {skill.title}
                </span>
                <MasteryBadge level={skill.status} size="sm" />
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1.5 border-t border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-700">
                    {skill.accuracy}% accuracy
                  </span>
                  <span>•</span>
                  <span>{skill.attemptCount} attempts</span>
                </div>
                <span className="text-blue-600 font-semibold group-hover:underline flex items-center gap-0.5">
                  Inspect
                  <ChevronRight className="w-3 h-3" />
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
