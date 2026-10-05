import { findPracticeSetId } from "@/lib/practice/find-practice";
import React, { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth/auth-context";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { StudentInsightCard } from "@/components/insights/StudentInsightCard";
import { AdaptiveRecommendationCard } from "@/components/adaptive/AdaptiveRecommendationCard";
import { AITutorPanel } from "@/components/ai/AITutorPanel";
import { MasteryBadge } from "@/components/mastery/MasteryBadge";
import { MasteryDetailModal } from "@/components/mastery/MasteryDetailModal";
import type { AdaptiveRecommendationDTO } from "@/lib/adaptive/adaptive-types";
import type { SkillMasteryDTO } from "@/lib/mastery/mastery-types";
import {
  ArrowLeft,
  CheckCircle2,
  Lock,
  ArrowRight,
  Clock,
  BookOpen,
  Sparkles,
  Layers,
  AlertCircle,
  HelpCircle,
  Compass,
} from "lucide-react";

export interface StudentLearningPathPageProps {
  onNavigate?: (path: string) => void;
}

export default function StudentLearningPathPage({ onNavigate }: StudentLearningPathPageProps) {
  const { user } = useAuth();
  const [pathData, setPathData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedLockedLesson, setSelectedLockedLesson] = useState<any | null>(null);
  const [insights, setInsights] = useState<any[]>([]);
  const [adaptiveRec, setAdaptiveRec] = useState<AdaptiveRecommendationDTO | null>(null);
  const [refreshingRec, setRefreshingRec] = useState(false);
  const [isTutorOpen, setIsTutorOpen] = useState(false);
  const [tutorContext, setTutorContext] = useState<any>(null);
  const [masteries, setMasteries] = useState<SkillMasteryDTO[]>([]);
  const [selectedMastery, setSelectedMastery] = useState<SkillMasteryDTO | null>(null);

  const handleNav = (path: string) => {
    if (onNavigate) onNavigate(path);
    else window.location.pathname = path;
  };

  const fetchLearningPath = async () => {
    try {
      const res = await fetch("/api/student/learning-path");
      if (res.ok) {
        const json = await res.json();
        setPathData(json.data);
      }

      // Fetch student learning insights
      const insRes = await fetch("/api/student/insights");
      if (insRes.ok) {
        const insJson = await insRes.json();
        setInsights(insJson.data || []);
      }

      // Fetch student adaptive recommendation
      const adRes = await fetch("/api/student/adaptive/recommendation");
      if (adRes.ok) {
        const adJson = await adRes.json();
        setAdaptiveRec(adJson.data || null);
      }

      // Fetch student skill masteries (Phase 10)
      const mastRes = await fetch("/api/student/mastery");
      if (mastRes.ok) {
        const mastJson = await mastRes.json();
        setMasteries(mastJson.data || []);
      }
    } catch (err) {
      console.error("Failed to load learning path:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleRecalculateMastery = async (skillId: string) => {
    try {
      const res = await fetch(`/api/student/mastery/${skillId}/recalculate`, { method: "POST" });
      if (res.ok) {
        const json = await res.json();
        const updated = json.data;
        setSelectedMastery(updated);
        setMasteries((prev) =>
          prev.map((m) => (m.skillId === skillId ? updated : m))
        );
      }
    } catch (err) {
      console.warn("Failed to recalculate mastery:", err);
    }
  };

  const handleRefreshAdaptive = async () => {
    setRefreshingRec(true);
    try {
      const res = await fetch("/api/student/adaptive/recommendation/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        const json = await res.json();
        setAdaptiveRec(json.data || null);
      }
    } catch (err) {
      console.warn("Failed to recalculate recommendation:", err);
    } finally {
      setRefreshingRec(false);
    }
  };

  const handleDismissAdaptive = async (recId: string) => {
    try {
      await fetch(`/api/student/adaptive/recommendation/${recId}/dismiss`, { method: "POST" });
      setAdaptiveRec(null);
    } catch (err) {
      console.warn("Failed to dismiss recommendation:", err);
    }
  };

  const handleStartAdaptiveActivity = async (rec: AdaptiveRecommendationDTO) => {
    if (rec.recommendedActivityType === "PRACTICE_SET" || !rec.lessonId) {
      const pSetId = rec.recommendedPracticeSetId || rec.recommendedActivityId || (await findPracticeSetId(rec.skillId));
      if (pSetId) handleNav(`/student/practice/${pSetId}`);
      else window.alert("Your teacher has not published a practice set yet.");
    } else {
      handleNav(`/student/lessons/${rec.lessonId}`);
    }
  };

  const handleAskTutor = (rec: AdaptiveRecommendationDTO) => {
    setTutorContext({
      lessonId: rec.lessonId || undefined,
      skillId: rec.skillId || undefined,
      lessonTitle: rec.lessonTitle || undefined,
      skillTitle: rec.skillTitle || undefined,
      initialQuery: `Can you explain the key concepts for ${rec.skillTitle || "this skill"} and help me understand what to practice?`,
    });
    setIsTutorOpen(true);
  };

  useEffect(() => {
    fetchLearningPath();
  }, [user]);

  const handleLessonClick = (node: any) => {
    if (node.state === "LOCKED") {
      setSelectedLockedLesson(node);
      return;
    }
    handleNav(`/student/lessons/${node.lessonId}`);
  };

  if (loading) {
    return (
      <div className="py-20 text-center text-xs text-slate-400">
        Loading your MATATAG learning path...
      </div>
    );
  }

  const curriculum = pathData?.curriculum;
  const learningPath = pathData?.learningPath || [];
  const continueLearning = pathData?.continueLearning;
  const nextRecommended = pathData?.nextRecommended;

  return (
    <div className="py-8 sm:py-12 bg-slate-50 min-h-[calc(100vh-140px)]">
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleNav("/student")}
            className="gap-2 text-slate-600"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Student Dashboard</span>
          </Button>

          <Badge variant="default" className="text-xs">
            {curriculum?.subject || "Mathematics"} • {curriculum?.grade || "Grade 7"}
          </Badge>
        </div>

        {/* Learning Path Header Card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-teal-700">
                {curriculum?.term || "Term 1"} Curriculum Roadmap
              </span>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-1">
                {curriculum?.unit?.title || "Numbers and Algebraic Expressions"}
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-xl">
                {curriculum?.unit?.description ||
                  "A guided sequence of interactive mathematics lessons and prerequisite skills."}
              </p>
            </div>

            {/* Overall Progress Gauge */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 sm:w-56 shrink-0">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-700 mb-1.5">
                <span>Unit Progress</span>
                <span className="text-blue-600 font-bold">
                  {curriculum?.unit?.progressPercentage || 0}%
                </span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
                <div
                  className="bg-blue-600 h-2.5 rounded-full transition-all duration-500"
                  style={{ width: `${curriculum?.unit?.progressPercentage || 0}%` }}
                />
              </div>
              <p className="text-[11px] text-slate-500 mt-2 text-center">
                {curriculum?.unit?.completedLessons || 0} of {curriculum?.unit?.totalLessons || 0} lessons completed
              </p>
            </div>
          </div>

          {/* Quick-Action Recommendation Bar */}
          {nextRecommended && (
            <div className="mt-6 p-4 rounded-xl bg-gradient-to-r from-blue-50 to-teal-50/50 border border-blue-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider block">
                    Recommended Next Activity
                  </span>
                  <span className="text-sm font-bold text-slate-900">
                    {nextRecommended.title}
                  </span>
                  <p className="text-xs text-slate-600">
                    {nextRecommended.state === "IN_PROGRESS"
                      ? `In progress (${nextRecommended.progressPercentage}%)`
                      : "Ready to start • Prerequisites satisfied"}
                  </p>
                </div>
              </div>

              <Button
                variant="primary"
                size="sm"
                onClick={() => handleLessonClick(nextRecommended)}
                className="gap-1.5 shrink-0"
              >
                <span>{nextRecommended.state === "IN_PROGRESS" ? "Continue Lesson" : "Start Lesson"}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          )}
        </div>

        {/* Adaptive Learning Recommendation Card */}
        {adaptiveRec && (
          <div className="space-y-2">
            <div className="flex items-center justify-between px-2">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Compass className="w-4 h-4 text-teal-600" />
                <span>Personalized Adaptive Next Step</span>
              </h2>
              <span className="text-xs text-slate-400">Based on Recent Practice</span>
            </div>
            <AdaptiveRecommendationCard
              recommendation={adaptiveRec}
              onStartActivity={handleStartAdaptiveActivity}
              onAskTutor={handleAskTutor}
              onDismiss={handleDismissAdaptive}
              onRefresh={handleRefreshAdaptive}
              loading={refreshingRec}
            />
          </div>
        )}

        {/* Active Learning Insight Card */}
        {insights.length > 0 && (
          <div className="space-y-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5 px-2">
              <Sparkles className="w-4 h-4 text-emerald-600" />
              <span>Personalized Learning Insight</span>
            </h2>
            <StudentInsightCard
              insight={insights[0]}
              onReviewLesson={(lessonId) => {
                if (lessonId) handleNav(`/student/lessons/${lessonId}`);
              }}
              onPracticeAgain={async (skillId) => {
                const id = await findPracticeSetId(skillId);
                if (id) handleNav(`/student/practice/${id}`);
                else window.alert("Your teacher has not published a practice set yet.");
              }}
            />
          </div>
        )}

        {/* Sequential Learning Path Traversal */}
        <div className="space-y-4">
          <div className="flex items-center justify-between px-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-blue-600" />
              <span>Lesson Progression Roadmap</span>
            </h2>
            <span className="text-xs text-slate-400">Order by Curriculum Sequence</span>
          </div>

          <div className="relative pl-6 sm:pl-8 space-y-6 before:absolute before:left-3.5 sm:before:left-4 before:top-4 before:bottom-4 before:w-0.5 before:bg-slate-200">
            {learningPath.map((node: any, idx: number) => {
              const isCompleted = node.state === "COMPLETED";
              const isInProgress = node.state === "IN_PROGRESS";
              const isLocked = node.state === "LOCKED";
              const isAvailable = node.state === "AVAILABLE";

              return (
                <div key={node.lessonId} className="relative group">
                  {/* Status Indicator Icon along the timeline spine */}
                  <div
                    className={`absolute -left-6 sm:-left-8 top-5 -translate-x-1/2 w-7 h-7 rounded-full flex items-center justify-center border-2 transition-transform group-hover:scale-110 shadow-xs ${
                      isCompleted
                        ? "bg-emerald-500 border-white text-white"
                        : isInProgress
                        ? "bg-blue-600 border-white text-white ring-4 ring-blue-100"
                        : isAvailable
                        ? "bg-white border-blue-500 text-blue-600"
                        : "bg-slate-100 border-slate-300 text-slate-400"
                    }`}
                  >
                    {isCompleted ? (
                      <CheckCircle2 className="w-4 h-4" />
                    ) : isInProgress ? (
                      <ArrowRight className="w-3.5 h-3.5" />
                    ) : isAvailable ? (
                      <span className="w-2 h-2 rounded-full bg-blue-600" />
                    ) : (
                      <Lock className="w-3.5 h-3.5" />
                    )}
                  </div>

                  {/* Lesson Card */}
                  <div
                    onClick={() => handleLessonClick(node)}
                    className={`p-5 rounded-2xl border transition-all cursor-pointer ${
                      isCompleted
                        ? "bg-white border-emerald-200/80 hover:border-emerald-300 hover:shadow-xs"
                        : isInProgress
                        ? "bg-white border-blue-400 shadow-xs hover:border-blue-500 hover:shadow-md ring-1 ring-blue-100"
                        : isAvailable
                        ? "bg-white border-slate-200 hover:border-blue-300 hover:shadow-xs"
                        : "bg-slate-50/70 border-slate-200/80 opacity-75 hover:opacity-90"
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                            Lesson {node.sequenceOrder}
                          </span>
                          <span className="text-slate-300">•</span>
                          {isCompleted ? (
                            <Badge variant="success" className="text-[10px] gap-1">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Completed</span>
                            </Badge>
                          ) : isInProgress ? (
                            <Badge variant="info" className="text-[10px] gap-1">
                              <ArrowRight className="w-3 h-3" />
                              <span>In Progress ({node.progressPercentage}%)</span>
                            </Badge>
                          ) : isAvailable ? (
                            <Badge variant="secondary" className="text-[10px]">
                              Available to Start
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] gap-1 text-slate-500">
                              <Lock className="w-3 h-3" />
                              <span>Locked</span>
                            </Badge>
                          )}
                        </div>

                        <h3 className="text-base font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                          {node.title}
                        </h3>

                        <p className="text-xs text-slate-600 mt-1 max-w-xl line-clamp-2">
                          {node.description}
                        </p>
                      </div>

                      {/* Action CTA */}
                      <div className="shrink-0 flex items-center gap-2">
                        {isCompleted && (
                          <Button variant="outline" size="sm" className="text-xs gap-1">
                            <span>Review</span>
                          </Button>
                        )}
                        {isInProgress && (
                          <Button variant="primary" size="sm" className="text-xs gap-1.5">
                            <span>Continue</span>
                            <ArrowRight className="w-3 h-3" />
                          </Button>
                        )}
                        {isAvailable && (
                          <Button variant="outline" size="sm" className="text-xs gap-1.5 border-blue-300 text-blue-700 hover:bg-blue-50">
                            <span>Start Lesson</span>
                            <ArrowRight className="w-3 h-3" />
                          </Button>
                        )}
                        {isLocked && (
                          <span className="text-xs text-slate-400 font-medium flex items-center gap-1">
                            <Lock className="w-3.5 h-3.5" />
                            <span>Locked</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Associated Skills Pill row */}
                    {node.skills?.length > 0 && (
                      <div className="mt-3.5 pt-3 border-t border-slate-100 flex flex-wrap items-center gap-2 text-xs">
                        <span className="text-[10px] uppercase font-semibold text-slate-400">
                          Target Skills & Mastery:
                        </span>
                        {node.skills.map((s: any) => {
                          const skillMastery = masteries.find((m) => m.skillId === s.id);
                          return (
                            <button
                              key={s.id}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (skillMastery) {
                                  setSelectedMastery(skillMastery);
                                } else {
                                  handleNav(`/student/mastery/${s.id}`);
                                }
                              }}
                              className="px-2.5 py-1 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition-colors flex items-center gap-2 cursor-pointer shadow-2xs group/skill"
                              title="Click to view mastery evidence breakdown"
                            >
                              <span className="text-[11px] font-bold text-slate-800 group-hover/skill:text-blue-600 transition-colors">
                                {s.title}
                              </span>
                              <MasteryBadge level={skillMastery?.status || "NOT_STARTED"} size="sm" />
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* Lock reason warning message */}
                    {isLocked && node.lockReasons?.length > 0 && (
                      <div className="mt-3 p-2.5 rounded-lg bg-amber-50/70 border border-amber-200/70 text-xs text-amber-800 flex items-center gap-2">
                        <Lock className="w-3.5 h-3.5 shrink-0 text-amber-600" />
                        <span>{node.lockReasons[0]}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Locked Lesson Advisory Dialog */}
      {selectedLockedLesson && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in"
        >
          <div className="bg-white rounded-2xl border border-slate-200 p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
              <Lock className="w-6 h-6" />
            </div>

            <div className="text-center">
              <h3 className="text-lg font-bold text-slate-900">Lesson Locked</h3>
              <p className="text-xs text-slate-500 mt-0.5">{selectedLockedLesson.title}</p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs text-slate-700">
              <span className="font-semibold block uppercase tracking-wider text-slate-500 text-[10px]">
                Prerequisites Required Before Unlocking:
              </span>
              {selectedLockedLesson.lockReasons?.map((reason: string, idx: number) => (
                <div key={idx} className="flex items-start gap-2">
                  <span className="text-amber-500 font-bold">•</span>
                  <span>{reason}</span>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                fullWidth
                onClick={() => setSelectedLockedLesson(null)}
              >
                Close
              </Button>
              {nextRecommended && (
                <Button
                  variant="primary"
                  fullWidth
                  onClick={() => {
                    setSelectedLockedLesson(null);
                    handleLessonClick(nextRecommended);
                  }}
                >
                  Go to Recommended
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
      {/* AI Tutor Drawer for Adaptive Guidance */}
      {tutorContext && (
        <AITutorPanel
          isOpen={isTutorOpen}
          onClose={() => setIsTutorOpen(false)}
          context={tutorContext}
        />
      )}

      {/* Mastery Evidence Inspection Modal */}
      <MasteryDetailModal
        isOpen={Boolean(selectedMastery)}
        onClose={() => setSelectedMastery(null)}
        mastery={selectedMastery}
        onRecalculate={handleRecalculateMastery}
      />
    </div>
  );
}
