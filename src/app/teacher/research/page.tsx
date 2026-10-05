/**
 * Tuklas AI - Teacher Research & Assessment Analytics Dashboard
 * Phase 14: Empirical Learning Metrics, Pre/Post Tests & Research Exports
 */

import React, { useState, useEffect } from "react";
import { TeacherNav } from "@/components/teacher/TeacherNav";
import { Button } from "@/components/ui/Button";
import {
  BarChart3,
  TrendingUp,
  Brain,
  Target,
  ShieldCheck,
  Layers,
  ArrowRight,
  Download,
  Filter,
  AlertTriangle,
  Lightbulb,
  CheckCircle2,
  Clock,
  Sparkles,
  RefreshCw,
  Award,
  Users,
} from "lucide-react";
import type {
  StudentResearchProfile,
  PrePostComparisonResult,
  DifficultSkillEvidence,
  MistakeAggregateItem,
  InterventionObservationItem,
  TimeSeriesDataPoint,
} from "@/lib/research/research-types";

interface TeacherResearchPageProps {
  onNavigate?: (path: string) => void;
}

export default function TeacherResearchPage({ onNavigate }: TeacherResearchPageProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  // "" = all of my students. Classes and students come from the signed-in teacher's own data.
  const [selectedClassroomId, setSelectedClassroomId] = useState<string>("");
  const [selectedGrade, setSelectedGrade] = useState<number>(7);
  const [selectedStudentId, setSelectedStudentId] = useState<string>("");
  const [classes, setClasses] = useState<Array<{ id: string; name: string }>>([]);
  const [students, setStudents] = useState<Array<{ id: string; name: string }>>([]);
  const classQuery = selectedClassroomId ? `classroomId=${encodeURIComponent(selectedClassroomId)}` : "";

  // Analytics data
  const [profile, setProfile] = useState<StudentResearchProfile | null>(null);
  const [comparison, setComparison] = useState<PrePostComparisonResult | null>(null);
  const [difficultSkills, setDifficultSkills] = useState<DifficultSkillEvidence[]>([]);
  const [mistakes, setMistakes] = useState<MistakeAggregateItem[]>([]);
  const [interventions, setInterventions] = useState<InterventionObservationItem[]>([]);
  const [timeSeries, setTimeSeries] = useState<TimeSeriesDataPoint[]>([]);

  const handleNav = (path: string) => {
    if (onNavigate) {
      onNavigate(path);
    } else {
      window.location.pathname = path;
    }
  };

  const loadResearchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [profRes, compRes, diffRes, mistRes, intRes, tsRes] = await Promise.all([
        selectedStudentId ? fetch(`/api/teacher/research/profile/${selectedStudentId}`) : Promise.resolve(null),
        fetch(`/api/teacher/research/comparison?${classQuery}`),
        fetch(`/api/teacher/research/difficult-skills?grade=${selectedGrade}&${classQuery}`),
        fetch(`/api/teacher/research/mistakes?${classQuery}`),
        fetch(`/api/teacher/research/interventions?${classQuery}`),
        fetch(`/api/teacher/research/time-series?${classQuery}`),
      ]);

      if (profRes && profRes.ok) {
        const j = await profRes.json();
        setProfile(j.data);
      } else {
        setProfile(null);
      }
      if (compRes.ok) {
        const j = await compRes.json();
        setComparison(j.data);
      }
      if (diffRes.ok) {
        const j = await diffRes.json();
        setDifficultSkills(j.data || []);
      }
      if (mistRes.ok) {
        const j = await mistRes.json();
        setMistakes(j.data || []);
      }
      if (intRes.ok) {
        const j = await intRes.json();
        setInterventions(j.data || []);
      }
      if (tsRes.ok) {
        const j = await tsRes.json();
        setTimeSeries(j.data || []);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load research analytics";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetch("/api/teacher/classes")
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((j) => setClasses((j.data || []).map((c: any) => ({ id: c.id, name: c.name }))))
      .catch(() => setClasses([]));
  }, []);

  // The student list follows the class filter (all of my students when no class is chosen).
  useEffect(() => {
    const url = selectedClassroomId ? `/api/teacher/classes/${selectedClassroomId}` : "/api/teacher/students?limit=100";
    fetch(url)
      .then((r) => (r.ok ? r.json() : { data: {} }))
      .then((j) => {
        const list = selectedClassroomId ? j.data?.students : j.data?.students;
        setStudents((list || []).map((st: any) => ({ id: st.id, name: st.name })));
      })
      .catch(() => setStudents([]));
    setSelectedStudentId("");
  }, [selectedClassroomId]);

  useEffect(() => {
    loadResearchData();
  }, [selectedStudentId, selectedClassroomId, selectedGrade]);

  const handleExportCsv = (endpoint: string, filename: string) => {
    window.open(endpoint, "_blank");
  };

  const getLevelTextClass = (level: string) => {
    switch (level) {
      case "HIGH":
      case "PROFICIENT":
        return "text-emerald-700 font-bold";
      case "DEVELOPING":
        return "text-amber-700 font-bold";
      case "LOW":
        return "text-rose-700 font-bold";
      default:
        return "text-slate-500 font-medium";
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <TeacherNav currentTab="research" onNavigate={handleNav} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Header with Title and CSV Exports */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200/90 shadow-xs">
          <div>
            <div className="flex items-center gap-2 text-xs">
              <span className="font-bold uppercase tracking-wider text-indigo-700">
                Research Analytics
              </span>
              <span aria-hidden="true" className="text-slate-300">·</span>
              <span className="font-medium text-slate-500">
                Version: RESEARCH_V1
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 mt-1">
              Assessment & Research Analytics
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Empirical evidence, multi-dimensional learning metrics, pre/post comparisons, and standardized data exports
            </p>
          </div>

          {/* Export Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExportCsv(`/api/teacher/research/export/metrics.csv?${classQuery}`, "metrics.csv")}
              className="gap-1.5 text-xs text-slate-700 border-slate-300"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Metrics CSV</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExportCsv(`/api/teacher/research/export/comparison.csv?${classQuery}`, "comparison.csv")}
              className="gap-1.5 text-xs text-slate-700 border-slate-300"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Pre/Post CSV</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExportCsv(`/api/teacher/research/export/attempts.csv?${classQuery}`, "attempts.csv")}
              className="gap-1.5 text-xs text-indigo-700 border-indigo-200 hover:bg-indigo-50"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Raw Attempts CSV</span>
            </Button>
          </div>
        </div>

        {/* Global Filter Bar */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-2xs flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
              Research Filters:
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div>
              <label className="text-[11px] font-semibold text-slate-500 mr-2">Class:</label>
              <select
                value={selectedClassroomId}
                onChange={(e) => setSelectedClassroomId(e.target.value)}
                className="text-xs font-semibold py-1.5 px-3 rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">All my students</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-500 mr-2">Grade:</label>
              <select
                value={selectedGrade}
                onChange={(e) => setSelectedGrade(Number(e.target.value))}
                className="text-xs font-semibold py-1.5 px-3 rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value={7}>Grade 7</option>
                <option value={8}>Grade 8</option>
                <option value={9}>Grade 9</option>
                <option value={10}>Grade 10</option>
              </select>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-500 mr-2">Student Dossier:</label>
              <select
                value={selectedStudentId}
                onChange={(e) => setSelectedStudentId(e.target.value)}
                className="text-xs font-semibold py-1.5 px-3 rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Choose a student...</option>
                {students.map((st) => (
                  <option key={st.id} value={st.id}>{st.name}</option>
                ))}
              </select>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={loadResearchData}
              disabled={loading}
              className="p-1.5 text-slate-500 hover:text-slate-900"
              aria-label="Refresh analytics data"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>

        {error && (
          <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-xs text-red-800 flex items-center justify-between">
            <span>{error}</span>
            <Button size="sm" variant="outline" onClick={loadResearchData}>
              Retry
            </Button>
          </div>
        )}

        {/* SECTION 1: RESEARCH METRICS (UNDERSTANDING, ACCURACY, APPLICATION, CONSISTENCY) */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
                <Brain className="w-5 h-5 text-indigo-600" />
                <span>Primary Research Metrics (Empirical Evidence)</span>
              </h2>
              <p className="text-xs text-slate-500">
                Deterministic calculations based on actual student question attempts, checkpoints, and longitudinal stability
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Accuracy */}
            <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Accuracy
                  </span>
                  <span className={`text-xs ${getLevelTextClass(profile?.metrics.accuracy.level || "INSUFFICIENT_EVIDENCE")}`}>
                    {profile?.metrics.accuracy.level || "..."}
                  </span>
                </div>
                <div className="text-2xl sm:text-3xl font-black text-slate-900">
                  {profile ? `${(profile.metrics.accuracy.value * 100).toFixed(1)}%` : "--%"}
                </div>
                <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">
                  {profile?.metrics.accuracy.summary || "Evaluating valid attempts..."}
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-400">
                Evidence: {profile?.metrics.accuracy.evidenceCount || 0} valid attempts
              </div>
            </div>

            {/* Understanding */}
            <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Understanding
                  </span>
                  <span className={`text-xs ${getLevelTextClass(profile?.metrics.understanding.level || "INSUFFICIENT_EVIDENCE")}`}>
                    {profile?.metrics.understanding.level || "..."}
                  </span>
                </div>
                <div className="text-2xl sm:text-3xl font-black text-slate-900">
                  {profile ? `${(profile.metrics.understanding.value * 100).toFixed(1)}%` : "--%"}
                </div>
                <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">
                  {profile?.metrics.understanding.summary || "Synthesizing non-hint attempts & checkpoints..."}
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-400">
                Evidence: {profile?.metrics.understanding.evidence.hintFreeAttempts || 0} hint-free attempts
              </div>
            </div>

            {/* Application */}
            <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Application
                  </span>
                  <span className={`text-xs ${getLevelTextClass(profile?.metrics.application.level || "INSUFFICIENT_EVIDENCE")}`}>
                    {profile?.metrics.application.level || "..."}
                  </span>
                </div>
                <div className="text-2xl sm:text-3xl font-black text-slate-900">
                  {profile ? `${(profile.metrics.application.value * 100).toFixed(1)}%` : "--%"}
                </div>
                <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">
                  {profile?.metrics.application.summary || "Evaluating transfer questions..."}
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-400">
                Evidence: {profile?.metrics.application.evidenceCount || 0} transfer items
              </div>
            </div>

            {/* Consistency */}
            <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Consistency
                  </span>
                  <span className={`text-xs ${getLevelTextClass(profile?.metrics.consistency.level || "INSUFFICIENT_EVIDENCE")}`}>
                    {profile?.metrics.consistency.level || "..."}
                  </span>
                </div>
                <div className="text-2xl sm:text-3xl font-black text-slate-900">
                  {profile ? `${(profile.metrics.consistency.value * 100).toFixed(1)}%` : "--%"}
                </div>
                <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">
                  {profile?.metrics.consistency.summary || "Evaluating variance & streaks..."}
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-400">
                Streak: {profile?.metrics.consistency.evidence.streakStability || 0} consecutive
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 2: PRE-TEST / POST-TEST COMPARATIVE OBSERVATIONS */}
        <section className="bg-white rounded-3xl border border-slate-200/90 p-6 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
                <Target className="w-5 h-5 text-teal-600" />
                <span>Pre-Test / Post-Test Comparative Analytics</span>
              </h2>
              <p className="text-xs text-slate-500">
                Non-causal empirical comparison preserving separate diagnostic baseline and summative records
              </p>
            </div>
            <div className="text-xs text-slate-500">
              Cohort: <span className="font-semibold text-slate-800">{comparison?.classroomName || (selectedClassroomId ? "" : "All my students")}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
            {/* Pre-Test Box */}
            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Baseline (Pre-Test)
              </span>
              <h3 className="text-sm font-bold text-slate-800 mt-1">
                {comparison?.preTest.title || "Pre-Test"}
              </h3>
              <div className="text-3xl font-black text-slate-900 mt-2">
                {comparison?.preTest.averageScorePercent != null ? `${comparison.preTest.averageScorePercent.toFixed(1)}%` : "No data"}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Completed by {comparison?.preTest.totalStudents ?? 0} student(s)
              </p>
            </div>

            {/* Observed Difference Callout */}
            <div className="p-6 rounded-2xl bg-teal-50 border border-teal-200 text-center flex flex-col items-center justify-center">
              <span className="text-[11px] font-bold uppercase tracking-wider text-teal-700">
                Observed Pre-to-Post Difference
              </span>
              <div className="text-3xl sm:text-4xl font-black text-teal-900 mt-1">
                {comparison?.comparison.scoreDifferencePoints == null
                  ? "No data yet"
                  : comparison.comparison.scoreDifferencePoints > 0
                  ? `+${comparison.comparison.scoreDifferencePoints.toFixed(1)} pts`
                  : `${comparison.comparison.scoreDifferencePoints.toFixed(1)} pts`}
              </div>
              <p className="text-[11px] text-teal-800 mt-1 max-w-xs">
                {comparison?.comparison.description || "Comparing cohort baseline..."}
              </p>
              <span className="text-[10px] text-teal-600 font-semibold mt-2">
                {comparison?.comparison.relativeGrowthPercent != null && (
                  <>Relative change: {comparison.comparison.relativeGrowthPercent > 0 ? "+" : ""}{comparison.comparison.relativeGrowthPercent.toFixed(1)}%</>
                )}
              </span>
            </div>

            {/* Post-Test Box */}
            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Summative (Post-Test)
              </span>
              <h3 className="text-sm font-bold text-slate-800 mt-1">
                {comparison?.postTest.title || "Post-Test"}
              </h3>
              <div className="text-3xl font-black text-slate-900 mt-2">
                {comparison?.postTest.averageScorePercent != null ? `${comparison.postTest.averageScorePercent.toFixed(1)}%` : "No data"}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Completed by {comparison?.postTest.totalStudents ?? 0} student(s)
              </p>
            </div>
          </div>

          {/* Skill Breakdown Table */}
          {comparison?.skillBreakdown && comparison.skillBreakdown.length > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-100">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                Skill-Level Observed Progress
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-400 uppercase text-[10px]">
                      <th className="py-2 px-3">Curriculum Skill</th>
                      <th className="py-2 px-3">Pre-Test Accuracy</th>
                      <th className="py-2 px-3">Post-Test Accuracy</th>
                      <th className="py-2 px-3">Observed Change</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {comparison.skillBreakdown.map((s) => (
                      <tr key={s.skillId} className="hover:bg-slate-50/80">
                        <td className="py-2.5 px-3 font-semibold text-slate-900">{s.skillTitle}</td>
                        <td className="py-2.5 px-3">{s.preAccuracy}%</td>
                        <td className="py-2.5 px-3">{s.postAccuracy}%</td>
                        <td className={`py-2.5 px-3 font-bold ${s.pointChange > 0 ? "text-emerald-600" : s.pointChange < 0 ? "text-rose-600" : "text-slate-500"}`}>
                          {s.pointChange > 0 ? `+${s.pointChange}` : s.pointChange} pts
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>

        {/* SECTION 3: DIFFICULT SKILLS & MISTAKE TAXONOMY */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Difficult Skills */}
          <div className="bg-white rounded-3xl border border-slate-200/90 p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  <span>Difficult Skills Analysis</span>
                </h3>
                <p className="text-[11px] text-slate-500">
                  Empirical flags based on cohort accuracy (&lt;65%) and high hint dependence
                </p>
              </div>
              <span className="text-[11px] font-bold text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
                {difficultSkills.length} Flagged
              </span>
            </div>

            {difficultSkills.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">
                No skills currently flag as difficult under empirical thresholds.
              </p>
            ) : (
              <div className="space-y-3">
                {difficultSkills.map((sk) => (
                  <div key={sk.skillId} className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          {sk.skillCode || "DEPED-MATATAG"}
                        </span>
                        <h4 className="text-xs font-bold text-slate-900">{sk.skillTitle}</h4>
                      </div>
                      <span className="text-xs font-black text-rose-600 shrink-0">
                        {(sk.accuracy * 100).toFixed(0)}% Acc
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-600 bg-white p-2 rounded-xl border border-slate-100">
                      <strong>Flag reason:</strong> {sk.flagReason}
                    </p>

                    <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-500 pt-1">
                      <span>Hint rate: {(sk.hintDependenceRate * 100).toFixed(0)}%</span>
                      <span>•</span>
                      <span>Evidence: {sk.evidenceCount} attempts</span>
                      <span>•</span>
                      <span>Primary error: {sk.primaryMisconceptions[0]?.category || "None"}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Mistake Taxonomy */}
          <div className="bg-white rounded-3xl border border-slate-200/90 p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
                  <Brain className="w-4 h-4 text-purple-600" />
                  <span>Mistake Taxonomy & Patterns</span>
                </h3>
                <p className="text-[11px] text-slate-500">
                  Aggregated categories from student error analyses across formative sessions
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {mistakes.map((m) => (
                <div key={m.category} className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800">{m.category}</span>
                    <span className="text-xs font-black text-slate-900">
                      {m.count} errors ({m.percentage}%)
                    </span>
                  </div>
                  <p className="text-[11px] text-purple-900 bg-purple-50/80 p-2 rounded-xl border border-purple-100">
                    💡 <strong>Pedagogical action:</strong> {m.recommendedPedagogicalAction}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* SECTION 4: INTERVENTION OBSERVATIONS & LONGITUDINAL PROGRESSION */}
        <section className="bg-white rounded-3xl border border-slate-200/90 p-6 shadow-xs space-y-5">
          <div className="pb-3 border-b border-slate-100">
            <h2 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-500" />
              <span>Intervention Observations (Strictly Non-Causal Analytics)</span>
            </h2>
            <p className="text-xs text-slate-500">
              Tracks empirical performance before and after pedagogical interventions without unsupported causal attribution
            </p>
          </div>

          <div className="space-y-3">
            {interventions.map((intv, idx) => (
              <div key={idx} className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800">
                      {intv.interventionType}
                    </span>
                    <span aria-hidden="true" className="text-slate-300">·</span>
                    <span className="text-xs font-bold text-slate-900">
                      {intv.studentName} — {intv.skillTitle}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400">
                    {new Date(intv.timestamp).toLocaleDateString()}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1">
                  <div className="bg-white p-3 rounded-xl border border-slate-100">
                    <span className="text-[10px] font-bold uppercase text-slate-400 block mb-0.5">
                      Prior Evidence:
                    </span>
                    <p className="text-slate-700">{intv.beforeEvidence.description}</p>
                    <span className="text-[11px] font-bold text-slate-900 mt-1 block">
                      Prior Accuracy: {(intv.beforeEvidence.accuracy * 100).toFixed(0)}%
                    </span>
                  </div>

                  <div className="bg-white p-3 rounded-xl border border-slate-100">
                    <span className="text-[10px] font-bold uppercase text-slate-400 block mb-0.5">
                      Subsequent Evidence:
                    </span>
                    <p className="text-slate-700">{intv.afterEvidence.description}</p>
                    <span className="text-[11px] font-bold text-emerald-600 mt-1 block">
                      Subsequent Accuracy: {(intv.afterEvidence.accuracy * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>

                <p className="text-[11px] text-slate-600 bg-white/70 p-2 rounded-xl border border-slate-200/60 font-medium">
                  <strong>Observed Change:</strong> {intv.observedChange.observationStatement}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* SECTION 5: LONGITUDINAL TIME SERIES PROGRESSION */}
        <section className="bg-white rounded-3xl border border-slate-200/90 p-6 shadow-xs space-y-4">
          <div className="pb-3 border-b border-slate-100">
            <h2 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-indigo-600" />
              <span>Longitudinal Time Series Progression</span>
            </h2>
            <p className="text-xs text-slate-500">
              Tracks changes in accuracy, understanding, application, and consistency across recorded dates
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400 uppercase text-[10px]">
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Accuracy</th>
                  <th className="py-2.5 px-3">Understanding</th>
                  <th className="py-2.5 px-3">Application</th>
                  <th className="py-2.5 px-3">Consistency</th>
                  <th className="py-2.5 px-3">Attempts Count</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {timeSeries.map((t) => (
                  <tr key={t.date} className="hover:bg-slate-50/80">
                    <td className="py-2.5 px-3 font-semibold text-slate-900">{t.date}</td>
                    <td className="py-2.5 px-3 font-bold text-slate-800">
                      {(t.accuracy * 100).toFixed(0)}%
                    </td>
                    <td className="py-2.5 px-3 font-bold text-indigo-700">
                      {t.understanding == null ? "—" : `${(t.understanding * 100).toFixed(0)}%`}
                    </td>
                    <td className="py-2.5 px-3 font-bold text-purple-700">
                      {t.application == null ? "—" : `${(t.application * 100).toFixed(0)}%`}
                    </td>
                    <td className="py-2.5 px-3 font-bold text-emerald-700">
                      {t.consistency == null ? "—" : `${(t.consistency * 100).toFixed(0)}%`}
                    </td>
                    <td className="py-2.5 px-3 text-slate-400">{t.attemptCount} items</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
