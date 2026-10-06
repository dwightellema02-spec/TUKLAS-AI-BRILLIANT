import React, { useState } from "react";
import { AlertCircle, HelpCircle, ArrowRight, User, Clock, ShieldAlert } from "lucide-react";
import type { StudentSupportSignalDTO } from "@/lib/teacher/teacher-types";
import { Badge } from "@/components/ui/Badge";

export interface NeedsAttentionPanelProps {
  signals: StudentSupportSignalDTO[];
  onSelectStudent: (studentId: string) => void;
}

const INITIAL = 6;

export function NeedsAttentionPanel({ signals, onSelectStudent }: NeedsAttentionPanelProps) {
  const [showAll, setShowAll] = useState(false);
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
              Nobody is currently flagged: no low practice or quiz results, repeated mistake patterns, tutor flags, or long silences.
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
    <div data-testid="needs-attention" className="bg-white rounded-3xl border border-slate-200/90 p-5 sm:p-6 shadow-xs mb-8">
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
          Each flag lists the evidence behind it. Flags are prompts for a conversation, not judgements about the student.
        </p>
      </div>

      <div className="divide-y divide-slate-100 pt-2">
        {(showAll ? signals : signals.slice(0, INITIAL)).map((sig, idx) => (
          <div
            data-testid="attention-row"
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
              <ul className="text-xs text-slate-600 list-disc pl-4 space-y-0.5">
                {(sig.evidence && sig.evidence.length > 0 ? sig.evidence : [sig.details]).map((e, i) => <li key={i}>{e}</li>)}
              </ul>
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
      {signals.length > INITIAL && (
        <button type="button" data-testid="attention-toggle" onClick={() => setShowAll((v) => !v)} className="mt-3 text-xs font-bold text-blue-600 hover:underline">
          {showAll ? "Show fewer" : `Show all ${signals.length} students`}
        </button>
      )}
    </div>
  );
}
