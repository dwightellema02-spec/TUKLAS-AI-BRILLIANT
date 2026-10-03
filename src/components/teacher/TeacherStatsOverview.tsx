import React from "react";
import { Users, BookOpen, FileEdit, GraduationCap, CheckCircle2, Clock } from "lucide-react";

export interface TeacherStatsOverviewProps {
  stats: {
    totalStudents: number;
    activeStudents: number;
    recentlyActiveStudents: number;
    inactiveStudents: number;
    publishedLessonsCount: number;
    draftLessonsCount: number;
    activeClassesCount: number;
  };
  onNavigateStudents?: () => void;
  onNavigateLessons?: () => void;
  onNavigateClasses?: () => void;
}

export function TeacherStatsOverview({
  stats,
  onNavigateStudents,
  onNavigateLessons,
  onNavigateClasses,
}: TeacherStatsOverviewProps) {
  const {
    totalStudents,
    activeStudents,
    recentlyActiveStudents,
    inactiveStudents,
    publishedLessonsCount,
    draftLessonsCount,
    activeClassesCount,
  } = stats;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      {/* 1. Students Card */}
      <div
        onClick={onNavigateStudents}
        className="bg-white rounded-3xl border border-slate-200/90 p-5 shadow-2xs hover:border-indigo-300 hover:shadow-xs transition-all cursor-pointer group"
      >
        <div className="flex items-center justify-between text-slate-500 mb-2">
          <span className="text-[11px] font-bold uppercase tracking-wider">
            Total Students
          </span>
          <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:scale-105 transition-transform">
            <Users className="w-4 h-4" />
          </div>
        </div>

        <div className="flex items-baseline gap-2 mb-2">
          <span className="text-3xl font-black text-slate-900 tracking-tight">
            {totalStudents}
          </span>
          <span className="text-xs font-semibold text-emerald-600">
            {activeStudents} active
          </span>
        </div>

        <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-100">
          <span>{recentlyActiveStudents} active this week</span>
          <span className="text-slate-400">{inactiveStudents} inactive</span>
        </div>
      </div>

      {/* 2. Published Lessons */}
      <div
        onClick={onNavigateLessons}
        className="bg-white rounded-3xl border border-slate-200/90 p-5 shadow-2xs hover:border-teal-300 hover:shadow-xs transition-all cursor-pointer group"
      >
        <div className="flex items-center justify-between text-slate-500 mb-2">
          <span className="text-[11px] font-bold uppercase tracking-wider">
            Published Content
          </span>
          <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center group-hover:scale-105 transition-transform">
            <CheckCircle2 className="w-4 h-4" />
          </div>
        </div>

        <div className="flex items-baseline gap-2 mb-2">
          <span className="text-3xl font-black text-slate-900 tracking-tight">
            {publishedLessonsCount}
          </span>
          <span className="text-xs text-slate-500">
            live MATATAG lessons
          </span>
        </div>

        <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-100">
          <span className="text-teal-700 font-medium">Ready for student access</span>
        </div>
      </div>

      {/* 3. Draft & In-Review Content */}
      <div
        onClick={onNavigateLessons}
        className="bg-white rounded-3xl border border-slate-200/90 p-5 shadow-2xs hover:border-amber-300 hover:shadow-xs transition-all cursor-pointer group"
      >
        <div className="flex items-center justify-between text-slate-500 mb-2">
          <span className="text-[11px] font-bold uppercase tracking-wider">
            Draft & In-Review
          </span>
          <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center group-hover:scale-105 transition-transform">
            <FileEdit className="w-4 h-4" />
          </div>
        </div>

        <div className="flex items-baseline gap-2 mb-2">
          <span className="text-3xl font-black text-slate-900 tracking-tight">
            {draftLessonsCount}
          </span>
          <span className="text-xs text-amber-600 font-semibold">
            in authoring pipeline
          </span>
        </div>

        <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-100">
          <span>Teacher Content Studio</span>
          <span className="text-blue-600 font-semibold">Edit</span>
        </div>
      </div>

      {/* 4. Active Classes */}
      <div
        onClick={onNavigateClasses}
        className="bg-white rounded-3xl border border-slate-200/90 p-5 shadow-2xs hover:border-blue-300 hover:shadow-xs transition-all cursor-pointer group"
      >
        <div className="flex items-center justify-between text-slate-500 mb-2">
          <span className="text-[11px] font-bold uppercase tracking-wider">
            Active Classes
          </span>
          <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-105 transition-transform">
            <GraduationCap className="w-4 h-4" />
          </div>
        </div>

        <div className="flex items-baseline gap-2 mb-2">
          <span className="text-3xl font-black text-slate-900 tracking-tight">
            {activeClassesCount}
          </span>
          <span className="text-xs text-slate-500">
            sections assigned
          </span>
        </div>

        <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-100">
          <span>DepEd S.Y. 2026-2027</span>
          <span className="text-blue-600 font-semibold">Manage</span>
        </div>
      </div>
    </div>
  );
}
