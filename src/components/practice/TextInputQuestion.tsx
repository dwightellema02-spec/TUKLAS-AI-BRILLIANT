import React from "react";
import { Type } from "lucide-react";

export interface TextInputQuestionProps {
  value: string;
  onChange: (val: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function TextInputQuestion({
  value,
  onChange,
  disabled = false,
  placeholder = "Type your answer...",
}: TextInputQuestionProps) {
  return (
    <div className="space-y-2">
      <label htmlFor="text-answer-input" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
        Your Answer
      </label>
      <div className="relative max-w-md">
        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
          <Type className="w-4 h-4" />
        </div>
        <input
          id="text-answer-input"
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          placeholder={placeholder}
          className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-300 bg-white text-slate-900 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-shadow disabled:bg-slate-50 disabled:text-slate-500"
        />
      </div>
      <p className="text-xs text-slate-500">
        Answers are normalized for capitalization and leading/trailing spacing.
      </p>
    </div>
  );
}
