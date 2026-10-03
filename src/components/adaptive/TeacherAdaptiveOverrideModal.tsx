import React, { useState } from "react";
import { X, ShieldAlert, CheckCircle2, RotateCcw, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import type { AdaptiveRecommendationDTO, AdaptiveDecisionType, QuestionDifficulty } from "@/lib/adaptive/adaptive-types";

export interface TeacherAdaptiveOverrideModalProps {
  isOpen: boolean;
  onClose: () => void;
  recommendation: AdaptiveRecommendationDTO;
  studentId: string;
  onSuccess?: () => void;
}

const OVERRIDE_OPTIONS: Array<{
  type: AdaptiveDecisionType;
  label: string;
  desc: string;
}> = [
  {
    type: "PRACTICE_SAME_DIFFICULTY",
    label: "Keep Same Difficulty",
    desc: "Maintain practice at current difficulty level.",
  },
  {
    type: "PRACTICE_EASIER",
    label: "Practice Easier Questions",
    desc: "Step down to foundational questions to rebuild confidence.",
  },
  {
    type: "PRACTICE_HARDER",
    label: "Advance to Harder Questions",
    desc: "Accelerate student with higher-difficulty challenge problems.",
  },
  {
    type: "REMEDIATE",
    label: "Concept Remediation",
    desc: "Re-assign lesson walkthrough and guided example exercises.",
  },
  {
    type: "REVIEW_PREREQUISITE",
    label: "Prerequisite Review",
    desc: "Require student to review foundational prerequisite lesson first.",
  },
  {
    type: "TEACHER_REVIEW",
    label: "Teacher 1-on-1 Review",
    desc: "Flag for personal in-class educator consultation.",
  },
];

export function TeacherAdaptiveOverrideModal({
  isOpen,
  onClose,
  recommendation,
  studentId,
  onSuccess,
}: TeacherAdaptiveOverrideModalProps) {
  const [selectedDecision, setSelectedDecision] = useState<AdaptiveDecisionType>(
    recommendation.decisionType
  );
  const [reason, setReason] = useState("");
  const [targetDifficulty, setTargetDifficulty] = useState<QuestionDifficulty>(
    recommendation.targetDifficulty || "MEDIUM"
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      setError("Please provide a pedagogical reason for this override.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/teacher/students/${studentId}/adaptive/override`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recommendationId: recommendation.id,
          overrideDecision: selectedDecision,
          reason: reason.trim(),
          targetDifficulty,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to submit override.");
      }

      if (onSuccess) onSuccess();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error submitting override");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-lg bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/60">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0 border border-amber-200/80">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Teacher Adaptive Override
              </h2>
              <p className="text-xs text-slate-500">
                Audited educator intervention for {recommendation.skillTitle || "Active Skill"}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 text-rose-800 text-xs border border-rose-200 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Current System Decision */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1 text-xs">
            <span className="font-bold uppercase tracking-wider text-slate-500 block">
              Current System Decision
            </span>
            <div className="flex items-center gap-2 pt-0.5">
              <Badge variant="outline" className="text-[10px] font-bold">
                {recommendation.decisionType}
              </Badge>
              <span className="text-slate-600 font-medium">{recommendation.reason}</span>
            </div>
          </div>

          {/* Override Decision Selector */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-700 block">
              New Teacher Decision
            </label>
            <div className="space-y-2">
              {OVERRIDE_OPTIONS.map((opt) => {
                const isSelected = selectedDecision === opt.type;
                return (
                  <label
                    key={opt.type}
                    className={`p-3 rounded-xl border flex items-start gap-3 cursor-pointer transition-all ${
                      isSelected
                        ? "bg-teal-50/70 border-teal-500 ring-1 ring-teal-500/20"
                        : "bg-white border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <input
                      type="radio"
                      name="overrideDecision"
                      value={opt.type}
                      checked={isSelected}
                      onChange={() => setSelectedDecision(opt.type)}
                      className="mt-0.5 text-teal-600 focus:ring-teal-500"
                    />
                    <div>
                      <span className="text-xs font-bold text-slate-900 block">{opt.label}</span>
                      <span className="text-[11px] text-slate-500 leading-tight block mt-0.5">
                        {opt.desc}
                      </span>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Target Difficulty Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-700 block">
              Target Question Difficulty
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(["EASY", "MEDIUM", "HARD"] as QuestionDifficulty[]).map((lvl) => (
                <button
                  type="button"
                  key={lvl}
                  onClick={() => setTargetDifficulty(lvl)}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold cursor-pointer transition-all ${
                    targetDifficulty === lvl
                      ? "bg-teal-600 text-white border-teal-600"
                      : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  {lvl}
                </button>
              ))}
            </div>
          </div>

          {/* Mandatory Teacher Reason */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-700 block">
              Audited Reason <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Student showed mastery during classroom boardwork; accelerating to challenging practice."
              className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              required
            />
          </div>

          {/* Actions */}
          <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
            <Button variant="ghost" size="sm" type="button" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit" disabled={submitting} className="gap-1.5">
              {submitting ? "Saving Override..." : "Confirm Override"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
