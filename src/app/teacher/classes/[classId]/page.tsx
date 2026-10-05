import React, { useState, useEffect } from "react";
import { useAuth, authFetch } from "@/lib/auth/auth-context";
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

  const [lessons, setLessons] = useState<Array<{ id: string; title: string }>>([]);
  const [assignmentLessonId, setAssignmentLessonId] = useState("");
  const [assignmentError, setAssignmentError] = useState<string | null>(null);
  const [emailsText, setEmailsText] = useState("");
  const [rosterResults, setRosterResults] = useState<Array<{ email: string; status: string }>>([]);
  const [manageError, setManageError] = useState<string | null>(null);
  const [codeCopied, setCodeCopied] = useState(false);

  const callApi = async (url: string, method: string, body?: unknown) => {
    setManageError(null);
    const res = await authFetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setManageError(json.error || "That action failed");
      return null;
    }
    return json;
  };

  const handleAddStudents = async (e: React.FormEvent) => {
    e.preventDefault();
    const emails = emailsText.split(/[\s,;]+/).filter(Boolean);
    if (emails.length === 0) return;
    const json = await callApi(`/api/teacher/classes/${classId}/students`, "POST", { emails });
    if (json) {
      setRosterResults(json.data);
      setEmailsText("");
      fetchClassDetail(true);
    }
  };

  const STATUS_TEXT: Record<string, string> = {
    ADDED: "Added",
    ALREADY_ENROLLED: "Already in class",
    NO_STUDENT_ACCOUNT: "No student account with this email",
    INVALID_EMAIL: "Not a valid email",
    CLASS_FULL: "Class is full",
  };

  const handleRemove = async (studentId: string, name: string) => {
    if (!window.confirm(`Remove ${name} from this class?`)) return;
    if (await callApi(`/api/teacher/classes/${classId}/students/${studentId}`, "DELETE")) fetchClassDetail(true);
  };

  const handleRegenerate = async () => {
    if (!window.confirm("Generate a new code? The old code will stop working.")) return;
    if (await callApi(`/api/teacher/classes/${classId}/join-code/regenerate`, "POST")) fetchClassDetail(true);
  };

  const handleUpdate = async (patch: Record<string, unknown>) => {
    if (await callApi(`/api/teacher/classes/${classId}`, "PATCH", patch)) fetchClassDetail(true);
  };

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(classData.classroom.joinCode);
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 1500);
    } catch {
      /* clipboard unavailable; the code is visible on screen */
    }
  };

  const handleNav = (path: string) => {
    if (onNavigate) onNavigate(path);
    else window.location.pathname = path;
  };

  const fetchClassDetail = async (quiet = false) => {
    if (!quiet) setLoading(true);
    setError(null);
    try {
      const res = await authFetch(`/api/teacher/classes/${classId}`);
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

  useEffect(() => {
    authFetch("/api/lessons?status=PUBLISHED")
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((j) => setLessons((j.data || []).map((l: any) => ({ id: l.id, title: l.title }))))
      .catch(() => setLessons([]));
  }, []);

  const handleCreateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignmentTitle.trim()) return;
    if (!assignmentLessonId) {
      setAssignmentError("Choose a published lesson to assign.");
      return;
    }

    setSubmittingAssignment(true);
    setAssignmentError(null);
    try {
      const res = await authFetch(`/api/teacher/classes/${classId}/assignments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: assignmentTitle,
          description: assignmentDesc,
          lessonId: assignmentLessonId,
          dueDate: new Date(Date.now() + 86400000 * 7).toISOString(),
        }),
      });

      if (res.ok) {
        setAssignmentTitle("");
        setAssignmentDesc("");
        setAssignmentLessonId("");
        setAssignmentModalOpen(false);
        fetchClassDetail(true);
      } else {
        const json = await res.json().catch(() => ({}));
        setAssignmentError(json.error || "Could not create the assignment");
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

            {/* Class management: join code + roster */}
            <div className="bg-white rounded-3xl border border-slate-200/90 p-6 shadow-xs space-y-5" data-testid="class-manage">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold text-slate-900">Class code</h2>
                  <p className="text-xs text-slate-500">Students enter this code on their dashboard to join. Turn it off when your roster is complete.</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span data-testid="join-code" className="font-mono text-xl font-black tracking-widest bg-slate-100 rounded-xl px-4 py-2 text-slate-900">
                    {classData.classroom.joinCode || "------"}
                  </span>
                  <Button size="sm" variant="outline" onClick={copyCode} className="text-xs">{codeCopied ? "Copied" : "Copy"}</Button>
                  <Button size="sm" variant="outline" onClick={handleRegenerate} className="text-xs">New code</Button>
                  <Button size="sm" variant="outline" onClick={() => handleUpdate({ joinCodeActive: !classData.classroom.joinCodeActive })} className="text-xs">
                    {classData.classroom.joinCodeActive ? "Turn code off" : "Turn code on"}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleUpdate({ archived: !classData.classroom.archivedAt })} className="text-xs">
                    {classData.classroom.archivedAt ? "Restore class" : "Archive class"}
                  </Button>
                </div>
              </div>
              {!classData.classroom.joinCodeActive && <p className="text-xs text-amber-700">The class code is off. Nobody can join with it.</p>}
              {classData.classroom.archivedAt && <p className="text-xs text-amber-700">This class is archived. Students cannot see it and the roster is read-only.</p>}
              {manageError && <p role="alert" className="text-xs text-red-600">{manageError}</p>}

              <form onSubmit={handleAddStudents} className="space-y-2" data-testid="add-students-form">
                <label htmlFor="student-emails" className="text-xs font-bold text-slate-700 block">Add students by email (one per line, or comma-separated)</label>
                <textarea id="student-emails" rows={3} value={emailsText} onChange={(e) => setEmailsText(e.target.value)} placeholder="juan@school.edu" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs" />
                <Button type="submit" size="sm" variant="primary" className="bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs">Add to class</Button>
              </form>
              {rosterResults.length > 0 && (
                <ul data-testid="roster-results" className="text-xs space-y-1">
                  {rosterResults.map((r) => (
                    <li key={r.email} className={r.status === "ADDED" ? "text-emerald-700" : "text-slate-600"}>
                      {r.email}: {STATUS_TEXT[r.status] || r.status}
                    </li>
                  ))}
                </ul>
              )}
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
              {(classData.students || []).length > 0 && (
                <ul data-testid="roster-remove" className="flex flex-wrap gap-2">
                  {(classData.students || []).map((st: any) => (
                    <li key={st.id}>
                      <button type="button" onClick={() => handleRemove(st.id, st.name)} aria-label={`Remove ${st.name}`} className="text-[11px] px-2 py-1 rounded-lg border border-slate-200 text-slate-600 hover:text-red-600 hover:border-red-200">
                        Remove {st.name}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
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
                  <label htmlFor="assignment-title" className="font-bold text-slate-700 block mb-1">
                    Assignment Title
                  </label>
                  <input
                    id="assignment-title"
                    type="text"
                    required
                    value={assignmentTitle}
                    onChange={(e) => setAssignmentTitle(e.target.value)}
                    placeholder="e.g. Adding Integers Practice Problem Set"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label htmlFor="assignment-desc" className="font-bold text-slate-700 block mb-1">
                    Instructions / Description
                  </label>
                  <textarea
                    id="assignment-desc"
                    rows={3}
                    value={assignmentDesc}
                    onChange={(e) => setAssignmentDesc(e.target.value)}
                    placeholder="Provide instructions for students..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label htmlFor="assignment-lesson" className="font-bold text-slate-700 block mb-1">Lesson</label>
                  <select id="assignment-lesson" value={assignmentLessonId} onChange={(e) => setAssignmentLessonId(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs">
                    <option value="">Select a published lesson...</option>
                    {lessons.map((l) => <option key={l.id} value={l.id}>{l.title}</option>)}
                  </select>
                </div>
                {assignmentError && <p role="alert" className="text-red-600">{assignmentError}</p>}
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
