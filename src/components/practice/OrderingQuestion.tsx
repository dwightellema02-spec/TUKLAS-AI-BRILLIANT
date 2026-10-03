import React from "react";
import { ArrowUp, ArrowDown, GripVertical } from "lucide-react";
import { MathText } from "@/components/ui/MathText";

export interface OrderingQuestionProps {
  items: string[];
  value: string[];
  onChange: (val: string[]) => void;
  disabled?: boolean;
}

export function OrderingQuestion({
  items = [],
  value = [],
  onChange,
  disabled = false,
}: OrderingQuestionProps) {
  // If value is empty, initialize with items
  const currentList = value && value.length === items.length ? value : items;

  const move = (fromIndex: number, toIndex: number) => {
    if (disabled) return;
    if (toIndex < 0 || toIndex >= currentList.length) return;
    const next = [...currentList];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    onChange(next);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs font-semibold text-slate-700 uppercase tracking-wider">
        <span>Arrange sequence using buttons</span>
        <span className="text-[11px] text-slate-500 font-normal lowercase">top = first, bottom = last</span>
      </div>

      <div className="space-y-2" role="list">
        {currentList.map((item, index) => {
          const isFirst = index === 0;
          const isLast = index === currentList.length - 1;

          return (
            <div
              key={`${item}-${index}`}
              role="listitem"
              className="p-3 sm:p-4 rounded-xl border border-slate-200 bg-white flex items-center justify-between gap-3 shadow-2xs hover:border-slate-300 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-teal-50 text-teal-700 font-bold text-xs flex items-center justify-center border border-teal-200 shrink-0">
                  {index + 1}
                </div>
                <div className="text-sm sm:text-base font-medium text-slate-900">
                  <MathText content={item} />
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  aria-label={`Move ${item} up`}
                  disabled={disabled || isFirst}
                  onClick={() => move(index, index - 1)}
                  className="p-2 rounded-lg text-slate-600 hover:text-teal-700 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  <ArrowUp className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  aria-label={`Move ${item} down`}
                  disabled={disabled || isLast}
                  onClick={() => move(index, index + 1)}
                  className="p-2 rounded-lg text-slate-600 hover:text-teal-700 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  <ArrowDown className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
