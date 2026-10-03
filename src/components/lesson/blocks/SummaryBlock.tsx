import React from "react";
import { Award, CheckCircle2 } from "lucide-react";
import { MathText } from "@/components/ui/MathText";

export interface SummaryBlockProps {
  title?: string;
  content: string; // Bullet points or text
}

export function SummaryBlock({ title, content }: SummaryBlockProps) {
  return (
    <div className="rounded-2xl border border-slate-900 bg-slate-900 text-white p-6 sm:p-8 shadow-md space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-teal-500 text-slate-950 flex items-center justify-center shrink-0 shadow-xs">
          <Award className="w-5 h-5 font-bold" />
        </div>
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-teal-400 block">
            Lesson Recap & Key Takeaways
          </span>
          <h2 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
            {title || "What You Learned"}
          </h2>
        </div>
      </div>

      <div className="text-sm sm:text-base leading-relaxed text-slate-200">
        <MathText content={content} />
      </div>

      <div className="pt-3 border-t border-slate-800 flex items-center gap-2 text-xs text-teal-300">
        <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0" />
        <span>You have reached the end of the conceptual learning sections!</span>
      </div>
    </div>
  );
}
