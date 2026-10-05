import React, { useState, useEffect } from "react";
import { useAuth, authFetch } from "@/lib/auth/auth-context";
import { TeacherNav } from "@/components/teacher";
import { Button } from "@/components/ui/Button";
import { GraduationCap, Users, ArrowRight, BookOpen, Loader2 } from "lucide-react";
import type { ClassSummaryDTO } from "@/lib/teacher/teacher-types";

export interface TeacherClassesPageProps {
  onNavigate?: (path: string) => void;
}

export default function TeacherClassesPage({ onNavigate }: TeacherClassesPageProps) {
  const { user } = useAuth();
  const [classes, setClasses] = useState<ClassSummaryDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handleNav = (path: string) => {
    if (onNavigate) onNavigate(path);
    else window.location.pathname = path;
  };

  const fetchClasses = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/teacher/classes");
      if (!res.ok) throw new Error("Failed to load classes");
      const json = await res.json();
      setClasses(json.data || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error fetching classes");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClasses();
  }, []);

  const [newName, setNewName] = useState("");
  const [newGrade, setNewGrade] = useState("7");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setCreateError(null);
    try {
      const res = await authFetch("/api/teacher/classes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName, gradeLevel: Number(newGrade) }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Could not create the class");
      setNewName("");
      await fetchClasses();
    } catch (err: unknown) {
      setCreateError(err instanceof Error ? err.message : "Could not create the class");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-140px)] bg-slate-50/70">
      <TeacherNav currentTab="classes" onNavigate={handleNav} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6 space-y-1">
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Assigned Classes
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            View student enrollments, curricular progress, and mastery across your authorized classroom sections.
          </p>
        </div>

        <form onSubmit={handleCreate} data-testid="create-class-form" className="bg-white rounded-2xl border border-slate-200 p-4 mb-6 flex flex-col sm:flex-row gap-3 sm:items-end">
          <div className="flex-1">
            <label htmlFor="new-class-name" className="text-xs font-bold text-slate-700 block mb-1">New class name</label>
            <input id="new-class-name" required minLength={2} maxLength={80} value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Grade 7 - Rizal" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs" />
          </div>
          <div>
            <label htmlFor="new-class-grade" className="text-xs font-bold text-slate-700 block mb-1">Grade</label>
            <select id="new-class-grade" value={newGrade} onChange={(e) => setNewGrade(e.target.value)} className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs">
              {[7, 8, 9, 10, 11, 12].map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
          <Button type="submit" variant="primary" size="sm" disabled={creating} className="bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs">
            {creating ? "Creating..." : "Create class"}
          </Button>
          {createError && <p role="alert" className="text-xs text-red-600 sm:basis-full">{createError}</p>}
        </form>

        {loading && (
          <div className="py-24 text-center">
            <Loader2 className="w-8 h-8 animate-spin text-teal-600 mx-auto mb-2" />
            <p className="text-xs font-bold text-slate-700">Loading classroom sections...</p>
          </div>
        )}

        {error && (
          <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-xs text-red-700 mb-6">
            {error}
          </div>
        )}

        {!loading && classes.length === 0 && (
          <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center max-w-md mx-auto shadow-xs">
            <GraduationCap className="w-10 h-10 text-slate-400 mx-auto mb-3" />
            <h3 className="text-sm font-bold text-slate-900">No classes assigned</h3>
            <p className="text-xs text-slate-500 mt-1">
              No classes are currently assigned to your account.
            </p>
          </div>
        )}

        {!loading && classes.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {classes.map((cls) => (
              <div
                key={cls.id}
                onClick={() => handleNav(`/teacher/classes/${cls.id}`)}
                className="bg-white rounded-3xl border border-slate-200/90 p-6 shadow-xs hover:border-teal-300 hover:shadow-xs transition-all cursor-pointer group space-y-4"
              >
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full border border-teal-100">
                      S.Y. {cls.schoolYear}
                    </span>
                    <h2 className="text-lg font-black text-slate-900 group-hover:text-teal-700 transition-colors">
                      {cls.name}
                    </h2>
                  </div>

                  <div className="w-10 h-10 rounded-2xl bg-slate-50 text-slate-600 flex items-center justify-center group-hover:bg-teal-50 group-hover:text-teal-600 transition-colors">
                    <GraduationCap className="w-5 h-5" />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 py-2 border-y border-slate-100 text-center">
                  <div>
                    <span className="text-xs text-slate-400 block">Students</span>
                    <span className="text-base font-black text-slate-900">{cls.totalStudents}</span>
                  </div>
                  <div>
                    <span className="text-xs text-slate-400 block">Active</span>
                    <span className="text-base font-black text-emerald-600">{cls.activeStudents}</span>
                  </div>
                  <div>
                    <span className="text-xs text-slate-400 block">Avg Progress</span>
                    <span className="text-base font-black text-blue-600">{cls.averageProgress}%</span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs pt-1">
                  <span className="text-slate-500 font-medium">Grade {cls.gradeLevel} {cls.subject}</span>
                  <span className="text-teal-700 font-bold group-hover:underline flex items-center gap-1">
                    Open Class
                    <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
