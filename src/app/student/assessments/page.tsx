import React, { useEffect, useState } from "react";
import { authFetch } from "@/lib/auth/auth-context";
import { Button } from "@/components/ui/Button";
import { ArrowLeft, ClipboardCheck, Loader2 } from "lucide-react";

interface Row {
  id: string; title: string; description?: string; type: string; itemCount: number; totalPoints: number; timeLimitMinutes?: number;
  dueDate?: string; progress: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED"; attemptId?: string; scorePercent?: number; isPassed?: boolean; canStart: boolean; answersHidden: boolean;
}

const TYPE_TEXT: Record<string, string> = { PRE_TEST: "Pre-test", POST_TEST: "Post-test", DIAGNOSTIC: "Diagnostic", FORMATIVE: "Quiz", SUMMATIVE: "Test", PRACTICE: "Practice" };

export default function StudentAssessmentsPage({ onNavigate }: { onNavigate?: (path: string) => void }) {
  const go = (p: string) => (onNavigate ? onNavigate(p) : (window.location.pathname = p));
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await authFetch("/api/student/assessments");
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error || "Could not load your assessments");
        setRows(json.data || []);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not load your assessments");
      }
    })();
  }, []);

  return (
    <div className="min-h-[calc(100vh-140px)] bg-slate-50/70">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <button type="button" onClick={() => go("/student")} className="text-xs font-bold text-slate-500 hover:text-slate-800 inline-flex items-center gap-1 mb-4"><ArrowLeft className="w-3.5 h-3.5" /> Back to dashboard</button>
        <h1 className="text-2xl font-black text-slate-900 mb-1 flex items-center gap-2"><ClipboardCheck className="w-6 h-6 text-teal-600" /> My assessments</h1>
        <p className="text-sm text-slate-500 mb-6">Quizzes and tests your teacher has given to your class.</p>

        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        {!rows && !error && <p className="text-sm text-slate-500 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</p>}
        {rows && rows.length === 0 && <p data-testid="no-assessments" className="text-sm text-slate-500 bg-white border border-slate-200 rounded-2xl p-5">Nothing has been assigned to you yet. If your teacher gave you a class code, join the class from your dashboard.</p>}
        <ul className="space-y-3">
          {(rows ?? []).map((r) => (
            <li key={r.id} data-testid="assessment-row" className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-teal-700">{TYPE_TEXT[r.type] ?? r.type}</p>
                  <h2 className="text-base font-black text-slate-900">{r.title}</h2>
                  {r.description && <p className="text-xs text-slate-500 mt-0.5">{r.description}</p>}
                  <p className="text-xs text-slate-500 mt-2">{r.itemCount} question{r.itemCount === 1 ? "" : "s"}{r.timeLimitMinutes ? ` · ${r.timeLimitMinutes} min` : ""}{r.dueDate ? ` · due ${new Date(r.dueDate).toLocaleDateString()}` : ""}</p>
                </div>
                <div className="text-right shrink-0">
                  {r.progress === "COMPLETED" && <p className="text-sm font-black text-slate-900">{r.scorePercent}%<span className="block text-[10px] font-bold text-slate-500">{r.isPassed ? "Passed" : "Not yet passed"}</span></p>}
                </div>
              </div>
              <div className="mt-4 flex items-center gap-2">
                {r.progress !== "COMPLETED" || r.canStart ? (
                  <Button size="sm" variant="primary" data-testid="open-assessment" onClick={() => go(`/student/assessments/${r.id}`)} className="bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold">
                    {r.progress === "IN_PROGRESS" ? "Continue" : r.progress === "COMPLETED" ? "Try again" : "Start"}
                  </Button>
                ) : null}
                {r.progress === "COMPLETED" && r.attemptId && (
                  <Button size="sm" variant="outline" onClick={() => go(`/student/assessments/${r.id}?result=${r.attemptId}`)} className="text-xs font-bold">See result</Button>
                )}
                {r.progress === "COMPLETED" && !r.canStart && <span className="text-[11px] text-slate-500">Taken once only</span>}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
