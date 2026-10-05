import React, { useState, useEffect } from "react";
import { useAuth, authFetch } from "@/lib/auth/auth-context";
import { AuthModal } from "@/components/auth/AuthModal";
import { Button } from "@/components/ui/Button";
import {
  WelcomeHeader,
  ContinueLearningCard,
  AdaptiveNextStepCard,
  ProgressOverviewSection,
  RecentActivityTimeline,
  NeedHelpSection,
} from "@/components/dashboard";
import { findPracticeSetId } from "@/lib/practice/find-practice";
import { StudentAssessmentsCard } from "@/components/assessment/StudentAssessmentsCard";
import { StudentClassesCard } from "@/components/classroom/StudentClassesCard";
import { AITutorPanel } from "@/components/ai/AITutorPanel";
import type { StudentDashboardDataDTO } from "@/lib/dashboard/student-dashboard-types";
import type { AdaptiveRecommendationDTO } from "@/lib/adaptive/adaptive-types";
import {
  GraduationCap,
  ArrowLeft,
  Lock,
  RotateCcw,
  Loader2,
  Sparkles,
} from "lucide-react";

export interface StudentPageProps {
  onNavigate?: (path: string) => void;
}

export default function StudentPage({ onNavigate }: StudentPageProps) {
  const { user, loading: authLoading, logout } = useAuth();
  const [authModalOpen, setAuthModalOpen] = useState(false);

  // Dashboard Data State
  const [dashboardData, setDashboardData] = useState<StudentDashboardDataDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshingRec, setRefreshingRec] = useState(false);

  // AI Tutor Modal / Drawer State
  const [aiTutorOpen, setAiTutorOpen] = useState(false);
  const [tutorContext, setTutorContext] = useState<any>({
    lessonTitle: "Numbers and Algebraic Expressions",
    skillTitle: "Integers & Operations",
  });

  const handleNav = (path: string) => {
    if (onNavigate) {
      onNavigate(path);
    } else {
      window.location.pathname = path;
    }
  };

  // Load Dashboard Data from /api/student/dashboard
  const loadDashboard = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch("/api/student/dashboard");
      if (!res.ok) {
        throw new Error(`Failed to load dashboard data (Status ${res.status})`);
      }
      const json = await res.json();
      setDashboardData(json.data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load learning dashboard";
      console.warn("Student dashboard fetch error:", err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadDashboard();
    } else if (!authLoading) {
      setLoading(false);
    }
  }, [user, authLoading]);

  // Handle Continuing a Lesson
  const handleContinueLesson = (lessonId: string, _sectionIndex?: number) => {
    handleNav(`/student/lessons/${lessonId}`);
  };

  // Handle Starting Adaptive Activity
  const handleStartAdaptiveActivity = async (rec: AdaptiveRecommendationDTO) => {
    if (rec.recommendedActivityType === "PRACTICE_SET") {
      const practiceSetId = rec.recommendedPracticeSetId || rec.recommendedActivityId || (await findPracticeSetId(rec.skillId));
      if (practiceSetId) handleNav(`/student/practice/${practiceSetId}`);
      else window.alert("Your teacher has not published a practice set yet.");
    } else if (rec.lessonId) {
      handleNav(`/student/lessons/${rec.lessonId}`);
    } else {
      const practiceSetId = await findPracticeSetId(rec.skillId);
      if (practiceSetId) handleNav(`/student/practice/${practiceSetId}`);
      else window.alert("Your teacher has not published a practice set yet.");
    }
  };

  // Handle Recalculating / Refreshing Adaptive Guidance
  const handleRefreshAdaptive = async () => {
    setRefreshingRec(true);
    try {
      const res = await authFetch("/api/student/adaptive/recommendation/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        const json = await res.json();
        if (dashboardData) {
          setDashboardData({
            ...dashboardData,
            adaptiveRecommendation: json.data || null,
          });
        }
      }
    } catch (err) {
      console.warn("Failed to refresh adaptive recommendation:", err);
    } finally {
      setRefreshingRec(false);
    }
  };

  // Handle Dismissing Recommendation
  const handleDismissAdaptive = async (recId: string) => {
    try {
      await authFetch(`/api/student/adaptive/recommendation/${recId}/dismiss`, { method: "POST" });
      if (dashboardData) {
        setDashboardData({
          ...dashboardData,
          adaptiveRecommendation: null,
        });
      }
    } catch (err) {
      console.warn("Failed to dismiss adaptive recommendation:", err);
    }
  };

  // Handle Quick Topic Click from Need Help Section
  const handleSelectHelpTopic = (topicItem: any) => {
    setTutorContext({
      lessonTitle: dashboardData?.continueLearning?.title || "Integers",
      skillTitle: topicItem.topic,
      questionPrompt: topicItem.prompt,
    });
    setAiTutorOpen(true);
  };

  // Handle General AI Tutor Launch
  const handleOpenGeneralChat = () => {
    setTutorContext({
      lessonTitle: dashboardData?.continueLearning?.title || "Grade 7 Mathematics",
      skillTitle: "Integers and Real-World Applications",
    });
    setAiTutorOpen(true);
  };

  // 1. Unauthenticated Gate
  if (!authLoading && !user) {
    return (
      <div className="py-12 sm:py-20 bg-slate-50 min-h-[calc(100vh-140px)]">
        <div className="max-w-md mx-auto px-4 text-center">
          <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-xs">
            <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-4 shadow-2xs">
              <Lock className="w-8 h-8" />
            </div>
            <h1 className="text-xl font-bold text-slate-900 mb-2">Student Area Protected</h1>
            <p className="text-sm text-slate-600 mb-6 leading-relaxed">
              Please sign in with a Student account to access your personalized MATATAG learning dashboard, adaptive practice, and skill mastery insights.
            </p>
            <div className="space-y-3">
              <Button
                variant="primary"
                fullWidth
                onClick={() => setAuthModalOpen(true)}
                className="gap-2 font-bold"
              >
                <GraduationCap className="w-4 h-4" />
                <span>Sign In as Student</span>
              </Button>
              <Button variant="ghost" fullWidth onClick={() => handleNav("/")}>
                Return to Home
              </Button>
            </div>
          </div>
        </div>
        <AuthModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} defaultRole="STUDENT" />
      </div>
    );
  }

  // 2. Loading State
  if (loading || authLoading) {
    return (
      <div className="py-20 bg-slate-50 min-h-[calc(100vh-140px)] flex flex-col items-center justify-center">
        <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
        <h2 className="text-sm font-bold text-slate-800">
          Loading your learning dashboard...
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Gathering your interactive lessons, adaptive steps, and skill masteries.
        </p>
      </div>
    );
  }

  // 3. Error State
  if (error || !dashboardData) {
    return (
      <div className="py-16 bg-slate-50 min-h-[calc(100vh-140px)]">
        <div className="max-w-md mx-auto px-4 text-center">
          <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-xs">
            <h2 className="text-lg font-bold text-slate-900 mb-2">Could Not Load Dashboard</h2>
            <p className="text-sm text-slate-500 mb-6">{error || "Unexpected data error"}</p>
            <Button variant="primary" onClick={loadDashboard} className="gap-2">
              <RotateCcw className="w-4 h-4" />
              <span>Retry</span>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const {
    student,
    curriculum,
    continueLearning,
    adaptiveRecommendation,
    progressSummary,
    recentActivity,
    quickHelpTopics,
  } = dashboardData;

  return (
    <div className="py-8 sm:py-12 bg-slate-50/70 min-h-[calc(100vh-140px)]">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Navigation Breadcrumb / Top Bar */}
        <div className="flex items-center justify-between mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleNav("/")}
            className="gap-2 text-slate-600 text-xs hover:text-slate-900"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Home</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => logout()}
            className="text-xs text-slate-500 hover:text-red-600"
          >
            <span>Sign Out</span>
          </Button>
        </div>

        {/* 1. Welcome Section */}
        <WelcomeHeader
          studentName={student.name}
          gradeLevel={student.gradeLevel || 7}
          subject={curriculum.subject}
          term={curriculum.term}
          onOpenLearningPath={() => handleNav("/student/learning-path")}
          onOpenPracticeHistory={() => handleNav("/student/practice-history")}
          onAskAI={handleOpenGeneralChat}
        />

        <StudentAssessmentsCard onOpen={() => handleNav("/student/assessments")} />
        <StudentClassesCard onOpenLesson={(id) => handleNav(`/student/lessons/${id}`)} onOpenPractice={(id) => handleNav(`/student/practice/${id}`)} />

        {/* 2. Continue Learning (Where did I stop? / What am I learning?) */}
        <ContinueLearningCard
          continueData={continueLearning}
          onContinue={handleContinueLesson}
          onExplorePath={() => handleNav("/student/learning-path")}
        />

        {/* 3. Your Next Step (Adaptive Recommendation - What should I do next?) */}
        <AdaptiveNextStepCard
          recommendation={adaptiveRecommendation}
          onStartActivity={handleStartAdaptiveActivity}
          onAskTutor={(rec) => {
            setTutorContext({
              lessonId: rec.lessonId || undefined,
              skillId: rec.skillId || undefined,
              skillTitle: rec.skillTitle,
              questionPrompt: rec.explanation?.reason || rec.reason || "Adaptive learning assistance",
            });
            setAiTutorOpen(true);
          }}
          onDismiss={handleDismissAdaptive}
          onRefresh={handleRefreshAdaptive}
          refreshing={refreshingRec}
        />

        {/* 4. Current Progress & Skill Mastery (How am I progressing?) */}
        <ProgressOverviewSection
          unit={curriculum.unit}
          progressSummary={progressSummary}
          onNavigateSkill={(skillId) => handleNav(`/student/mastery/${skillId}`)}
          onViewAllSkills={() => handleNav("/student/learning-path")}
        />

        {/* 5. Recent Activity Timeline */}
        <RecentActivityTimeline
          activities={recentActivity}
          onNavigateItem={(url) => handleNav(url)}
          onViewAll={() => handleNav("/student/practice-history")}
        />

        {/* 6. Where can I get help? (Need Help? [Ask Tuklas AI]) */}
        <NeedHelpSection
          topics={quickHelpTopics}
          onSelectTopic={handleSelectHelpTopic}
          onOpenGeneralChat={handleOpenGeneralChat}
        />
      </div>

      {/* Embedded AI Tutor Panel */}
      <AITutorPanel
        isOpen={aiTutorOpen}
        onClose={() => setAiTutorOpen(false)}
        context={tutorContext}
        initialHelpLevel="LEVEL_1_HINT"
      />

      {/* Auth Modal for guest/session renew */}
      <AuthModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} defaultRole="STUDENT" />
    </div>
  );
}
