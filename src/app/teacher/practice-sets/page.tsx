import React, { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth/auth-context";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { PracticeSetStatus } from "@prisma/client";
import {
  ArrowLeft,
  Plus,
  Target,
  Layers,
  BookOpen,
  Eye,
  CheckCircle,
  Clock,
  Sparkles,
  ChevronRight,
  Trash2,
} from "lucide-react";

export interface TeacherPracticeSetsPageProps {
  onNavigate?: (path: string) => void;
}

export default function TeacherPracticeSetsPage({
  onNavigate,
}: TeacherPracticeSetsPageProps) {
  const { user } = useAuth();
  const [practiceSets, setPracticeSets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // New Practice Set Form
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [lessonId, setLessonId] = useState("lsn_01");
  const [status, setStatus] = useState<PracticeSetStatus>("DRAFT");
  const [saving, setSaving] = useState(false);

  const handleNav = (path: string) => {
    if (onNavigate) onNavigate(path);
    else window.location.pathname = path;
  };

  const loadPracticeSets = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/practice-sets");
      if (res.ok) {
        const json = await res.json();
        setPracticeSets(json.data || []);
      }
    } catch (e) {
      console.error("Error loading practice sets", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPracticeSets();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setSaving(true);
    try {
      const res = await fetch("/api/practice-sets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          lessonId,
          status,
        }),
      });
      if (res.ok) {
        setTitle("");
        setDescription("");
        setShowCreateModal(false);
        loadPracticeSets();
      }
    } catch (e) {
      console.error("Failed to create practice set", e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <button
            type="button"
            onClick={() => handleNav("/teacher")}
            className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 mb-2 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Teacher Dashboard</span>
          </button>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Practice Sets Manager
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
            Organize questions into structured practice activities linked to lesson blocks and skills.
          </p>
        </div>

        <Button
          variant="primary"
          onClick={() => setShowCreateModal(true)}
          className="gap-2 shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>New Practice Set</span>
        </Button>
      </div>

      {loading ? (
        <div className="py-20 text-center text-xs text-slate-400">
          Loading practice sets...
        </div>
      ) : practiceSets.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center space-y-3">
          <Target className="w-10 h-10 text-slate-300 mx-auto" />
          <h2 className="text-base font-bold text-slate-700">No practice sets authored yet</h2>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Assemble approved questions into practice sets to link with curriculum lessons.
          </p>
          <Button variant="primary" size="sm" onClick={() => setShowCreateModal(true)}>
            <Plus className="w-3.5 h-3.5 mr-1" />
            <span>Create Practice Set</span>
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {practiceSets.map((ps) => {
            const isPublished = ps.status === "PUBLISHED";
            const qCount = ps.questions?.length || ps.questionCount || 0;

            return (
              <div
                key={ps.id}
                className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs hover:border-slate-300 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-base font-bold text-slate-900">
                      {ps.title}
                    </h2>
                    <Badge
                      variant="outline"
                      className={`text-[10px] font-semibold ${
                        isPublished
                          ? "bg-teal-50 text-teal-800 border-teal-200"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {ps.status}
                    </Badge>
                    {ps.lesson && (
                      <span className="text-xs text-slate-500 font-medium">
                        • {ps.lesson.title}
                      </span>
                    )}
                  </div>

                  {ps.description && (
                    <p className="text-xs text-slate-600 max-w-xl">
                      {ps.description}
                    </p>
                  )}

                  <div className="flex items-center gap-3 text-xs text-slate-500 pt-1">
                    <span className="font-semibold text-slate-700">
                      {qCount} Question{qCount === 1 ? "" : "s"}
                    </span>
                    <span>•</span>
                    <span>Created: {new Date(ps.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleNav(`/student/practice/${ps.id}`)}
                    className="text-xs gap-1.5"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Student View</span>
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 max-w-md w-full shadow-xl space-y-4">
            <h3 className="text-lg font-bold text-slate-900">
              Create New Practice Set
            </h3>

            <form onSubmit={handleCreate} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Title
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Integer Addition & Sign Rules Practice"
                  className="w-full p-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brief description of skills tested..."
                  className="w-full p-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Initial Status
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as PracticeSetStatus)}
                  className="w-full p-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  <option value="DRAFT">Draft</option>
                  <option value="PUBLISHED">Published</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                >
                  Cancel
                </Button>
                <Button variant="primary" type="submit" disabled={saving}>
                  {saving ? "Creating..." : "Create Practice Set"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
