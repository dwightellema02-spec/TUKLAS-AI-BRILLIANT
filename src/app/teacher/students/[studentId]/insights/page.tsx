import React, { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth/auth-context";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { MathText } from "@/components/ui/MathText";
import {
  ArrowLeft,
  Sparkles,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertCircle,
  Clock,
  Layers,
  HelpCircle,
  Eye,
  X,
  FileCheck,
  ChevronRight,
  TrendingDown,
  TrendingUp,
  Compass,
  ShieldAlert,
  RotateCcw,
  Award,
  BarChart3,
} from "lucide-react";
import type { MistakeAnalysisDTO, MistakeCategoryType } from "@/lib/ai/types";
import { TeacherAdaptiveOverrideModal } from "@/components/adaptive/TeacherAdaptiveOverrideModal";
import { MasteryBadge } from "@/components/mastery/MasteryBadge";
import { MasteryDetailModal } from "@/components/mastery/MasteryDetailModal";
import type { AdaptiveRecommendationDTO } from "@/lib/adaptive/adaptive-types";
import type { SkillMasteryDTO } from "@/lib/mastery/mastery-types";

export interface TeacherStudentInsightsPageProps {
  studentId: string;
  onNavigate?: (path: string) => void;
}

export default function TeacherStudentInsightsPage({
  studentId,
  onNavigate,
}: TeacherStudentInsightsPageProps) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"MASTERY" | "ADAPTIVE" | "MISTAKES">("MASTERY");
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [insights, setInsights] = useState<MistakeAnalysisDTO[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [activeEvidenceModal, setActiveEvidenceModal] = useState<MistakeAnalysisDTO | null>(null);

  // Phase 10 Mastery state
  const [masteries, setMasteries] = useState<SkillMasteryDTO[]>([]);
  const [loadingMastery, setLoadingMastery] = useState(false);
  const [selectedMasteryForAudit, setSelectedMasteryForAudit] = useState<SkillMasteryDTO | null>(null);

  // Phase 9 Adaptive state
  const [adaptiveHistory, setAdaptiveHistory] = useState<AdaptiveRecommendationDTO[]>([]);
  const [loadingAdaptive, setLoadingAdaptive] = useState(false);
  const [overrideModalOpen, setOverrideModalOpen] = useState(false);
  const [selectedRecForOverride, setSelectedRecForOverride] = useState<AdaptiveRecommendationDTO | null>(null);
  const [recalculatingAdaptive, setRecalculatingAdaptive] = useState(false);

  const handleNav = (path: string) => {
    if (onNavigate) onNavigate(path);
    else window.location.pathname = path;
  };

  const loadInsights = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem("tuklas_token");
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`/api/teacher/students/${studentId}/insights`, { headers });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load student insights.");
      setInsights(json.data || []);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Error loading insights";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const loadAdaptive = async () => {
    setLoadingAdaptive(true);
    try {
      const token = localStorage.getItem("tuklas_token");
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`/api/teacher/students/${studentId}/adaptive/recommendations`, { headers });
      const json = await res.json();
      if (res.ok) {
        setAdaptiveHistory(json.data || []);
      }
    } catch (e) {
      console.warn("Failed to load student adaptive history:", e);
    } finally {
      setLoadingAdaptive(false);
    }
  };

  const loadMasteries = async () => {
    setLoadingMastery(true);
    try {
      const token = localStorage.getItem("tuklas_token");
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`/api/teacher/students/${studentId}/mastery`, { headers });
      const json = await res.json();
      if (res.ok) {
        setMasteries(json.data || []);
      }
    } catch (e) {
      console.warn("Failed to load student masteries:", e);
    } finally {
      setLoadingMastery(false);
    }
  };

  useEffect(() => {
    loadInsights();
    loadAdaptive();
    loadMasteries();
  }, [studentId]);

  const handleRecalculateAdaptive = async () => {
    setRecalculatingAdaptive(true);
    setError(null);
    try {
      const token = localStorage.getItem("tuklas_token");
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`/api/teacher/students/${studentId}/adaptive/recommendation`, {
        method: "POST",
        headers,
        body: JSON.stringify({}),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to recalculate recommendation.");
      await loadAdaptive();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Recalculation failed");
    } finally {
      setRecalculatingAdaptive(false);
    }
  };

  const handleTriggerAnalysis = async () => {
    setAnalyzing(true);
    setError(null);
    try {
      const token = localStorage.getItem("tuklas_token");
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`/api/teacher/students/${studentId}/analyze`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          skillId: "skl_02", // Default to Comparing Integers or student's active skill
          maxAttempts: 10,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to generate analysis.");
      await loadInsights();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Analysis failed";
      setError(msg);
    } finally {
      setAnalyzing(false);
    }
  };

  const getCategoryColor = (cat: MistakeCategoryType) => {
    switch (cat) {
      case "CONCEPTUAL_MISUNDERSTANDING":
        return "bg-purple-50 text-purple-800 border-purple-200";
      case "SIGN_ERROR":
        return "bg-amber-50 text-amber-800 border-amber-200";
      case "CALCULATION_ERROR":
        return "bg-blue-50 text-blue-800 border-blue-200";
      case "PREREQUISITE_GAP":
        return "bg-red-50 text-red-800 border-red-200";
      case "APPLICATION_DIFFICULTY":
        return "bg-teal-50 text-teal-800 border-teal-200";
      case "POSSIBLE_CARELESS_ERROR":
        return "bg-emerald-50 text-emerald-800 border-emerald-200";
      default:
        return "bg-slate-100 text-slate-700 border-slate-200";
    }
  };

  const filteredInsights = insights.filter((item) => {
    if (selectedCategory === "ALL") return true;
    return item.category === selectedCategory;
  });

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4 sm:px-6">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <button
              onClick={() => handleNav("/teacher")}
              className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-200 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-slate-900">Student Learning Insights</h1>
                <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs">
                  AI Mistake Analyzer
                </Badge>
              </div>
              <p className="text-xs text-slate-500">
                Evidence-based pattern identification for Student ID: <span className="font-mono">{studentId}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={loadInsights}
              disabled={loading}
              className="text-xs gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              <span>Refresh</span>
            </Button>

            <Button
              variant="primary"
              size="sm"
              onClick={handleTriggerAnalysis}
              disabled={analyzing}
              className="text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{analyzing ? "Analyzing Patterns..." : "Analyze Learning Pattern"}</span>
            </Button>
          </div>
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-900 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Phase 10 & 9 Navigation Tabs */}
        <div className="flex border-b border-slate-200 gap-6 text-xs font-bold">
          <button
            type="button"
            onClick={() => setActiveTab("MASTERY")}
            className={`pb-3 px-1 border-b-2 flex items-center gap-2 transition-colors cursor-pointer ${
              activeTab === "MASTERY"
                ? "border-emerald-600 text-emerald-700"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Award className="w-4 h-4" />
            <span>Competency Mastery Matrix</span>
            {masteries.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px]">
                {masteries.length} Skills
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("ADAPTIVE")}
            className={`pb-3 px-1 border-b-2 flex items-center gap-2 transition-colors cursor-pointer ${
              activeTab === "ADAPTIVE"
                ? "border-teal-600 text-teal-700"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Compass className="w-4 h-4" />
            <span>Adaptive Next Steps & Overrides</span>
            {adaptiveHistory.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-teal-100 text-teal-800 text-[10px]">
                {adaptiveHistory.filter((r) => r.status === "ACTIVE").length} Active
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("MISTAKES")}
            className={`pb-3 px-1 border-b-2 flex items-center gap-2 transition-colors cursor-pointer ${
              activeTab === "MISTAKES"
                ? "border-emerald-600 text-emerald-700"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>Mistake Patterns & Evidence</span>
            {insights.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px]">
                {insights.length}
              </span>
            )}
          </button>
        </div>

        {/* TAB 0: COMPETENCY MASTERY MATRIX */}
        {activeTab === "MASTERY" && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900">Student Competency Mastery Matrix</h2>
                <p className="text-xs text-slate-500">
                  Deterministic, multi-dimensional mastery states evaluated from attempts, consistency, difficulty, and mistake history.
                </p>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={loadMasteries}
                disabled={loadingMastery}
                className="text-xs gap-1.5 cursor-pointer"
              >
                <RotateCcw className={`w-3.5 h-3.5 ${loadingMastery ? "animate-spin" : ""}`} />
                <span>{loadingMastery ? "Refreshing..." : "Refresh Mastery Matrix"}</span>
              </Button>
            </div>

            {masteries.length === 0 ? (
              <div className="p-8 text-center bg-white rounded-2xl border border-dashed border-slate-300 space-y-2">
                <Award className="w-8 h-8 text-slate-400 mx-auto" />
                <p className="text-sm font-semibold text-slate-700">No mastery records evaluated yet.</p>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Mastery evaluates automatically as the student attempts lesson checkpoints and practice sets.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {masteries.map((m) => (
                  <div
                    key={m.id}
                    className="p-5 rounded-2xl border border-slate-200 bg-white hover:border-slate-300 hover:shadow-xs transition-all space-y-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        {m.lessonTitle && (
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                            {m.lessonTitle}
                          </span>
                        )}
                        <h3 className="text-base font-bold text-slate-900 leading-snug">{m.skillTitle}</h3>
                      </div>
                      <MasteryBadge level={m.status} size="md" />
                    </div>

                    <div className="grid grid-cols-4 gap-2 text-center text-xs">
                      <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                        <span className="text-[10px] font-bold text-slate-400 uppercase block">Accuracy</span>
                        <span className="font-extrabold text-slate-900">{Math.round(m.accuracy * 100)}%</span>
                      </div>
                      <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                        <span className="text-[10px] font-bold text-slate-400 uppercase block">Recent</span>
                        <span className="font-extrabold text-blue-600">{Math.round(m.recentAccuracy * 100)}%</span>
                      </div>
                      <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                        <span className="text-[10px] font-bold text-slate-400 uppercase block">Consistency</span>
                        <span className="font-extrabold text-teal-700">{Math.round(m.consistencyScore * 100)}%</span>
                      </div>
                      <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                        <span className="text-[10px] font-bold text-slate-400 uppercase block">Attempts</span>
                        <span className="font-extrabold text-slate-900">{m.attemptCount}</span>
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-50 text-xs text-slate-600 space-y-1">
                      <p className="font-medium text-slate-800">{m.explanation?.summary || m.evidenceSummary}</p>
                      {m.explanation?.why && (
                        <p className="text-[11px] text-slate-500">
                          <span className="font-bold">Evidence: </span>
                          {m.explanation.why}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-xs">
                      <span className="text-[11px] text-slate-400">
                        Version: {m.masteryVersion}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedMasteryForAudit(m)}
                        className="text-xs gap-1.5 cursor-pointer"
                      >
                        <BarChart3 className="w-3.5 h-3.5" />
                        <span>Audit Evidence</span>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 1: ADAPTIVE LEARNING & OVERRIDES */}
        {activeTab === "ADAPTIVE" && (
          <div className="space-y-6">
            {/* Action Bar */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-900">Current Adaptive Trajectory</h2>
                <p className="text-xs text-slate-500">
                  Automated deterministic next-step recommendations derived from student attempt evidence.
                </p>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={handleRecalculateAdaptive}
                disabled={recalculatingAdaptive}
                className="text-xs gap-1.5"
              >
                <RotateCcw className={`w-3.5 h-3.5 ${recalculatingAdaptive ? "animate-spin" : ""}`} />
                <span>{recalculatingAdaptive ? "Recalculating..." : "Recalculate Recommendation"}</span>
              </Button>
            </div>

            {/* Active Recommendation Display */}
            {(() => {
              const activeRec = adaptiveHistory.find((r) => r.status === "ACTIVE");
              if (!activeRec) {
                return (
                  <div className="p-8 text-center bg-white rounded-2xl border border-dashed border-slate-300 space-y-3">
                    <Compass className="w-8 h-8 text-slate-400 mx-auto" />
                    <p className="text-sm font-semibold text-slate-700">No active recommendation at this time.</p>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto">
                      Click below to trigger a deterministic evaluation of this student's latest attempts and mistake reports.
                    </p>
                    <Button variant="primary" size="sm" onClick={handleRecalculateAdaptive} disabled={recalculatingAdaptive}>
                      Generate Recommendation
                    </Button>
                  </div>
                );
              }

              return (
                <div className="bg-white rounded-2xl border border-teal-200/90 p-5 sm:p-6 shadow-xs space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-teal-800">
                          Active Recommendation
                        </span>
                        <Badge variant="outline" className="text-[10px] font-bold bg-teal-50 text-teal-700 border-teal-200">
                          {activeRec.decisionType}
                        </Badge>
                        {activeRec.targetDifficulty && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                            Difficulty: {activeRec.targetDifficulty}
                          </span>
                        )}
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-mono">
                          Source: {activeRec.source}
                        </span>
                      </div>
                      <h3 className="text-base sm:text-lg font-bold text-slate-900">
                        {activeRec.skillTitle || "Active Curriculum Skill"}
                      </h3>
                    </div>

                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => {
                        setSelectedRecForOverride(activeRec);
                        setOverrideModalOpen(true);
                      }}
                      className="gap-1.5 text-xs bg-amber-600 hover:bg-amber-700 text-white shrink-0"
                    >
                      <ShieldAlert className="w-3.5 h-3.5" />
                      <span>Apply Teacher Override</span>
                    </Button>
                  </div>

                  {/* Rationale & Explanation */}
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2 text-xs">
                    <div>
                      <span className="font-bold text-slate-700 block">System Rationale:</span>
                      <p className="text-slate-800 mt-0.5">{activeRec.reason}</p>
                    </div>

                    {activeRec.explanation?.message && (
                      <div className="pt-2 border-t border-slate-200/60">
                        <span className="font-bold text-teal-800 block">Student-Facing Explanation:</span>
                        <p className="text-slate-700 italic mt-0.5">"{activeRec.explanation.message}"</p>
                      </div>
                    )}

                    <div className="pt-2 border-t border-slate-200/60 text-slate-500 font-mono text-[11px]">
                      <span className="font-bold text-slate-700 font-sans">Evidence Summary: </span>
                      {activeRec.evidenceSummary}
                    </div>
                  </div>

                  {/* Target Activity */}
                  <div className="flex items-center justify-between text-xs pt-1">
                    <div className="text-slate-600">
                      <span className="font-bold text-slate-800">Target Activity: </span>
                      <span>{activeRec.recommendedActivityTitle || activeRec.recommendedActivityType}</span>
                    </div>
                    <span className="text-slate-400">
                      Generated {new Date(activeRec.createdAt).toLocaleDateString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                </div>
              );
            })()}

            {/* Recommendation History Table */}
            <div className="space-y-3 pt-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Traceable Recommendation History ({adaptiveHistory.length})
              </h3>

              {loadingAdaptive ? (
                <div className="py-8 text-center text-xs text-slate-400">Loading adaptive history...</div>
              ) : adaptiveHistory.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-400 bg-white rounded-xl border border-slate-200">
                  No historical recommendations recorded yet.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {adaptiveHistory.map((rec) => {
                    const hasOverrides = rec.overrides && rec.overrides.length > 0;
                    return (
                      <div
                        key={rec.id}
                        className="bg-white rounded-xl border border-slate-200 p-4 text-xs space-y-2 shadow-2xs hover:border-slate-300 transition-colors"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900">{rec.skillTitle || "Skill"}</span>
                            <Badge
                              variant="outline"
                              className={`text-[10px] font-bold ${
                                rec.status === "ACTIVE"
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                  : rec.status === "COMPLETED"
                                  ? "bg-blue-50 text-blue-700 border-blue-200"
                                  : rec.status === "SUPERSEDED"
                                  ? "bg-slate-100 text-slate-500 border-slate-200"
                                  : "bg-amber-50 text-amber-700 border-amber-200"
                              }`}
                            >
                              {rec.status}
                            </Badge>
                            <span className="font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px]">
                              {rec.decisionType}
                            </span>
                          </div>

                          <span className="text-[11px] text-slate-400">
                            {new Date(rec.createdAt).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}
                          </span>
                        </div>

                        <p className="text-slate-600">{rec.reason}</p>

                        <div className="text-[11px] text-slate-500 font-mono bg-slate-50 p-2 rounded-lg border border-slate-100">
                          {rec.evidenceSummary}
                        </div>

                        {/* Audit Trail for Teacher Overrides */}
                        {hasOverrides && (
                          <div className="mt-2 p-2.5 rounded-lg bg-amber-50/70 border border-amber-200/80 text-[11px] space-y-1">
                            <span className="font-bold text-amber-900 block flex items-center gap-1">
                              <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
                              <span>Teacher Override Audit Record</span>
                            </span>
                            {rec.overrides?.map((ovr) => (
                              <div key={ovr.id} className="text-amber-800">
                                Overridden by <span className="font-semibold">{ovr.teacherName || "Teacher"}</span>:{" "}
                                <span className="font-mono font-bold">{ovr.originalDecision} → {ovr.overrideDecision}</span>
                                <p className="italic mt-0.5">"{ovr.reason}"</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: MISTAKE PATTERNS & EVIDENCE */}
        {activeTab === "MISTAKES" && (
          <div className="space-y-6">
            {/* Category Filters */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
          {[
            "ALL",
            "CONCEPTUAL_MISUNDERSTANDING",
            "SIGN_ERROR",
            "CALCULATION_ERROR",
            "PREREQUISITE_GAP",
            "APPLICATION_DIFFICULTY",
            "POSSIBLE_CARELESS_ERROR",
          ].map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`shrink-0 text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${
                selectedCategory === cat
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
              }`}
            >
              {cat === "ALL" ? "All Categories" : cat.replace(/_/g, " ")}
            </button>
          ))}
        </div>

        {/* Insights List */}
        {loading ? (
          <div className="py-16 text-center text-slate-500 text-sm">Loading learning insights...</div>
        ) : filteredInsights.length === 0 ? (
          <div className="py-16 text-center bg-white rounded-2xl border border-slate-200 p-8 space-y-3">
            <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
              <Sparkles className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-slate-800 text-base">No learning difficulties detected</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              The student has not accumulated enough recurring errors in this category, or recent practice shows strong performance.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={handleTriggerAnalysis}
              className="mt-2 text-xs"
            >
              Run On-Demand Analysis
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredInsights.map((insight) => {
              const confidencePercent = Math.round(insight.confidence * 100);

              return (
                <div
                  key={insight.id}
                  className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4 hover:border-slate-300 transition-all"
                >
                  {/* Card Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={`text-xs font-bold ${getCategoryColor(insight.category)}`}>
                        {insight.category.replace(/_/g, " ")}
                      </Badge>

                      {insight.status === "OUTDATED" && (
                        <Badge variant="outline" className="text-[10px] text-slate-400 border-slate-200">
                          Outdated
                        </Badge>
                      )}

                      <span className="text-xs font-semibold text-slate-700">
                        {insight.skillTitle || "General Practice"}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-xs">
                      <div className="flex items-center gap-1.5 font-semibold text-slate-600">
                        <span>Confidence:</span>
                        <span className="font-mono text-emerald-700 font-bold">{confidencePercent}%</span>
                      </div>
                      <span className="text-slate-300">•</span>
                      <span className="text-slate-400">
                        {new Date(insight.createdAt).toLocaleDateString([], {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  </div>

                  {/* 4 Pillars: Observation vs Pattern vs Cause vs Recommendation */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Observed Evidence */}
                    <div className="p-3.5 bg-slate-50/80 rounded-xl border border-slate-200/80 space-y-1">
                      <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 block">
                        1. Observed Evidence (Facts)
                      </span>
                      <p className="text-xs sm:text-sm text-slate-800 leading-relaxed font-medium">
                        {insight.observation}
                      </p>
                    </div>

                    {/* Identified Pattern */}
                    <div className="p-3.5 bg-amber-50/60 rounded-xl border border-amber-200/80 space-y-1">
                      <span className="text-[10px] uppercase font-bold tracking-wider text-amber-700 block">
                        2. Inferred Error Pattern
                      </span>
                      <p className="text-xs sm:text-sm text-amber-950 leading-relaxed font-medium">
                        {insight.pattern}
                      </p>
                    </div>

                    {/* Possible Cause */}
                    <div className="p-3.5 bg-purple-50/60 rounded-xl border border-purple-200/80 space-y-1">
                      <span className="text-[10px] uppercase font-bold tracking-wider text-purple-700 block">
                        3. Pedagogical Hypothesis
                      </span>
                      <p className="text-xs sm:text-sm text-purple-950 leading-relaxed">
                        {insight.possibleCause || "Emerging learning pattern."}
                      </p>
                    </div>

                    {/* Suggested Support */}
                    <div className="p-3.5 bg-emerald-50/60 rounded-xl border border-emerald-200/80 space-y-1">
                      <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-700 block">
                        4. Suggested Educational Support
                      </span>
                      <div className="text-xs sm:text-sm text-emerald-950 leading-relaxed font-medium">
                        <MathText content={insight.recommendation} />
                      </div>
                    </div>
                  </div>

                  {/* Inspect Evidence Button */}
                  <div className="pt-2 flex items-center justify-between border-t border-slate-100">
                    <span className="text-xs text-slate-500">
                      Triggered by: <span className="font-mono text-slate-700">{insight.trigger}</span> (v{insight.analyzerVersion})
                    </span>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setActiveEvidenceModal(insight)}
                      className="text-xs gap-1.5 text-slate-700 hover:text-slate-900 border-slate-200"
                    >
                      <Eye className="w-3.5 h-3.5 text-slate-500" />
                      <span>Inspect Evidence ({insight.evidences?.length || 0} Attempts)</span>
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
          </div>
        )}

        {/* Evidence Inspection Modal */}
        {activeEvidenceModal && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl border border-slate-200 w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
              {/* Modal Header */}
              <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <div>
                  <h3 className="font-bold text-slate-900 text-sm sm:text-base">
                    Underlying Attempt Evidence
                  </h3>
                  <p className="text-xs text-slate-500">
                    Category: <span className="font-bold text-slate-700">{activeEvidenceModal.category}</span> •{" "}
                    {activeEvidenceModal.evidences?.length || 0} attempts evaluated
                  </p>
                </div>
                <button
                  onClick={() => setActiveEvidenceModal(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Evidence Scroll Area */}
              <div className="p-4 sm:p-6 overflow-y-auto space-y-4">
                {activeEvidenceModal.evidences && activeEvidenceModal.evidences.length > 0 ? (
                  activeEvidenceModal.evidences.map((ev, idx) => (
                    <div
                      key={ev.attemptId || idx}
                      className="p-4 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-2.5"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-md bg-slate-100 text-slate-700 text-xs font-bold flex items-center justify-center">
                            #{idx + 1}
                          </span>
                          <Badge variant="outline" className="text-[10px]">
                            {ev.questionType}
                          </Badge>
                          <Badge variant="outline" className="text-[10px]">
                            {ev.difficulty}
                          </Badge>
                        </div>

                        <span
                          className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                            ev.isCorrect
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-red-50 text-red-700 border border-red-200"
                          }`}
                        >
                          {ev.isCorrect ? "Correct" : "Incorrect"}
                        </span>
                      </div>

                      {/* Question prompt */}
                      <div className="text-xs sm:text-sm text-slate-800 font-medium">
                        <MathText content={ev.questionPrompt} />
                      </div>

                      {/* Student answer */}
                      <div className="p-2.5 bg-slate-50 rounded-lg text-xs space-y-1">
                        <div className="flex justify-between">
                          <span className="text-slate-500 font-medium">Student Answer:</span>
                          <span className="font-mono text-slate-900 font-bold">{ev.studentAnswer}</span>
                        </div>
                        {ev.timeTakenMs && (
                          <div className="flex justify-between text-slate-400 text-[11px]">
                            <span>Time taken:</span>
                            <span>{Math.round(ev.timeTakenMs / 1000)}s</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-8 text-center text-xs text-slate-500">
                    No individual attempts linked to this historical analysis record.
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
                <Button variant="outline" size="sm" onClick={() => setActiveEvidenceModal(null)}>
                  Close Evidence Inspector
                </Button>
              </div>
            </div>
          </div>
        )}
        {/* Teacher Adaptive Override Modal */}
        {overrideModalOpen && selectedRecForOverride && (
          <TeacherAdaptiveOverrideModal
            isOpen={overrideModalOpen}
            onClose={() => {
              setOverrideModalOpen(false);
              setSelectedRecForOverride(null);
            }}
            recommendation={selectedRecForOverride}
            studentId={studentId}
            onSuccess={loadAdaptive}
          />
        )}

        {/* Teacher Mastery Evidence Audit Modal */}
        <MasteryDetailModal
          isOpen={Boolean(selectedMasteryForAudit)}
          onClose={() => setSelectedMasteryForAudit(null)}
          mastery={selectedMasteryForAudit}
          isTeacherView={true}
          onRecalculate={async (skillId) => {
            await loadMasteries();
            const refreshed = masteries.find((m) => m.skillId === skillId);
            if (refreshed) setSelectedMasteryForAudit(refreshed);
          }}
        />
      </div>
    </div>
  );
}
