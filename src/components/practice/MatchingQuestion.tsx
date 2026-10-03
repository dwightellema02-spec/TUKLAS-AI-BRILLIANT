import React from "react";
import { ArrowRight, Link } from "lucide-react";
import { MathText } from "@/components/ui/MathText";

export interface MatchingQuestionProps {
  leftItems: string[];
  rightOptions: string[];
  value: Record<string, string>; // { [left]: selectedRight }
  onChange: (val: Record<string, string>) => void;
  disabled?: boolean;
}

export function MatchingQuestion({
  leftItems = [],
  rightOptions = [],
  value = {},
  onChange,
  disabled = false,
}: MatchingQuestionProps) {
  const handleSelect = (left: string, right: string) => {
    if (disabled) return;
    onChange({
      ...value,
      [left]: right,
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 uppercase tracking-wider">
        <Link className="w-3.5 h-3.5 text-teal-600" />
        <span>Match each item on the left with its correct partner on the right</span>
      </div>

      <div className="space-y-3">
        {leftItems.map((left, idx) => {
          const currentRight = value[left] || "";

          return (
            <div
              key={idx}
              className="p-3.5 sm:p-4 rounded-xl border border-slate-200 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs"
            >
              <div className="flex items-center gap-2 font-medium text-slate-900 text-sm sm:text-base">
                <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-600 text-xs flex items-center justify-center font-bold">
                  {idx + 1}
                </span>
                <MathText content={left} />
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <ArrowRight className="w-4 h-4 text-slate-400 shrink-0 hidden sm:block" />
                <select
                  aria-label={`Match for ${left}`}
                  value={currentRight}
                  onChange={(e) => handleSelect(left, e.target.value)}
                  disabled={disabled}
                  className="w-full sm:w-48 px-3 py-2 rounded-lg border border-slate-300 bg-slate-50 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white disabled:opacity-70"
                >
                  <option value="">Select match...</option>
                  {rightOptions.map((opt, oIdx) => (
                    <option key={oIdx} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
