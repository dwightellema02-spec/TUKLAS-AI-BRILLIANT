/**
 * Tuklas AI - Mastery Detail & Evidence Inspection Modal
 * Shows full multi-dimensional evidence, difficulty breakdown, and transition history
 */

import React, { useState } from "react";
import {
  X,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Clock,
  Layers,
  TrendingUp,
  Award,
  Sparkles,
  BarChart3,
  Calendar,
} from "lucide-react";
import { MasteryBadge } from "./MasteryBadge";
import { Button } from "@/components/ui/Button";
import type { SkillMasteryDTO } from "@/lib/mastery/mastery-types";

interface MasteryDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  mastery: SkillMasteryDTO | null;
  onRecalculate?: (skillId: string) => Promise<void>;
  isTeacherView?: boolean;
}

export function MasteryDetailModal({
  isOpen,
  onClose,
  mastery,
  onRecalculate,
  isTeacherView = false,
}: MasteryDetailModalProps) {
  const [recalculating, setRecalculating] = useState(false);

  if (!isOpen || !mastery) return null;

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

  const handleRecalc = async () => {
    if (!onRecalculate) return;
    try {
      setRecalculating(true);
      await onRecalculate(mastery.skillId);
    } finally {
      setRecalculating(false);
    }
  };

  const difficultyStats = metadata?.difficulty || {
    EASY: { attempts: 0, correct: 0, accuracy: 0.0 },
    MEDIUM: { attempts: 0, correct: 0, accuracy: 0.0 },
    HARD: { attempts: 0, correct: 0, accuracy: 0.0 },
  };

  const questionTypes = metadata?.questionTypes || {};

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="mastery-modal-title"
    >
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="p-6 border-b border-slate-100 flex items-start justify-between gap-4 bg-slate-50/50">
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Evidence-Based Mastery Audit
              </span>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-200/80 text-slate-700">
                {masteryVersion}
              </span>
            </div>
            <h2 id="mastery-modal-title" className="text-xl font-extrabold text-slate-900 leading-snug">
              {skillTitle}
            </h2>
            {lessonTitle && (
              <p className="text-xs text-slate-500 mt-0.5">Part of: {lessonTitle}</p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <MasteryBadge level={status} size="md" />
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              aria-label="Close dialog"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Modal Body */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1 text-slate-800">
          {/* Pedagogical Explanation Box */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-50/80 via-white to-slate-50 border border-blue-200/80 space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-blue-800">
              <Sparkles className="w-4 h-4 text-blue-600" />
              <span>Diagnostic Summary</span>
            </div>
            <p className="text-sm font-semibold text-slate-900 leading-relaxed">
              {explanation?.summary || mastery.evidenceSummary}
            </p>
            {explanation?.why && (
              <p className="text-xs text-slate-600 leading-relaxed pt-1 border-t border-blue-100/80">
                <span className="font-bold text-slate-700">Evidence Rationale: </span>
                {explanation.why}
              </p>
            )}
            {explanation?.nextStep && (
              <p className="text-xs text-teal-800 font-medium pt-0.5">
                <span className="font-bold">Recommended Step: </span>
                {explanation.nextStep}
              </p>
            )}
          </div>

          {/* 4-Dimension Metric Grid */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1.5">
              <BarChart3 className="w-4 h-4 text-slate-600" />
              <span>Mastery Metric Dimensions</span>
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-center">
                <span className="text-[11px] font-bold text-slate-500 uppercase block">Overall Accuracy</span>
                <span className="text-xl font-black text-slate-900">{Math.round(accuracy * 100)}%</span>
                <span className="text-[10px] text-slate-400 block mt-0.5">{attemptCount} total attempts</span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-center">
                <span className="text-[11px] font-bold text-slate-500 uppercase block">Recent Window</span>
                <span className="text-xl font-black text-blue-600">{Math.round(recentAccuracy * 100)}%</span>
                <span className="text-[10px] text-slate-400 block mt-0.5">Last 5 questions</span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-center">
                <span className="text-[11px] font-bold text-slate-500 uppercase block">Consistency</span>
                <span className="text-xl font-black text-teal-700">{Math.round(consistencyScore * 100)}%</span>
                <span className="text-[10px] text-slate-400 block mt-0.5">Repeatable runs</span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-center">
                <span className="text-[11px] font-bold text-slate-500 uppercase block">Application</span>
                <span className="text-xl font-black text-indigo-600">{Math.round(applicationScore * 100)}%</span>
                <span className="text-[10px] text-slate-400 block mt-0.5">Higher-order items</span>
              </div>
            </div>
          </div>

          {/* Difficulty Breakdown */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2.5">
              Performance by Question Difficulty
            </h3>
            <div className="grid grid-cols-3 gap-3">
              {(["EASY", "MEDIUM", "HARD"] as const).map((diff) => {
                const stat = difficultyStats[diff] || { attempts: 0, correct: 0, accuracy: 0.0 };
                return (
                  <div key={diff} className="p-3 rounded-xl border border-slate-200 bg-white">
                    <div className="flex items-center justify-between text-xs font-bold mb-1">
                      <span className="text-slate-600">{diff}</span>
                      <span className="text-slate-900">{Math.round(stat.accuracy * 100)}%</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                      <div
                        className={`h-1.5 rounded-full ${
                          diff === "EASY"
                            ? "bg-emerald-500"
                            : diff === "MEDIUM"
                            ? "bg-blue-500"
                            : "bg-purple-500"
                        }`}
                        style={{ width: `${Math.round(stat.accuracy * 100)}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-slate-400 mt-1 block">
                      {stat.correct} of {stat.attempts} correct
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Question Type Breakdown */}
          {Object.keys(questionTypes).length > 0 && (
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2.5">
                Question Format Diversity
              </h3>
              <div className="flex flex-wrap gap-2">
                {Object.entries(questionTypes).map(([typeKey, stats]) => (
                  <div
                    key={typeKey}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-xs flex items-center gap-2"
                  >
                    <span className="font-bold text-slate-700">{typeKey.replace(/_/g, " ")}:</span>
                    <span className="font-semibold text-slate-900">{Math.round(stats.accuracy * 100)}%</span>
                    <span className="text-[10px] text-slate-400">({stats.attempts} attempts)</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Historical Transitions Audit */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2.5 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-slate-600" />
              <span>Mastery State Progression Audit Trail</span>
            </h3>

            {history.length > 0 ? (
              <div className="space-y-2 border-l-2 border-slate-200 ml-2 pl-4 py-1">
                {history.map((h, i) => (
                  <div key={h.id || i} className="text-xs space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-400">
                        {new Date(h.createdAt).toLocaleDateString()}
                      </span>
                      {h.previousStatus && (
                        <>
                          <span className="text-slate-500 line-through text-[11px]">{h.previousStatus}</span>
                          <span className="text-slate-400">→</span>
                        </>
                      )}
                      <MasteryBadge level={h.newStatus} size="sm" />
                    </div>
                    <p className="text-slate-600 text-[11px]">{h.reason}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic">
                Initial evaluation snapshot. Subsequent transitions will be recorded here.
              </p>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-100 flex items-center justify-between gap-3 bg-slate-50/50">
          <span className="text-[11px] text-slate-400">
            Last evaluated: {new Date(lastEvaluatedAt).toLocaleString()}
          </span>

          <div className="flex items-center gap-2">
            {onRecalculate && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleRecalc}
                disabled={recalculating}
                className="gap-1.5 text-xs cursor-pointer"
              >
                <RotateCcw className={`w-3.5 h-3.5 ${recalculating ? "animate-spin" : ""}`} />
                <span>{recalculating ? "Recalculating..." : "Recalculate Mastery"}</span>
              </Button>
            )}
            <Button variant="primary" size="sm" onClick={onClose} className="text-xs cursor-pointer">
              Close
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
