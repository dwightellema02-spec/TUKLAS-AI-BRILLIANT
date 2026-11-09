import React, { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth/auth-context";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { LessonStatus } from "@prisma/client";
import { MathAuthorizationNotice, useMathAuthorization } from "@/components/teacher/MathAuthorizationNotice";
import {
  BookOpen,
  ArrowLeft,
  Plus,
  Edit,
  Eye,
  Trash2,
  Send,
  CheckCircle,
  Globe,
  Clock,
  Filter,
} from "lucide-react";

export interface TeacherLessonsPageProps {
  onNavigate?: (path: string) => void;
}

export default function TeacherLessonsPage({ onNavigate }: TeacherLessonsPageProps) {
  const { user } = useAuth();
  const mathAuth = useMathAuthorization();
  const [lessons, setLessons] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [actionError, setActionError] = useState<string | null>(null);

  const handleNav = (path: string) => {
    if (onNavigate) onNavigate(path);
    else window.location.pathname = path;
  };

  const fetchLessons = async () => {
    setLoading(true);
    try {
      const url = statusFilter === "ALL" ? "/api/lessons" : `/api/lessons?status=${statusFilter}`;
      const res = await fetch(url);
      if (res.ok) {
        const json = await res.json();
        setLessons(json.data || []);
      }
    } catch (e) {
      console.error("Failed to load lessons:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLessons();
  }, [statusFilter]);

  const handleStatusTransition = async (id: string, targetStatus: LessonStatus) => {
    setActionError(null);
    try {
      const res = await fetch(`/api/lessons/${id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetStatus }),
      });
      const data = await res.json();
      if (!res.ok) {
        setActionError(data.error || "Status update failed");
        return;
      }
      fetchLessons();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : "Error updating status");
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this lesson?")) return;
    try {
      const res = await fetch(`/api/lessons/${id}`, { method: "DELETE" });
      if (res.ok) {
        fetchLessons();
      }
    } catch (err) {
      console.error("Delete failed:", err);
    }
  };

  const getStatusBadge = (status: LessonStatus) => {
    switch (status) {
      case "DRAFT":
        return <Badge variant="secondary">Draft</Badge>;
      case "REVIEW":
        return <Badge variant="warning">In Review</Badge>;
      case "APPROVED":
        return <Badge variant="info">Approved</Badge>;
      case "PUBLISHED":
        return <Badge variant="success">Published</Badge>;
      case "ARCHIVED":
        return <Badge variant="outline">Archived</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  return (
    <div className="py-8 sm:py-12 bg-slate-50 min-h-[calc(100vh-140px)]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <MathAuthorizationNotice auth={mathAuth} />
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
              <span className="text-slate-900 font-medium">Lesson Management</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
              Teacher Content Studio — Lessons
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Author, edit, review, and publish interactive lessons aligned with Grade 7 MATATAG.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleNav("/teacher/curriculum")}
            >
              Curriculum Tree
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

        {/* Error notification banner */}
        {actionError && (
          <div className="mb-4 p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 font-medium flex items-center justify-between">
            <span>{actionError}</span>
            <button onClick={() => setActionError(null)} className="text-red-500 font-bold ml-2">
              ×
            </button>
          </div>
        )}

        {/* Filter Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 mb-6 bg-white p-1.5 rounded-xl border border-slate-200 shadow-2xs">
          {["ALL", "DRAFT", "REVIEW", "APPROVED", "PUBLISHED", "ARCHIVED"].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                statusFilter === st
                  ? "bg-slate-900 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}
            >
              {st === "ALL" ? "All Lessons" : st}
            </button>
          ))}
        </div>

        {/* Lessons List Card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-xs text-slate-400">Loading lessons...</div>
          ) : lessons.length === 0 ? (
            <div className="p-12 text-center">
              <BookOpen className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-700">No Lessons Found</p>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
                No lessons match the selected filter. Start by creating a new lesson draft.
              </p>
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
          ) : (
            <div className="divide-y divide-slate-100">
              {lessons.map((lesson) => (
                <div
                  key={lesson.id}
                  className="p-5 sm:p-6 hover:bg-slate-50/50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5 max-w-xl">
                    <div className="flex items-center gap-2.5">
                      <h3 className="font-bold text-base text-slate-900">{lesson.title}</h3>
                      {getStatusBadge(lesson.status)}
                    </div>
                    <p className="text-xs text-slate-600 line-clamp-2">{lesson.description}</p>

                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 pt-1">
                      <span className="font-medium text-slate-700">
                        {lesson.unit?.term?.grade?.name || "Grade 7"} • {lesson.unit?.term?.name || "Term 1"}
                      </span>
                      <span>•</span>
                      <span>{lesson.unit?.title || "Numbers & Algebra"}</span>
                      <span>•</span>
                      <span>⏱ {lesson.estimatedMinutes} mins</span>
                      <span>•</span>
                      <span>{lesson.resources?.length || 0} Resources</span>
                      <span>•</span>
                      <span>{lesson.contentBlocks?.length || 0} Content Blocks</span>
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleNav(`/teacher/lessons/${lesson.id}/edit`)}
                      className="gap-1.5 text-xs"
                    >
                      <Edit className="w-3.5 h-3.5" />
                      <span>Edit Studio</span>
                    </Button>

                    {/* Status Transitions */}
                    {lesson.status === "DRAFT" && (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleStatusTransition(lesson.id, "REVIEW")}
                        className="gap-1.5 text-xs bg-amber-600 hover:bg-amber-700"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Submit for Review</span>
                      </Button>
                    )}

                    {lesson.status === "REVIEW" && (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleStatusTransition(lesson.id, "APPROVED")}
                        className="gap-1.5 text-xs bg-blue-600 hover:bg-blue-700"
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                        <span>Approve</span>
                      </Button>
                    )}

                    {lesson.status === "APPROVED" && (
                      <Button
                        variant="accent"
                        size="sm"
                        onClick={() => handleStatusTransition(lesson.id, "PUBLISHED")}
                        className="gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700"
                      >
                        <Globe className="w-3.5 h-3.5" />
                        <span>Publish</span>
                      </Button>
                    )}

                    {lesson.status === "PUBLISHED" && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleNav(`/student/lessons/${lesson.id}`)}
                        className="gap-1.5 text-xs"
                      >
                        <Eye className="w-3.5 h-3.5 text-blue-600" />
                        <span>Student View</span>
                      </Button>
                    )}

                    <button
                      onClick={() => handleDelete(lesson.id)}
                      className="p-2 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                      title="Delete Lesson"
                      aria-label="Delete Lesson"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
