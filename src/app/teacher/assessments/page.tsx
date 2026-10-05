import React, { useCallback, useEffect, useState } from "react";
import { authFetch } from "@/lib/auth/auth-context";
import { TeacherNav } from "@/components/teacher";
import { Button } from "@/components/ui/Button";
import { MathText } from "@/components/ui/MathText";
import { ClipboardCheck, Loader2, Plus } from "lucide-react";

interface Asm { id: string; title: string; description?: string; type: string; status: string; itemCount: number; totalPoints: number; timeLimitMinutes?: number; passingScorePercent: number; assignedClassIds?: string[]; createdAt: string }
interface Q { id: string; prompt: string; type: string; status?: string; difficulty?: string }
interface Cls { id: string; name: string }

const TYPES: Array<[string, string]> = [["PRE_TEST", "Pre-test (once only, answers hidden)"], ["POST_TEST", "Post-test (once only, answers hidden)"], ["FORMATIVE", "Quiz (can retake)"], ["SUMMATIVE", "Test (can retake)"], ["DIAGNOSTIC", "Diagnostic (can retake)"], ["PRACTICE", "Practice (can retake)"]];
const STATUS_STYLE: Record<string, string> = { DRAFT: "bg-slate-100 text-slate-700", PUBLISHED: "bg-emerald-100 text-emerald-800", ARCHIVED: "bg-slate-100 text-slate-500" };

