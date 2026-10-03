import React from "react";
import { GraduationCap, Award, Compass, Sparkles, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/Button";

export interface WelcomeHeaderProps {
  studentName: string;
  gradeLevel?: number;
  subject?: string;
  term?: string;
  onOpenLearningPath: () => void;
  onOpenPracticeHistory: () => void;
  onAskAI: () => void;
}

export function WelcomeHeader({
  studentName,
  gradeLevel = 7,
  subject = "Mathematics",
  term = "Term 1",
  onOpenLearningPath,
  onOpenPracticeHistory,
  onAskAI,
}: WelcomeHeaderProps) {
  return (
    <div className="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-8 shadow-xs mb-8 transition-all">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        {/* Left: Avatar & Friendly Greeting */}
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-teal-500 text-white flex items-center justify-center shadow-md shadow-blue-500/10 shrink-0">
            <GraduationCap className="w-8 h-8" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
                Welcome back, {studentName}!
              </h1>
            </div>
            <p className="text-slate-600 text-sm mt-1 font-medium">
              Ready to continue learning?
            </p>
            <div className="flex items-center gap-2 mt-1.5 text-xs text-slate-500">
              <span className="font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">
                Grade {gradeLevel} {subject}
              </span>
              <span>•</span>
              <span>DepEd MATATAG ({term})</span>
            </div>
          </div>
        </div>

        {/* Right: Quick Launch Navigation */}
        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={onOpenPracticeHistory}
            className="gap-2 text-xs border-slate-200 hover:bg-slate-50 text-slate-700"
          >
            <Award className="w-4 h-4 text-amber-500" />
            <span>Practice History</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={onOpenLearningPath}
            className="gap-2 text-xs border-slate-200 hover:bg-slate-50 text-slate-700"
          >
            <Compass className="w-4 h-4 text-teal-600" />
            <span>Learning Path</span>
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={onAskAI}
            className="gap-2 text-xs bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200"
          >
            <Sparkles className="w-4 h-4 text-indigo-600" />
            <span>Ask Tuklas AI</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
