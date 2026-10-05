import React, { useEffect, useState } from "react";
import { authFetch } from "@/lib/auth/auth-context";
import { ClipboardCheck } from "lucide-react";

/** Dashboard shortcut: how many assessments are waiting. Renders nothing until something is assigned. */
export function StudentAssessmentsCard({ onOpen }: { onOpen: () => void }) {
  const [rows, setRows] = useState<Array<{ progress: string; title: string }>>([]);
  useEffect(() => {
    (async () => { try { const r = await authFetch("/api/student/assessments"); if (r.ok) setRows((await r.json()).data || []); } catch { /* card stays hidden */ } })();
  }, []);
  if (rows.length === 0) return null;
  const waiting = rows.filter((r) => r.progress !== "COMPLETED").length;
  return (
    <section data-testid="student-assessments-card" className="bg-white rounded-3xl border border-slate-200/90 p-5 shadow-xs mb-8 flex items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <ClipboardCheck className="w-6 h-6 text-teal-600" />
        <div>
          <h2 className="text-base font-black text-slate-900">Assessments</h2>
          <p className="text-xs text-slate-500">{waiting > 0 ? `${waiting} waiting for you` : "All done for now"}</p>
        </div>
      </div>
      <button type="button" onClick={onOpen} className="text-xs font-bold text-teal-700 hover:underline">Open</button>
    </section>
  );
}
