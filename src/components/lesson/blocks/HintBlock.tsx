import React, { useState } from "react";
import { Lightbulb, ChevronDown, ChevronUp } from "lucide-react";
import { MathText } from "@/components/ui/MathText";
import { Button } from "@/components/ui/Button";

export interface HintBlockProps {
  title?: string;
  content: string; // The hint guidance text
}

export function HintBlock({ title, content }: HintBlockProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="rounded-2xl border border-amber-200/80 bg-amber-50/50 p-5 sm:p-6 shadow-2xs space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
            <Lightbulb className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 block">
              Helpful Thinking Strategy
            </span>
            <h3 className="text-base sm:text-lg font-bold text-slate-900">
              {title || "Need help thinking about this concept?"}
            </h3>
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsOpen(!isOpen)}
          className="gap-1.5 text-xs self-start sm:self-auto border-amber-300 text-amber-900 hover:bg-amber-100"
        >
          <span>{isOpen ? "Hide Hint" : "Show Hint"}</span>
          {isOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </Button>
      </div>

      {isOpen && (
        <div className="mt-3 pt-3 border-t border-amber-200/60 text-sm text-slate-800 leading-relaxed animate-in fade-in duration-200 pl-1">
          <MathText content={content} />
        </div>
      )}
    </div>
  );
}
