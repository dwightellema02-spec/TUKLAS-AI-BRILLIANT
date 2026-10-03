import React, { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth/auth-context";
import { TeacherNav, StudentDetailView } from "@/components/teacher";
import { Button } from "@/components/ui/Button";
import { Loader2, ArrowLeft, RotateCcw } from "lucide-react";
import type { StudentDetailDTO } from "@/lib/teacher/teacher-types";

export interface TeacherStudentDetailPageProps {
  studentId: string;
  onNavigate?: (path: string) => void;
}

export default function TeacherStudentDetailPage({
  studentId,
  onNavigate,
}: TeacherStudentDetailPageProps) {
  const { user } = useAuth();
  const [detail, setDetail] = useState<StudentDetailDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handleNav = (path: string) => {
    if (onNavigate) onNavigate(path);
    else window.location.pathname = path;
  };

  const fetchStudentDetail = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/teacher/students/${studentId}`);
      if (!res.ok) {
        if (res.status === 403) {
          throw new Error("Forbidden: You are not authorized to view this student's records.");
        }
        throw new Error("Failed to load student details");
      }
      const json = await res.json();
      setDetail(json.data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error fetching student details");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudentDetail();
  }, [studentId]);

  return (
    <div className="min-h-[calc(100vh-140px)] bg-slate-50/70">
      <TeacherNav currentTab="students" onNavigate={handleNav} />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading && (
          <div className="py-24 text-center space-y-3">
            <Loader2 className="w-8 h-8 animate-spin text-teal-600 mx-auto" />
            <p className="text-xs font-bold text-slate-700">Loading student diagnostic profile...</p>
          </div>
        )}

        {error && (
          <div className="bg-white rounded-3xl border border-red-200 p-8 text-center max-w-md mx-auto shadow-xs">
            <h2 className="text-base font-bold text-slate-900 mb-2">Access Denied or Error</h2>
            <p className="text-xs text-slate-600 mb-6">{error}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleNav("/teacher/students")}
              className="gap-1 text-xs"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Student Roster</span>
            </Button>
          </div>
        )}

        {detail && !loading && (
          <StudentDetailView
            detail={detail}
            onBack={() => handleNav("/teacher/students")}
            onNavigateSkill={(skillId) => handleNav(`/teacher/students?skillId=${skillId}`)}
            onNavigateLesson={(lessonId) => handleNav(`/teacher/lessons/${lessonId}/edit`)}
          />
        )}
      </div>
    </div>
  );
}
