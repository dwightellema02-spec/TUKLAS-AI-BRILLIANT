import React, { useEffect } from "react";
import { MathText } from "@/components/ui/MathText";
import { ArrowUp, ArrowDown } from "lucide-react";

export interface AssessmentQuestion {
  id: string;
  prompt: string;
  type: string;
  questionData?: any;
}

/** The answer a student has given: text for most types, an object for matching, an array for ordering. */
export type AnswerValue = string | Record<string, string> | string[] | undefined;

export function isAnswered(q: AssessmentQuestion, v: AnswerValue): boolean {
  if (v === undefined) return false;
  if (typeof v === "string") return v.trim() !== "";
  if (Array.isArray(v)) return v.length > 0;
  if (q.type === "MATCHING") return Object.values(v).some((x) => x);
  return Object.keys(v).length > 0;
}

/** One question with the right input for its type. It never sees an answer key: the server removes it before sending. */
export function AssessmentQuestionInput({ q, value, onChange, disabled }: { q: AssessmentQuestion; value: AnswerValue; onChange: (v: AnswerValue) => void; disabled?: boolean }) {
  const d = q.questionData ?? {};
  // An ordering question shows an arrangement from the start; what is on screen is what gets submitted,
  // so leaving it untouched must not count as a blank answer.
  const orderingDefault = q.type === "ORDERING" && Array.isArray(d.itemsToOrder) ? d.itemsToOrder.map(String) : null;
  useEffect(() => {
    if (orderingDefault && value === undefined && !disabled) onChange(orderingDefault);
  }, [q.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const label = "block w-full text-left px-4 py-3 rounded-xl border text-sm transition-colors";

  const body = (() => {
    if (q.type === "MULTIPLE_CHOICE" && Array.isArray(d.choices)) {
      return (
        <div role="radiogroup" aria-label="Answer choices" className="space-y-2">
          {d.choices.map((c: { id: string; text: string }, i: number) => {
            const on = value === c.id;
            return (
              <button key={c.id} type="button" role="radio" aria-checked={on} disabled={disabled} data-testid={`choice-${c.id}`} onClick={() => onChange(c.id)}
                className={`${label} ${on ? "border-teal-500 bg-teal-50 text-teal-900 font-semibold" : "border-slate-200 bg-white hover:bg-slate-50 text-slate-800"}`}>
                <span className="font-bold mr-2">{String.fromCharCode(65 + i)}.</span><MathText content={c.text} />
              </button>
            );
          })}
        </div>
      );
    }
    if (q.type === "TRUE_FALSE") {
      return (
        <div role="radiogroup" aria-label="True or false" className="grid grid-cols-2 gap-2">
          {["true", "false"].map((v) => (
            <button key={v} type="button" role="radio" aria-checked={value === v} disabled={disabled} data-testid={`tf-${v}`} onClick={() => onChange(v)}
              className={`${label} text-center ${value === v ? "border-teal-500 bg-teal-50 text-teal-900 font-semibold" : "border-slate-200 bg-white hover:bg-slate-50"}`}>
              {v === "true" ? "True" : "False"}
            </button>
          ))}
        </div>
      );
    }
    if (q.type === "MATCHING" && Array.isArray(d.leftItems)) {
      const cur = (typeof value === "object" && value && !Array.isArray(value) ? value : {}) as Record<string, string>;
      return (
        <div className="space-y-2">
          {d.leftItems.map((left: string) => (
            <div key={left} className="flex items-center gap-3">
              <span className="w-1/3 text-sm font-semibold text-slate-800"><MathText content={left} /></span>
              <select aria-label={`Match ${left}`} disabled={disabled} value={cur[left] ?? ""} onChange={(e) => onChange({ ...cur, [left]: e.target.value })} className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white">
                <option value="">Choose…</option>
                {(d.rightOptions ?? []).map((r: string) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          ))}
        </div>
      );
    }
    if (q.type === "ORDERING" && Array.isArray(d.itemsToOrder)) {
      const order: string[] = Array.isArray(value) && value.length === d.itemsToOrder.length ? value : d.itemsToOrder.map(String);
      const move = (i: number, dir: -1 | 1) => { const j = i + dir; if (j < 0 || j >= order.length) return; const next = [...order]; [next[i], next[j]] = [next[j], next[i]]; onChange(next); };
      return (
        <div>
          <p className="text-xs text-slate-500 mb-2">Use the arrows to put the items in order.</p>
          <ol className="space-y-2">
            {order.map((it, i) => (
              <li key={it} className="flex items-center gap-2 border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white">
                <span className="w-5 text-slate-400 text-xs">{i + 1}</span><span className="flex-1"><MathText content={it} /></span>
                <button type="button" aria-label={`Move ${it} up`} disabled={disabled || i === 0} onClick={() => move(i, -1)} className="p-1 rounded hover:bg-slate-100 disabled:opacity-30"><ArrowUp className="w-4 h-4" /></button>
                <button type="button" aria-label={`Move ${it} down`} disabled={disabled || i === order.length - 1} onClick={() => move(i, 1)} className="p-1 rounded hover:bg-slate-100 disabled:opacity-30"><ArrowDown className="w-4 h-4" /></button>
              </li>
            ))}
          </ol>
        </div>
      );
    }
    // numeric, text, equation and anything else: a text box
    return (
      <div className="flex items-center gap-2">
        <input aria-label="Your answer" data-testid="answer-input" disabled={disabled} value={typeof value === "string" ? value : ""} onChange={(e) => onChange(e.target.value)} maxLength={200} autoComplete="off"
          inputMode={q.type === "NUMERIC_INPUT" ? "decimal" : "text"} placeholder={d.placeholder || (q.type === "NUMERIC_INPUT" ? "Type a number" : "Type your answer")}
          className="w-full max-w-sm border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white" />
        {d.unit ? <span className="text-sm text-slate-500">{d.unit}</span> : null}
      </div>
    );
  })();

  return (
    <div>
      <div className="text-base font-semibold text-slate-900 mb-1"><MathText content={q.prompt} /></div>
      {d.instructions ? <p className="text-xs text-slate-500 mb-3">{d.instructions}</p> : <div className="mb-3" />}
      {body}
    </div>
  );
}
