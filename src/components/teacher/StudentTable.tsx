import React from "react";
import { Search, ChevronLeft, ChevronRight, User, AlertCircle, ArrowRight } from "lucide-react";
import { MasteryBadge } from "@/components/mastery/MasteryBadge";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import type { StudentListItemDTO } from "@/lib/teacher/teacher-types";

export interface StudentTableProps {
  students: StudentListItemDTO[];
  total: number;
  page: number;
  totalPages: number;
  search: string;
  onSearchChange: (q: string) => void;
  onPageChange: (p: number) => void;
  onSelectStudent: (studentId: string) => void;
  loading?: boolean;
}

export function StudentTable({
  students,
  total,
  page,
  totalPages,
  search,
  onSearchChange,
  onPageChange,
  onSelectStudent,
  loading = false,
}: StudentTableProps) {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return <Badge variant="success" className="text-[10px]">Active</Badge>;
      case "NEEDS_SUPPORT":
        return <Badge variant="warning" className="text-[10px]">Needs Support</Badge>;
      case "NO_DATA":
        return <Badge variant="outline" className="text-[10px] text-slate-500">No activity yet</Badge>;
      default:
        return <Badge variant="outline" className="text-[10px] text-slate-500">Inactive</Badge>;
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs overflow-hidden">
      {/* Search Header */}
      <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search authorized students by name..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>

        <span className="text-xs text-slate-500">
          Showing {students.length} of {total} students
        </span>
      </div>

      {/* Table Content */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50/80 text-slate-500 uppercase tracking-wider font-bold border-b border-slate-100">
            <tr>
              <th className="py-3 px-4">Student</th>
              <th className="py-3 px-4">Class</th>
              <th className="py-3 px-4">Current Lesson</th>
              <th className="py-3 px-4">Accuracy</th>
              <th className="py-3 px-4">Primary Mastery</th>
              <th className="py-3 px-4">Last Activity</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {students.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-slate-400">
                  {search ? "No students matching your search criteria." : "No students assigned to your classes."}
                </td>
              </tr>
            ) : (
              students.map((st) => (
                <tr
                  key={st.id}
                  onClick={() => onSelectStudent(st.id)}
                  className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                >
                  {/* Student Name & Email */}
                  <td className="py-3.5 px-4 font-bold text-slate-900">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-teal-50 text-teal-700 font-black flex items-center justify-center text-[11px] shrink-0">
                        {st.name.charAt(0)}
                      </div>
                      <div>
                        <span className="group-hover:text-teal-700 transition-colors block">
                          {st.name}
                        </span>
                        <span className="text-[11px] text-slate-400 font-normal">
                          {st.email}
                        </span>
                      </div>
                    </div>
                  </td>

                  {/* Class */}
                  <td className="py-3.5 px-4 text-slate-600">
                    {st.classrooms.map((c) => c.name).join(", ") || "Unassigned"}
                  </td>

                  {/* Current Lesson & Progress */}
                  <td className="py-3.5 px-4">
                    {st.currentLesson ? (
                      <div className="space-y-1">
                        <span className="font-semibold text-slate-800 line-clamp-1">
                          {st.currentLesson.title}
                        </span>
                        <div className="flex items-center gap-2">
                          <div className="w-16 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                            <div
                              className="bg-blue-600 h-1.5 rounded-full"
                              style={{ width: `${st.currentLesson.progressPercentage}%` }}
                            />
                          </div>
                          <span className="text-[10px] text-slate-400">
                            {st.currentLesson.progressPercentage}%
                          </span>
                        </div>
                      </div>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>

                  {/* Accuracy */}
                  <td className="py-3.5 px-4 font-bold text-slate-700">
                    {st.overallAccuracy === null ? <span className="text-slate-400 font-normal" title="No scored practice yet">—</span> : `${st.overallAccuracy}%`}
                  </td>

                  {/* Primary Mastery Badge */}
                  <td className="py-3.5 px-4">
                    {st.primaryMastery ? (
                      <MasteryBadge level={st.primaryMastery.status} size="sm" />
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>

                  {/* Last Activity */}
                  <td className="py-3.5 px-4 text-slate-500">
                    {st.lastActivityDisplay}
                  </td>

                  {/* Status */}
                  <td className="py-3.5 px-4">
                    {getStatusBadge(st.status)}
                  </td>

                  {/* Action */}
                  <td className="py-3.5 px-4 text-right">
                    <span className="text-teal-700 font-bold group-hover:underline inline-flex items-center gap-0.5">
                      View
                      <ArrowRight className="w-3 h-3" />
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div className="p-4 border-t border-slate-100 flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            className="gap-1 text-xs"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span>Previous</span>
          </Button>

          <span className="text-xs text-slate-500">
            Page {page} of {totalPages}
          </span>

          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
            className="gap-1 text-xs"
          >
            <span>Next</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
}
