import React from "react";
import { MathText } from "@/components/ui/MathText";

export interface TextBlockProps {
  title?: string;
  content: string;
}

export function TextBlock({ title, content }: TextBlockProps) {
  return (
    <div className="space-y-4">
      {title && (
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
          {title}
        </h2>
      )}
      <div className="text-sm sm:text-base leading-relaxed text-slate-700 font-normal">
        <MathText content={content} />
      </div>
    </div>
  );
}
