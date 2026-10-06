import React from "react";
import { Users, ClipboardCheck, BookOpen } from "lucide-react";
import type { GroupRecommendationDTO, AssessmentPerformanceDTO, LessonPerformanceDTO } from "@/lib/teacher/teacher-types";

const TYPE_TEXT: Record<string, string> = { PRE_TEST: "Pre-test", POST_TEST: "Post-test", DIAGNOSTIC: "Diagnostic", FORMATIVE: "Quiz", SUMMATIVE: "Test", PRACTICE: "Practice" };
const card = "bg-white rounded-3xl border border-slate-200/90 p-5 sm:p-6 shadow-xs";

/** Skills several students share difficulty with, with the evidence and a suggested group action. */
export function GroupRecommendationsCard({ items, onSelectStudent }: { items: GroupRecommendationDTO[]; onSelectStudent: (id: string) => void }) {
  return (
    <section data-testid="group-recommendations" className={card}>
      <div className="flex items-center gap-2 mb-1"><Users className="w-4 h-4 text-indigo-600" /><h2 className="text-base font-black text-slate-900">Suggested whole-group focus</h2></div>
      <p className="text-xs text-slate-500 mb-3">Shown only when several students share the same difficulty. Suggestions, not diagnoses.</p>
      {items.length === 0 ? (
        <p className="text-xs text-slate-500">No skill is currently a difficulty for several students at once.</p>
      ) : (
        <ul className="space-y-3">
          {items.map((g) => (
            <li key={g.skillId} className="border border-indigo-100 bg-indigo-50/30 rounded-2xl p-3 text-xs">
              <p className="font-bold text-slate-900 text-sm">{g.skillTitle}</p>
              <p className="text-slate-600 mt-0.5">{g.evidence}</p>
              <p className="text-teal-700 font-medium mt-1">{g.suggestedAction}</p>
              <p className="mt-1.5 flex flex-wrap gap-1">
                {g.students.map((s) => <button key={s.id} type="button" onClick={() => onSelectStudent(s.id)} className="px-2 py-0.5 rounded-full bg-white border border-slate-200 text-slate-700 hover:border-teal-400">{s.name}</button>)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** How each assessment assigned to the class went. */
export function AssessmentPerformanceCard({ items, onOpen }: { items: AssessmentPerformanceDTO[]; onOpen: (id: string) => void }) {
  return (
    <section data-testid="assessment-performance" className={card}>
      <div className="flex items-center gap-2 mb-3"><ClipboardCheck className="w-4 h-4 text-teal-600" /><h2 className="text-base font-black text-slate-900">Assessments</h2></div>
      {items.length === 0 ? (
        <p className="text-xs text-slate-500">No assessment has been assigned to this class yet.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {items.map((a) => (
            <li key={a.assessmentId} className="py-2.5 flex items-center justify-between gap-3 text-xs">
              <button type="button" onClick={() => onOpen(a.assessmentId)} className="text-left">
                <span className="font-bold text-slate-900 hover:text-teal-700 block">{a.title}</span>
                <span className="text-slate-500">{TYPE_TEXT[a.type] ?? a.type}{a.status === "ARCHIVED" ? " · archived" : ""} · {a.completed} of {a.assigned} finished</span>
              </button>
              <span className="text-right shrink-0">
                <span className="block text-sm font-black text-slate-900">{a.meanScorePercent === null ? "–" : `${a.meanScorePercent}%`}</span>
                <span className="text-slate-500">{a.passRate === null ? "no results" : `${Math.round(a.passRate * 100)}% passed`}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** How the class is doing in each lesson. */
export function LessonPerformanceCard({ items }: { items: LessonPerformanceDTO[] }) {
  return (
    <section data-testid="lesson-performance" className={card}>
      <div className="flex items-center gap-2 mb-3"><BookOpen className="w-4 h-4 text-blue-600" /><h2 className="text-base font-black text-slate-900">Lessons</h2></div>
      {items.length === 0 ? (
        <p className="text-xs text-slate-500">No student has started a lesson yet, and none is assigned.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {items.map((l) => (
            <li key={l.lessonId} className="py-2.5 text-xs flex items-center justify-between gap-3">
              <span><span className="font-bold text-slate-900 block">{l.title}</span><span className="text-slate-500">{l.studentsStarted} of {l.totalStudents} started · {l.studentsCompleted} finished</span></span>
              <span className="text-right shrink-0 text-slate-600">{l.practiceAccuracy === null ? "no practice yet" : <><b className="text-slate-900">{l.practiceAccuracy}%</b> practice accuracy<br /><span className="text-slate-400">{l.practiceQuestions} questions</span></>}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
