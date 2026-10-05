import React, { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth/auth-context";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  Layers,
  BookOpen,
  CheckCircle2,
  Lock,
  Edit,
  Save,
  AlertCircle,
  Sparkles,
  GitBranch,
  RefreshCw,
  Plus,
} from "lucide-react";

export interface TeacherUnitCurriculumPageProps {
  unitId: string;
  onNavigate?: (path: string) => void;
}

export default function TeacherUnitCurriculumPage({
  unitId,
  onNavigate,
}: TeacherUnitCurriculumPageProps) {
  const { user } = useAuth();
  const [curriculum, setCurriculum] = useState<any[]>([]);
  const [skills, setSkills] = useState<any[]>([]);
  const [lessons, setLessons] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingReorder, setSavingReorder] = useState(false);
  const [selectedSkillForPrereq, setSelectedSkillForPrereq] = useState<any | null>(null);
  const [selectedPrereqIds, setSelectedPrereqIds] = useState<string[]>([]);
  const [prereqSaving, setPrereqSaving] = useState(false);
  const [notification, setNotification] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const handleNav = (path: string) => {
    if (onNavigate) onNavigate(path);
    else window.location.pathname = path;
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [curRes, skillsRes] = await Promise.all([
        fetch("/api/curriculum"),
        fetch("/api/skills"),
      ]);

      if (curRes.ok) {
        const cJson = await curRes.json();
        setCurriculum(cJson.data || []);

        // Find current unit
        const foundUnit = (cJson.data?.[0]?.grades?.[0]?.terms ?? []).flatMap((t: any) => t.units ?? []).find(
          (u: any) => u.id === unitId
        ) || (cJson.data?.[0]?.grades?.[0]?.terms ?? []).flatMap((t: any) => t.units ?? [])[0];

        if (foundUnit && foundUnit.lessons) {
          // Sort by sequenceOrder
          const sorted = [...foundUnit.lessons].sort((a, b) => a.sequenceOrder - b.sequenceOrder);
          setLessons(sorted);
        }
      }

      if (skillsRes.ok) {
        const sJson = await skillsRes.json();
        setSkills(sJson.data || []);
      }
    } catch (e) {
      console.error("Failed to load unit curriculum:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [unitId]);

  // Reorder lessons
  const handleMoveLesson = (index: number, direction: "up" | "down") => {
    if (
      (direction === "up" && index === 0) ||
      (direction === "down" && index === lessons.length - 1)
    ) {
      return;
    }

    const targetIndex = direction === "up" ? index - 1 : index + 1;
    const reordered = [...lessons];
    const temp = reordered[index];
    reordered[index] = reordered[targetIndex];
    reordered[targetIndex] = temp;

    // Update sequence orders
    const updated = reordered.map((l, i) => ({ ...l, sequenceOrder: i + 1 }));
    setLessons(updated);
  };

  const handleSaveLessonOrder = async () => {
    setSavingReorder(true);
    setNotification(null);
    try {
      const orderedIds = lessons.map((l) => l.id);
      const res = await fetch(`/api/units/${unitId}/reorder-lessons`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderedLessonIds: orderedIds }),
      });
      const data = await res.json();
      if (!res.ok) {
        setNotification({ type: "error", message: data.error || "Failed to reorder lessons" });
      } else {
        setNotification({ type: "success", message: "Lesson sequence saved successfully!" });
      }
    } catch (e: unknown) {
      setNotification({
        type: "error",
        message: e instanceof Error ? e.message : "Error saving sequence",
      });
    } finally {
      setSavingReorder(false);
    }
  };

  // Skill prerequisite selection
  const handleSelectSkillForPrereq = (skill: any) => {
    setSelectedSkillForPrereq(skill);
    setSelectedPrereqIds(skill.prerequisiteIds || skill.prerequisites?.map((p: any) => p.prerequisiteSkillId) || []);
    setNotification(null);
  };

  const handleTogglePrereq = (pId: string) => {
    if (selectedPrereqIds.includes(pId)) {
      setSelectedPrereqIds(selectedPrereqIds.filter((id) => id !== pId));
    } else {
      setSelectedPrereqIds([...selectedPrereqIds, pId]);
    }
  };

  const handleSavePrerequisites = async () => {
    if (!selectedSkillForPrereq) return;
    setPrereqSaving(true);
    setNotification(null);

    try {
      const res = await fetch(`/api/skills/${selectedSkillForPrereq.id}/prerequisites`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prerequisiteSkillIds: selectedPrereqIds }),
      });

      const data = await res.json();
      if (!res.ok) {
        setNotification({
          type: "error",
          message: data.error || "Failed to save prerequisites (Cycle or validation error).",
        });
      } else {
        setNotification({
          type: "success",
          message: `Prerequisites for "${selectedSkillForPrereq.title}" updated successfully!`,
        });
        loadData();
      }
    } catch (e: unknown) {
      setNotification({
        type: "error",
        message: e instanceof Error ? e.message : "Prerequisite save failed",
      });
    } finally {
      setPrereqSaving(false);
    }
  };

  const currentUnit =
    (curriculum?.[0]?.grades?.[0]?.terms ?? []).flatMap((t: any) => t.units ?? []).find((u: any) => u.id === unitId) ||
    (curriculum?.[0]?.grades?.[0]?.terms ?? []).flatMap((t: any) => t.units ?? [])[0];

  return (
    <div className="py-8 sm:py-12 bg-slate-50 min-h-[calc(100vh-140px)]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        {/* Navigation Breadcrumb */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
              <button
                onClick={() => handleNav("/teacher/curriculum")}
                className="hover:text-blue-600 transition-colors flex items-center gap-1"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Curriculum Hierarchy</span>
              </button>
              <span>/</span>
              <span className="text-slate-900 font-medium">Unit Learning Path</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
              Learning Path & Prerequisite Manager
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Unit: {currentUnit?.title || "Numbers and Algebraic Expressions"} (Term 1)
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleNav("/teacher/lessons")}
            >
              Lessons List
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => handleNav("/teacher/lessons/new")}
              className="gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Create Lesson</span>
            </Button>
          </div>
        </div>

        {/* Notifications */}
        {notification && (
          <div
            className={`mb-6 p-4 rounded-xl border text-xs flex items-center justify-between font-medium ${
              notification.type === "success"
                ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                : "bg-red-50 border-red-200 text-red-700"
            }`}
          >
            <div className="flex items-center gap-2">
              {notification.type === "success" ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-600" />
              )}
              <span>{notification.message}</span>
            </div>
            <button
              onClick={() => setNotification(null)}
              className="text-slate-400 hover:text-slate-700 font-bold ml-4"
            >
              ×
            </button>
          </div>
        )}

        {/* Main Grid: Left = Lesson Order, Right = Prerequisite DAG Manager */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column (7 cols): Lesson Order & Publishing State */}
          <div className="lg:col-span-7 space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
                    <Layers className="w-4 h-4 text-blue-600" />
                    <span>Lesson Sequence & Progression Order</span>
                  </h2>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Defines the exact linear order students encounter in their learning path.
                  </p>
                </div>

                <Button
                  variant="primary"
                  size="sm"
                  disabled={savingReorder}
                  onClick={handleSaveLessonOrder}
                  className="gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{savingReorder ? "Saving..." : "Save Order"}</span>
                </Button>
              </div>

              {loading ? (
                <p className="text-xs text-slate-400 py-6 text-center">Loading lessons...</p>
              ) : lessons.length === 0 ? (
                <p className="text-xs text-slate-400 py-6 text-center">No lessons in this unit.</p>
              ) : (
                <div className="space-y-3">
                  {lessons.map((lesson, idx) => {
                    const isPublished = lesson.status === "PUBLISHED";
                    return (
                      <div
                        key={lesson.id}
                        className="p-4 rounded-xl bg-slate-50/70 border border-slate-200 flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="flex items-center gap-3">
                          <span className="w-6 h-6 rounded-md bg-blue-100 text-blue-800 font-bold flex items-center justify-center text-xs shrink-0">
                            {idx + 1}
                          </span>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900 text-sm">{lesson.title}</span>
                              <Badge
                                variant={isPublished ? "success" : "secondary"}
                                className="text-[10px]"
                              >
                                {lesson.status}
                              </Badge>
                            </div>
                            <p className="text-slate-500 text-[11px] mt-0.5 line-clamp-1">
                              {lesson.description || "Interactive lesson"}
                            </p>
                            <span className="text-[10px] text-slate-400 mt-1 block">
                              ⏱ {lesson.estimatedMinutes} mins • {lesson.skillIds?.length || 0} Skills assigned
                            </span>
                          </div>
                        </div>

                        {/* Reorder and Edit Actions */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => handleMoveLesson(idx, "up")}
                            className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-white"
                            title="Move Up"
                          >
                            <ArrowUp className="w-3.5 h-3.5 text-slate-600" />
                          </button>
                          <button
                            type="button"
                            disabled={idx === lessons.length - 1}
                            onClick={() => handleMoveLesson(idx, "down")}
                            className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-white"
                            title="Move Down"
                          >
                            <ArrowDown className="w-3.5 h-3.5 text-slate-600" />
                          </button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleNav(`/teacher/lessons/${lesson.id}/edit`)}
                            className="text-xs p-1.5 text-blue-600"
                            title="Edit in Studio"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right Column (5 cols): Skill Prerequisites Manager (DAG) */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
                    <GitBranch className="w-4 h-4 text-emerald-600" />
                    <span>Prerequisite System (DAG)</span>
                  </h2>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Assign prerequisite dependencies with cycle detection validation.
                  </p>
                </div>
              </div>

              {/* Skills Selector List */}
              <div className="space-y-2 mb-6">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  1. Select Target Skill to Edit Prerequisites:
                </span>
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {skills.map((skill) => {
                    const isSelected = selectedSkillForPrereq?.id === skill.id;
                    const prereqCount = skill.prerequisiteIds?.length || 0;
                    return (
                      <div
                        key={skill.id}
                        onClick={() => handleSelectSkillForPrereq(skill)}
                        className={`p-2.5 rounded-xl border text-xs cursor-pointer flex items-center justify-between transition-colors ${
                          isSelected
                            ? "bg-emerald-50/80 border-emerald-500 font-bold text-emerald-950 shadow-2xs"
                            : "bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-700"
                        }`}
                      >
                        <span className="truncate pr-2">{skill.title}</span>
                        <span className="text-[10px] text-slate-400 shrink-0">
                          {prereqCount} Prereq{prereqCount === 1 ? "" : "s"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Prerequisite Checklist for Selected Skill */}
              {selectedSkillForPrereq ? (
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                        Configuring Prerequisites For:
                      </span>
                      <h3 className="font-bold text-slate-900 text-xs mt-0.5">
                        {selectedSkillForPrereq.title}
                      </h3>
                    </div>
                    <Badge variant="outline" className="text-[10px]">
                      Diff {selectedSkillForPrereq.difficulty?.toFixed(1)}
                    </Badge>
                  </div>

                  <p className="text-[11px] text-slate-500">
                    Check the skills that a student must complete before unlocking this skill:
                  </p>

                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {skills
                      .filter((s) => s.id !== selectedSkillForPrereq.id)
                      .map((candidate) => {
                        const isChecked = selectedPrereqIds.includes(candidate.id);
                        return (
                          <label
                            key={candidate.id}
                            className={`flex items-center gap-2 p-2 rounded-lg border text-xs cursor-pointer transition-colors ${
                              isChecked
                                ? "bg-white border-blue-400 text-blue-900 font-semibold shadow-2xs"
                                : "bg-white/60 border-slate-200 text-slate-600 hover:bg-white"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleTogglePrereq(candidate.id)}
                              className="rounded text-blue-600 focus:ring-blue-500"
                            />
                            <span className="truncate">{candidate.title}</span>
                          </label>
                        );
                      })}
                  </div>

                  <div className="pt-2 flex justify-end">
                    <Button
                      variant="primary"
                      size="sm"
                      disabled={prereqSaving}
                      onClick={handleSavePrerequisites}
                      className="gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>{prereqSaving ? "Validating & Saving..." : "Save Prerequisites"}</span>
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="p-6 rounded-xl border border-dashed border-slate-200 text-center text-xs text-slate-400">
                  Select a skill above to view or modify its required prerequisites.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
