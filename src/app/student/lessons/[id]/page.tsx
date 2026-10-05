import React, { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth/auth-context";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Lock,
  List,
  Clock,
  Sparkles,
  Award,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  Layout,
  Layers,
} from "lucide-react";
import { ContentBlockRenderer, LessonContentBlockData } from "@/components/lesson/ContentBlockRenderer";
import { AITutorPanel } from "@/components/ai/AITutorPanel";
import { AITutorHintButton } from "@/components/ai/AITutorHintButton";
import { YouTubeVideo } from "@/components/video/YouTubeVideo";

export interface StudentLessonPageProps {
  lessonId: string;
  onNavigate?: (path: string) => void;
}

export default function StudentLessonPage({ lessonId, onNavigate }: StudentLessonPageProps) {
  const { user } = useAuth();
  const [lesson, setLesson] = useState<any>(null);
  const [access, setAccess] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Lesson Engine State
  const [activeSectionIndex, setActiveSectionIndex] = useState<number>(0);
  const [completedBlockIds, setCompletedBlockIds] = useState<string[]>([]);
  const [attemptsMap, setAttemptsMap] = useState<Record<string, any>>({});
  const [isCompleted, setIsCompleted] = useState<boolean>(false);
  const [showOutline, setShowOutline] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<"step" | "scroll">("step");
  const [isAITutorOpen, setIsAITutorOpen] = useState<boolean>(false);

  const handleNav = (path: string) => {
    if (onNavigate) onNavigate(path);
    else window.location.pathname = path;
  };

  useEffect(() => {
    async function initLesson() {
      setLoading(true);
      try {
        // 1. Verify access & prerequisite satisfaction
        const accessRes = await fetch(`/api/student/lessons/${lessonId}/access`);
        const accessJson = await accessRes.json();

        if (!accessRes.ok || !accessJson.data?.allowed) {
          setAccess(accessJson.data || { allowed: false, reason: "Lesson is locked by prerequisites." });
          setLoading(false);
          return;
        }
        setAccess(accessJson.data);

        // 2. Load published lesson content
        const lessonRes = await fetch(`/api/lessons/${lessonId}`);
        const lessonJson = await lessonRes.json();
        if (!lessonRes.ok) {
          setError(lessonJson.error || "Failed to load lesson.");
          setLoading(false);
          return;
        }
        setLesson(lessonJson.data);

        // 3. Load or restore student lesson session (Resume Engine)
        const sessionRes = await fetch(`/api/student/lessons/${lessonId}/session`);
        if (sessionRes.ok) {
          const sessionJson = await sessionRes.json();
          const sess = sessionJson.data?.session;
          const attempts = sessionJson.data?.attempts || [];

          if (sess) {
            const restoredIndex = sess.currentSectionIndex || 0;
            const blocks = lessonJson.data?.contentBlocks || [];
            setActiveSectionIndex(Math.min(restoredIndex, Math.max(0, blocks.length - 1)));
            setCompletedBlockIds(sess.completedBlockIds || []);
            if (sess.completedAt) {
              setIsCompleted(true);
            }
          }

          // Build attempts dictionary
          const attMap: Record<string, any> = {};
          attempts.forEach((a: any) => {
            if (!attMap[a.blockId] || attMap[a.blockId].createdAt < a.createdAt) {
              attMap[a.blockId] = a;
            }
          });
          setAttemptsMap(attMap);
        }

        // 4. Mark START on progress record if first load
        fetch("/api/student/progress", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lessonId, action: "START" }),
        }).catch(console.warn);
      } catch (err) {
        setError("Network error loading lesson experience.");
      } finally {
        setLoading(false);
      }
    }

    initLesson();
  }, [lessonId]);

  // Sync session state to server
  const syncSession = async (newIndex: number, newCompletedIds: string[], completeFlag = false) => {
    try {
      await fetch(`/api/student/lessons/${lessonId}/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentSectionIndex: newIndex,
          completedBlockIds: newCompletedIds,
          isCompleted: completeFlag,
        }),
      });
    } catch (e) {
      console.warn("Session sync error:", e);
    }
  };

  // Section completion handler
  const markBlockComplete = (blockId: string) => {
    if (!completedBlockIds.includes(blockId)) {
      const updated = [...completedBlockIds, blockId];
      setCompletedBlockIds(updated);
      syncSession(activeSectionIndex, updated);
    }
  };

  // Answers are graded by the server; the browser never holds the answer key.
  const handleSubmitAnswer = async (blockId: string, answer: string) => {
    const res = await fetch(`/api/student/lessons/${lessonId}/checkpoint`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blockId, answer }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.grading) {
      throw new Error(json.error || "Could not check your answer. Please try again.");
    }
    const { isCorrect, feedback, correctAnswer } = json.grading as { isCorrect: boolean; feedback: string; correctAnswer?: string };
    setAttemptsMap((prev) => ({ ...prev, [blockId]: { answer, isCorrect, feedback } }));
    const updated = completedBlockIds.includes(blockId) ? completedBlockIds : [...completedBlockIds, blockId];
    setCompletedBlockIds(updated);
    syncSession(activeSectionIndex, updated);
    return { isCorrect, feedback, correctAnswer };
  };

  // Navigation handlers
  const blocks: LessonContentBlockData[] = lesson?.contentBlocks || [];
  const currentBlock = blocks[activeSectionIndex];
  const totalBlocks = blocks.length;

  const handleNextSection = () => {
    if (activeSectionIndex < totalBlocks - 1) {
      // Mark current block as completed if not already
      if (currentBlock && !completedBlockIds.includes(currentBlock.id)) {
        markBlockComplete(currentBlock.id);
      }
      const nextIndex = activeSectionIndex + 1;
      setActiveSectionIndex(nextIndex);
      syncSession(nextIndex, completedBlockIds);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      // Last section reached
      handleCompleteLesson();
    }
  };

  const handlePrevSection = () => {
    if (activeSectionIndex > 0) {
      const prevIndex = activeSectionIndex - 1;
      setActiveSectionIndex(prevIndex);
      syncSession(prevIndex, completedBlockIds);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleJumpToSection = (index: number) => {
    setActiveSectionIndex(index);
    syncSession(index, completedBlockIds);
    setShowOutline(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const [completeError, setCompleteError] = useState<string | null>(null);

  const handleCompleteLesson = async () => {
    setCompleteError(null);
    try {
      const res = await fetch(`/api/student/lessons/${lessonId}/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentSectionIndex: activeSectionIndex, completedBlockIds, isCompleted: true }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.status === 409 && Array.isArray(json.missingBlockIds)) {
        // Send the student to the first question they still have to answer correctly.
        const idx = blocks.findIndex((b) => json.missingBlockIds.includes(b.id));
        setCompleteError(json.error || "Some questions still need a correct answer.");
        if (idx >= 0) setActiveSectionIndex(idx);
        return;
      }
      if (!res.ok) {
        setCompleteError(json.error || "Could not complete the lesson. Please try again.");
        return;
      }
      setCompletedBlockIds(blocks.map((b) => b.id));
      setIsCompleted(true);
    } catch {
      setCompleteError("Network error. Please try again.");
    }
  };

  // Progress metrics
  const completedCount = completedBlockIds.length;
  const progressPercent = totalBlocks > 0 ? Math.min(100, Math.round((completedCount / totalBlocks) * 100)) : 0;

  if (loading) {
    return (
      <div className="py-24 text-center text-xs text-slate-400">
        Loading interactive lesson and resuming position...
      </div>
    );
  }

  // Gated: Locked lesson
  if (access && !access.allowed) {
    return (
      <div className="py-16 max-w-md mx-auto px-4 text-center">
        <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-4 border border-amber-200 shadow-xs">
          <Lock className="w-8 h-8" />
        </div>
        <Badge variant="outline" className="mb-2 text-slate-500 text-xs">
          Prerequisite Required
        </Badge>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Lesson Locked</h1>
        <p className="text-xs sm:text-sm text-slate-600 mb-6 leading-relaxed">
          {access.reason || "Complete the required previous lesson and prerequisite skills first before advancing."}
        </p>

        <div className="space-y-3">
          <Button variant="primary" fullWidth onClick={() => handleNav("/student/learning-path")}>
            <span>View Learning Path Roadmap</span>
          </Button>
          <Button variant="ghost" fullWidth onClick={() => handleNav("/student")}>
            Return to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  if (error || !lesson) {
    return (
      <div className="py-16 max-w-md mx-auto px-4 text-center">
        <div className="w-14 h-14 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-4">
          <Lock className="w-7 h-7" />
        </div>
        <h1 className="text-xl font-bold text-slate-900 mb-2">Lesson Unavailable</h1>
        <p className="text-xs sm:text-sm text-slate-600 mb-6 leading-relaxed">
          {error || "This lesson has not been published yet or is undergoing curriculum review."}
        </p>
        <Button variant="primary" onClick={() => handleNav("/student/learning-path")}>
          Return to Learning Path
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-140px)] bg-slate-50 flex flex-col">
      {/* Sticky Progress & Header Bar */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 py-3 shadow-2xs">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
          {/* Back & Title */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => handleNav("/student/learning-path")}
              className="p-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors shrink-0"
              title="Return to Learning Path"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="min-w-0">
              <span className="text-[10px] font-bold uppercase tracking-wider text-teal-700 block truncate">
                {lesson.unit?.title || "Grade 7 Mathematics"}
              </span>
              <h1 className="text-sm sm:text-base font-bold text-slate-900 truncate">
                {lesson.title}
              </h1>
            </div>
          </div>

          {/* Progress Gauge & Controls */}
          <div className="flex items-center gap-2 sm:gap-4 shrink-0">
            {/* View Mode Toggle */}
            <div className="hidden sm:flex items-center p-1 bg-slate-100 rounded-lg text-xs">
              <button
                type="button"
                onClick={() => setViewMode("step")}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                  viewMode === "step" ? "bg-white text-slate-900 shadow-2xs font-semibold" : "text-slate-500 hover:text-slate-900"
                }`}
              >
                Step-by-Step
              </button>
              <button
                type="button"
                onClick={() => setViewMode("scroll")}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                  viewMode === "scroll" ? "bg-white text-slate-900 shadow-2xs font-semibold" : "text-slate-500 hover:text-slate-900"
                }`}
              >
                Full View
              </button>
            </div>

            {/* Outline Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowOutline(!showOutline)}
              className="text-xs gap-1.5"
            >
              <List className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Outline</span>
              <span className="text-slate-400 font-normal">
                ({activeSectionIndex + 1}/{totalBlocks})
              </span>
            </Button>

            {/* AI Tutor Button */}
            <AITutorHintButton
              onClick={() => setIsAITutorOpen(true)}
              label="AI Tutor"
            />

            {/* Percentage Badge */}
            <div className="hidden md:flex items-center gap-2">
              <div className="w-24 bg-slate-200 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <span className="text-xs font-bold text-slate-700 w-9 text-right tabular-nums">
                {progressPercent}%
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <div className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 flex flex-col md:flex-row gap-8">
        {/* Main Lesson Stage */}
        <main className="flex-1 min-w-0">
          {/* Attached Mathisipan Educational Video Resource */}
          {(() => {
            const attachedVideo = lesson?.resources?.find((r: any) => r.type === "YOUTUBE") || (lesson?.videoUrl ? { youtubeId: lesson.videoUrl, title: lesson.title, url: lesson.videoUrl } : null);
            if (!attachedVideo) return null;
            return (
              <div className="mb-6">
                <YouTubeVideo
                  videoId={attachedVideo.youtubeId}
                  url={attachedVideo.url}
                  title={attachedVideo.title || `${lesson.title} - Mathisipan Concept Video`}
                  description={attachedVideo.notes}
                  onVideoOpened={() => {
                    fetch(`/api/student/lessons/${lessonId}/video-event`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ videoId: attachedVideo.youtubeId || attachedVideo.url }),
                    }).catch(console.warn);
                  }}
                />
              </div>
            );
          })()}

          {viewMode === "step" ? (
            /* STEP-BY-STEP GUIDED VIEW */
            <div className="space-y-6">
              {/* Section Card */}
              {currentBlock ? (
                <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-10 shadow-xs space-y-6">
                  {/* Section Breadcrumb Indicator */}
                  <div className="flex items-center justify-between pb-4 border-b border-slate-100 text-xs text-slate-400">
                    <span className="font-semibold uppercase tracking-wider text-[11px] text-teal-800">
                      Section {activeSectionIndex + 1} of {totalBlocks} • {currentBlock.type}
                    </span>
                    {completedBlockIds.includes(currentBlock.id) && (
                      <span className="flex items-center gap-1 text-emerald-600 font-semibold text-[11px]">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Completed</span>
                      </span>
                    )}
                  </div>

                  {/* Render Current Content Block */}
                  <div className="pt-2">
                    <ContentBlockRenderer
                      block={currentBlock}
                      isCompleted={completedBlockIds.includes(currentBlock.id)}
                      onComplete={() => markBlockComplete(currentBlock.id)}
                      onSubmitAnswer={handleSubmitAnswer}
                      previousAttempt={attemptsMap[currentBlock.id]}
                      onNavigate={handleNav}
                    />
                  </div>
                </div>
              ) : (
                <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 text-xs text-slate-400">
                  No sections in this lesson.
                </div>
              )}

              {/* Bottom Navigation Control Bar */}
              <div className="flex items-center justify-between gap-3 pt-2">
                <Button
                  variant="outline"
                  disabled={activeSectionIndex === 0}
                  onClick={handlePrevSection}
                  className="gap-2 min-h-[44px] px-5"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Previous</span>
                </Button>

                {completeError && <p role="alert" className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-3 mb-3">{completeError}</p>}
                <div className="flex items-center gap-2">
                  {activeSectionIndex === totalBlocks - 1 ? (
                    <Button
                      variant="primary"
                      onClick={handleCompleteLesson}
                      className="gap-2 min-h-[44px] px-6 bg-emerald-600 hover:bg-emerald-700"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{isCompleted ? "Finish & Return" : "Complete Lesson"}</span>
                    </Button>
                  ) : (
                    <Button
                      variant="primary"
                      onClick={handleNextSection}
                      className="gap-2 min-h-[44px] px-6"
                    >
                      <span>Next Section</span>
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* CONTINUOUS SCROLL VIEW */
            <div className="space-y-8">
              {blocks.map((block, idx) => (
                <div
                  key={block.id}
                  id={`section-${idx}`}
                  className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-10 shadow-xs space-y-4"
                >
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100 text-xs text-slate-400">
                    <span className="font-semibold uppercase tracking-wider text-[11px] text-teal-800">
                      Section {idx + 1} • {block.type}
                    </span>
                    {completedBlockIds.includes(block.id) && (
                      <span className="flex items-center gap-1 text-emerald-600 font-semibold text-[11px]">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Completed</span>
                      </span>
                    )}
                  </div>
                  <ContentBlockRenderer
                    block={block}
                    isCompleted={completedBlockIds.includes(block.id)}
                    onComplete={() => markBlockComplete(block.id)}
                    onSubmitAnswer={handleSubmitAnswer}
                    previousAttempt={attemptsMap[block.id]}
                    onNavigate={handleNav}
                  />
                </div>
              ))}

              <div className="p-6 bg-white rounded-2xl border border-slate-200 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Finished All Sections?</h3>
                  <p className="text-xs text-slate-500">Record your progress and advance in your learning path.</p>
                  {completeError && <p role="alert" className="text-xs text-amber-800 mt-1">{completeError}</p>}
                </div>
                <Button variant="primary" onClick={handleCompleteLesson} className="gap-2 bg-emerald-600 hover:bg-emerald-700">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Mark Lesson Complete</span>
                </Button>
              </div>
            </div>
          )}

          {/* Celebratory Completion Dialog */}
          {isCompleted && (
            <div className="mt-8 p-6 sm:p-8 rounded-2xl bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-sm">
                  <Award className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="font-extrabold text-lg text-emerald-950">
                    Lesson Completed!
                  </h3>
                  <p className="text-xs sm:text-sm text-emerald-800 mt-0.5">
                    You have successfully engaged with all interactive learning sections and checkpoints.
                  </p>
                </div>
              </div>

              <Button
                variant="primary"
                onClick={() => handleNav("/student/learning-path")}
                className="gap-2 bg-emerald-600 hover:bg-emerald-700 shrink-0 min-h-[44px]"
              >
                <span>Continue Learning Path</span>
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          )}
        </main>

        {/* Lesson Outline Sidebar / Drawer */}
        <aside
          className={`md:w-72 shrink-0 ${
            showOutline
              ? "fixed inset-y-0 right-0 z-40 w-80 bg-white p-6 shadow-2xl overflow-y-auto block"
              : "hidden md:block"
          }`}
        >
          <div className="sticky top-20 bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-blue-600" />
                <span>Lesson Outline</span>
              </h2>
              {showOutline && (
                <button
                  type="button"
                  onClick={() => setShowOutline(false)}
                  className="md:hidden text-slate-400 hover:text-slate-700 text-lg font-bold"
                >
                  ×
                </button>
              )}
            </div>

            <div className="space-y-1.5 max-h-[60vh] overflow-y-auto pr-1">
              {blocks.map((block, idx) => {
                const isActive = activeSectionIndex === idx;
                const isBlockDone = completedBlockIds.includes(block.id);

                return (
                  <button
                    key={block.id}
                    type="button"
                    onClick={() => handleJumpToSection(idx)}
                    className={`w-full text-left p-2.5 rounded-xl border text-xs transition-all flex items-center justify-between gap-2 ${
                      isActive
                        ? "bg-blue-50/80 border-blue-400 font-bold text-blue-950 shadow-2xs"
                        : isBlockDone
                        ? "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                        : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className="w-5 h-5 rounded-md bg-slate-200 text-slate-700 font-bold text-[10px] flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <span className="truncate">{block.title || `${block.type} section`}</span>
                    </div>

                    <div className="shrink-0">
                      {isBlockDone ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      ) : isActive ? (
                        <span className="w-2 h-2 rounded-full bg-blue-600" />
                      ) : (
                        <span className="w-2 h-2 rounded-full bg-slate-300" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Quick Session Stats */}
            <div className="pt-3 border-t border-slate-100 text-[11px] text-slate-500 space-y-1">
              <div className="flex justify-between">
                <span>Completed:</span>
                <span className="font-semibold text-slate-700">
                  {completedCount} / {totalBlocks} sections
                </span>
              </div>
              <div className="flex justify-between">
                <span>Checkpoints:</span>
                <span className="font-semibold text-slate-700">
                  {Object.keys(attemptsMap).length} recorded
                </span>
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* Embedded AI Tutor Panel */}
      <AITutorPanel
        isOpen={isAITutorOpen}
        onClose={() => setIsAITutorOpen(false)}
        context={{
          lessonId: lesson.id,
          lessonTitle: lesson.title,
          skillId: lesson.skills?.[0]?.skill?.id,
          skillTitle: lesson.skills?.[0]?.skill?.title,
        }}
        initialHelpLevel="CONCEPT_EXPLANATION"
      />
    </div>
  );
}
