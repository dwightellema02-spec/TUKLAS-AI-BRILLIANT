import React from "react";
import { AlertCircle, HelpCircle, ArrowRight, User, Clock, ShieldAlert } from "lucide-react";
import type { StudentSupportSignalDTO } from "@/lib/teacher/teacher-types";
import { Badge } from "@/components/ui/Badge";

export interface NeedsAttentionPanelProps {
  signals: StudentSupportSignalDTO[];
  onSelectStudent: (studentId: string) => void;
}

export function NeedsAttentionPanel({ signals, onSelectStudent }: NeedsAttentionPanelProps) {
  if (signals.length === 0) {
    return (
      <div className="bg-white rounded-3xl border border-slate-200/90 p-6 shadow-xs mb-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <AlertCircle className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              All Students Progressing Reliably
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              No students are currently flagged for low accuracy, repeated misconceptions, or prolonged inactivity.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case "HIGH":
        return <Badge variant="warning" className="text-[10px] bg-red-50 text-red-700 border-red-200">High Priority</Badge>;
      case "MEDIUM":
        return <Badge variant="warning" className="text-[10px]">Support Needed</Badge>;
      default:
        return <Badge variant="outline" className="text-[10px] text-slate-600">Observational</Badge>;
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200/90 p-5 sm:p-6 shadow-xs mb-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100">
              Formative Intervention
            </span>
            <span className="text-xs text-slate-400">Neutral Signals</span>
          </div>
          <h2 className="text-base sm:text-lg font-black text-slate-900">
            Students Who May Need Support
          </h2>
        </div>
        <p className="text-xs text-slate-500 max-w-sm">
          Signals indicate areas where timely teacher guidance or remedial practice can accelerate learning.
        </p>
      </div>

      <div className="divide-y divide-slate-100 pt-2">
        {signals.map((sig, idx) => (
          <div
            key={`${sig.studentId}_${idx}`}
            onClick={() => onSelectStudent(sig.studentId)}
            className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/80 -mx-2 px-2 rounded-2xl transition-colors cursor-pointer group"
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                  {sig.studentName}
                </span>
                <span className="text-[11px] font-medium text-slate-500 bg-slate-100 px-2 py-0.2 rounded-md">
                  {sig.classroomName}
                </span>
                {getSeverityBadge(sig.severity)}
              </div>
              <p className="text-xs text-slate-600">
                {sig.details}
              </p>
              <p className="text-[11px] text-teal-700 font-medium">
                Action: {sig.suggestedAction}
              </p>
            </div>

            <div className="flex items-center gap-1 text-xs text-blue-600 font-semibold group-hover:underline shrink-0">
              <span>Inspect Student</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
