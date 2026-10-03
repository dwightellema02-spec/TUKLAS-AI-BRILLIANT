import React, { useState } from "react";
import { Sparkles, Minus, Plus, Compass, ArrowLeftRight } from "lucide-react";
import { MathText } from "@/components/ui/MathText";
import { Button } from "@/components/ui/Button";

export interface InteractiveBlockProps {
  title?: string;
  content: string;
  metadata?: string;
  onComplete?: () => void;
  readOnly?: boolean;
}

export function InteractiveBlock({
  title,
  content,
  metadata,
  onComplete,
  readOnly = false,
}: InteractiveBlockProps) {
  const [valA, setValA] = useState<number>(-3);
  const [valB, setValB] = useState<number>(4);
  const [compareMode, setCompareMode] = useState<boolean>(true);
  const [hasInteracted, setHasInteracted] = useState<boolean>(false);

  const range = [-6, -5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6];

  const handleSelectA = (n: number) => {
    setValA(n);
    if (!hasInteracted) {
      setHasInteracted(true);
      if (onComplete) onComplete();
    }
  };

  const handleSelectB = (n: number) => {
    setValB(n);
    if (!hasInteracted) {
      setHasInteracted(true);
      if (onComplete) onComplete();
    }
  };

  const absA = Math.abs(valA);
  const oppositeA = -valA;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center shrink-0">
            <Compass className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-teal-700 block">
              Interactive Math Model
            </span>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              {title || "Integer Number Line Explorer"}
            </h2>
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => setCompareMode(!compareMode)}
          className="text-xs gap-1.5"
        >
          <ArrowLeftRight className="w-3.5 h-3.5" />
          <span>{compareMode ? "Single Value" : "Compare Values"}</span>
        </Button>
      </div>

      {content && (
        <div className="text-sm text-slate-600 leading-relaxed">
          <MathText content={content} />
        </div>
      )}

      {/* Main Interactive Stage */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7 shadow-xs space-y-6">
        {/* Interactive Number Line Visualization */}
        <div className="py-4 px-2 bg-slate-50 rounded-xl border border-slate-200 overflow-x-auto">
          <div className="min-w-[540px] px-4 py-6 relative">
            {/* Axis Horizontal Line */}
            <div className="h-1 bg-slate-400 w-full relative top-3.5 rounded-full" />

            {/* Left and Right directional arrows */}
            <div className="absolute left-1 top-6.5 -translate-y-1/2 text-slate-500 font-bold text-xs select-none">
              ◀ Negative (Decreasing)
            </div>
            <div className="absolute right-1 top-6.5 -translate-y-1/2 text-slate-500 font-bold text-xs select-none">
              Positive (Increasing) ▶
            </div>

            {/* Axis Tick Nodes */}
            <div className="flex justify-between items-center relative z-10 pt-1">
              {range.map((num) => {
                const isA = num === valA;
                const isB = compareMode && num === valB;
                const isZero = num === 0;

                return (
                  <div key={num} className="flex flex-col items-center">
                    {/* Active Point Indicator Marker */}
                    <div className="h-7 flex items-end">
                      {isA && (
                        <div className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold text-[11px] flex items-center justify-center shadow-md animate-bounce">
                          A
                        </div>
                      )}
                      {isB && !isA && (
                        <div className="w-6 h-6 rounded-full bg-amber-500 text-white font-bold text-[11px] flex items-center justify-center shadow-md animate-bounce">
                          B
                        </div>
                      )}
                      {isA && isB && (
                        <div className="w-6 h-6 rounded-full bg-purple-600 text-white font-bold text-[10px] flex items-center justify-center shadow-md">
                          A,B
                        </div>
                      )}
                    </div>

                    {/* Tick Mark */}
                    <div
                      className={`w-0.5 ${
                        isZero ? "h-5 bg-slate-900 w-1" : "h-3 bg-slate-400"
                      }`}
                    />

                    {/* Numeric Clickable Label */}
                    <button
                      type="button"
                      onClick={() => (compareMode && valA !== num ? handleSelectB(num) : handleSelectA(num))}
                      className={`mt-2 min-w-[32px] h-8 rounded-lg font-mono text-xs sm:text-sm font-semibold transition-all flex items-center justify-center ${
                        isA
                          ? "bg-blue-600 text-white shadow-xs"
                          : isB
                          ? "bg-amber-500 text-white shadow-xs"
                          : isZero
                          ? "bg-slate-800 text-white font-bold"
                          : "text-slate-700 hover:bg-slate-200"
                      }`}
                    >
                      {num > 0 ? `+${num}` : num}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Stepper Controls and Mathematics Analysis Deck */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Analysis for Value A */}
          <div className="p-4 rounded-xl bg-blue-50/60 border border-blue-200 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-800">
                Selected Value A
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={valA <= -6}
                  onClick={() => handleSelectA(valA - 1)}
                  className="w-7 h-7 rounded bg-white border border-blue-200 hover:bg-blue-50 flex items-center justify-center disabled:opacity-30"
                >
                  <Minus className="w-3.5 h-3.5 text-blue-700" />
                </button>
                <span className="font-mono font-bold text-sm text-blue-900 w-8 text-center">
                  {valA > 0 ? `+${valA}` : valA}
                </span>
                <button
                  type="button"
                  disabled={valA >= 6}
                  onClick={() => handleSelectA(valA + 1)}
                  className="w-7 h-7 rounded bg-white border border-blue-200 hover:bg-blue-50 flex items-center justify-center disabled:opacity-30"
                >
                  <Plus className="w-3.5 h-3.5 text-blue-700" />
                </button>
              </div>
            </div>

            <div className="text-xs space-y-1 text-blue-950 font-medium pt-1">
              <div>
                • <strong>Classification:</strong>{" "}
                {valA > 0
                  ? "Positive Integer (greater than 0)"
                  : valA < 0
                  ? "Negative Integer (less than 0)"
                  : "Zero (Neutral origin)"}
              </div>
              <div>
                • <strong>Absolute Value:</strong> $|{valA}| = {absA}$ (Distance from 0)
              </div>
              <div>
                • <strong>Opposite Value:</strong> $-({valA}) = {oppositeA > 0 ? `+${oppositeA}` : oppositeA}$
              </div>
            </div>
          </div>

          {/* Comparative Analysis */}
          {compareMode ? (
            <div className="p-4 rounded-xl bg-amber-50/60 border border-amber-200 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-800">
                  Value B Comparison
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={valB <= -6}
                    onClick={() => handleSelectB(valB - 1)}
                    className="w-7 h-7 rounded bg-white border border-amber-200 hover:bg-amber-50 flex items-center justify-center disabled:opacity-30"
                  >
                    <Minus className="w-3.5 h-3.5 text-amber-700" />
                  </button>
                  <span className="font-mono font-bold text-sm text-amber-900 w-8 text-center">
                    {valB > 0 ? `+${valB}` : valB}
                  </span>
                  <button
                    type="button"
                    disabled={valB >= 6}
                    onClick={() => handleSelectB(valB + 1)}
                    className="w-7 h-7 rounded bg-white border border-amber-200 hover:bg-amber-50 flex items-center justify-center disabled:opacity-30"
                  >
                    <Plus className="w-3.5 h-3.5 text-amber-700" />
                  </button>
                </div>
              </div>

              <div className="text-xs space-y-1 text-amber-950 font-medium pt-1">
                <div>
                  • <strong>Inequality Relation:</strong>{" "}
                  <span className="font-bold text-sm">
                    {valA < valB ? `${valA} < ${valB}` : valA > valB ? `${valA} > ${valB}` : `${valA} = ${valB}`}
                  </span>
                </div>
                <div>
                  • <strong>Pedagogical Reason:</strong>{" "}
                  {valA < valB
                    ? `${valA} is to the LEFT of ${valB} on the line.`
                    : valA > valB
                    ? `${valA} is to the RIGHT of ${valB} on the line.`
                    : "Both points coincide at the exact same location."}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center text-xs text-slate-500">
              Click &quot;Compare Values&quot; to inspect inequality relationships between two points.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
