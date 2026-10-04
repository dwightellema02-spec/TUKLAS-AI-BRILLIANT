import React, { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";

interface TutorFlag {
  conversationId: string;
  lessonId: string | null;
  updatedAt: string;
  reasons: string[];
  mistakePatterns: Record<string, number>;
  recentStudentMessages: string[];
}

const PATTERN_LABELS: Record<string, string> = {
  SIGN_ERROR: "sign errors",
  IGNORED_SIGNS: "ignoring signs",
  ADDED_MAGNITUDES: "adding sizes when signs differ",
  WRONG_OPERATION: "mixing up operations",
  CALCULATION_SLIP: "arithmetic slips",
  UNKNOWN_INCORRECT: "unclassified errors",
};

/** Shows the teacher where the AI Tutor judged a student needed human help. */
export function TutorFlagsCard({ studentId }: { studentId: string }) {
  const [flags, setFlags] = useState<TutorFlag[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/teacher/students/${studentId}/tutor-flags`)
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((j) => !cancelled && setFlags(j.data ?? []))
      .catch(() => !cancelled && setFlags([]));
    return () => {
      cancelled = true;
    };
  }, [studentId]);

  if (!flags || flags.length === 0) return null;

  return (
    <section className="bg-amber-50 border border-amber-200 rounded-2xl p-5 mt-6" aria-label="AI Tutor needs your help">
      <div className="flex items-center gap-2 mb-2">
        <AlertTriangle className="w-4 h-4 text-amber-600" />
        <h2 className="text-sm font-bold text-amber-900">The AI Tutor asked for your help</h2>
      </div>
      <ul className="space-y-3">
        {flags.map((f) => (
          <li key={f.conversationId} className="text-xs text-amber-900">
            <p className="font-semibold">{f.reasons.join("; ")}</p>
            {Object.keys(f.mistakePatterns).length > 0 && (
              <p className="text-amber-800">
                Mistake patterns:{" "}
                {Object.entries(f.mistakePatterns)
                  .map(([k, n]) => `${PATTERN_LABELS[k] ?? k} (${n})`)
                  .join(", ")}
              </p>
            )}
            {f.recentStudentMessages.length > 0 && (
              <p className="text-amber-800 italic">Recent messages: {f.recentStudentMessages.map((m) => `"${m}"`).join(" ")}</p>
            )}
            <p className="text-[11px] text-amber-700">{new Date(f.updatedAt).toLocaleString()}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
