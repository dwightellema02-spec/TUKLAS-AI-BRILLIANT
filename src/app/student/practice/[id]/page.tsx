import React, { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth/auth-context";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { MathText } from "@/components/ui/MathText";
import { QuestionRenderer } from "@/components/practice/QuestionRenderer";
import { AITutorPanel } from "@/components/ai/AITutorPanel";
import { AITutorHintButton } from "@/components/ai/AITutorHintButton";
import { StudentInsightCard } from "@/components/insights/StudentInsightCard";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  Sparkles,
  Award,
  ChevronRight,
  BookOpen,
  Eye,
  Check,
  X,
  Target,
} from "lucide-react";

export interface StudentPracticePageProps {
  practiceSetId: string;
  onNavigate?: (path: string) => void;
}

export default function StudentPracticePage({
  practiceSetId,
  onNavigate,
}: StudentPracticePageProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<any>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [studentAnswer, setStudentAnswer] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastResult, setLastResult] = useState<any>(null);
  const [isCompleted, setIsCompleted] = useState(false);
  const [reviewData, setReviewData] = useState<any>(null);
  const [showReview, setShowReview] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAITutorOpen, setIsAITutorOpen] = useState(false);
  const [sessionInsight, setSessionInsight] = useState<any>(null);

  const handleNav = (path: string) => {
    if (onNavigate) onNavigate(path);
    else window.location.pathname = path;
  };

  // Start or resume practice session
  useEffect(() => {
    async function initSession() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/practice/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ practiceSetId }),
        });

        const json = await res.json();
        if (!res.ok) {
          setError(json.error || "Failed to start practice activity.");
          setLoading(false);
          return;
        }

        const sess = json.data;
        setSession(sess);

        // Find first uncompleted question
        const questions: any[] = sess.questions || [];
        const firstUncompleted = questions.findIndex((q: any) => !q.completedAt);
        if (firstUncompleted !== -1) {
          setCurrentQuestionIndex(firstUncompleted);
        } else if (questions.length > 0 && sess.status === "COMPLETED") {
          setIsCompleted(true);
          loadReview(sess.id);
        }
      } catch (err: any) {
        setError(err.message || "Network error loading practice.");
      } finally {
        setLoading(false);
      }
    }

    initSession();
  }, [practiceSetId]);

  const loadReview = async (sessId: string) => {
    try {
      const res = await fetch(`/api/practice/${sessId}/review`);
      if (res.ok) {
        const json = await res.json();
        setReviewData(json.data);
      }
    } catch (e) {
      console.error("Failed to load review data", e);
    }
  };

  const currentPQ = session?.questions?.[currentQuestionIndex];
  const currentQuestion = currentPQ?.question;
  const totalQuestions = session?.questions?.length || 0;

  // Handle answer submission
  const handleSubmitAnswer = async () => {
    if (!studentAnswer && studentAnswer !== false && studentAnswer !== 0) {
      return;
    }
    if (!session || !currentQuestion) return;

    setIsSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/practice/${session.id}/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionId: currentQuestion.id,
          answer: studentAnswer,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Failed to submit answer.");
        setIsSubmitting(false);
        return;
      }

      setLastResult(json.data);
    } catch (err: any) {
      setError(err.message || "Failed to submit answer.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Next question
  const handleNextQuestion = () => {
    setLastResult(null);
    setStudentAnswer(null);

    if (currentQuestionIndex < totalQuestions - 1) {
      setCurrentQuestionIndex((prev) => prev + 1);
    } else {
      handleCompleteSession();
    }
  };

  // Retry current question
  const handleRetry = () => {
    setLastResult(null);
    setStudentAnswer(null);
  };

  // Complete session
  const handleCompleteSession = async () => {
    if (!session) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/practice/${session.id}/complete`, {
        method: "POST",
      });
      if (res.ok) {
        const json = await res.json();
        setReviewData(json.data);
        setIsCompleted(true);

        // Fetch latest learning insight for student
        const token = localStorage.getItem("tuklas_token");
        const headers: Record<string, string> = {};
        if (token) headers["Authorization"] = `Bearer ${token}`;
        fetch("/api/student/insights", { headers })
          .then((r) => r.json())
          .then((insJson) => {
            if (insJson.data && insJson.data.length > 0) {
              setSessionInsight(insJson.data[0]);
            }
          })
          .catch(() => {});
      }
    } catch (e) {
      console.error("Failed to complete session", e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="py-24 text-center max-w-md mx-auto px-4">
        <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center mx-auto mb-3 animate-pulse">
          <Target className="w-6 h-6" />
        </div>
        <p className="text-sm text-slate-600">Loading practice session...</p>
      </div>
    );
  }

  if (error && !session) {
    return (
      <div className="py-16 max-w-md mx-auto px-4 text-center">
        <div className="w-16 h-16 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-4 border border-red-200">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h1 className="text-xl font-bold text-slate-900 mb-2">Practice Unavailable</h1>
        <p className="text-sm text-slate-600 mb-6">{error}</p>
        <Button variant="outline" onClick={() => handleNav("/student/learning-path")}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          <span>Return to Learning Path</span>
        </Button>
      </div>
    );
  }

  // -------------------------------------------------------------
  // COMPLETION & SUMMARY SCREEN
  // -------------------------------------------------------------
  if (isCompleted && reviewData) {
    const isPassing = reviewData.accuracy >= 75;

    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-10 shadow-xs text-center space-y-6">
          <div
            className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto shadow-xs ${
              isPassing ? "bg-teal-50 text-teal-600 border border-teal-200" : "bg-amber-50 text-amber-600 border border-amber-200"
            }`}
          >
            {isPassing ? <Award className="w-8 h-8" /> : <Sparkles className="w-8 h-8" />}
          </div>

          <div className="space-y-2">
            <Badge variant="outline" className="text-xs">
              {reviewData.practiceSetTitle || "Practice Set"}
            </Badge>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Practice Complete!
            </h1>
            <p className="text-sm text-slate-600 max-w-md mx-auto">
              Every attempt has been permanently recorded to guide your personalized learning progression.
            </p>
          </div>

          {/* Score Cards Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-2">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                Score
              </span>
              <span className="text-2xl font-extrabold text-slate-900">
                {reviewData.score}%
              </span>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                Accuracy
              </span>
              <span className="text-2xl font-extrabold text-teal-600">
                {reviewData.accuracy}%
              </span>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                Correct
              </span>
              <span className="text-2xl font-extrabold text-emerald-600">
                {reviewData.correctAnswers}
              </span>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                Questions
              </span>
              <span className="text-2xl font-extrabold text-slate-700">
                {reviewData.totalQuestions}
              </span>
            </div>
          </div>

          {/* AI Learning Insight */}
          {sessionInsight && (
            <div className="text-left py-1">
              <StudentInsightCard
                insight={sessionInsight}
                onReviewLesson={(lId) => {
                  if (lId || session?.lessonId) {
                    handleNav(`/student/lessons/${lId || session.lessonId}`);
                  }
                }}
                onPracticeAgain={() => {
                  window.location.reload();
                }}
              />
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Button
              variant="outline"
              onClick={() => setShowReview(!showReview)}
              className="w-full sm:w-auto"
            >
              <Eye className="w-4 h-4 mr-2" />
              <span>{showReview ? "Hide Answer Review" : "Review All Answers"}</span>
            </Button>

            <Button
              variant="primary"
              onClick={() => {
                if (session?.lessonId) {
                  handleNav(`/student/lessons/${session.lessonId}`);
                } else {
                  handleNav("/student/learning-path");
                }
              }}
              className="w-full sm:w-auto"
            >
              <BookOpen className="w-4 h-4 mr-2" />
              <span>Return to Lesson</span>
            </Button>
          </div>
        </div>

        {/* Detailed Question Review List */}
        {showReview && (
          <div className="mt-8 space-y-4">
            <h2 className="text-lg font-bold text-slate-900 px-1">
              Detailed Question Review
            </h2>

            {reviewData.questions?.map((item: any, idx: number) => {
              const isCorrect = item.isCorrect;

              return (
                <div
                  key={item.questionId || idx}
                  className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-2xs space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-7 h-7 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold flex items-center justify-center">
                        {idx + 1}
                      </span>
                      <Badge variant="outline" className="text-[10px]">
                        {item.type}
                      </Badge>
                      <Badge variant="outline" className="text-[10px]">
                        {item.difficulty}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {isCorrect ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <Check className="w-3.5 h-3.5 stroke-[2.5]" /> Correct
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200">
                          <X className="w-3.5 h-3.5 stroke-[2.5]" /> Incorrect
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="text-sm font-medium text-slate-900 leading-relaxed">
                    <MathText content={item.prompt} />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-xs">
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                        Your Submitted Answer
                      </span>
                      <div className="font-mono text-slate-800">
                        {item.latestAttempt?.answer ? String(item.latestAttempt.answer) : "None"}
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-teal-50/60 border border-teal-200/80">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-teal-800 block mb-1">
                        Correct Answer
                      </span>
                      <div className="font-mono text-teal-950 font-semibold">
                        {item.expectedAnswerDisplay}
                      </div>
                    </div>
                  </div>

                  {item.explanation && (
                    <div className="p-3.5 rounded-xl bg-slate-50/80 border border-slate-200 text-xs text-slate-600 leading-relaxed space-y-1">
                      <span className="font-semibold text-slate-700 block">Explanation:</span>
                      <MathText content={item.explanation} />
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

  // -------------------------------------------------------------
  // ACTIVE QUESTION PRACTICE VIEW
  // -------------------------------------------------------------
  if (!currentQuestion) {
    return (
      <div className="py-16 text-center text-slate-500">
        No questions available in this practice set.
      </div>
    );
  }

  const progressPercent = totalQuestions > 0 ? Math.round(((currentQuestionIndex + 1) / totalQuestions) * 100) : 0;
  const isAnswered = lastResult !== null;
  const isCorrect = lastResult?.isCorrect;
  const canRetry = lastResult?.allowRetry;

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-6">
      {/* Top Header & Progress */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              if (session?.lessonId) {
                handleNav(`/student/lessons/${session.lessonId}`);
              } else {
                handleNav("/student/learning-path");
              }
            }}
            className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Exit Practice</span>
          </button>

          <span className="text-xs font-semibold text-slate-600">
            Question {currentQuestionIndex + 1} of {totalQuestions}
          </span>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
          <div
            className="bg-teal-600 h-full rounded-full transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Main Practice Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-6">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <Badge variant="outline" className="text-[11px] font-semibold text-slate-600">
            {currentQuestion.type}
          </Badge>
          <Badge
            variant="outline"
            className={`text-[10px] font-bold ${
              currentQuestion.difficulty === "HARD"
                ? "text-red-700 bg-red-50 border-red-200"
                : currentQuestion.difficulty === "MEDIUM"
                ? "text-amber-700 bg-amber-50 border-amber-200"
                : "text-emerald-700 bg-emerald-50 border-emerald-200"
            }`}
          >
            {currentQuestion.difficulty}
          </Badge>
        </div>

        {/* Question Renderer */}
        <QuestionRenderer
          question={currentQuestion}
          value={studentAnswer}
          onChange={(val) => {
            if (!isAnswered) setStudentAnswer(val);
          }}
          disabled={isAnswered || isSubmitting}
        />

        {error && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Feedback Area on Submission */}
        {isAnswered && (
          <div
            className={`p-4 sm:p-5 rounded-2xl border space-y-3 transition-all ${
              isCorrect
                ? "bg-emerald-50/70 border-emerald-200 text-emerald-950"
                : "bg-amber-50/80 border-amber-200 text-amber-950"
            }`}
          >
            <div className="flex items-center gap-2 font-bold text-sm sm:text-base">
              {isCorrect ? (
                <>
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  <span>Correct!</span>
                </>
              ) : (
                <>
                  <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
                  <span>Not quite</span>
                </>
              )}
            </div>

            <p className="text-xs sm:text-sm leading-relaxed">
              {lastResult.feedback}
            </p>

            {/* Explanation reveal */}
            {lastResult.explanation && (
              <div className="pt-2 border-t border-slate-200/60 text-xs text-slate-700 space-y-1">
                <span className="font-semibold block">Explanation:</span>
                <MathText content={lastResult.explanation} />
              </div>
            )}

            {/* Correct answer display if final attempt or failed */}
            {!isCorrect && lastResult.expectedAnswerDisplay && (
              <div className="text-xs font-mono pt-1 text-slate-800">
                <span className="font-semibold font-sans">Answer: </span>
                {lastResult.expectedAnswerDisplay}
              </div>
            )}
          </div>
        )}

        {/* Controls */}
        <div className="pt-4 flex items-center justify-between gap-3 border-t border-slate-100">
          {!isAnswered ? (
            <div className="flex items-center justify-between w-full">
              <AITutorHintButton
                onClick={() => setIsAITutorOpen(true)}
                label="Need a hint?"
              />

              <Button
                variant="primary"
                onClick={handleSubmitAnswer}
                disabled={studentAnswer === null || studentAnswer === undefined || studentAnswer === "" || isSubmitting}
                className="ml-auto"
              >
                <span>{isSubmitting ? "Validating..." : "Submit Answer"}</span>
                <ArrowRight className="w-4 h-4 ml-1.5" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                {canRetry ? (
                  <Button variant="outline" size="sm" onClick={handleRetry} className="gap-1.5">
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Try Again ({lastResult.attemptsRemaining} left)</span>
                  </Button>
                ) : null}

                {!isCorrect && (
                  <AITutorHintButton
                    onClick={() => setIsAITutorOpen(true)}
                    label="Ask AI Tutor"
                    hasMistake={true}
                  />
                )}
              </div>

              <Button variant="primary" onClick={handleNextQuestion} className="gap-1.5">
                <span>{currentQuestionIndex < totalQuestions - 1 ? "Next Question" : "Finish Practice"}</span>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Embedded AI Tutor Panel */}
      <AITutorPanel
        isOpen={isAITutorOpen}
        onClose={() => setIsAITutorOpen(false)}
        context={{
          lessonId: session?.lessonId,
          questionId: currentQuestion?.id,
          questionPrompt: currentQuestion?.prompt,
          practiceSessionId: session?.id,
          studentAnswer: studentAnswer,
          hasFailedAttempt: isAnswered && !isCorrect,
        }}
      />
    </div>
  );
}
