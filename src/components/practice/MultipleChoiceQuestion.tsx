import React from "react";
import { MathText } from "@/components/ui/MathText";

export interface MultipleChoiceQuestionProps {
  choices: Array<{ id: string; text: string }>;
  value: string;
  onChange: (val: string) => void;
  disabled?: boolean;
}

export function MultipleChoiceQuestion({
  choices,
  value,
  onChange,
  disabled = false,
}: MultipleChoiceQuestionProps) {
  const letters = ["A", "B", "C", "D", "E", "F"];

  return (
    <div className="space-y-3" role="radiogroup" aria-label="Multiple choice options">
      {choices.map((choice, index) => {
        const isSelected = value === choice.id || value === choice.text;
        const letter = letters[index % letters.length];

        return (
          <button
            key={choice.id || index}
            type="button"
            role="radio"
            aria-checked={isSelected}
            disabled={disabled}
            onClick={() => onChange(choice.id)}
            className={`w-full p-4 rounded-xl border text-left flex items-center gap-3 transition-all cursor-pointer select-none focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-1 ${
              isSelected
                ? "border-teal-600 bg-teal-50/70 text-teal-950 font-medium shadow-xs"
                : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 text-slate-800"
            } ${disabled ? "opacity-75 cursor-not-allowed" : ""}`}
          >
            <div
              className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 transition-colors ${
                isSelected
                  ? "bg-teal-600 text-white"
                  : "bg-slate-100 text-slate-600 border border-slate-200"
              }`}
            >
              {letter}
            </div>
            <div className="text-sm sm:text-base flex-1">
              <MathText content={choice.text} />
            </div>
          </button>
        );
      })}
    </div>
  );
}
