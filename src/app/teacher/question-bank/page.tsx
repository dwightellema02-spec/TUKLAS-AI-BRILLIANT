import React, { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth/auth-context";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { MathText } from "@/components/ui/MathText";
import { QuestionType, QuestionDifficulty, QuestionStatus } from "@prisma/client";
import {
  Search,
  Plus,
  Filter,
  Eye,
  Edit,
  Trash2,
  CheckCircle,
  HelpCircle,
  ArrowLeft,
  Layers,
  Sparkles,
  BookOpen,
} from "lucide-react";

export interface TeacherQuestionBankPageProps {
  onNavigate?: (path: string) => void;
}

export default function TeacherQuestionBankPage({
  onNavigate,
}: TeacherQuestionBankPageProps) {
  const { user } = useAuth();
  const [questions, setQuestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [difficultyFilter, setDifficultyFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [noSkillOnly, setNoSkillOnly] = useState(false);

  const handleNav = (path: string) => {
    if (onNavigate) onNavigate(path);
    else window.location.pathname = path;
  };

  const loadQuestions = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append("search", search);
      if (typeFilter !== "ALL") params.append("type", typeFilter);
      if (difficultyFilter !== "ALL") params.append("difficulty", difficultyFilter);
      if (statusFilter !== "ALL") params.append("status", statusFilter);
      if (noSkillOnly) params.append("noSkill", "true");

      const res = await fetch(`/api/questions?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        setQuestions(json.data || []);
      }
    } catch (e) {
      console.error("Error loading questions", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQuestions();
  }, [typeFilter, difficultyFilter, statusFilter, noSkillOnly]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadQuestions();
  };

  const handleStatusChange = async (id: string, newStatus: QuestionStatus) => {
    try {
      const res = await fetch(`/api/questions/${id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        loadQuestions();
      }
    } catch (e) {
      console.error("Failed to update status", e);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <button
            type="button"
            onClick={() => handleNav("/teacher")}
            className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 mb-2 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Teacher Dashboard</span>
          </button>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Question Bank
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
            Manage, author, review, and assign curriculum-linked practice questions.
          </p>
        </div>

        <Button
          variant="primary"
          onClick={() => handleNav("/teacher/questions/new")}
          className="gap-2 shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Create Question</span>
        </Button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs space-y-3">
        <form onSubmit={handleSearchSubmit} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Search by prompt or explanation..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
          <Button variant="outline" type="submit" size="sm">
            Search
          </Button>
        </form>

        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 text-xs">
          <div className="flex items-center gap-1.5 text-slate-500 font-semibold mr-1">
            <Filter className="w-3.5 h-3.5" />
            <span>Filters:</span>
          </div>

          {/* Type Filter */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 text-xs focus:outline-none focus:ring-1 focus:ring-teal-500"
          >
            <option value="ALL">All Types</option>
            <option value="MULTIPLE_CHOICE">Multiple Choice</option>
            <option value="NUMERIC_INPUT">Numeric Input</option>
            <option value="TEXT_INPUT">Text Input</option>
            <option value="TRUE_FALSE">True / False</option>
            <option value="EQUATION">Equation</option>
            <option value="MATCHING">Matching</option>
            <option value="ORDERING">Ordering</option>
          </select>

          {/* Difficulty Filter */}
          <select
            value={difficultyFilter}
            onChange={(e) => setDifficultyFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 text-xs focus:outline-none focus:ring-1 focus:ring-teal-500"
          >
            <option value="ALL">All Difficulties</option>
            <option value="EASY">Easy</option>
            <option value="MEDIUM">Medium</option>
            <option value="HARD">Hard</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 text-xs focus:outline-none focus:ring-1 focus:ring-teal-500"
          >
            <option value="ALL">All Statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="REVIEW">Under Review</option>
            <option value="APPROVED">Approved</option>
            <option value="PUBLISHED">Published</option>
            <option value="ARCHIVED">Archived</option>
          </select>

          <label className="inline-flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
            <input type="checkbox" data-testid="no-skill-filter" checked={noSkillOnly} onChange={(e) => setNoSkillOnly(e.target.checked)} />
            Only questions without a skill
          </label>

          <span className="ml-auto text-xs text-slate-500">
            {questions.length} Question{questions.length === 1 ? "" : "s"}
          </span>
        </div>
      </div>

      {/* Question Table / List */}
      {loading ? (
        <div className="py-20 text-center text-xs text-slate-400">
          Loading questions...
        </div>
      ) : questions.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center space-y-3">
          <HelpCircle className="w-10 h-10 text-slate-300 mx-auto" />
          <h2 className="text-base font-bold text-slate-700">No questions found</h2>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Try adjusting your search filters or author a new question to populate the question bank.
          </p>
          <Button variant="primary" size="sm" onClick={() => handleNav("/teacher/questions/new")}>
            <Plus className="w-3.5 h-3.5 mr-1" />
            <span>Create First Question</span>
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {questions.map((q) => {
            const isPublished = q.status === "PUBLISHED";

            return (
              <div
                key={q.id}
                className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-2xs hover:border-slate-300 transition-colors space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="text-[10px] font-bold">
                      {q.type}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={`text-[10px] font-semibold ${
                        q.difficulty === "HARD"
                          ? "bg-red-50 text-red-700 border-red-200"
                          : q.difficulty === "MEDIUM"
                          ? "bg-amber-50 text-amber-700 border-amber-200"
                          : "bg-emerald-50 text-emerald-700 border-emerald-200"
                      }`}
                    >
                      {q.difficulty}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={`text-[10px] font-semibold ${
                        isPublished
                          ? "bg-teal-50 text-teal-800 border-teal-200"
                          : q.status === "APPROVED"
                          ? "bg-blue-50 text-blue-700 border-blue-200"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {q.status}
                    </Badge>

                    {q.skill ? (
                      <span className="text-[11px] text-slate-500 font-medium">
                        Skill: {q.skill.title}
                      </span>
                    ) : (
                      <span data-testid="no-skill-badge" title="Answers to this question cannot count towards mastery or recommendations" className="text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
                        No skill
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center">
                    {/* Status Quick Changer */}
                    <select
                      value={q.status}
                      onChange={(e) => handleStatusChange(q.id, e.target.value as QuestionStatus)}
                      className="px-2 py-1 rounded border border-slate-200 text-xs bg-slate-50 text-slate-700 focus:outline-none"
                    >
                      <option value="DRAFT">Draft</option>
                      <option value="REVIEW">Review</option>
                      <option value="APPROVED">Approved</option>
                      <option value="PUBLISHED">Published</option>
                      <option value="ARCHIVED">Archived</option>
                    </select>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleNav(`/teacher/questions/${q.id}/preview`)}
                      className="text-xs gap-1"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Preview</span>
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleNav(`/teacher/questions/${q.id}/edit`)}
                      className="text-xs gap-1"
                    >
                      <Edit className="w-3.5 h-3.5" />
                      <span>Edit</span>
                    </Button>
                  </div>
                </div>

                <div className="text-sm font-medium text-slate-900 leading-relaxed">
                  <MathText content={q.prompt} />
                </div>

                {q.explanation && (
                  <div className="text-xs text-slate-500 border-t border-slate-100 pt-2 line-clamp-2">
                    <span className="font-semibold text-slate-600">Explanation: </span>
                    <MathText content={q.explanation} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
