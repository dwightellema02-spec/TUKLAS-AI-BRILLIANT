import React, { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth/auth-context";
import { TeacherNav, StudentTable } from "@/components/teacher";
import { Button } from "@/components/ui/Button";
import { Users, ArrowLeft, Loader2, RotateCcw } from "lucide-react";
import type { StudentListItemDTO } from "@/lib/teacher/teacher-types";

export interface TeacherStudentsPageProps {
  onNavigate?: (path: string) => void;
}

export default function TeacherStudentsPage({ onNavigate }: TeacherStudentsPageProps) {
  const { user } = useAuth();
  const [students, setStudents] = useState<StudentListItemDTO[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handleNav = (path: string) => {
    if (onNavigate) onNavigate(path);
    else window.location.pathname = path;
  };

  const fetchStudents = async (p = 1, query = "") => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: p.toString(),
        limit: "20",
      });
      if (query.trim()) params.set("search", query.trim());

      const res = await fetch(`/api/teacher/students?${params.toString()}`);
      if (!res.ok) {
        throw new Error(`Failed to load student roster (${res.status})`);
      }
      const json = await res.json();
      setStudents(json.data.students || []);
      setTotal(json.data.total || 0);
      setPage(json.data.page || 1);
      setTotalPages(json.data.totalPages || 1);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load students");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents(1, search);
  }, []);

  const handleSearchChange = (q: string) => {
    setSearch(q);
    fetchStudents(1, q);
  };

  return (
    <div className="min-h-[calc(100vh-140px)] bg-slate-50/70">
      <TeacherNav currentTab="students" onNavigate={handleNav} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header Breadcrumb */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleNav("/teacher")}
              className="gap-2 text-slate-600 text-xs"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Dashboard</span>
            </Button>
          </div>
        </div>

        {/* Page Title */}
        <div className="mb-6 space-y-1">
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Authorized Students
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Monitor learning progress, evidence-based mastery states, and active interventions across your assigned classes.
          </p>
        </div>

        {/* Error State */}
        {error && (
          <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center justify-between mb-6">
            <span>{error}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchStudents(page, search)}
              className="text-xs"
            >
              Retry
            </Button>
          </div>
        )}

        {/* Students Table */}
        <StudentTable
          students={students}
          total={total}
          page={page}
          totalPages={totalPages}
          search={search}
          onSearchChange={handleSearchChange}
          onPageChange={(p) => fetchStudents(p, search)}
          onSelectStudent={(studentId) => handleNav(`/teacher/students/${studentId}`)}
          loading={loading}
        />
      </div>
    </div>
  );
}
