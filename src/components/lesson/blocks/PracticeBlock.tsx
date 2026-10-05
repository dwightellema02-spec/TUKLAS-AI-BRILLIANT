import { findPracticeSetId } from "@/lib/practice/find-practice";
import React from "react";
import { Target, ArrowRight, Award } from "lucide-react";
import { MathText } from "@/components/ui/MathText";
import { Button } from "@/components/ui/Button";

export interface PracticeBlockProps {
  title?: string;
  content: string; // Description or instructions
  metadata?: string; // JSON with skillName, questionCount, difficulty, practiceSetId
  onComplete?: () => void;
  onNavigate?: (path: string) => void;
  readOnly?: boolean;
}

export function PracticeBlock({
  title,
  content,
  metadata,
  onComplete,
  onNavigate,
  readOnly = false,
}: PracticeBlockProps) {
  let parsed: { skillName?: string; questionCount?: number; difficulty?: string; practiceSetId?: string } = {};
  if (metadata) {
    try {
      parsed = JSON.parse(metadata);
    } catch {}
  }

  const skillName = parsed.skillName || "Target MATATAG Skill";
  const questionCount = parsed.questionCount || 8;
  const handleLaunch = async () => {
    const practiceSetId = parsed.practiceSetId || (await findPracticeSetId());
    if (!practiceSetId) {
      window.alert("Your teacher has not published a practice set yet.");
      return;
    }
    if (onComplete) onComplete();
    if (onNavigate) {
      onNavigate(`/student/practice/${practiceSetId}`);
    } else {
      window.location.href = `/student/practice/${practiceSetId}`;
    }
  };

  return (
    <div className="rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50/70 via-white to-teal-50/50 p-6 sm:p-8 shadow-xs space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
          <Target className="w-5 h-5" />
        </div>
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 block">
            Practice Integration Point
          </span>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            {title || "Targeted Skill Practice"}
          </h2>
        </div>
      </div>

      <div className="text-sm text-slate-600 leading-relaxed">
        <MathText
          content={
            content ||
            "Apply what you have learned through targeted math exercises. Solidify your understanding of integer representations and comparisons."
          }
        />
      </div>

      <div className="p-4 rounded-xl bg-white border border-slate-200/80 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
        <div>
          <span className="text-slate-400 block text-[10px] uppercase font-bold">Targeted Skill:</span>
          <span className="font-semibold text-slate-800">{skillName}</span>
        </div>
        <div>
          <span className="text-slate-400 block text-[10px] uppercase font-bold">Activity:</span>
          <span className="font-semibold text-slate-800">{questionCount} Practice Problems</span>
        </div>
        <div>
          <span className="text-slate-400 block text-[10px] uppercase font-bold">Standard:</span>
          <span className="font-semibold text-teal-700">DepEd MATATAG (Phase 6 Engine)</span>
        </div>
      </div>

      <div className="pt-2 flex items-center justify-between">
        <Button
          variant="primary"
          onClick={handleLaunch}
          disabled={readOnly}
          className="gap-2"
        >
          <span>Launch Practice Session</span>
          <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
