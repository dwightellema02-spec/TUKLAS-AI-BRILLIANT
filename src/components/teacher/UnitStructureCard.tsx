import React, { useState } from "react";
import { Layers, Plus, Trash2, Pencil } from "lucide-react";
import { authFetch } from "@/lib/auth/auth-context";

interface Skill { id: string; title: string; description?: string | null; difficulty: number }
interface Competency { id: string; code: string; statement: string; skills?: Skill[] }

/**
 * The competencies and skills of one unit, with forms to add, rename and remove them. Skills are what mastery, practice and the teacher's
 * analytics are measured against, so a new lesson's questions should be tied to a skill created here.
 */
export function UnitStructureCard({ unit, onChanged }: { unit: { id: string; title: string; createdById?: string | null; competencies?: Competency[] }; onChanged: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState("");
  const [statement, setStatement] = useState("");
  const [skillFor, setSkillFor] = useState<string | null>(null);
  const [skillTitle, setSkillTitle] = useState("");
  const [skillDesc, setSkillDesc] = useState("");
  const [skillDiff, setSkillDiff] = useState("2");

  const call = async (url: string, method: string, body?: unknown): Promise<boolean> => {
    setBusy(true); setError(null);
    try {
      const res = await authFetch(url, { method, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setError(json.error || "That did not work"); return false; }
      onChanged();
      return true;
    } finally { setBusy(false); }
  };

  const rename = async (kind: "skills" | "competencies", id: string, field: string, current: string) => {
    const next = window.prompt(`New ${field}`, current);
    if (next && next.trim() && next.trim() !== current) await call(`/api/${kind}/${id}`, "PUT", { [field]: next.trim() });
  };

  const comps = unit.competencies ?? [];
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4" data-testid="unit-structure">
      <div>
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2"><Layers className="w-4 h-4 text-teal-600" /><span>Competencies and skills</span></h2>
        <p className="text-[11px] text-slate-500 mt-0.5">Add what this unit teaches. Each lesson and question is then tied to a skill, which is what the students' mastery and your analytics are measured on.</p>
      </div>
      {error && <p role="alert" className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-2">{error}</p>}

      {comps.length === 0 && <p className="text-xs text-slate-500">No competencies yet.</p>}
      <ul className="space-y-3">
        {comps.map((c) => (
          <li key={c.id} className="rounded-xl border border-slate-200 p-3 space-y-2" data-testid={`competency-${c.code}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0"><span className="text-[10px] font-bold uppercase tracking-wider text-blue-700">{c.code}</span><p className="text-xs text-slate-800">{c.statement}</p></div>
              <div className="flex gap-1 shrink-0">
                <button type="button" aria-label={`Edit competency ${c.code}`} onClick={() => rename("competencies", c.id, "statement", c.statement)} className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-blue-600"><Pencil className="w-3 h-3" /></button>
                <button type="button" aria-label={`Delete competency ${c.code}`} disabled={busy} onClick={() => { if (window.confirm(`Delete competency ${c.code}?`)) call(`/api/competencies/${c.id}`, "DELETE"); }} className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-red-600"><Trash2 className="w-3 h-3" /></button>
              </div>
            </div>
            <ul className="space-y-1">
              {(c.skills ?? []).map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-2 text-xs bg-slate-50 rounded-lg px-2 py-1.5" data-testid={`skill-${s.title}`}>
                  <span className="truncate">{s.title} <span className="text-slate-400">· difficulty {s.difficulty}</span></span>
                  <span className="flex gap-1 shrink-0">
                    <button type="button" aria-label={`Rename skill ${s.title}`} onClick={() => rename("skills", s.id, "title", s.title)} className="p-1 rounded border border-slate-200 text-slate-500 hover:text-blue-600"><Pencil className="w-3 h-3" /></button>
                    <button type="button" aria-label={`Delete skill ${s.title}`} disabled={busy} onClick={() => { if (window.confirm(`Delete skill "${s.title}"?`)) call(`/api/skills/${s.id}`, "DELETE"); }} className="p-1 rounded border border-slate-200 text-slate-500 hover:text-red-600"><Trash2 className="w-3 h-3" /></button>
                  </span>
                </li>
              ))}
            </ul>
            {skillFor === c.id ? (
              <form className="space-y-1.5 text-xs" data-testid="add-skill-form" onSubmit={async (e) => { e.preventDefault(); if (await call(`/api/competencies/${c.id}/skills`, "POST", { title: skillTitle, description: skillDesc || undefined, difficulty: Number(skillDiff) })) { setSkillTitle(""); setSkillDesc(""); setSkillFor(null); } }}>
                <label className="block font-bold text-slate-700" htmlFor={`skill-title-${c.id}`}>Skill title</label>
                <input id={`skill-title-${c.id}`} value={skillTitle} onChange={(e) => setSkillTitle(e.target.value)} required maxLength={120} placeholder="e.g. Add and subtract rational numbers" className="w-full border border-slate-200 rounded-lg px-2 py-1.5" />
                <label className="block font-bold text-slate-700" htmlFor={`skill-desc-${c.id}`}>What the student can do (optional)</label>
                <input id={`skill-desc-${c.id}`} value={skillDesc} onChange={(e) => setSkillDesc(e.target.value)} maxLength={500} className="w-full border border-slate-200 rounded-lg px-2 py-1.5" />
                <label className="block font-bold text-slate-700" htmlFor={`skill-diff-${c.id}`}>Difficulty (1 easy - 5 hard)</label>
                <input id={`skill-diff-${c.id}`} type="number" min={1} max={5} step={0.5} value={skillDiff} onChange={(e) => setSkillDiff(e.target.value)} className="w-24 border border-slate-200 rounded-lg px-2 py-1.5" />
                <div className="flex gap-2 pt-1"><button type="submit" disabled={busy} className="px-3 py-1.5 rounded-lg bg-teal-600 text-white font-semibold disabled:opacity-50">Add skill</button><button type="button" onClick={() => setSkillFor(null)} className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600">Cancel</button></div>
              </form>
            ) : (
              <button type="button" onClick={() => { setSkillFor(c.id); setError(null); }} className="text-[11px] font-semibold text-teal-700 flex items-center gap-1" aria-label={`Add a skill to ${c.code}`}><Plus className="w-3 h-3" />Add a skill</button>
            )}
          </li>
        ))}
      </ul>

      <form className="space-y-1.5 text-xs border-t border-slate-100 pt-3" data-testid="add-competency-form" onSubmit={async (e) => { e.preventDefault(); if (await call(`/api/units/${unit.id}/competencies`, "POST", { code: code || undefined, statement })) { setCode(""); setStatement(""); } }}>
        <p className="font-bold text-slate-700">Add a competency</p>
        <label className="block text-slate-600" htmlFor="competency-code">Code (optional, e.g. the DepEd code)</label>
        <input id="competency-code" value={code} onChange={(e) => setCode(e.target.value)} maxLength={40} className="w-40 border border-slate-200 rounded-lg px-2 py-1.5" />
        <label className="block text-slate-600" htmlFor="competency-statement">Competency statement</label>
        <textarea id="competency-statement" value={statement} onChange={(e) => setStatement(e.target.value)} required maxLength={400} rows={2} className="w-full border border-slate-200 rounded-lg px-2 py-1.5" />
        <button type="submit" disabled={busy} className="px-3 py-1.5 rounded-lg bg-teal-600 text-white font-semibold disabled:opacity-50">Add competency</button>
      </form>
    </div>
  );
}
