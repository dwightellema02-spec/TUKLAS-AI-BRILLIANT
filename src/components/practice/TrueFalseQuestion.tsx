import React from "react";
import { Check, X } from "lucide-react";

export interface TrueFalseQuestionProps {
  value: boolean | null;
  onChange: (val: boolean) => void;
  disabled?: boolean;
}

export function TrueFalseQuestion({
  value,
  onChange,
  disabled = false,
}: TrueFalseQuestionProps) {
  return (
    <div className="grid grid-cols-2 gap-4 max-w-sm" role="radiogroup" aria-label="True or False options">
      <button
        type="button"
        role="radio"
        aria-checked={value === true}
        disabled={disabled}
        onClick={() => onChange(true)}
        className={`p-5 rounded-xl border flex flex-col items-center justify-center gap-2 transition-all cursor-pointer select-none focus:outline-none focus:ring-2 focus:ring-teal-500 ${
          value === true
            ? "border-teal-600 bg-teal-50 text-teal-900 font-bold shadow-xs ring-1 ring-teal-600"
            : "border-slate-200 bg-white hover:bg-slate-50 text-slate-800"
        } ${disabled ? "opacity-75 cursor-not-allowed" : ""}`}
      >
        <div
          className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
            value === true ? "bg-teal-600 text-white" : "bg-slate-100 text-slate-500"
          }`}
        >
          <Check className="w-5 h-5 stroke-[2.5]" />
        </div>
        <span className="text-base font-semibold">True</span>
      </button>

      <button
        type="button"
        role="radio"
        aria-checked={value === false}
        disabled={disabled}
        onClick={() => onChange(false)}
        className={`p-5 rounded-xl border flex flex-col items-center justify-center gap-2 transition-all cursor-pointer select-none focus:outline-none focus:ring-2 focus:ring-amber-500 ${
          value === false
            ? "border-amber-600 bg-amber-50 text-amber-900 font-bold shadow-xs ring-1 ring-amber-600"
            : "border-slate-200 bg-white hover:bg-slate-50 text-slate-800"
        } ${disabled ? "opacity-75 cursor-not-allowed" : ""}`}
      >
        <div
          className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
            value === false ? "bg-amber-600 text-white" : "bg-slate-100 text-slate-500"
          }`}
        >
          <X className="w-5 h-5 stroke-[2.5]" />
        </div>
        <span className="text-base font-semibold">False</span>
      </button>
    </div>
  );
}
