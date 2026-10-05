/**
 * Tuklas AI - Core Application Container
 * Handles client routing across foundation, Phase 3 Curriculum & Studio, and Phase 4 Learning Path routes.
 */

import React, { useState, useEffect } from "react";
import { AuthProvider } from "@/lib/auth/auth-context";
import RootLayout from "@/app/layout";
import LandingPage from "@/app/page";
import StudentPage from "@/app/student/page";
import StudentLearningPathPage from "@/app/student/learning-path/page";
import StudentLessonPage from "@/app/student/lessons/[id]/page";
import StudentPracticePage from "@/app/student/practice/[id]/page";
import StudentPracticeHistoryPage from "@/app/student/practice-history/page";
import StudentMasteryDetailPage from "@/app/student/mastery/[skillId]/page";
import TeacherPage from "@/app/teacher/page";
import TeacherCurriculumPage from "@/app/teacher/curriculum/page";
import TeacherUnitCurriculumPage from "@/app/teacher/curriculum/[unitId]/page";
import TeacherLessonsPage from "@/app/teacher/lessons/page";
import TeacherNewLessonPage from "@/app/teacher/lessons/new/page";
import TeacherLessonEditorPage from "@/app/teacher/lessons/[id]/edit/page";
import TeacherQuestionBankPage from "@/app/teacher/question-bank/page";
import TeacherQuestionEditorPage from "@/app/teacher/questions/[id]/edit/page";
import TeacherQuestionPreviewPage from "@/app/teacher/questions/[id]/preview/page";
import TeacherPracticeSetsPage from "@/app/teacher/practice-sets/page";
import TeacherAISettingsPage from "@/app/teacher/ai-settings/page";
import TeacherStudentsPage from "@/app/teacher/students/page";
import TeacherStudentDetailPage from "@/app/teacher/students/[studentId]/page";
import TeacherClassesPage from "@/app/teacher/classes/page";
import TeacherClassDetailPage from "@/app/teacher/classes/[classId]/page";
import TeacherStudentInsightsPage from "@/app/teacher/students/[studentId]/insights/page";
import TeacherResearchPage from "@/app/teacher/research/page";
import AdminPage from "@/app/admin/page";
import AccountPage from "@/app/account/page";
import NotFound from "@/app/not-found";