export default function TeacherAssessmentsPage({ onNavigate }: { onNavigate?: (path: string) => void }) {
  const go = (p: string) => (onNavigate ? onNavigate(p) : (window.location.pathname = p));
  const [list, setList] = useState<Asm[] | null>(null);
  const [classes, setClasses] = useState<Cls[]>([]);
  const [questions, setQuestions] = useState<Q[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);

  // form
  const [title, setTitle] = useState("");
  const [type, setType] = useState("FORMATIVE");
  const [description, setDescription] = useState("");
  const [timeLimit, setTimeLimit] = useState("");
  const [passing, setPassing] = useState("70");
  const [picked, setPicked] = useState<Record<string, number>>({}); // questionId -> points
  const [filter, setFilter] = useState("");
  // assign
  const [assigning, setAssigning] = useState<string | null>(null);
  const [assignClass, setAssignClass] = useState("");
  const [assignDue, setAssignDue] = useState("");

  const load = useCallback(async () => {
    try {
      const [a, c, q] = await Promise.all([authFetch("/api/teacher/assessments"), authFetch("/api/teacher/classes"), authFetch("/api/questions")]);
      const aj = await a.json().catch(() => ({}));
      if (!a.ok) throw new Error(aj.error || "Could not load assessments");
      setList(aj.data || []);
      if (c.ok) setClasses(((await c.json()).data || []).map((x: any) => ({ id: x.id, name: x.name })));
      if (q.ok) setQuestions(((await q.json()).data || []).filter((x: Q) => x.status === undefined || x.status === "PUBLISHED"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load assessments");
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const say = (ok: boolean, text: string) => setNotice({ ok, text });
  const call = async (path: string, body?: unknown) => {
    const res = await authFetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body ?? {}) });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || "Something went wrong");
    return json;
  };

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setNotice(null);
    try {
      await call("/api/teacher/assessments", {
        title, type, description: description || undefined, passingScorePercent: Number(passing),
        timeLimitMinutes: timeLimit ? Number(timeLimit) : undefined,
        questions: Object.entries(picked).map(([questionId, points]) => ({ questionId, points })),
      });
      setTitle(""); setDescription(""); setTimeLimit(""); setPicked({}); setShowForm(false);
      say(true, "Created as a draft. Publish it, then assign it to a class.");
      await load();
    } catch (err) { say(false, err instanceof Error ? err.message : "Could not create"); } finally { setBusy(false); }
  };

  const publish = async (a: Asm) => {
    setBusy(true); setNotice(null);
    try { await call(`/api/teacher/assessments/${a.id}/publish`); say(true, `"${a.title}" is published. Assign it to a class so students can see it.`); await load(); }
    catch (err) { say(false, err instanceof Error ? err.message : "Could not publish"); } finally { setBusy(false); }
  };

  const assign = async (a: Asm) => {
    setBusy(true); setNotice(null);
    try {
      await call(`/api/teacher/assessments/${a.id}/assign`, { classroomId: assignClass, dueDate: assignDue ? new Date(assignDue + "T23:59:00").toISOString() : undefined });
      say(true, "Assigned. Students in that class can now see it."); setAssigning(null); setAssignClass(""); setAssignDue(""); await load();
    } catch (err) { say(false, err instanceof Error ? err.message : "Could not assign"); } finally { setBusy(false); }
  };

  const shown = questions.filter((q) => !filter || q.prompt.toLowerCase().includes(filter.toLowerCase()));
  const pickedCount = Object.keys(picked).length;

  return (
    <div className="min-h-[calc(100vh-140px)] bg-slate-50/70">
      <TeacherNav currentTab="assessments" onNavigate={go} />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-start justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2"><ClipboardCheck className="w-7 h-7 text-teal-600" /> Assessments</h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">Build a quiz or a pre/post test from your question bank, publish it, assign it to a class, then review the results.</p>
          </div>
          <Button variant="primary" size="sm" data-testid="new-assessment" onClick={() => setShowForm((v) => !v)} className="bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold gap-1 shrink-0"><Plus className="w-3.5 h-3.5" /> New</Button>
        </div>

        {notice && <p role="status" data-testid="notice" className={`text-sm mb-4 ${notice.ok ? "text-emerald-700" : "text-red-600"}`}>{notice.text}</p>}
        {error && <p role="alert" className="text-sm text-red-600 mb-4">{error}</p>}

        {showForm && (
          <form onSubmit={create} data-testid="assessment-form" className="bg-white border border-slate-200 rounded-2xl p-5 mb-6 space-y-4 shadow-xs">
            <div className="grid sm:grid-cols-2 gap-3">
              <label className="text-xs font-bold text-slate-700">Title<input data-testid="asm-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} required className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-normal" /></label>
              <label className="text-xs font-bold text-slate-700">Kind<select data-testid="asm-type" value={type} onChange={(e) => setType(e.target.value)} className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-normal bg-white">{TYPES.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select></label>
              <label className="text-xs font-bold text-slate-700 sm:col-span-2">Description (optional)<input value={description} onChange={(e) => setDescription(e.target.value)} maxLength={1000} className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-normal" /></label>
              <label className="text-xs font-bold text-slate-700">Time limit in minutes (optional)<input value={timeLimit} onChange={(e) => setTimeLimit(e.target.value)} inputMode="numeric" className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-normal" /></label>
              <label className="text-xs font-bold text-slate-700">Passing score %<input value={passing} onChange={(e) => setPassing(e.target.value)} inputMode="numeric" className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-normal" /></label>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-bold text-slate-700">Questions ({pickedCount} chosen)</p>
                <input aria-label="Search questions" placeholder="Search…" value={filter} onChange={(e) => setFilter(e.target.value)} className="border border-slate-200 rounded-lg px-2 py-1 text-xs" />
              </div>
              <ul data-testid="question-picker" className="max-h-64 overflow-auto border border-slate-100 rounded-xl divide-y divide-slate-100">
                {shown.length === 0 && <li className="p-3 text-xs text-slate-500">No published questions yet. Create and publish some in the question bank.</li>}
                {shown.map((q) => (
                  <li key={q.id} className="flex items-start gap-3 p-3 text-sm">
                    <input type="checkbox" aria-label={`Use question: ${q.prompt}`} checked={q.id in picked} onChange={(e) => setPicked((p) => { const n = { ...p }; if (e.target.checked) n[q.id] = 1; else delete n[q.id]; return n; })} className="mt-1" />
                    <span className="flex-1"><MathText content={q.prompt} /><span className="block text-[10px] text-slate-400">{q.type.replace("_", " ")}</span></span>
                    {q.id in picked && <label className="text-[10px] text-slate-500">pts <input aria-label="Points" value={picked[q.id]} inputMode="decimal" onChange={(e) => setPicked((p) => ({ ...p, [q.id]: Number(e.target.value) || 0 }))} className="w-12 border border-slate-200 rounded px-1 py-0.5 text-xs" /></label>}
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex gap-2">
              <Button type="submit" variant="primary" size="sm" data-testid="create-assessment" disabled={busy || pickedCount === 0 || title.trim().length < 3} className="bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold">{busy ? "Creating…" : "Create draft"}</Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setShowForm(false)} className="text-xs">Cancel</Button>
            </div>
          </form>
        )}

        {!list && !error && <p className="text-sm text-slate-500 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</p>}
        {list && list.length === 0 && <p className="text-sm text-slate-500 bg-white border border-slate-200 rounded-2xl p-5">You have not made any assessments yet.</p>}
        <ul className="space-y-3">
          {(list ?? []).map((a) => (
            <li key={a.id} data-testid="teacher-assessment" className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-black text-slate-900">{a.title}</h2>
                  <p className="text-xs text-slate-500 mt-0.5">{TYPES.find(([v]) => v === a.type)?.[1] ?? a.type} · {a.itemCount} question{a.itemCount === 1 ? "" : "s"} · {a.totalPoints} pts{a.timeLimitMinutes ? ` · ${a.timeLimitMinutes} min` : ""} · pass at {a.passingScorePercent}%</p>
                </div>
                <span className={`text-[10px] font-black px-2 py-1 rounded-full ${STATUS_STYLE[a.status] ?? ""}`}>{a.status}</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {a.status === "DRAFT" && <Button size="sm" variant="primary" disabled={busy} data-testid="publish-assessment" onClick={() => publish(a)} className="bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold">Publish</Button>}
                {a.status === "PUBLISHED" && <Button size="sm" variant="outline" onClick={() => { setAssigning(assigning === a.id ? null : a.id); setAssignClass(classes[0]?.id ?? ""); }} data-testid="open-assign" className="text-xs font-bold">Assign to a class</Button>}
                <Button size="sm" variant="outline" onClick={() => go(`/teacher/assessments/${a.id}`)} data-testid="view-results" className="text-xs font-bold">Results</Button>
              </div>
              {assigning === a.id && (
                <div data-testid="assign-panel" className="mt-3 flex flex-wrap items-end gap-3 border-t border-slate-100 pt-3">
                  <label className="text-xs font-bold text-slate-700">Class
                    <select data-testid="assign-class" value={assignClass} onChange={(e) => setAssignClass(e.target.value)} className="mt-1 block border border-slate-200 rounded-xl px-3 py-2 text-sm font-normal bg-white">
                      {classes.length === 0 && <option value="">You have no classes</option>}
                      {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </label>
                  <label className="text-xs font-bold text-slate-700">Due date (optional)<input type="date" value={assignDue} onChange={(e) => setAssignDue(e.target.value)} className="mt-1 block border border-slate-200 rounded-xl px-3 py-2 text-sm font-normal" /></label>
                  <Button size="sm" variant="primary" data-testid="confirm-assign" disabled={busy || !assignClass} onClick={() => assign(a)} className="bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold">Assign</Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
