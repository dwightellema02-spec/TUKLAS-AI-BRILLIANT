import React, { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth/auth-context";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { MathText } from "@/components/ui/MathText";
import { QuestionType, QuestionDifficulty, QuestionStatus } from "@prisma/client";
import {
  ArrowLeft,
  Save,
  Eye,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Layers,
  Sparkles,
} from "lucide-react";

export interface TeacherQuestionEditorPageProps {
  questionId?: string; // If undefined, creates new question
  onNavigate?: (path: string) => void;
}

export default function TeacherQuestionEditorPage({
  questionId,
  onNavigate,
}: TeacherQuestionEditorPageProps) {
  const { user } = useAuth();
  const isNew = !questionId || questionId === "new";

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Curriculum Data
  const [skills, setSkills] = useState<any[]>([]);
  const [lessons, setLessons] = useState<any[]>([]);

  // Form State
  const [type, setType] = useState<QuestionType>("MULTIPLE_CHOICE");
  const [prompt, setPrompt] = useState("");
  const [skillId, setSkillId] = useState("");
  // new questions start with no lesson: a made-up demo lesson id does not exist in a real database
  const [lessonId, setLessonId] = useState("");
  const [difficulty, setDifficulty] = useState<QuestionDifficulty>("MEDIUM");
  const [status, setStatus] = useState<QuestionStatus>("DRAFT");
  const [explanation, setExplanation] = useState("");
  const [correctFeedback, setCorrectFeedback] = useState("");
  const [incorrectFeedback, setIncorrectFeedback] = useState("");
  const [allowRetry, setAllowRetry] = useState(true);
  const [maxAttempts, setMaxAttempts] = useState(3);

  // Type-specific state
  // Multiple Choice
  const [choices, setChoices] = useState<Array<{ id: string; text: string }>>([
    { id: "opt_a", text: "First option" },
    { id: "opt_b", text: "Second option" },
    { id: "opt_c", text: "Third option" },
    { id: "opt_d", text: "Fourth option" },
  ]);
  const [correctChoiceId, setCorrectChoiceId] = useState("opt_a");

  // Numeric
  const [numericAnswer, setNumericAnswer] = useState("");
  const [numericTolerance, setNumericTolerance] = useState(0);

  // Text
  const [textAnswer, setTextAnswer] = useState("");
  const [acceptableAnswersText, setAcceptableAnswersText] = useState("");
  const [caseSensitive, setCaseSensitive] = useState(false);

  // True / False
  const [tfAnswer, setTfAnswer] = useState<boolean>(true);

  // Equation
  const [equationAnswer, setEquationAnswer] = useState("");

  // Matching
  const [matchingPairs, setMatchingPairs] = useState<Array<{ left: string; right: string }>>([
    { left: "-5", right: "5" },
    { left: "3", right: "-3" },
  ]);

  // Ordering
  const [orderingItems, setOrderingItems] = useState<string[]>([
    "-5", "-2", "0", "3"
  ]);

  const handleNav = (path: string) => {
    if (onNavigate) onNavigate(path);
    else window.location.pathname = path;
  };

  useEffect(() => {
    async function loadMeta() {
      try {
        const [sRes, lRes] = await Promise.all([
          fetch("/api/skills"),
          fetch("/api/lessons"),
        ]);
        if (sRes.ok) {
          const sJson = await sRes.json();
          setSkills(sJson.data || []);
          // no skill is pre-selected: silently tagging every new question with the first skill would corrupt mastery evidence
        }
        if (lRes.ok) {
          const lJson = await lRes.json();
          setLessons(lJson.data || []);
        }
      } catch (e) {
        console.error("Meta loading error", e);
      }
    }
    loadMeta();
  }, []);

  useEffect(() => {
    if (isNew) return;

    async function loadQuestion() {
      setLoading(true);
      try {
        const res = await fetch(`/api/questions/${questionId}`);
        if (!res.ok) {
          setError("Failed to load question.");
          setLoading(false);
          return;
        }

        const json = await res.json();
        const q = json.data;
        setType(q.type);
        setPrompt(q.prompt || "");
        setSkillId(q.skillId || "");
        setLessonId(q.lessonId || "");
        setDifficulty(q.difficulty || "MEDIUM");
        setStatus(q.status || "DRAFT");
        setExplanation(q.explanation || "");
        setCorrectFeedback(q.correctFeedback || "");
        setIncorrectFeedback(q.incorrectFeedback || "");
        setAllowRetry(q.allowRetry !== false);
        setMaxAttempts(q.maxAttempts || 3);

        // Parse questionData
        let qData: any = {};
        if (typeof q.questionData === "string") {
          try {
            qData = JSON.parse(q.questionData);
          } catch {
            qData = {};
          }
        } else if (q.questionData) {
          qData = q.questionData;
        }

        if (q.type === "MULTIPLE_CHOICE") {
          if (qData.choices) setChoices(qData.choices);
          if (qData.correctAnswer) setCorrectChoiceId(qData.correctAnswer);
        } else if (q.type === "NUMERIC_INPUT") {
          setNumericAnswer(String(qData.correctAnswer ?? ""));
          setNumericTolerance(qData.tolerance || 0);
        } else if (q.type === "TEXT_INPUT") {
          setTextAnswer(String(qData.correctAnswer ?? ""));
          if (Array.isArray(qData.acceptableAnswers)) {
            setAcceptableAnswersText(qData.acceptableAnswers.join(", "));
          }
          setCaseSensitive(Boolean(qData.caseSensitive));
        } else if (q.type === "TRUE_FALSE") {
          setTfAnswer(Boolean(qData.correctAnswer));
        } else if (q.type === "EQUATION") {
          setEquationAnswer(String(qData.correctAnswer ?? ""));
        } else if (q.type === "MATCHING") {
          if (Array.isArray(qData.matchingPairs)) setMatchingPairs(qData.matchingPairs);
        } else if (q.type === "ORDERING") {
          if (Array.isArray(qData.orderingItems)) setOrderingItems(qData.orderingItems);
        }
      } catch (err: any) {
        setError(err.message || "Error loading question");
      } finally {
        setLoading(false);
      }
    }

    loadQuestion();
  }, [questionId, isNew]);

  const assembleQuestionData = (): any => {
    switch (type) {
      case "MULTIPLE_CHOICE":
        return {
          choices,
          correctAnswer: correctChoiceId,
        };
      case "NUMERIC_INPUT":
        return {
          correctAnswer: numericAnswer,
          tolerance: numericTolerance,
        };
      case "TEXT_INPUT":
        return {
          correctAnswer: textAnswer,
          acceptableAnswers: acceptableAnswersText
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          caseSensitive,
          trimWhitespace: true,
        };
      case "TRUE_FALSE":
        return {
          correctAnswer: tfAnswer,
        };
      case "EQUATION":
        return {
          correctAnswer: equationAnswer,
        };
      case "MATCHING":
        return {
          matchingPairs,
        };
      case "ORDERING":
        return {
          orderingItems,
        };
      default:
        return {};
    }
  };

  const handleSave = async (targetStatus?: QuestionStatus) => {
    if (!prompt.trim()) {
      setError("Question prompt cannot be blank.");
      return;
    }

    const effectiveStatus = targetStatus || status;
    if (!skillId && !lessonId && effectiveStatus === "PUBLISHED" &&
        !window.confirm("This question has no skill. Students can still answer it, but their answers will not count towards mastery, the difficult-skills view or recommendations. Publish anyway?")) {
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    const qData = assembleQuestionData();

    const payload = {
      type,
      prompt,
      skillId: skillId || null,
      lessonId: lessonId || null,
      difficulty,
      status: effectiveStatus,
      explanation,
      correctFeedback,
      incorrectFeedback,
      allowRetry,
      maxAttempts,
      questionData: qData,
    };

    try {
      const url = isNew ? "/api/questions" : `/api/questions/${questionId}`;
      const method = isNew ? "POST" : "PATCH";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Failed to save question.");
        setSaving(false);
        return;
      }

      setSuccess("Question successfully saved!");
      if (isNew && json.data?.id) {
        handleNav(`/teacher/questions/${json.data.id}/edit`);
      }
    } catch (err: any) {
      setError(err.message || "Failed to save question.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="py-24 text-center text-xs text-slate-400">
        Loading question editor...
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <button
            type="button"
            onClick={() => handleNav("/teacher/question-bank")}
            className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 mb-2 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Question Bank</span>
          </button>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            {isNew ? "Author New Question" : "Edit Practice Question"}
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
            Configure pedagogical prompt, verification rules, mathematical notation, and formative feedback.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {!isNew && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleNav(`/teacher/questions/${questionId}/preview`)}
              className="gap-1 text-xs"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Preview</span>
            </Button>
          )}

          <Button
            variant="primary"
            size="sm"
            onClick={() => handleSave()}
            disabled={saving}
            className="gap-1.5"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? "Saving..." : "Save Question"}</span>
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>{success}</span>
        </div>
      )}

      {/* Main Configuration Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-6">
        {/* Core Attributes Row */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Question Type
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as QuestionType)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="MULTIPLE_CHOICE">Multiple Choice</option>
              <option value="NUMERIC_INPUT">Numeric Input</option>
              <option value="TEXT_INPUT">Text Input</option>
              <option value="TRUE_FALSE">True / False</option>
              <option value="EQUATION">Equation</option>
              <option value="MATCHING">Matching</option>
              <option value="ORDERING">Ordering</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Difficulty
            </label>
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value as QuestionDifficulty)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="EASY">Easy</option>
              <option value="MEDIUM">Medium</option>
              <option value="HARD">Hard</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as QuestionStatus)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="DRAFT">Draft</option>
              <option value="REVIEW">Review</option>
              <option value="APPROVED">Approved</option>
              <option value="PUBLISHED">Published</option>
              <option value="ARCHIVED">Archived</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Assigned Skill
            </label>
            <select
              data-testid="skill-select"
              value={skillId}
              onChange={(e) => setSkillId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="">Choose a skill…</option>
              {skills.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </select>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mt-3 mb-1.5">
              Lesson (optional)
            </label>
            <select
              data-testid="lesson-select"
              value={lessonId}
              onChange={(e) => setLessonId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="">No lesson</option>
              {/* a teacher can attach questions only to lessons they wrote (the server enforces it); admins to any */}
              {lessons.filter((l) => user?.role === "ADMIN" || l.authorId === user?.id || l.id === lessonId).map((l) => (
                <option key={l.id} value={l.id}>
                  {l.title}
                </option>
              ))}
            </select>
            {!skillId && (
              <p data-testid="skill-warning" role="note" className="mt-1.5 text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
                {lessonId
                  ? "No skill chosen: the lesson's first skill will be used."
                  : "No skill chosen: answers to this question cannot count towards mastery, difficult skills or recommendations."}
              </p>
            )}
          </div>
        </div>

        {/* Prompt Field with Live Math Preview */}
        <div className="space-y-2">
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
            Question Prompt (Supports LaTeX like $$-8 + 13$$ and $x \in \mathbb{'{Z}'}$)
          </label>
          <textarea
            rows={3}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Type your question prompt here. You can use LaTeX math notations like $$-5 > -8$$..."
            className="w-full p-3.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
          />

          {prompt && (
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 text-sm text-slate-800">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Live Formula Preview
              </span>
              <MathText content={prompt} />
            </div>
          )}
        </div>

        {/* ------------------------------------------------------------- */}
        {/* TYPE SPECIFIC CONFIGURATION */}
        {/* ------------------------------------------------------------- */}
        <div className="pt-4 border-t border-slate-100 space-y-4">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
            Answer & Verification Rules ({type})
          </h2>

          {/* 1. Multiple Choice Config */}
          {type === "MULTIPLE_CHOICE" && (
            <div className="space-y-3">
              <p className="text-xs text-slate-500">
                Select the radio button next to the choice to designate it as the correct answer.
              </p>
              {choices.map((c, index) => (
                <div key={c.id || index} className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="correct-choice"
                    checked={correctChoiceId === c.id}
                    onChange={() => setCorrectChoiceId(c.id)}
                    className="w-4 h-4 text-teal-600 focus:ring-teal-500 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={c.text}
                    onChange={(e) => {
                      const next = [...choices];
                      next[index].text = e.target.value;
                      setChoices(next);
                    }}
                    placeholder={`Option ${index + 1}`}
                    className="flex-1 p-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                  {choices.length > 2 && (
                    <button
                      type="button"
                      onClick={() => {
                        const next = choices.filter((_, idx) => idx !== index);
                        setChoices(next);
                        if (correctChoiceId === c.id) setCorrectChoiceId(next[0]?.id || "");
                      }}
                      className="p-2 text-slate-400 hover:text-red-600 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}

              <Button
                variant="outline"
                size="sm"
                type="button"
                onClick={() => {
                  const newId = `opt_${Date.now()}`;
                  setChoices([...choices, { id: newId, text: "" }]);
                }}
                className="text-xs gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Choice</span>
              </Button>
            </div>
          )}

          {/* 2. Numeric Input Config */}
          {type === "NUMERIC_INPUT" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Expected Numerical Answer
                </label>
                <input
                  type="text"
                  value={numericAnswer}
                  onChange={(e) => setNumericAnswer(e.target.value)}
                  placeholder="e.g. -15 or 5"
                  className="w-full p-2.5 rounded-xl border border-slate-200 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Tolerance (Optional, e.g. 0.01)
                </label>
                <input
                  type="number"
                  step="any"
                  value={numericTolerance}
                  onChange={(e) => setNumericTolerance(parseFloat(e.target.value) || 0)}
                  placeholder="0 (exact match)"
                  className="w-full p-2.5 rounded-xl border border-slate-200 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
            </div>
          )}

          {/* 3. Text Input Config */}
          {type === "TEXT_INPUT" && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Expected Canonical Answer
                </label>
                <input
                  type="text"
                  value={textAnswer}
                  onChange={(e) => setTextAnswer(e.target.value)}
                  placeholder="e.g. 8"
                  className="w-full p-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Acceptable Alternative Answers (Comma separated)
                </label>
                <input
                  type="text"
                  value={acceptableAnswersText}
                  onChange={(e) => setAcceptableAnswersText(e.target.value)}
                  placeholder="e.g. +8, positive 8, eight"
                  className="w-full p-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700 font-medium">
                <input
                  type="checkbox"
                  checked={caseSensitive}
                  onChange={(e) => setCaseSensitive(e.target.checked)}
                  className="rounded text-teal-600 focus:ring-teal-500"
                />
                <span>Case-sensitive matching</span>
              </label>
            </div>
          )}

          {/* 4. True / False Config */}
          {type === "TRUE_FALSE" && (
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Correct Truth Value
              </label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm font-semibold cursor-pointer">
                  <input
                    type="radio"
                    name="tf-correct"
                    checked={tfAnswer === true}
                    onChange={() => setTfAnswer(true)}
                    className="text-teal-600 focus:ring-teal-500"
                  />
                  <span>True</span>
                </label>
                <label className="flex items-center gap-2 text-sm font-semibold cursor-pointer">
                  <input
                    type="radio"
                    name="tf-correct"
                    checked={tfAnswer === false}
                    onChange={() => setTfAnswer(false)}
                    className="text-teal-600 focus:ring-teal-500"
                  />
                  <span>False</span>
                </label>
              </div>
            </div>
          )}

          {/* 5. Equation Config */}
          {type === "EQUATION" && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Expected Equation Solution
              </label>
              <input
                type="text"
                value={equationAnswer}
                onChange={(e) => setEquationAnswer(e.target.value)}
                placeholder="e.g. x = 7"
                className="w-full p-2.5 rounded-xl border border-slate-200 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
              <p className="text-xs text-slate-500 mt-1">
                The validator automatically accepts symmetric forms like <code className="bg-slate-100 px-1 rounded">7 = x</code> and pure root values like <code className="bg-slate-100 px-1 rounded">7</code>.
              </p>
            </div>
          )}

          {/* 6. Matching Config */}
          {type === "MATCHING" && (
            <div className="space-y-3">
              <p className="text-xs text-slate-500">
                Define the correct pairings. The system will shuffle the right options when presenting to students.
              </p>
              {matchingPairs.map((pair, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={pair.left}
                    onChange={(e) => {
                      const next = [...matchingPairs];
                      next[idx].left = e.target.value;
                      setMatchingPairs(next);
                    }}
                    placeholder="Left item (e.g. -5)"
                    className="flex-1 p-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                  <span className="text-slate-400 font-bold">→</span>
                  <input
                    type="text"
                    value={pair.right}
                    onChange={(e) => {
                      const next = [...matchingPairs];
                      next[idx].right = e.target.value;
                      setMatchingPairs(next);
                    }}
                    placeholder="Matching right item (e.g. 5)"
                    className="flex-1 p-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                  {matchingPairs.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setMatchingPairs(matchingPairs.filter((_, i) => i !== idx))}
                      className="p-2 text-slate-400 hover:text-red-600 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}

              <Button
                variant="outline"
                size="sm"
                type="button"
                onClick={() => setMatchingPairs([...matchingPairs, { left: "", right: "" }])}
                className="text-xs gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Matching Pair</span>
              </Button>
            </div>
          )}

          {/* 7. Ordering Config */}
          {type === "ORDERING" && (
            <div className="space-y-3">
              <p className="text-xs text-slate-500">
                Enter items in their exact expected sequential order (top = first).
              </p>
              {orderingItems.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-600 text-xs font-bold flex items-center justify-center shrink-0">
                    {idx + 1}
                  </span>
                  <input
                    type="text"
                    value={item}
                    onChange={(e) => {
                      const next = [...orderingItems];
                      next[idx] = e.target.value;
                      setOrderingItems(next);
                    }}
                    placeholder={`Item ${idx + 1}`}
                    className="flex-1 p-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                  {orderingItems.length > 2 && (
                    <button
                      type="button"
                      onClick={() => setOrderingItems(orderingItems.filter((_, i) => i !== idx))}
                      className="p-2 text-slate-400 hover:text-red-600 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}

              <Button
                variant="outline"
                size="sm"
                type="button"
                onClick={() => setOrderingItems([...orderingItems, ""])}
                className="text-xs gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Item to Order</span>
              </Button>
            </div>
          )}
        </div>

        {/* Formative Feedback & Worked Explanation */}
        <div className="pt-4 border-t border-slate-100 space-y-4">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
            Pedagogical Feedback & Worked Solution
          </h2>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Detailed Worked Explanation
            </label>
            <textarea
              rows={3}
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
              placeholder="Explain the step-by-step reasoning and mathematical justification..."
              className="w-full p-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-emerald-800 uppercase tracking-wider mb-1">
                Correct Feedback Message
              </label>
              <input
                type="text"
                value={correctFeedback}
                onChange={(e) => setCorrectFeedback(e.target.value)}
                placeholder="e.g. Great work! You correctly applied the sign rule."
                className="w-full p-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-amber-800 uppercase tracking-wider mb-1">
                Incorrect Feedback Hint
              </label>
              <input
                type="text"
                value={incorrectFeedback}
                onChange={(e) => setIncorrectFeedback(e.target.value)}
                placeholder="e.g. Remember to compare the absolute values first."
                className="w-full p-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>
        </div>

        {/* Retry & Attempt Rules */}
        <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center gap-6">
          <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={allowRetry}
              onChange={(e) => setAllowRetry(e.target.checked)}
              className="rounded text-teal-600 focus:ring-teal-500"
            />
            <span>Allow Student Retries on Mistake</span>
          </label>

          {allowRetry && (
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
              <span>Max Attempts:</span>
              <input
                type="number"
                min={1}
                max={10}
                value={maxAttempts}
                onChange={(e) => setMaxAttempts(parseInt(e.target.value, 10) || 1)}
                className="w-16 p-1.5 rounded-lg border border-slate-200 text-center font-mono focus:outline-none focus:ring-1 focus:ring-teal-500"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
