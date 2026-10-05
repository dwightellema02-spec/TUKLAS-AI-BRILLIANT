import React, { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth/auth-context";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
  BookOpen,
  ArrowLeft,
  ChevronRight,
  Plus,
  Layers,
  GraduationCap,
  Calendar,
  CheckCircle2,
  FolderOpen,
  Sparkles,
} from "lucide-react";

export interface TeacherCurriculumPageProps {
  onNavigate?: (path: string) => void;
}

export default function TeacherCurriculumPage({ onNavigate }: TeacherCurriculumPageProps) {
  const { user } = useAuth();
  const [curriculum, setCurriculum] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);

  const handleNav = (path: string) => {
    if (onNavigate) onNavigate(path);
    else window.location.pathname = path;
  };

  useEffect(() => {
    async function fetchCurriculum() {
      try {
        const res = await fetch("/api/curriculum");
        if (res.ok) {
          const json = await res.json();
          setCurriculum(json.data || []);
          // Default select first unit if available
          const firstUnit = json.data?.[0]?.grades?.[0]?.terms?.[0]?.units?.[0];
          if (firstUnit) setSelectedUnitId(firstUnit.id);
        }
      } catch (err) {
        console.error("Error fetching curriculum:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchCurriculum();
  }, []);

  const currentSubject = curriculum[0];
  const currentGrade = currentSubject?.grades?.[0];
  // every term of the grade, not only the first: a unit is shown with the term it belongs to
  const terms: any[] = currentGrade?.terms || [];
  const currentTerm = terms[0];
  const units: any[] = terms.flatMap((t: any) => (t.units || []).map((u: any) => ({ ...u, termName: t.name })));
  const selectedUnit = units.find((u: any) => u.id === selectedUnitId) || units[0];

  return (
    <div className="py-8 sm:py-12 bg-slate-50 min-h-[calc(100vh-140px)]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        {/* Navigation & Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
              <button
                onClick={() => handleNav("/teacher")}
                className="hover:text-blue-600 transition-colors flex items-center gap-1"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Teacher Dashboard</span>
              </button>
              <span>/</span>
              <span className="text-slate-900 font-medium">Curriculum Management</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
              Curriculum Hierarchy Explorer
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Browse competencies, skills, and lesson assignments aligned with MATATAG standards.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleNav("/teacher/lessons")}
            >
              View Lessons
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => handleNav("/teacher/lessons/new")}
              className="gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Create New Lesson</span>
            </Button>
          </div>
        </div>

        {/* Curriculum Path Badges */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6 shadow-2xs flex flex-wrap items-center gap-2 text-xs">
          <Badge variant="default" className="text-xs py-1">
            Subject: {currentSubject?.name || "Mathematics"} ({currentSubject?.code || "MATH"})
          </Badge>
          <ChevronRight className="w-4 h-4 text-slate-300" />
          <Badge variant="secondary" className="text-xs py-1">
            Grade: {currentGrade?.name || "Grade 7"}
          </Badge>
          <ChevronRight className="w-4 h-4 text-slate-300" />
          <Badge variant="info" className="text-xs py-1">
            {terms.length > 1 ? "Terms" : "Term"}: {terms.map((t: any) => t.name).join(", ") || "Term 1"}
          </Badge>
        </div>

        {/* Units & Details Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Units List */}
          <div className="space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Curriculum Units
            </h2>

            {loading ? (
              <p className="text-xs text-slate-400">Loading curriculum units...</p>
            ) : (
              units.map((unit: any) => {
                const isSelected = unit.id === selectedUnit?.id;
                return (
                  <div
                    key={unit.id}
                    onClick={() => setSelectedUnitId(unit.id)}
                    className={`p-4 rounded-xl border cursor-pointer transition-all ${
                      isSelected
                        ? "bg-blue-50/70 border-blue-500 shadow-xs"
                        : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700">
                        {unit.termName} · Unit {unit.sequenceOrder}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {unit.lessons?.length || 0} Lessons
                      </span>
                    </div>
                    <h3 className="font-bold text-sm text-slate-900">{unit.title}</h3>
                    <p className="text-xs text-slate-500 mt-1 line-clamp-2">{unit.description}</p>
                  </div>
                );
              })
            )}
          </div>

          {/* Right Column: Selected Unit Details & Lessons */}
          <div className="lg:col-span-2 space-y-6">
            {selectedUnit ? (
              <>
                {/* Unit Header Card */}
                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-xs font-semibold text-teal-700 uppercase tracking-wider">
                        Active Unit Overview
                      </span>
                      <h2 className="text-xl font-bold text-slate-900 mt-1">
                        {selectedUnit.title}
                      </h2>
                      <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                        {selectedUnit.description}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleNav(`/teacher/curriculum/${selectedUnit.id}`)}
                        className="gap-1.5"
                      >
                        <Layers className="w-3.5 h-3.5 text-blue-600" />
                        <span>Manage Order & Prerequisites</span>
                      </Button>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleNav("/teacher/lessons/new")}
                        className="gap-1.5"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Lesson</span>
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Lessons In Unit */}
                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-blue-600" />
                      <span>Lessons in this Unit ({selectedUnit.lessons?.length || 0})</span>
                    </h3>
                  </div>

                  {selectedUnit.lessons?.length === 0 ? (
                    <p className="text-xs text-slate-500">No lessons created yet in this unit.</p>
                  ) : (
                    <div className="space-y-3">
                      {selectedUnit.lessons?.map((lesson: any) => (
                        <div
                          key={lesson.id}
                          className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-sm text-slate-900">{lesson.title}</span>
                              <Badge
                                variant={
                                  lesson.status === "PUBLISHED"
                                    ? "success"
                                    : lesson.status === "APPROVED"
                                    ? "info"
                                    : lesson.status === "REVIEW"
                                    ? "warning"
                                    : "secondary"
                                }
                                className="text-[10px]"
                              >
                                {lesson.status}
                              </Badge>
                            </div>
                            <p className="text-slate-500 text-xs mt-1">{lesson.description}</p>
                            <div className="flex items-center gap-3 mt-2 text-[11px] text-slate-500">
                              <span>⏱ {lesson.estimatedMinutes} mins</span>
                              <span>•</span>
                              <span>{lesson.learningObjectives?.length || 0} Objectives</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleNav(`/teacher/lessons/${lesson.id}/edit`)}
                            >
                              Edit Studio
                            </Button>
                            {lesson.status === "PUBLISHED" && (
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => handleNav(`/student/lessons/${lesson.id}`)}
                              >
                                Student View
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Competencies & Associated Skills */}
                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
                  <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Official MATATAG Competencies & Skills</span>
                  </h3>

                  <div className="space-y-4">
                    {selectedUnit.competencies?.map((comp: any) => (
                      <div key={comp.id} className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className="font-mono text-[10px] text-slate-700">
                            {comp.code}
                          </Badge>
                        </div>
                        <p className="text-xs font-medium text-slate-800 mb-3">{comp.statement}</p>

                        <div className="space-y-1.5 pl-2 border-l-2 border-slate-200">
                          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                            Associated Skills:
                          </span>
                          {comp.skills?.map((skill: any) => (
                            <div key={skill.id} className="flex items-center justify-between text-xs text-slate-700 py-1">
                              <span>• {skill.title}</span>
                              <span className="text-[11px] text-slate-400">Difficulty {skill.difficulty?.toFixed(1)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <p className="text-sm text-slate-500">Select a unit to view details.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