export default function App() {
  const [currentPath, setCurrentPath] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return window.location.pathname || "/";
    }
    return "/";
  });

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname || "/");
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const navigate = (path: string) => {
    if (typeof window !== "undefined") {
      window.history.pushState({}, "", path);
      setCurrentPath(path);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const renderCurrentView = () => {
    // Normalize path (strip trailing slash if not root)
    const normalized =
      currentPath.length > 1 && currentPath.endsWith("/")
        ? currentPath.slice(0, -1)
        : currentPath;

    // Exact matches
    if (normalized === "/") return <LandingPage onNavigate={navigate} />;
    if (normalized === "/student") return <StudentPage onNavigate={navigate} />;
    if (normalized === "/student/learning-path") return <StudentLearningPathPage onNavigate={navigate} />;
    if (normalized === "/student/practice-history") return <StudentPracticeHistoryPage onNavigate={navigate} />;
    if (normalized === "/teacher") return <TeacherPage onNavigate={navigate} />;
    if (normalized === "/teacher/curriculum") return <TeacherCurriculumPage onNavigate={navigate} />;
    if (normalized === "/teacher/lessons") return <TeacherLessonsPage onNavigate={navigate} />;
    if (normalized === "/teacher/lessons/new") return <TeacherNewLessonPage onNavigate={navigate} />;
    if (normalized === "/teacher/question-bank") return <TeacherQuestionBankPage onNavigate={navigate} />;
    if (normalized === "/teacher/questions/new") return <TeacherQuestionEditorPage onNavigate={navigate} />;
    if (normalized === "/teacher/practice-sets") return <TeacherPracticeSetsPage onNavigate={navigate} />;
    if (normalized === "/teacher/practice") return <TeacherPracticeSetsPage onNavigate={navigate} />;
    if (normalized === "/teacher/students") return <TeacherStudentsPage onNavigate={navigate} />;
    if (normalized === "/teacher/classes") return <TeacherClassesPage onNavigate={navigate} />;
    if (normalized === "/teacher/research") return <TeacherResearchPage onNavigate={navigate} />;
    if (normalized === "/teacher/ai-settings") return <TeacherAISettingsPage onNavigate={navigate} />;
    if (normalized === "/admin") return <AdminPage onNavigate={navigate} />;
    if (normalized === "/account") return <AccountPage onNavigate={navigate} />;

    // Dynamic Route: /student/practice/:practiceSetId
    const studentPracticeMatch = normalized.match(/^\/student\/practice\/([^\/]+)$/);
    if (studentPracticeMatch) {
      return <StudentPracticePage practiceSetId={studentPracticeMatch[1]} onNavigate={navigate} />;
    }

    // Dynamic Route: /teacher/questions/:id/preview
    const teacherQuestionPreviewMatch = normalized.match(/^\/teacher\/questions\/([^\/]+)\/preview$/);
    if (teacherQuestionPreviewMatch) {
      return <TeacherQuestionPreviewPage questionId={teacherQuestionPreviewMatch[1]} onNavigate={navigate} />;
    }

    // Dynamic Route: /teacher/questions/:id/edit
    const teacherQuestionEditMatch = normalized.match(/^\/teacher\/questions\/([^\/]+)\/edit$/);
    if (teacherQuestionEditMatch) {
      return <TeacherQuestionEditorPage questionId={teacherQuestionEditMatch[1]} onNavigate={navigate} />;
    }

    // Dynamic Route: /teacher/students/:studentId/insights
    const teacherStudentInsightsMatch = normalized.match(/^\/teacher\/students\/([^\/]+)\/insights$/);
    if (teacherStudentInsightsMatch) {
      return <TeacherStudentInsightsPage studentId={teacherStudentInsightsMatch[1]} onNavigate={navigate} />;
    }

    // Dynamic Route: /teacher/students/:studentId
    const teacherStudentMatch = normalized.match(/^\/teacher\/students\/([^\/]+)$/);
    if (teacherStudentMatch) {
      return <TeacherStudentDetailPage studentId={teacherStudentMatch[1]} onNavigate={navigate} />;
    }

    // Dynamic Route: /teacher/classes/:classId
    const teacherClassMatch = normalized.match(/^\/teacher\/classes\/([^\/]+)$/);
    if (teacherClassMatch) {
      return <TeacherClassDetailPage classId={teacherClassMatch[1]} onNavigate={navigate} />;
    }

    // Dynamic Route: /student/mastery/:skillId
    const studentMasteryMatch = normalized.match(/^\/student\/mastery\/([^\/]+)$/);
    if (studentMasteryMatch) {
      return <StudentMasteryDetailPage skillId={studentMasteryMatch[1]} onNavigate={navigate} />;
    }

    // Dynamic Route: /teacher/curriculum/:unitId
    const teacherUnitMatch = normalized.match(/^\/teacher\/curriculum\/([^\/]+)$/);
    if (teacherUnitMatch) {
      return <TeacherUnitCurriculumPage unitId={teacherUnitMatch[1]} onNavigate={navigate} />;
    }

    // Dynamic Route: /teacher/lessons/:id/edit
    const teacherEditMatch = normalized.match(/^\/teacher\/lessons\/([^\/]+)\/edit$/);
    if (teacherEditMatch) {
      return <TeacherLessonEditorPage lessonId={teacherEditMatch[1]} onNavigate={navigate} />;
    }

    // Dynamic Route: /student/lessons/:id
    const studentLessonMatch = normalized.match(/^\/student\/lessons\/([^\/]+)$/);
    if (studentLessonMatch) {
      return <StudentLessonPage lessonId={studentLessonMatch[1]} onNavigate={navigate} />;
    }

    return <NotFound onNavigateHome={() => navigate("/")} />;
  };

  return (
    <AuthProvider>
      <RootLayout currentPath={currentPath} onNavigate={navigate}>
        {renderCurrentView()}
      </RootLayout>
    </AuthProvider>
  );
}
