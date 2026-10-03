import React from "react";
import {
  ArrowLeft,
  GraduationCap,
  BookOpen,
  Award,
  AlertTriangle,
  Compass,
  CheckCircle2,
  Clock,
  ChevronRight,
  TrendingUp,
} from "lucide-react";
import { MasteryBadge } from "@/components/mastery/MasteryBadge";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import type { StudentDetailDTO } from "@/lib/teacher/teacher-types";

export interface StudentDetailViewProps {
  detail: StudentDetailDTO;
  onBack: () => void;
  onNavigateSkill?: (skillId: string) => void;
  onNavigateLesson?: (lessonId: string) => void;
}

export function StudentDetailView({
  detail,
  onBack,
  onNavigateSkill,
  onNavigateLesson,
}: StudentDetailViewProps) {
  const {
    student,
    currentLesson,
    learningPathNodes,
    masteries,
    mistakePatterns,
    adaptiveRecommendations,
    recentPractice,
  } = detail;

  return (
    <div className="space-y-6">
      {/* Back button */}
      <div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="gap-2 text-slate-600 hover:text-slate-900 text-xs"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Students List</span>
        </Button>
      </div>

      {/* Student Profile Card */}
      <div className="bg-white rounded-3xl border border-slate-200/90 p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-teal-50 text-teal-700 font-black text-xl flex items-center justify-center shrink-0 border border-teal-100 shadow-2xs">
              {student.name.charAt(0)}
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900">
                {student.name}
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                {student.email} • Grade {student.gradeLevel} Student
              </p>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                {student.classrooms.map((c) => (
                  <span
                    key={c.id}
                    className="text-[11px] font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md"
                  >
                    {c.name}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {currentLesson && (
            <div className="p-3.5 rounded-2xl bg-blue-50/80 border border-blue-200/80 space-y-1.5 shrink-0 max-w-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 block">
                Current Lesson
              </span>
              <p className="text-xs font-bold text-slate-900 line-clamp-1">
                {currentLesson.title}
              </p>
              <div className="flex items-center gap-2">
                <div className="w-24 bg-slate-200 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-blue-600 h-1.5 rounded-full"
                    style={{ width: `${currentLesson.progressPercentage}%` }}
                  />
                </div>
                <span className="text-[10px] font-bold text-blue-700">
                  {currentLesson.progressPercentage}%
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Grid: Masteries & Adaptive Recommendations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Phase 10 Evidence-Based Skill Mastery */}
        <div className="bg-white rounded-3xl border border-slate-200/90 p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Award className="w-4 h-4 text-emerald-600" />
              <h2 className="text-sm font-bold text-slate-900">
                Evidence-Based Skill Mastery (Phase 10)
              </h2>
            </div>
            <span className="text-xs text-slate-400">Multi-Signal</span>
          </div>

          <div className="space-y-3">
            {masteries.map((m) => (
              <div
                key={m.skillId}
                className="p-3.5 rounded-2xl border border-slate-100 bg-slate-50/50 space-y-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-slate-900">
                    {m.skillTitle}
                  </span>
                  <MasteryBadge level={m.status} size="sm" />
                </div>
                {m.summary && (
                  <p className="text-[11px] text-slate-500 line-clamp-2">
                    {m.summary}
                  </p>
                )}
                <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-200/60">
                  <span>Accuracy: {m.accuracy}%</span>
                  <span>{m.attemptCount} attempts</span>
                  <span>Consistency: {m.consistencyScore}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Phase 9 Adaptive Learning & Phase 8 Mistakes */}
        <div className="space-y-6">
          {/* Active Adaptive Recommendation */}
          <div className="bg-white rounded-3xl border border-slate-200/90 p-5 sm:p-6 shadow-xs space-y-3">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Compass className="w-4 h-4 text-teal-600" />
                <h2 className="text-sm font-bold text-slate-900">
                  Adaptive Guidance (Phase 9)
                </h2>
              </div>
              <span className="text-xs text-slate-400">Live Calibration</span>
            </div>

            {adaptiveRecommendations.length === 0 ? (
              <p className="text-xs text-slate-400 py-3">
                No active adaptive recommendation for this student.
              </p>
            ) : (
              adaptiveRecommendations.slice(0, 2).map((rec) => (
                <div
                  key={rec.id}
                  className="p-3.5 rounded-2xl border border-teal-100 bg-teal-50/40 space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-900">
                      {rec.skillTitle || "Active Skill"}
                    </span>
                    <Badge variant="info" className="text-[10px]">
                      {rec.decisionType.replace(/_/g, " ")}
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-600">
                    {rec.reason}
                  </p>
                  <p className="text-[11px] text-teal-700 font-semibold">
                    Suggested: {rec.recommendedActivityTitle || rec.recommendedActivityType}
                  </p>
                </div>
              ))
            )}
          </div>

          {/* Phase 8 Common Mistakes */}
          <div className="bg-white rounded-3xl border border-slate-200/90 p-5 sm:p-6 shadow-xs space-y-3">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <h2 className="text-sm font-bold text-slate-900">
                  Observed Misconceptions (Phase 8)
                </h2>
              </div>
              <span className="text-xs text-slate-400">AI Analyzer</span>
            </div>

            {mistakePatterns.length === 0 ? (
              <p className="text-xs text-slate-400 py-3">
                No recurring mistake patterns detected.
              </p>
            ) : (
              <div className="space-y-2.5">
                {mistakePatterns.map((mp, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl border border-amber-200/80 bg-amber-50/30 space-y-1 text-xs"
                  >
                    <div className="flex items-center justify-between font-bold text-slate-800">
                      <span>{mp.categoryLabel}</span>
                      <span className="text-amber-700 font-semibold">
                        {mp.count} occurrences
                      </span>
                    </div>
                    {mp.suggestedRemediation && (
                      <p className="text-[11px] text-slate-600">
                        {mp.suggestedRemediation}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent Practice Performance */}
      <div className="bg-white rounded-3xl border border-slate-200/90 p-5 sm:p-6 shadow-xs">
        <h2 className="text-sm font-bold text-slate-900 mb-3">
          Recent Practice History
        </h2>
        {recentPractice.length === 0 ? (
          <p className="text-xs text-slate-400">No practice sets completed yet.</p>
        ) : (
          <div className="divide-y divide-slate-100 text-xs">
            {recentPractice.map((rp) => (
              <div key={rp.id} className="py-2.5 flex items-center justify-between">
                <div>
                  <span className="font-bold text-slate-800 block">{rp.title}</span>
                  <span className="text-[11px] text-slate-400">Score: {rp.score}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={rp.accuracy >= 75 ? "success" : "warning"} className="text-[10px]">
                    {rp.accuracy}%
                  </Badge>
                  <span className="text-slate-500 capitalize">{rp.status.toLowerCase()}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
