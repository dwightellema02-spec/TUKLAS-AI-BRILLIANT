import React from "react";
import katex from "katex";

interface MathTextProps {
  content: string;
  className?: string;
}

export function MathText({ content, className = "" }: MathTextProps) {
  if (!content) return null;

  // Split by double dollar ($$...$$) first for block math, then single dollar ($...$) for inline math
  const renderFormattedSegments = (text: string) => {
    // Regex matching $$...$$ (block) and $...$ (inline)
    const regex = /(\$\$[\s\S]+?\$\$|\$[^\$\n]+?\$)/g;
    const parts = text.split(regex);

    return parts.map((part, idx) => {
      if (part.startsWith("$$") && part.endsWith("$$")) {
        const math = part.slice(2, -2).trim();
        try {
          const html = katex.renderToString(math, {
            displayMode: true,
            throwOnError: false,
          });
          return (
            <div
              key={idx}
              className="my-3 overflow-x-auto py-1"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          );
        } catch {
          return (
            <div key={idx} className="my-2 font-mono text-sm text-slate-700">
              {math}
            </div>
          );
        }
      } else if (part.startsWith("$") && part.endsWith("$")) {
        const math = part.slice(1, -1).trim();
        try {
          const html = katex.renderToString(math, {
            displayMode: false,
            throwOnError: false,
          });
          return (
            <span
              key={idx}
              className="inline-block px-0.5"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          );
        } catch {
          return (
            <span key={idx} className="font-mono text-xs">
              {math}
            </span>
          );
        }
      }

      // Plain text formatting: handle paragraphs, bullet points, bold
      const lines = part.split("\n");
      return (
        <React.Fragment key={idx}>
          {lines.map((line, lineIdx) => {
            const isBullet = line.trim().startsWith("• ") || line.trim().startsWith("- ");
            const cleanLine = isBullet ? line.trim().replace(/^[•\-]\s*/, "") : line;

            // Simple bold parser **text**
            const renderInlineBold = (str: string) => {
              const boldParts = str.split(/(\*\*[^*]+?\*\*)/g);
              return boldParts.map((bp, bIdx) => {
                if (bp.startsWith("**") && bp.endsWith("**")) {
                  return (
                    <strong key={bIdx} className="font-bold text-slate-900">
                      {bp.slice(2, -2)}
                    </strong>
                  );
                }
                return bp;
              });
            };

            if (isBullet) {
              return (
                <div key={lineIdx} className="flex items-start gap-2 my-1 pl-1">
                  <span className="text-blue-500 font-bold leading-relaxed select-none">•</span>
                  <span className="flex-1">{renderInlineBold(cleanLine)}</span>
                </div>
              );
            }

            return (
              <React.Fragment key={lineIdx}>
                {renderInlineBold(line)}
                {lineIdx < lines.length - 1 && <br />}
              </React.Fragment>
            );
          })}
        </React.Fragment>
      );
    });
  };

  return (
    <div className={`leading-relaxed text-slate-700 ${className}`}>
      {renderFormattedSegments(content)}
    </div>
  );
}
