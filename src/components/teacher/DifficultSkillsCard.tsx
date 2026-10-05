import React from "react";
import { AlertCircle, TrendingDown, ChevronRight, HelpCircle } from "lucide-react";
import type { DifficultSkillDTO } from "@/lib/teacher/teacher-types";

export interface DifficultSkillsCardProps {
  skills: DifficultSkillDTO[];
  onInspectSkill?: (skillId: string) => void;
}

export function DifficultSkillsCard({ skills, onInspectSkill }: DifficultSkillsCardProps) {
  if (skills.length === 0) {
    return (
      <div className="bg-white rounded-3xl border border-slate-200/90 p-6 shadow-xs mb-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <TrendingDown className="w-5 h-5 rotate-180" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              No Skills Needing Urgent Attention
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Class performance indicates healthy progress across all active curriculum skills.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-3xl border border-slate-200/90 p-5 sm:p-6 shadow-xs mb-8">
      <div className="flex items-center justify-between pb-4 border-b border-slate-100">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100">
              Formative Alert
            </span>
            <span className="text-xs text-slate-400">Class Diagnostics</span>
          </div>
          <h2 className="text-base sm:text-lg font-black text-slate-900">
            Skills Needing Attention
          </h2>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-4">
        {skills.map((skill) => (
          <div
            key={skill.skillId}
            onClick={() => onInspectSkill && onInspectSkill(skill.skillId)}
            className="p-4 rounded-2xl border border-amber-200/80 bg-gradient-to-br from-amber-50/40 via-white to-orange-50/20 hover:border-amber-300 hover:shadow-xs transition-all cursor-pointer group space-y-2"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-bold text-slate-900 group-hover:text-amber-700 transition-colors">
                {skill.skillTitle}
              </span>
              <span className="text-xs font-bold text-amber-700 bg-amber-100/80 px-2 py-0.5 rounded-md">
                {skill.averageAccuracy === null ? "No accuracy data" : `${skill.averageAccuracy}% Avg Acc`}
              </span>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              {skill.reason}
            </p>

            <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-amber-100/60">
              <span>{skill.developingOrLearningCount} students developing/learning</span>
              <span className="text-blue-600 font-semibold group-hover:underline flex items-center gap-0.5">
                Inspect Evidence
                <ChevronRight className="w-3 h-3" />
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
