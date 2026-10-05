import React, { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth/auth-context";
import { AuthModal } from "@/components/auth/AuthModal";
import { Button } from "@/components/ui/Button";
import {
  TeacherNav,
  TeacherQuickActions,
  TeacherStatsOverview,
  MasteryDistributionCard,
  GroupRecommendationsCard,
  AssessmentPerformanceCard,
  LessonPerformanceCard,
  DifficultSkillsCard,
  NeedsAttentionPanel,
  TeacherActivityTimeline,
  TeacherAIAssistantModal,
} from "@/components/teacher";
import type { TeacherDashboardDataDTO } from "@/lib/teacher/teacher-types";
import {
  Users,
  ShieldAlert,
  Lock,
  Loader2,
  RotateCcw,
  Sparkles,
  ArrowRight,
  GraduationCap,
} from "lucide-react";

export interface TeacherPageProps {
  onNavigate?: (path: string) => void;
}

export default function TeacherPage({ onNavigate }: TeacherPageProps) {
  const { user, loading: authLoading, logout } = useAuth();
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [dashboardData, setDashboardData] = useState<TeacherDashboardDataDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [aiAssistantOpen, setAiAssistantOpen] = useState(false);

  const handleNav = (path: string) => {
    if (onNavigate) onNavigate(path);
    else window.location.pathname = path;
  };

  const [classFilter, setClassFilter] = useState("");
  const [allClasses, setAllClasses] = useState<Array<{ id: string; name: string }>>([]);

  const loadDashboard = async (classId: string = classFilter) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/teacher/dashboard${classId ? `?classId=${encodeURIComponent(classId)}` : ""}`);
      if (!res.ok) {
        throw new Error(`Failed to load teacher dashboard (${res.status})`);
      }
      const json = await res.json();
      setDashboardData(json.data);
      if (!classId) setAllClasses((json.data.classes || []).map((c: any) => ({ id: c.id, name: c.name })));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load dashboard data";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user && (user.role === "TEACHER" || user.role === "ADMIN")) {
      loadDashboard(classFilter);
    } else if (!authLoading) {
      setLoading(false);
    }
  }, [user, authLoading, classFilter]);

  // 1. Unauthenticated Gate
  if (!authLoading && !user) {
    return (
      <div className="py-12 sm:py-20 bg-slate-50 min-h-[calc(100vh-140px)]">
        <div className="max-w-md mx-auto px-4 text-center">
          <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-xs">
            <div className="w-16 h-16 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center mx-auto mb-4 shadow-2xs">
              <Lock className="w-8 h-8" />
            </div>
            <h1 className="text-xl font-bold text-slate-900 mb-2">Teacher Area Protected</h1>
            <p className="text-sm text-slate-600 mb-6 leading-relaxed">
              Educators must authenticate with an authorized Teacher or Administrator account to manage lessons and monitor student progress.
            </p>
            <div className="space-y-3">
              <Button
                variant="primary"
                fullWidth
                onClick={() => setAuthModalOpen(true)}
                className="gap-2 bg-teal-600 hover:bg-teal-700 font-bold"
              >
                <Users className="w-4 h-4" />
                <span>Sign In as Teacher</span>
              </Button>
              <Button variant="ghost" fullWidth onClick={() => handleNav("/")}>
                Return to Home
              </Button>
            </div>
          </div>
        </div>
        <AuthModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} defaultRole="TEACHER" />
      </div>
    );
  }

  // 2. Role Restriction Gate: Students cannot view Teacher Dashboard
  const isAuthorized = user?.role === "TEACHER" || user?.role === "ADMIN";
  if (!authLoading && user && !isAuthorized) {
    return (
      <div className="py-12 sm:py-20 bg-slate-50 min-h-[calc(100vh-140px)]">
        <div className="max-w-md mx-auto px-4 text-center">
          <div className="bg-white rounded-3xl border border-amber-200 p-8 shadow-xs">
            <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-4 shadow-2xs">
              <ShieldAlert className="w-8 h-8" />
            </div>
            <h1 className="text-xl font-bold text-slate-900 mb-2">Role Access Restricted</h1>
            <p className="text-sm text-slate-600 mb-6 leading-relaxed">
              Your account role is <span className="font-bold text-slate-900">{user.role}</span>. Student accounts cannot view teacher control centers or class analytics.
            </p>
            <div className="space-y-3">
              <Button variant="primary" fullWidth onClick={() => handleNav("/student")}>
                Go to Student Dashboard
              </Button>
              <Button variant="ghost" fullWidth onClick={() => logout()}>
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 3. Loading State
  if (loading || authLoading) {
    return (
      <div className="py-24 bg-slate-50 min-h-[calc(100vh-140px)] flex flex-col items-center justify-center">
        <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center mb-4">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
        <h2 className="text-sm font-bold text-slate-800">
          Loading Teacher Dashboard...
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Gathering class mastery distributions and student learning signals.
        </p>
      </div>
    );
  }

  // 4. Error State
  if (error || !dashboardData) {
    return (
      <div className="py-16 bg-slate-50 min-h-[calc(100vh-140px)]">
        <div className="max-w-md mx-auto px-4 text-center">
          <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-xs">
            <h2 className="text-lg font-bold text-slate-900 mb-2">We couldn't load your dashboard</h2>
            <p className="text-sm text-slate-500 mb-6">{error || "Data loading failed"}</p>
            <Button variant="primary" onClick={() => loadDashboard()} className="gap-2 bg-teal-600 hover:bg-teal-700">
              <RotateCcw className="w-4 h-4" />
              <span>Try Again</span>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const {
    teacher,
    stats,
    classes,
    masteryDistribution,
    difficultSkills,
    needsAttention,
    groupRecommendations,
    assessmentPerformance,
    lessonPerformance,
    dataNotes,
    recentActivity,
  } = dashboardData;

  return (
    <div className="min-h-[calc(100vh-140px)] bg-slate-50/70">
      {/* Subnavigation Bar */}
      <TeacherNav
        currentTab="dashboard"
        onNavigate={handleNav}
        onAskAI={() => setAiAssistantOpen(true)}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
        {/* Welcome Banner */}
        <div className="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-8 shadow-xs mb-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-teal-600 to-emerald-600 text-white flex items-center justify-center font-black text-2xl shadow-md shadow-teal-500/10 shrink-0">
                {teacher.name.charAt(0)}
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
                  Welcome back, {teacher.name}!
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 mt-1">
                  {teacher.email} • {teacher.role === "ADMIN" ? "Administrator" : "Mathematics Educator"} • S.Y. 2026-2027
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleNav("/teacher/classes")}
                className="gap-1.5 text-xs text-slate-700"
              >
                <GraduationCap className="w-4 h-4 text-teal-600" />
                <span>{classes.length} Active Classes</span>
              </Button>

              <Button
                variant="primary"
                size="sm"
                onClick={() => setAiAssistantOpen(true)}
                className="gap-2 bg-gradient-to-r from-teal-600 to-indigo-600 text-white font-bold text-xs"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Ask AI Assistant</span>
              </Button>
            </div>
          </div>
        </div>

        {(allClasses.length > 1 || classFilter) && (
          <div className="mb-6 flex items-center gap-2 text-xs">
            <label htmlFor="class-filter" className="font-bold text-slate-700">Show</label>
            <select id="class-filter" data-testid="class-filter" value={classFilter} onChange={(e) => setClassFilter(e.target.value)} className="border border-slate-200 rounded-xl px-3 py-2 bg-white text-xs">
              <option value="">All my classes</option>
              {allClasses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        )}

        {(dataNotes ?? []).map((n, i) => <p key={i} data-testid="data-note" role="note" className="mb-4 text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">{n}</p>)}

        {/* Quick Actions */}
        <TeacherQuickActions
          onCreateLesson={() => handleNav("/teacher/lessons/new")}
          onManageLessons={() => handleNav("/teacher/lessons")}
          onViewStudents={() => handleNav("/teacher/students")}
          onCreatePractice={() => handleNav("/teacher/practice-sets")}
          onAskAI={() => setAiAssistantOpen(true)}
        />

        {/* Overview Stats */}
        <TeacherStatsOverview
          stats={stats}
          onNavigateStudents={() => handleNav("/teacher/students")}
          onNavigateLessons={() => handleNav("/teacher/lessons")}
          onNavigateClasses={() => handleNav("/teacher/classes")}
        />

        {/* Class Mastery Distribution (Phase 10) */}
        <MasteryDistributionCard distribution={masteryDistribution} />

        {/* Two-Column Grid: Difficult Skills & Needs Attention */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <DifficultSkillsCard
            skills={difficultSkills}
            onInspectSkill={(skillId) => handleNav(`/teacher/students?skillId=${skillId}`)}
          />
          <NeedsAttentionPanel
            signals={needsAttention}
            onSelectStudent={(studentId) => handleNav(`/teacher/students/${studentId}`)}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <GroupRecommendationsCard items={groupRecommendations ?? []} onSelectStudent={(id) => handleNav(`/teacher/students/${id}`)} />
          <AssessmentPerformanceCard items={assessmentPerformance ?? []} onOpen={(id) => handleNav(`/teacher/assessments/${id}`)} />
        </div>
        <div className="mb-8"><LessonPerformanceCard items={lessonPerformance ?? []} /></div>

        {/* Recent Activity Timeline */}
        <TeacherActivityTimeline activities={recentActivity} />
      </div>

      {/* AI Assistant Modal */}
      <TeacherAIAssistantModal
        isOpen={aiAssistantOpen}
        onClose={() => setAiAssistantOpen(false)}
      />

      <AuthModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} defaultRole="TEACHER" />
    </div>
  );
}
