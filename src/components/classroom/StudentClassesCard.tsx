import React, { useEffect, useState } from "react";
import { authFetch } from "@/lib/auth/auth-context";
import { Button } from "@/components/ui/Button";

interface ClassItem { id: string; name: string; teacherName?: string }
interface AssignmentItem {
  id: string; title: string; description: string | null; classroomName: string;
  lessonId: string | null; lessonTitle: string | null; dueDate: string | null; state: string;
}

const STATE_TEXT: Record<string, string> = {
  NOT_STARTED: "Not started", IN_PROGRESS: "In progress", COMPLETED: "Completed", NOT_TRACKED: "",
};

export function StudentClassesCard({ onOpenLesson }: { onOpenLesson?: (lessonId: string) => void }) {
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [assignments, setAssignments] = useState<AssignmentItem[]>([]);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const load = async () => {
    try {
      const [c, a] = await Promise.all([authFetch("/api/student/classes"), authFetch("/api/student/assignments")]);
      if (c.ok) setClasses((await c.json()).data || []);
      if (a.ok) setAssignments((await a.json()).data || []);
    } catch {
      /* leave the card empty if the network is down */
    }
  };

  useEffect(() => { load(); }, []);

  const join = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const res = await authFetch("/api/student/classes/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Could not join the class");
      setMessage({ ok: true, text: `You joined ${json.data.name}.` });
      setCode("");
      await load();
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : "Could not join the class" });
    } finally {
      setBusy(false);
    }
  };

  const leave = async (c: ClassItem) => {
    if (!window.confirm(`Leave ${c.name}?`)) return;
    const res = await authFetch(`/api/student/classes/${c.id}`, { method: "DELETE" });
    if (res.ok) await load();
  };

  return (
    <section data-testid="student-classes" className="bg-white rounded-3xl border border-slate-200/90 p-5 sm:p-6 shadow-xs mb-8 space-y-5">
      <h2 className="text-base font-black text-slate-900">My classes</h2>
      <form onSubmit={join} className="flex flex-col sm:flex-row gap-2 sm:items-end">
        <div className="flex-1">
          <label htmlFor="join-code-input" className="text-xs font-bold text-slate-700 block mb-1">Join a class with a code from your teacher</label>
          <input id="join-code-input" value={code} onChange={(e) => setCode(e.target.value)} maxLength={12} autoComplete="off" placeholder="e.g. K7M2QX" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-mono uppercase tracking-widest" />
        </div>
        <Button type="submit" variant="primary" size="sm" disabled={busy || !code.trim()} className="bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs">
          {busy ? "Joining..." : "Join class"}
        </Button>
      </form>
      {message && <p role="status" className={`text-xs ${message.ok ? "text-emerald-700" : "text-red-600"}`}>{message.text}</p>}

      {classes.length === 0 ? (
        <p className="text-xs text-slate-500">You are not in a class yet.</p>
      ) : (
        <ul className="space-y-2">
          {classes.map((c) => (
            <li key={c.id} className="flex items-center justify-between text-xs border border-slate-100 rounded-xl px-3 py-2">
              <span><b className="text-slate-900">{c.name}</b>{c.teacherName ? <span className="text-slate-500"> · {c.teacherName}</span> : null}</span>
              <button type="button" onClick={() => leave(c)} className="text-slate-500 hover:text-red-600">Leave</button>
            </li>
          ))}
        </ul>
      )}

      <div>
        <h3 className="text-sm font-bold text-slate-900 mb-2">Assignments</h3>
        {assignments.length === 0 ? (
          <p className="text-xs text-slate-500">No assignments right now.</p>
        ) : (
          <ul data-testid="student-assignments" className="space-y-2">
            {assignments.map((a) => (
              <li key={a.id} className="text-xs border border-slate-100 rounded-xl px-3 py-2 flex items-center justify-between gap-3">
                <span>
                  <b className="text-slate-900">{a.title}</b>
                  <span className="text-slate-500"> · {a.classroomName}{a.lessonTitle ? ` · ${a.lessonTitle}` : ""}{a.dueDate ? ` · due ${new Date(a.dueDate).toLocaleDateString()}` : ""}</span>
                  {STATE_TEXT[a.state] ? <span className="text-slate-500"> · {STATE_TEXT[a.state]}</span> : null}
                </span>
                {a.lessonId && onOpenLesson && (
                  <button type="button" onClick={() => onOpenLesson(a.lessonId!)} className="text-teal-700 font-bold hover:underline shrink-0">Open</button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
