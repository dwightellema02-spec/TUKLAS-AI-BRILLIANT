import React from "react";
import { Award, BarChart3, Info } from "lucide-react";
import type { MasteryDistributionDTO } from "@/lib/teacher/teacher-types";

export interface MasteryDistributionCardProps {
  distribution: MasteryDistributionDTO[];
}

export function MasteryDistributionCard({ distribution }: MasteryDistributionCardProps) {
  return (
    <div className="bg-white rounded-3xl border border-slate-200/90 p-5 sm:p-6 shadow-xs mb-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-slate-100">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
              Phase 10 Engine
            </span>
            <span className="text-xs text-slate-400">Classroom Aggregation</span>
          </div>
          <h2 className="text-base sm:text-lg font-black text-slate-900">
            Class Skill Mastery Distribution
          </h2>
        </div>
        <p className="text-xs text-slate-500 max-w-sm">
          Shows mastery progression across verified evidence sources. No individual ranking or leaderboards.
        </p>
      </div>

      <div className="divide-y divide-slate-100 pt-3">
        {distribution.map((skillItem) => {
          const total = Math.max(1, skillItem.totalEvaluated);
          const { MASTERED, PROFICIENT, DEVELOPING, LEARNING, NOT_STARTED } = skillItem.counts;

          const pMastered = Math.round((MASTERED / total) * 100);
          const pProficient = Math.round((PROFICIENT / total) * 100);
          const pDeveloping = Math.round((DEVELOPING / total) * 100);
          const pLearning = Math.round((LEARNING / total) * 100);
          const pNotStarted = Math.round((NOT_STARTED / total) * 100);

          return (
            <div key={skillItem.skillId} className="py-4 space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span className="text-sm font-bold text-slate-900">
                  {skillItem.skillTitle}
                </span>

                {/* Counts pill row */}
                <div className="flex items-center gap-2 text-[11px] font-semibold flex-wrap">
                  <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
                    Mastered: {MASTERED}
                  </span>
                  <span className="text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
                    Proficient: {PROFICIENT}
                  </span>
                  <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-100">
                    Developing: {DEVELOPING}
                  </span>
                  <span className="text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-100">
                    Learning: {LEARNING}
                  </span>
                  {NOT_STARTED > 0 && (
                    <span className="text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                      Not Started: {NOT_STARTED}
                    </span>
                  )}
                </div>
              </div>

              {/* Stacked Percentage Visual Bar */}
              <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden flex shadow-2xs">
                {pMastered > 0 && (
                  <div
                    style={{ width: `${pMastered}%` }}
                    className="bg-emerald-500 h-full"
                    title={`Mastered: ${MASTERED} (${pMastered}%)`}
                  />
                )}
                {pProficient > 0 && (
                  <div
                    style={{ width: `${pProficient}%` }}
                    className="bg-blue-500 h-full"
                    title={`Proficient: ${PROFICIENT} (${pProficient}%)`}
                  />
                )}
                {pDeveloping > 0 && (
                  <div
                    style={{ width: `${pDeveloping}%` }}
                    className="bg-amber-400 h-full"
                    title={`Developing: ${DEVELOPING} (${pDeveloping}%)`}
                  />
                )}
                {pLearning > 0 && (
                  <div
                    style={{ width: `${pLearning}%` }}
                    className="bg-purple-400 h-full"
                    title={`Learning: ${LEARNING} (${pLearning}%)`}
                  />
                )}
                {pNotStarted > 0 && (
                  <div
                    style={{ width: `${pNotStarted}%` }}
                    className="bg-slate-200 h-full"
                    title={`Not Started: ${NOT_STARTED} (${pNotStarted}%)`}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
