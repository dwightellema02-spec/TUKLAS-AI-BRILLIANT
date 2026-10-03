import React from "react";
import { Sparkles, Lightbulb } from "lucide-react";

export interface AITutorHintButtonProps {
  onClick: () => void;
  className?: string;
  label?: string;
  hasMistake?: boolean;
}

export function AITutorHintButton({
  onClick,
  className = "",
  label = "Need a hint?",
  hasMistake = false,
}: AITutorHintButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-medium text-xs sm:text-sm transition-all shadow-xs ${
        hasMistake
          ? "bg-amber-100/90 text-amber-900 border border-amber-300 hover:bg-amber-200/90 animate-pulse"
          : "bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100"
      } ${className}`}
    >
      <Lightbulb className={`w-3.5 h-3.5 ${hasMistake ? "text-amber-600" : "text-emerald-600"}`} />
      <span>{label}</span>
      <Sparkles className="w-3 h-3 text-emerald-500 opacity-80" />
    </button>
  );
}
