import React from "react";
import { Equal } from "lucide-react";

export interface EquationQuestionProps {
  value: string;
  onChange: (val: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function EquationQuestion({
  value,
  onChange,
  disabled = false,
  placeholder = "e.g. x = 7 or 7",
}: EquationQuestionProps) {
  return (
    <div className="space-y-2">
      <label htmlFor="equation-answer-input" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
        Your Equation Solution
      </label>
      <div className="relative max-w-sm">
        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
          <Equal className="w-4 h-4" />
        </div>
        <input
          id="equation-answer-input"
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          placeholder={placeholder}
          className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-300 bg-white text-slate-900 font-mono text-base focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-shadow disabled:bg-slate-50 disabled:text-slate-500"
        />
      </div>
      <p className="text-xs text-slate-500">
        You may write the variable equation (such as <code className="px-1 py-0.5 bg-slate-100 rounded text-slate-800">x = 7</code>) or just the numeric root (<code className="px-1 py-0.5 bg-slate-100 rounded text-slate-800">7</code>).
      </p>
    </div>
  );
}
