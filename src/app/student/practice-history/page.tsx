import React, { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth/auth-context";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
  Calendar,
  Award,
  CheckCircle2,
  Clock,
  ArrowRight,
  Target,
  ArrowLeft,
  ChevronRight,
  BookOpen,
} from "lucide-react";

export interface StudentPracticeHistoryPageProps {
  onNavigate?: (path: string) => void;
}

export default function StudentPracticeHistoryPage({
  onNavigate,
}: StudentPracticeHistoryPageProps) {
  const { user } = useAuth();
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const handleNav = (path: string) => {
    if (onNavigate) onNavigate(path);
    else window.location.pathname = path;
  };

  useEffect(() => {
    async function loadHistory() {
      try {
        const res = await fetch("/api/student/practice-history");
        if (res.ok) {
          const json = await res.json();
          setHistory(json.data || []);
        }
      } catch (e) {
        console.error("Failed to load practice history", e);
      } finally {
        setLoading(false);
      }
    }
    loadHistory();
  }, []);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-6">
      {/* Top Navigation */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => handleNav("/student")}
          className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Student Dashboard</span>
        </button>

        <Button
          variant="outline"
          size="sm"
          onClick={() => handleNav("/student/learning-path")}
          className="text-xs gap-1.5"
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>Learning Path</span>
        </Button>
      </div>

      {/* Page Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          Practice Attempt History
        </h1>
        <p className="text-xs sm:text-sm text-slate-600 mt-1">
          Review all completed practice sets, accuracy metrics, and question breakdowns.
        </p>
      </div>

      {loading ? (
        <div className="py-20 text-center text-xs text-slate-400">
          Loading your practice records...
        </div>
      ) : history.length === 0 ? (
        <Card className="text-center py-12 px-4 border-dashed">
          <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center mx-auto mb-3">
            <Target className="w-6 h-6" />
          </div>
          <h2 className="text-base font-bold text-slate-900 mb-1">
            No Practice Sessions Yet
          </h2>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mb-5">
            Complete your lesson sections and launch targeted practice exercises to build your track record.
          </p>
          <Button variant="primary" onClick={() => handleNav("/student/learning-path")}>
            <span>Explore Learning Path</span>
          </Button>
        </Card>
      ) : (
        <div className="space-y-3">
          {history.map((sess) => {
            const dateStr = new Date(sess.completedAt || sess.startedAt).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            });
            const isCompleted = sess.status === "COMPLETED";

            return (
              <div
                key={sess.id}
                className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-slate-300 transition-colors"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm sm:text-base font-bold text-slate-900">
                      {sess.practiceSet?.title || "Practice Activity"}
                    </h2>
                    <Badge
                      variant="outline"
                      className={`text-[10px] font-semibold ${
                        isCompleted
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : "bg-amber-50 text-amber-700 border-amber-200"
                      }`}
                    >
                      {sess.status}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      {dateStr}
                    </span>
                    <span>•</span>
                    <span>{sess.totalQuestions} Questions</span>
                    <span>•</span>
                    <span className="text-emerald-600 font-medium">
                      {sess.correctAnswers} / {sess.totalQuestions} Correct
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3 self-end sm:self-center">
                  <div className="text-right">
                    <span className="text-lg sm:text-xl font-extrabold text-slate-900 block leading-tight">
                      {sess.score}%
                    </span>
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">
                      Score
                    </span>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleNav(`/student/practice/${sess.practiceSetId}`)}
                    className="text-xs"
                  >
                    <span>{isCompleted ? "Review" : "Resume"}</span>
                    <ChevronRight className="w-3.5 h-3.5 ml-1" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
