import React, { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth/auth-context";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
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
          const firstUnit = cData.data?.[0]?.grades?.[0]?.terms?.[0]?.units?.[0];
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

  const units = curriculum[0]?.grades?.[0]?.terms?.[0]?.units || [];

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
                        Unit {u.sequenceOrder}: {u.title}
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {skillsList.map((skill) => {
                  const isChecked = selectedSkillIds.includes(skill.id);
                  return (
                    <div
                      key={skill.id}
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
