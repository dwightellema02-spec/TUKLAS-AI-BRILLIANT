/**
 * Tuklas AI - Student Mastery Detail Page
 * Route: /student/mastery/[skillId]
 * Deep evidence inspection for a specific skill
 */

import React, { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth/auth-context";
import { MasteryBadge } from "@/components/mastery/MasteryBadge";
import { Button } from "@/components/ui/Button";
import {
  ArrowLeft,
  RotateCcw,
  Sparkles,
  BarChart3,
  Clock,
  AlertCircle,
  CheckCircle2,
  TrendingUp,
  Layers,
  ArrowRight,
} from "lucide-react";
import type { SkillMasteryDTO } from "@/lib/mastery/mastery-types";

interface StudentMasteryDetailPageProps {
  skillId: string;
  onNavigate?: (path: string) => void;
}

export default function StudentMasteryDetailPage({
  skillId,
  onNavigate,
}: StudentMasteryDetailPageProps) {
  const { user } = useAuth();
  const [mastery, setMastery] = useState<SkillMasteryDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [recalculating, setRecalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleNav = (path: string) => {
    if (onNavigate) onNavigate(path);
    else window.location.pathname = path;
  };

  const loadMastery = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/student/mastery/${skillId}`);
      if (!res.ok) {
        throw new Error("Unable to load mastery evaluation for this skill.");
      }
      const json = await res.json();
      setMastery(json.data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error loading mastery";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleRecalculate = async () => {
    try {
      setRecalculating(true);
      const res = await fetch(`/api/student/mastery/${skillId}/recalculate`, {
        method: "POST",
      });
      if (res.ok) {
        const json = await res.json();
        setMastery(json.data);
      }
    } catch (err) {
      console.warn("Recalculate error:", err);
    } finally {
      setRecalculating(false);
    }
  };

  useEffect(() => {
    if (user && skillId) {
      loadMastery();
    }
  }, [user, skillId]);

  if (loading) {
    return (
      <div className="py-20 text-center max-w-xl mx-auto space-y-4">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm font-semibold text-slate-600">Evaluating multi-source mastery evidence...</p>
      </div>
    );
  }

  if (error || !mastery) {
    return (
      <div className="py-20 text-center max-w-md mx-auto space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-slate-900">Skill Evidence Not Found</h2>
        <p className="text-xs text-slate-500">{error || "No active record found for this skill."}</p>
        <Button variant="outline" size="sm" onClick={() => handleNav("/student/learning-path")}>
          Return to Learning Path
        </Button>
      </div>
    );
  }

  const {
    skillTitle,
    lessonTitle,
    status,
    accuracy,
    recentAccuracy,
    consistencyScore,
    applicationScore,
    attemptCount,
    explanation,
    metadata,
    history = [],
    masteryVersion,
    lastEvaluatedAt,
  } = mastery;

  const difficultyStats = metadata?.difficulty || {
    EASY: { attempts: 0, correct: 0, accuracy: 0.0 },
    MEDIUM: { attempts: 0, correct: 0, accuracy: 0.0 },
    HARD: { attempts: 0, correct: 0, accuracy: 0.0 },
  };

  const questionTypes = metadata?.questionTypes || {};

  return (
    <div className="py-8 sm:py-12 bg-slate-50/60 min-h-[calc(100vh-140px)]">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 space-y-6">
        {/* Top Back Navigation Bar */}
        <div className="flex items-center justify-between gap-4">
          <button
            onClick={() => handleNav("/student/learning-path")}
            className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Learning Path</span>
          </button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleRecalculate}
            disabled={recalculating}
            className="text-xs gap-1.5 cursor-pointer bg-white"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${recalculating ? "animate-spin" : ""}`} />
            <span>{recalculating ? "Recalculating..." : "Recalculate Evidence"}</span>
          </Button>
        </div>

        {/* Hero Card */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              {lessonTitle && (
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Lesson: {lessonTitle}
                </span>
              )}
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                {skillTitle}
              </h1>
            </div>
            <div className="shrink-0 flex items-center gap-2">
              <MasteryBadge level={status} size="lg" />
            </div>
          </div>

          {/* Explanation Box */}
          <div className="p-5 rounded-2xl bg-gradient-to-br from-blue-50/70 via-slate-50 to-teal-50/40 border border-blue-100 space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-blue-800">
              <Sparkles className="w-4 h-4 text-blue-600" />
              <span>Evidence-Based Mastery Insight</span>
            </div>
            <p className="text-sm font-semibold text-slate-900 leading-relaxed">
              {explanation?.summary || mastery.evidenceSummary}
            </p>
            {explanation?.why && (
              <p className="text-xs text-slate-600 leading-relaxed pt-1 border-t border-blue-100/60">
                <span className="font-bold text-slate-700">Why this status: </span>
                {explanation.why}
              </p>
            )}
            {explanation?.nextStep && (
              <p className="text-xs text-teal-800 font-medium">
                <span className="font-bold">Next Recommended Activity: </span>
                {explanation.nextStep}
              </p>
            )}
          </div>
        </div>

        {/* 4-Dimension Metric Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs text-center space-y-1">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
              Overall Accuracy
            </span>
            <span className="text-2xl sm:text-3xl font-black text-slate-900">
              {Math.round(accuracy * 100)}%
            </span>
            <span className="text-xs text-slate-400 block">{attemptCount} attempts</span>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs text-center space-y-1">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
              Recent Window
            </span>
            <span className="text-2xl sm:text-3xl font-black text-blue-600">
              {Math.round(recentAccuracy * 100)}%
            </span>
            <span className="text-xs text-slate-400 block">Last 5 questions</span>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs text-center space-y-1">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
              Consistency
            </span>
            <span className="text-2xl sm:text-3xl font-black text-teal-700">
              {Math.round(consistencyScore * 100)}%
            </span>
            <span className="text-xs text-slate-400 block">Repeatable success</span>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs text-center space-y-1">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
              Application
            </span>
            <span className="text-2xl sm:text-3xl font-black text-indigo-600">
              {Math.round(applicationScore * 100)}%
            </span>
            <span className="text-xs text-slate-400 block">Higher-order items</span>
          </div>
        </div>

        {/* Difficulty Breakdown */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-blue-600" />
              <span>Evidence Across Difficulty Bands</span>
            </h2>
            <span className="text-xs text-slate-400">Deterministic Rule Version {masteryVersion}</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            {(["EASY", "MEDIUM", "HARD"] as const).map((diff) => {
              const stat = difficultyStats[diff] || { attempts: 0, correct: 0, accuracy: 0.0 };
              return (
                <div key={diff} className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-slate-700">{diff} Difficulty</span>
                    <span className="text-slate-900 font-extrabold">{Math.round(stat.accuracy * 100)}%</span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-2 rounded-full ${
                        diff === "EASY"
                          ? "bg-emerald-500"
                          : diff === "MEDIUM"
                          ? "bg-blue-500"
                          : "bg-purple-500"
                      }`}
                      style={{ width: `${Math.round(stat.accuracy * 100)}%` }}
                    />
                  </div>
                  <span className="text-xs text-slate-500 block">
                    {stat.correct} of {stat.attempts} correct answers
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Question Format Diversity */}
        {Object.keys(questionTypes).length > 0 && (
          <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
              <Layers className="w-4 h-4 text-teal-600" />
              <span>Question Format Diversity</span>
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {Object.entries(questionTypes).map(([typeKey, stats]) => (
                <div
                  key={typeKey}
                  className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 text-xs space-y-1"
                >
                  <span className="font-bold text-slate-800 block">{typeKey.replace(/_/g, " ")}</span>
                  <div className="flex items-center justify-between text-slate-600">
                    <span>Accuracy: {Math.round(stats.accuracy * 100)}%</span>
                    <span className="text-slate-400">({stats.attempts} att.)</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Longitudinal History */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
              <Clock className="w-4 h-4 text-indigo-600" />
              <span>Mastery Progression Audit Trail</span>
            </h2>
            <span className="text-xs text-slate-400">Last evaluated: {new Date(lastEvaluatedAt).toLocaleDateString()}</span>
          </div>

          {history.length > 0 ? (
            <div className="space-y-3 border-l-2 border-slate-200 ml-2 pl-4 py-1">
              {history.map((h, i) => (
                <div key={h.id || i} className="text-xs space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold text-slate-400">
                      {new Date(h.createdAt).toLocaleDateString()}
                    </span>
                    {h.previousStatus && (
                      <>
                        <span className="text-slate-400 line-through">{h.previousStatus}</span>
                        <span className="text-slate-400">→</span>
                      </>
                    )}
                    <MasteryBadge level={h.newStatus} size="sm" />
                  </div>
                  <p className="text-slate-600 text-xs leading-relaxed">{h.reason}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-400 italic">
              Initial evaluation snapshot. Subsequent transitions will be recorded here.
            </p>
          )}
        </div>

        {/* Practice Call to Action */}
        <div className="p-6 rounded-3xl bg-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold">Ready to reinforce this skill?</h3>
            <p className="text-xs text-slate-300 mt-0.5">
              Practice questions are calibrated to strengthen areas where evidence is still developing.
            </p>
          </div>
          <Button
            variant="primary"
            size="md"
            onClick={() => handleNav("/student/practice/ps_integers_basics")}
            className="gap-2 text-xs font-bold shrink-0 cursor-pointer"
          >
            <span>Practice Now</span>
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
