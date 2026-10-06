import React, { useState } from "react";
import { Plus } from "lucide-react";
import { authFetch } from "@/lib/auth/auth-context";

/** Adds a unit to Term 1, 2 or 3 (a term is created the first time it is used). */
export function AddUnitForm({ defaultTerm = 2, onCreated }: { defaultTerm?: number; onCreated: (unit: any) => void }) {
  const [open, setOpen] = useState(false);
  const [termNumber, setTermNumber] = useState(defaultTerm);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      const res = await authFetch("/api/units", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ termNumber, title, description: description || undefined }) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setError(json.error || "The unit could not be added"); return; }
      setTitle(""); setDescription(""); setOpen(false);
      onCreated(json.data);
    } finally { setBusy(false); }
  };

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="w-full text-xs font-semibold px-3 py-2.5 rounded-xl border border-dashed border-slate-300 text-slate-600 hover:border-teal-400 hover:text-teal-700 flex items-center justify-center gap-1.5" data-testid="add-unit-open">
        <Plus className="w-3.5 h-3.5" /><span>Add a unit</span>
      </button>
    );
  }
  return (
    <form onSubmit={submit} className="p-4 rounded-xl border border-slate-200 bg-white space-y-2.5 text-xs" data-testid="add-unit-form">
      <div>
        <label htmlFor="unit-term" className="font-bold text-slate-700 block mb-1">Term</label>
        <select id="unit-term" value={termNumber} onChange={(e) => setTermNumber(Number(e.target.value))} className="w-full border border-slate-200 rounded-lg px-2 py-1.5 bg-white">
          {[1, 2, 3].map((n) => <option key={n} value={n}>Term {n}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="unit-title" className="font-bold text-slate-700 block mb-1">Unit title</label>
        <input id="unit-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} required placeholder="e.g. Number and Algebra: Rational Numbers" className="w-full border border-slate-200 rounded-lg px-2 py-1.5" />
      </div>
      <div>
        <label htmlFor="unit-description" className="font-bold text-slate-700 block mb-1">Short description (optional)</label>
        <textarea id="unit-description" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} rows={2} className="w-full border border-slate-200 rounded-lg px-2 py-1.5" />
      </div>
      {error && <p role="alert" className="text-red-700 bg-red-50 border border-red-200 rounded-lg p-2">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={busy} className="px-3 py-1.5 rounded-lg bg-teal-600 text-white font-semibold disabled:opacity-50">{busy ? "Adding..." : "Add unit"}</button>
        <button type="button" onClick={() => { setOpen(false); setError(null); }} className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600">Cancel</button>
      </div>
    </form>
  );
}
