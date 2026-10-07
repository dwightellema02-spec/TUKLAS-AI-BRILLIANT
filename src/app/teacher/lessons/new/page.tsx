import React, { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth/auth-context";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { groupSkillsByUnit } from "@/lib/curriculum/skill-label";
import {
  BookOpen,
  ArrowLeft,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  Save,
} from "lucide-react";

export interface TeacherNewLessonPageProps {
  onNavigate?: (path: string) => void;
}

export default function TeacherNewLessonPage({ onNavigate }: TeacherNewLessonPageProps) {
  const { user } = useAuth();
  const [curriculum, setCurriculum] = useState<any[]>([]);
  const [skillsList, setSkillsList] = useState<any[]>([]);
  const [loadingMeta, setLoadingMeta] = useState(true);

  // Form State
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedUnitId, setSelectedUnitId] = useState("");
  const [estimatedMinutes, setEstimatedMinutes] = useState(20);
  const [objectives, setObjectives] = useState<string[]>([
    "Define core mathematical terms and identify real-world representations.",
    "Solve guided problems with instant feedback.",
  ]);
  const [newObjective, setNewObjective] = useState("");
  const [selectedSkillIds, setSelectedSkillIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Phase 45: import a draft from an uploaded document
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importUnitId, setImportUnitId] = useState("");
  const [importTitle, setImportTitle] = useState("");
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<any | null>(null);

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    setImportError(null);
    setImportResult(null);
    if (!importFile) { setImportError("Choose a Word, PDF or text file first."); return; }
    setImporting(true);
    try {
      const unit = importUnitId || selectedUnitId;
      const q = `?unitId=${encodeURIComponent(unit)}${importTitle.trim() ? `&title=${encodeURIComponent(importTitle.trim())}` : ""}`;
      const res = await fetch(`/api/teacher/lessons/import${q}`, {
        method: "POST",
        headers: { "Content-Type": "application/octet-stream", "x-file-name": encodeURIComponent(importFile.name) },
        body: await importFile.arrayBuffer(),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) setImportError(json.error || "The document could not be imported.");
      else setImportResult(json.data);
    } catch (err: unknown) {
      setImportError(err instanceof Error ? err.message : "The upload failed. Please try again.");
    } finally {
      setImporting(false);
    }
  };

  const handleNav = (path: string) => {
    if (onNavigate) onNavigate(path);
    else window.location.pathname = path;
  };

  useEffect(() => {
    async function loadMeta() {
      try {
        const [cRes, sRes] = await Promise.all([
          fetch("/api/curriculum"),
          fetch("/api/skills"),
        ]);

        if (cRes.ok) {
          const cData = await cRes.json();
          setCurriculum(cData.data || []);
          const firstUnit = (cData.data?.[0]?.grades?.[0]?.terms ?? []).flatMap((t: any) => t.units ?? [])[0];
          if (firstUnit) setSelectedUnitId(firstUnit.id);
        }

        if (sRes.ok) {
          const sData = await sRes.json();
          setSkillsList(sData.data || []);
        }
      } catch (err) {
        console.error("Meta loading error:", err);
      } finally {
        setLoadingMeta(false);
      }
    }
    loadMeta();
  }, []);

  const handleAddObjective = () => {
    if (!newObjective.trim()) return;
    setObjectives([...objectives, newObjective.trim()]);
    setNewObjective("");
  };

  const handleRemoveObjective = (index: number) => {
    setObjectives(objectives.filter((_, i) => i !== index));
  };

  const toggleSkill = (skillId: string) => {
    if (selectedSkillIds.includes(skillId)) {
      setSelectedSkillIds(selectedSkillIds.filter((id) => id !== skillId));
    } else {
      setSelectedSkillIds([...selectedSkillIds, skillId]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);

    try {
      const res = await fetch("/api/lessons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          unitId: selectedUnitId,
          learningObjectives: objectives,
          estimatedMinutes,
          skillIds: selectedSkillIds,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to create lesson");
        setSaving(false);
        return;
      }

      // Redirect directly to the full editor studio for this new lesson
      handleNav(`/teacher/lessons/${data.data.id}/edit`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error creating lesson");
      setSaving(false);
    }
  };

  const units = (curriculum[0]?.grades?.[0]?.terms ?? []).flatMap((t: any) => (t.units ?? []).map((u: any) => ({ ...u, termName: t.name })));

  return (
    <div className="py-8 sm:py-12 bg-slate-50 min-h-[calc(100vh-140px)]">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        {/* Navigation Breadcrumb */}
        <div className="mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleNav("/teacher/lessons")}
            className="gap-2 text-slate-600"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Lessons</span>
          </Button>
        </div>

        {/* Phase 45: import from a document */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs mb-6" data-testid="import-card">
          <h2 className="text-sm font-bold text-slate-900">Start from a document</h2>
          <p className="text-xs text-slate-500 mt-1 mb-4">
            Upload a Word, PDF or text file of the lesson. You get a <b>draft</b> to review and edit: nothing is published, and the document's own wording is kept.
            Answer keys are never imported. Questions are not created from the document; add them in the studio.
          </p>
          <form onSubmit={handleImport} className="space-y-3">
            <input
              type="file"
              data-testid="import-file"
              aria-label="Lesson document"
              accept=".docx,.pdf,.txt"
              onChange={(e) => setImportFile(e.target.files?.[0] ?? null)}
              className="block w-full text-xs text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-xs file:font-semibold"
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <select
                aria-label="Unit for the imported lesson"
                value={importUnitId || selectedUnitId}
                onChange={(e) => setImportUnitId(e.target.value)}
                className="text-sm px-3 py-2 rounded-xl border border-slate-300 bg-white"
              >
                {units.map((u: any) => (
                  <option key={u.id} value={u.id}>{u.termName} · {u.name || u.title}</option>
                ))}
              </select>
              <input
                type="text"
                aria-label="Lesson title (optional)"
                value={importTitle}
                onChange={(e) => setImportTitle(e.target.value)}
                placeholder="Lesson title (optional; the document's own title is used)"
                className="text-sm px-3 py-2 rounded-xl border border-slate-300"
              />
            </div>
            <Button type="submit" variant="primary" size="sm" disabled={importing || !importFile}>
              {importing ? "Importing..." : "Import draft"}
            </Button>
          </form>
          {importError && (
            <div role="alert" className="mt-4 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700" data-testid="import-error">{importError}</div>
          )}
          {importResult && (
            <div className="mt-4 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-slate-700 space-y-2" data-testid="import-result">
              <p className="font-semibold text-emerald-800">Draft created: {importResult.title} ({importResult.blocks.length} section{importResult.blocks.length === 1 ? "" : "s"})</p>
              <ul className="list-disc pl-5">
                {importResult.blocks.map((b: any) => (<li key={b.id}>{b.title} <span className="text-slate-400">({b.type.toLowerCase()})</span></li>))}
              </ul>
              {importResult.skipped.length > 0 && (
                <div data-testid="import-skipped"><b>Left out:</b> {importResult.skipped.map((s: any) => `${s.title} (${s.reason})`).join(" ")}</div>
              )}
              {importResult.warnings.length > 0 && (
                <div data-testid="import-warnings"><b>Please check:</b>
                  <ul className="list-disc pl-5">{importResult.warnings.map((w: string, i: number) => (<li key={i}>{w}</li>))}</ul>
                </div>
              )}
              <Button variant="primary" size="sm" onClick={() => handleNav(`/teacher/lessons/${importResult.lessonId}/edit`)}>Open in the editor</Button>
            </div>
          )}
        </div>

        {/* Form Card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-xs">
          <div className="flex items-center gap-3 mb-6 pb-6 border-b border-slate-100">
            <div className="w-12 h-12 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Create New Lesson</h1>
                <Badge variant="secondary">Draft</Badge>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Teacher Content Studio • Grade 7 MATATAG Mathematics
              </p>
            </div>
          </div>

          {error && (
            <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Information */}
            <div className="space-y-4">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                1. Lesson Information
              </h2>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Lesson Title *
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Multiplication of Integers: Sign Rules & Properties"
                  className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Description / Overview
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="A concise summary of what students will explore and master in this lesson."
                  className="w-full text-sm p-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Curriculum Unit *
                  </label>
                  <select
                    value={selectedUnitId}
                    onChange={(e) => setSelectedUnitId(e.target.value)}
                    required
                    className="w-full text-sm px-3 py-2.5 rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {units.map((u: any) => (
                      <option key={u.id} value={u.id}>
                        {u.termName} · Unit {u.sequenceOrder}: {u.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Estimated Time (Minutes)
                  </label>
                  <input
                    type="number"
                    min={5}
                    max={120}
                    value={estimatedMinutes}
                    onChange={(e) => setEstimatedMinutes(parseInt(e.target.value) || 20)}
                    className="w-full text-sm px-3 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Learning Objectives */}
            <div className="space-y-4 pt-4 border-t border-slate-100">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                2. Learning Objectives
              </h2>

              <div className="space-y-2">
                {objectives.map((obj, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-md bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-[10px]">
                        {idx + 1}
                      </span>
                      <span className="text-slate-800 font-medium">{obj}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveObjective(idx)}
                      className="text-slate-400 hover:text-red-600 p-1"
                      aria-label="Remove objective"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={newObjective}
                  onChange={(e) => setNewObjective(e.target.value)}
                  placeholder="Add specific learning objective..."
                  className="flex-1 text-xs px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddObjective}
                  className="gap-1 text-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add</span>
                </Button>
              </div>
            </div>

            {/* Target Skills */}
            <div className="space-y-4 pt-4 border-t border-slate-100">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                3. Associated MATATAG Skills
              </h2>

              <div className="space-y-4">
                {groupSkillsByUnit(skillsList).map((group) => (
                  <div key={group.key} className="space-y-2" data-testid="skill-group">
                    <p className="text-[11px] font-bold text-slate-500">{group.label}</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {group.skills.map((skill: any) => {
                        const isChecked = selectedSkillIds.includes(skill.id);
                        return (
                          <div
                            key={skill.id}
                            role="checkbox"
                            aria-checked={isChecked}
                            tabIndex={0}
                            onKeyDown={(e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); toggleSkill(skill.id); } }}
                            onClick={() => toggleSkill(skill.id)}
                            className={`p-3 rounded-xl border cursor-pointer text-xs flex items-center justify-between transition-colors ${
                              isChecked
                                ? "bg-blue-50/70 border-blue-500 text-blue-900 font-semibold"
                                : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                            }`}
                          >
                            <span>{skill.title}</span>
                            <span className="text-[10px] text-slate-400">Diff {skill.difficulty?.toFixed(1)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="pt-6 border-t border-slate-100 flex items-center justify-between">
              <Button
                type="button"
                variant="ghost"
                onClick={() => handleNav("/teacher/lessons")}
              >
                Cancel
              </Button>

              <Button
                type="submit"
                variant="primary"
                disabled={saving || !title.trim()}
                className="gap-2"
              >
                <Save className="w-4 h-4" />
                <span>{saving ? "Saving Draft..." : "Create Lesson & Open Studio"}</span>
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
