import React, { useCallback, useEffect, useState } from "react";
import { Unlock } from "lucide-react";
import { authFetch } from "@/lib/auth/auth-context";

interface AccessLesson { lessonId: string; title: string; position: number; openForClass: boolean; openForStudents: string[] }

/**
 * Lessons are taken in course order and a student cannot start one until the one before it is completed. When a class is ahead of
 * (or behind) that order, the teacher opens lessons here, for the whole class or for one student. Opening changes nothing about
 * anyone's progress, and a lesson the order already allows is not affected.
 */
export function LessonAccessCard({ classId, students }: { classId: string; students: Array<{ id: string; name: string }> }) {
  const [lessons, setLessons] = useState<AccessLesson[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [studentId, setStudentId] = useState("");

  const load = useCallback(async () => {
    const res = await authFetch(`/api/teacher/classes/${classId}/lesson-access`);
    const json = await res.json().catch(() => ({}));
    if (!res.ok) { setError(json.error || "Could not load lesson access"); return; }
    setLessons(json.data.lessons);
  }, [classId]);
  useEffect(() => { load(); }, [load]);

  const send = async (body: Record<string, unknown>) => {
    setBusy(true); setError(null);
    try {
      const res = await authFetch(`/api/teacher/classes/${classId}/lesson-access`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) setError(json.error || "That did not work");
      else setLessons(json.data.lessons);
    } finally { setBusy(false); }
  };

  const forStudent = (l: AccessLesson) => !!studentId && l.openForStudents.includes(studentId);
  const isOpen = (l: AccessLesson) => (studentId ? forStudent(l) : l.openForClass);

  return (
    <div className="bg-white rounded-3xl border border-slate-200/90 p-6 shadow-xs space-y-3" data-testid="lesson-access">
      <div className="pb-3 border-b border-slate-100">
        <h2 className="text-base font-bold text-slate-900 flex items-center gap-2"><Unlock className="w-4 h-4 text-teal-600" /><span>Lesson access</span></h2>
        <p className="text-xs text-slate-500 mt-1">Students take the lessons in order and cannot start one until the one before it is finished. Open a lesson here to let your class (or one student) start it early, for example to catch up or move ahead.</p>
      </div>
      <div className="flex items-center gap-2 text-xs">
        <label htmlFor="lesson-access-scope" className="font-bold text-slate-700">Open for</label>
        <select id="lesson-access-scope" value={studentId} onChange={(e) => setStudentId(e.target.value)} className="border border-slate-200 rounded-lg px-2 py-1 bg-white">
          <option value="">The whole class</option>
          {students.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>
      {error && <p role="alert" className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-2">{error}</p>}
      {!lessons ? <p className="text-xs text-slate-400">Loading lessons...</p> : lessons.length === 0 ? <p className="text-xs text-slate-500">No published lessons yet.</p> : (
        <ul className="divide-y divide-slate-100">
          {lessons.map((l) => (
            <li key={l.lessonId} className="py-2 flex items-center justify-between gap-3 text-sm" data-testid={`access-${l.position}`}>
              <span className="min-w-0"><span className="text-slate-400 mr-2">{l.position}.</span><span className="text-slate-800">{l.title}</span>
                {!studentId && l.openForStudents.length > 0 && <span className="ml-2 text-[11px] text-slate-500">(also open for {l.openForStudents.length} student{l.openForStudents.length === 1 ? "" : "s"})</span>}
                {studentId && l.openForClass && <span className="ml-2 text-[11px] text-slate-500">(open for the whole class)</span>}
              </span>
              <span className="flex items-center gap-2 shrink-0">
                {!studentId && (
                  <button type="button" disabled={busy} onClick={() => send({ lessonId: l.lessonId, through: true })} className="text-[11px] px-2 py-1 rounded-lg border border-slate-200 text-slate-600 hover:border-teal-300 disabled:opacity-50" aria-label={`Open everything up to lesson ${l.position}`}>Open through here</button>
                )}
                <button type="button" disabled={busy} aria-pressed={isOpen(l)} onClick={() => send({ lessonId: l.lessonId, studentId: studentId || undefined, open: !isOpen(l) })} className={`text-[11px] px-2 py-1 rounded-lg border disabled:opacity-50 ${isOpen(l) ? "bg-teal-50 border-teal-300 text-teal-800" : "border-slate-200 text-slate-600"}`} aria-label={`${isOpen(l) ? "Close" : "Open"} lesson ${l.position}`}>
                  {isOpen(l) ? "Opened (click to close)" : "Open"}
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
