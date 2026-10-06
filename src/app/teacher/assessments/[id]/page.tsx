import React, { useEffect, useState } from "react";
import { authFetch } from "@/lib/auth/auth-context";
import { TeacherNav } from "@/components/teacher";
import { MathText } from "@/components/ui/MathText";
import { ArrowLeft, Loader2 } from "lucide-react";

interface Results {
  assessment: { id: string; title: string; type: string; status: string; itemCount: number; totalPoints: number; passingScorePercent: number };
  summary: { assigned: number; completed: number; inProgress: number; notStarted: number; meanScorePercent: number | null; passRate: number | null };
  students: Array<{ studentId: string; name: string; status: string; attempts: number; scorePercent: number | null; isPassed: boolean | null; submittedAt: string | null }>;
  items: Array<{ itemId: string; prompt: string; answered: number; accuracy: number | null }>;
}

const STATUS_TEXT: Record<string, string> = { NOT_STARTED: "Not started", IN_PROGRESS: "In progress", COMPLETED: "Completed" };

export default function TeacherAssessmentResultsPage({ assessmentId, onNavigate }: { assessmentId: string; onNavigate?: (path: string) => void }) {
  const go = (p: string) => (onNavigate ? onNavigate(p) : (window.location.pathname = p));
  const [data, setData] = useState<Results | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await authFetch(`/api/teacher/assessments/${assessmentId}/results`);
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error || "Could not load the results");
        setData(json.data);
      } catch (e) { setError(e instanceof Error ? e.message : "Could not load the results"); }
    })();
  }, [assessmentId]);

  const pct = (x: number | null) => (x === null ? "–" : `${Math.round(x * 100)}%`);
  return (
    <div className="min-h-[calc(100vh-140px)] bg-slate-50/70">
      <TeacherNav currentTab="assessments" onNavigate={go} />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <button type="button" onClick={() => go("/teacher/assessments")} className="text-xs font-bold text-slate-500 hover:text-slate-800 inline-flex items-center gap-1 mb-4"><ArrowLeft className="w-3.5 h-3.5" /> All assessments</button>
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        {!data && !error && <p className="text-sm text-slate-500 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</p>}
        {data && (
          <>
            <h1 className="text-2xl font-black text-slate-900">{data.assessment.title}</h1>
            <p className="text-xs text-slate-500 mt-1">{data.assessment.type.replace("_", "-").toLowerCase()} · {data.assessment.itemCount} questions · {data.assessment.totalPoints} points · pass at {data.assessment.passingScorePercent}%</p>
            <div data-testid="results-summary" className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-6">
              {[["Assigned", data.summary.assigned], ["Completed", data.summary.completed], ["Average", data.summary.meanScorePercent === null ? "–" : `${data.summary.meanScorePercent}%`], ["Pass rate", pct(data.summary.passRate)]].map(([k, v]) => (
                <div key={String(k)} className="bg-white border border-slate-200 rounded-2xl p-4"><p className="text-[10px] font-black uppercase tracking-wider text-slate-500">{k}</p><p className="text-2xl font-black text-slate-900">{v}</p></div>
              ))}
            </div>
            {data.summary.assigned === 0 && <p className="text-sm text-slate-500 bg-white border border-slate-200 rounded-2xl p-5 mb-6">This assessment is not assigned to any class yet.</p>}
            {data.students.length > 0 && (
              <div className="bg-white border border-slate-200 rounded-2xl overflow-x-auto mb-6">
                <table data-testid="results-students" className="w-full text-sm">
                  <thead className="text-left text-[11px] uppercase tracking-wider text-slate-500"><tr><th className="p-3">Student</th><th className="p-3">Status</th><th className="p-3">Score</th><th className="p-3">Result</th></tr></thead>
                  <tbody>{data.students.map((s) => (
                    <tr key={s.studentId} className="border-t border-slate-100">
                      <td className="p-3 font-semibold text-slate-900">{s.name}</td><td className="p-3 text-slate-600">{STATUS_TEXT[s.status] ?? s.status}</td>
                      <td className="p-3">{s.scorePercent === null ? "–" : `${s.scorePercent}%`}</td><td className="p-3">{s.isPassed === null ? "–" : s.isPassed ? "Passed" : "Below pass mark"}</td>
                    </tr>))}</tbody>
                </table>
              </div>
            )}
            {data.items.length > 0 && (
              <div className="bg-white border border-slate-200 rounded-2xl p-5">
                <h2 className="text-sm font-black text-slate-900 mb-3">By question</h2>
                <ol className="space-y-3">{data.items.map((it, i) => (
                  <li key={it.itemId} className="text-sm">
                    <div className="flex justify-between gap-3"><span><b>{i + 1}.</b> <MathText content={it.prompt} /></span><span className="font-bold shrink-0">{pct(it.accuracy)}<span className="text-[10px] text-slate-400 font-normal"> of {it.answered}</span></span></div>
                    <div className="h-1.5 bg-slate-100 rounded-full mt-1"><div className="h-1.5 bg-teal-500 rounded-full" style={{ width: `${Math.round((it.accuracy ?? 0) * 100)}%` }} /></div>
                  </li>))}</ol>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
