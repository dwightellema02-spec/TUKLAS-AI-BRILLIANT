import React from "react";
import { PlusCircle, BookOpen, Users, CheckCircle2, Sparkles, FolderKanban } from "lucide-react";
import { Button } from "@/components/ui/Button";

export interface TeacherQuickActionsProps {
  onCreateLesson: () => void;
  onManageLessons: () => void;
  onViewStudents: () => void;
  onCreatePractice: () => void;
  onAskAI?: () => void;
}

export function TeacherQuickActions({
  onCreateLesson,
  onManageLessons,
  onViewStudents,
  onCreatePractice,
  onAskAI,
}: TeacherQuickActionsProps) {
  return (
    <div className="bg-white rounded-3xl border border-slate-200/90 p-5 sm:p-6 shadow-xs mb-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div>
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Control Center
          </h2>
          <p className="text-base sm:text-lg font-black text-slate-900 mt-0.5">
            Quick Actions
          </p>
        </div>
        <p className="text-xs text-slate-500 max-w-sm">
          Jump directly into lesson authoring, classroom student monitoring, or practice sets.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3 pt-4">
        <Button
          variant="primary"
          onClick={onCreateLesson}
          className="gap-2 bg-teal-600 hover:bg-teal-700 text-white font-bold h-11 text-xs shadow-xs"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Create Lesson</span>
        </Button>

        <Button
          variant="outline"
          onClick={onManageLessons}
          className="gap-2 border-slate-200 hover:bg-slate-50 text-slate-700 font-bold h-11 text-xs"
        >
          <BookOpen className="w-4 h-4 text-blue-600" />
          <span>Manage Lessons</span>
        </Button>

        <Button
          variant="outline"
          onClick={onViewStudents}
          className="gap-2 border-slate-200 hover:bg-slate-50 text-slate-700 font-bold h-11 text-xs"
        >
          <Users className="w-4 h-4 text-indigo-600" />
          <span>View Students</span>
        </Button>

        <Button
          variant="outline"
          onClick={onCreatePractice}
          className="gap-2 border-slate-200 hover:bg-slate-50 text-slate-700 font-bold h-11 text-xs"
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>Practice Sets</span>
        </Button>

        {onAskAI && (
          <Button
            variant="secondary"
            onClick={onAskAI}
            className="gap-2 bg-gradient-to-r from-indigo-50 to-purple-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 font-bold h-11 text-xs col-span-2 sm:col-span-4 lg:col-span-1"
          >
            <Sparkles className="w-4 h-4 text-indigo-600" />
            <span>AI Assistant</span>
          </Button>
        )}
      </div>
    </div>
  );
}
