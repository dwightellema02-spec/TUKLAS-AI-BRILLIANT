import React, { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth/auth-context";
import { TeacherNav, StudentTable, MasteryDistributionCard } from "@/components/teacher";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import {
  GraduationCap,
  Users,
  ArrowLeft,
  BookOpen,
  PlusCircle,
  Calendar,
  CheckCircle2,
  Loader2,
} from "lucide-react";

export interface TeacherClassDetailPageProps {
  classId: string;
  onNavigate?: (path: string) => void;
}

export default function TeacherClassDetailPage({
  classId,
  onNavigate,
}: TeacherClassDetailPageProps) {
  const { user } = useAuth();
  const [classData, setClassData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Assignment Modal
  const [assignmentModalOpen, setAssignmentModalOpen] = useState(false);
  const [assignmentTitle, setAssignmentTitle] = useState("");
  const [assignmentDesc, setAssignmentDesc] = useState("");
  const [submittingAssignment, setSubmittingAssignment] = useState(false);

  const handleNav = (path: string) => {
    if (onNavigate) onNavigate(path);
    else window.location.pathname = path;
  };

  const fetchClassDetail = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/teacher/classes/${classId}`);
      if (!res.ok) {
        if (res.status === 403) throw new Error("Forbidden: You are not authorized to view this class.");
        throw new Error("Failed to load class details");
      }
      const json = await res.json();
      setClassData(json.data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error fetching class");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClassDetail();
  }, [classId]);

  const handleCreateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignmentTitle.trim()) return;

    setSubmittingAssignment(true);
    try {
      const res = await fetch(`/api/teacher/classes/${classId}/assignments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: assignmentTitle,
          description: assignmentDesc,
          dueDate: new Date(Date.now() + 86400000 * 7).toISOString(),
        }),
      });

      if (res.ok) {
        setAssignmentTitle("");
        setAssignmentDesc("");
        setAssignmentModalOpen(false);
        fetchClassDetail();
      }
    } catch (err) {
      console.warn("Assignment creation error:", err);
    } finally {
      setSubmittingAssignment(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-140px)] bg-slate-50/70">
      <TeacherNav currentTab="classes" onNavigate={handleNav} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleNav("/teacher/classes")}
            className="gap-2 text-slate-600 text-xs"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Classes</span>
          </Button>
        </div>

        {loading && (
          <div className="py-24 text-center">
            <Loader2 className="w-8 h-8 animate-spin text-teal-600 mx-auto mb-2" />
            <p className="text-xs font-bold text-slate-700">Loading classroom metrics...</p>
          </div>
        )}

        {error && (
          <div className="bg-white rounded-3xl border border-red-200 p-8 text-center max-w-md mx-auto shadow-xs">
            <h2 className="text-base font-bold text-slate-900 mb-2">Access Restricted or Error</h2>
            <p className="text-xs text-slate-600 mb-6">{error}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleNav("/teacher/classes")}
              className="text-xs"
            >
              Return to Classes
            </Button>
          </div>
        )}

        {classData && !loading && (
          <div className="space-y-8">
            {/* Class Header Banner */}
            <div className="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-8 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full border border-teal-100">
                      S.Y. {classData.classroom.schoolYear}
                    </span>
                    <span className="text-xs text-slate-500">
                      Grade {classData.classroom.gradeLevel} {classData.classroom.subject}
                    </span>
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-black text-slate-900">
                    {classData.classroom.name}
                  </h1>
                </div>

                <div className="flex items-center gap-3">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => setAssignmentModalOpen(true)}
                    className="gap-2 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs"
                  >
                    <PlusCircle className="w-4 h-4" />
                    <span>Create Assignment</span>
                  </Button>
                </div>
              </div>
            </div>

            {/* Assignments Section */}
            <div className="bg-white rounded-3xl border border-slate-200/90 p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-teal-600" />
                  <span>Class Assignments</span>
                </h2>
                <span className="text-xs text-slate-400">
                  {classData.assignments?.length || 0} active
                </span>
              </div>

              {classData.assignments?.length === 0 ? (
                <p className="text-xs text-slate-400 py-3">No assignments created for this class yet.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {classData.assignments.map((asg: any) => (
                    <div
                      key={asg.id}
                      className="p-4 rounded-2xl border border-slate-100 bg-slate-50/60 space-y-1.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-slate-900">
                          {asg.title}
                        </span>
                        <Badge variant="success" className="text-[10px]">
                          {asg.status}
                        </Badge>
                      </div>
                      {asg.description && (
                        <p className="text-xs text-slate-500 line-clamp-1">
                          {asg.description}
                        </p>
                      )}
                      {asg.dueDate && (
                        <p className="text-[10px] text-slate-400 flex items-center gap-1 pt-1">
                          <Calendar className="w-3 h-3" />
                          <span>Due: {new Date(asg.dueDate).toLocaleDateString()}</span>
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Class Mastery Distribution */}
            {classData.masteryDistribution && (
              <MasteryDistributionCard distribution={classData.masteryDistribution} />
            )}

            {/* Enrolled Students Table */}
            <div className="space-y-3">
              <h2 className="text-base font-bold text-slate-900">
                Enrolled Students ({classData.students?.length || 0})
              </h2>
              <StudentTable
                students={classData.students || []}
                total={classData.students?.length || 0}
                page={1}
                totalPages={1}
                search=""
                onSearchChange={() => {}}
                onPageChange={() => {}}
                onSelectStudent={(studentId) => handleNav(`/teacher/students/${studentId}`)}
              />
            </div>
          </div>
        )}

        {/* Create Assignment Dialog */}
        {assignmentModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <div className="bg-white rounded-3xl border border-slate-200 p-6 w-full max-w-md shadow-2xl space-y-4">
              <h3 className="text-base font-bold text-slate-900">
                Create Class Assignment
              </h3>
              <form onSubmit={handleCreateAssignment} className="space-y-3 text-xs">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Assignment Title
                  </label>
                  <input
                    type="text"
                    required
                    value={assignmentTitle}
                    onChange={(e) => setAssignmentTitle(e.target.value)}
                    placeholder="e.g. Adding Integers Practice Problem Set"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Instructions / Description
                  </label>
                  <textarea
                    rows={3}
                    value={assignmentDesc}
                    onChange={(e) => setAssignmentDesc(e.target.value)}
                    placeholder="Provide instructions for students..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <div className="flex items-center justify-end gap-2 pt-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setAssignmentModalOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    disabled={submittingAssignment}
                    className="bg-teal-600 hover:bg-teal-700 text-white font-bold"
                  >
                    {submittingAssignment ? "Publishing..." : "Publish Assignment"}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
