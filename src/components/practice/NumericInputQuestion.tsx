import React from "react";
import { Hash } from "lucide-react";

export interface NumericInputQuestionProps {
  value: string;
  onChange: (val: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function NumericInputQuestion({
  value,
  onChange,
  disabled = false,
  placeholder = "Enter numeric value (e.g. -15, 5, 0)",
}: NumericInputQuestionProps) {
  return (
    <div className="space-y-2">
      <label htmlFor="numeric-answer-input" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
        Your Numerical Answer
      </label>
      <div className="relative max-w-sm">
        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
          <Hash className="w-4 h-4" />
        </div>
        <input
          id="numeric-answer-input"
          type="text"
          inputMode="numeric"
          pattern="[0-9\-.]*"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          placeholder={placeholder}
          className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-300 bg-white text-slate-900 font-mono text-base focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-shadow disabled:bg-slate-50 disabled:text-slate-500"
          aria-describedby="numeric-hint"
        />
      </div>
      <p id="numeric-hint" className="text-xs text-slate-500">
        Enter whole integers or decimal numbers. Positive numbers do not require a plus sign.
      </p>
    </div>
  );
}
