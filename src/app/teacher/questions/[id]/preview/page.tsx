import React, { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth/auth-context";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { MathText } from "@/components/ui/MathText";
import { QuestionRenderer } from "@/components/practice/QuestionRenderer";
import { QuestionValidator } from "@/lib/question-validator";
import {
  ArrowLeft,
  Edit,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Eye,
  Send,
  Layers,
  Sparkles,
} from "lucide-react";

export interface TeacherQuestionPreviewPageProps {
  questionId: string;
  onNavigate?: (path: string) => void;
}

export default function TeacherQuestionPreviewPage({
  questionId,
  onNavigate,
}: TeacherQuestionPreviewPageProps) {
  const { user } = useAuth();
  const [question, setQuestion] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [testAnswer, setTestAnswer] = useState<any>(null);
  const [validationResult, setValidationResult] = useState<any>(null);

  const handleNav = (path: string) => {
    if (onNavigate) onNavigate(path);
    else window.location.pathname = path;
  };

  useEffect(() => {
    async function loadQ() {
      setLoading(true);
      try {
        const res = await fetch(`/api/questions/${questionId}`);
        if (res.ok) {
          const json = await res.json();
          setQuestion(json.data);
        }
      } catch (e) {
        console.error("Error loading question for preview", e);
      } finally {
        setLoading(false);
      }
    }
    loadQ();
  }, [questionId]);

  const handleTestSubmit = () => {
    if (!question) return;
    const res = QuestionValidator.validate(
      {
        type: question.type,
        prompt: question.prompt,
        explanation: question.explanation,
        correctFeedback: question.correctFeedback,
        incorrectFeedback: question.incorrectFeedback,
        questionData: question.questionData,
      },
      testAnswer
    );
    setValidationResult(res);
  };

  const handleResetTest = () => {
    setTestAnswer(null);
    setValidationResult(null);
  };

  if (loading) {
    return (
      <div className="py-24 text-center text-xs text-slate-400">
        Loading question preview...
      </div>
    );
  }

  if (!question) {
    return (
      <div className="py-20 text-center max-w-md mx-auto px-4">
        <h2 className="text-lg font-bold text-slate-800 mb-2">Question not found</h2>
        <Button variant="outline" onClick={() => handleNav("/teacher/question-bank")}>
          Return to Question Bank
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleNav("/teacher/question-bank")}
            className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Question Bank</span>
          </button>
          <span className="text-slate-300">|</span>
          <Badge variant="outline" className="text-xs bg-slate-50 text-slate-700">
            Teacher Live Preview
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleNav(`/teacher/questions/${questionId}/edit`)}
            className="gap-1.5 text-xs"
          >
            <Edit className="w-3.5 h-3.5" />
            <span>Edit Question</span>
          </Button>
        </div>
      </div>

      {/* Preview Simulation Notice */}
      <div className="p-3.5 rounded-xl bg-teal-50 border border-teal-200/80 text-xs text-teal-900 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Eye className="w-4 h-4 text-teal-600 shrink-0" />
          <span>
            <strong>Interactive Teacher Simulation:</strong> Test different answer submissions to inspect immediate feedback and validation logic.
          </span>
        </div>
        <Button variant="outline" size="sm" onClick={handleResetTest} className="text-xs shrink-0">
          <RotateCcw className="w-3 h-3 mr-1" />
          <span>Reset Test</span>
        </Button>
      </div>

      {/* Main Student Facing Question Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-6">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <Badge variant="outline" className="text-[11px] font-semibold text-slate-600">
            {question.type}
          </Badge>
          <Badge
            variant="outline"
            className={`text-[10px] font-bold ${
              question.difficulty === "HARD"
                ? "text-red-700 bg-red-50 border-red-200"
                : question.difficulty === "MEDIUM"
                ? "text-amber-700 bg-amber-50 border-amber-200"
                : "text-emerald-700 bg-emerald-50 border-emerald-200"
            }`}
          >
            {question.difficulty}
          </Badge>
        </div>

        <QuestionRenderer
          question={question}
          value={testAnswer}
          onChange={(val) => {
            if (!validationResult) setTestAnswer(val);
          }}
          disabled={validationResult !== null}
        />

        {/* Validation Result Box */}
        {validationResult && (
          <div
            className={`p-4 rounded-xl border space-y-2 ${
              validationResult.isCorrect
                ? "bg-emerald-50/80 border-emerald-200 text-emerald-950"
                : "bg-amber-50/80 border-amber-200 text-amber-950"
            }`}
          >
            <div className="flex items-center gap-2 font-bold text-sm">
              {validationResult.isCorrect ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Correct!</span>
                </>
              ) : (
                <>
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Not quite</span>
                </>
              )}
            </div>

            <p className="text-xs sm:text-sm leading-relaxed">
              {validationResult.feedback}
            </p>

            {validationResult.explanation && (
              <div className="pt-2 border-t border-slate-200/60 text-xs text-slate-700 space-y-1">
                <span className="font-semibold block">Explanation:</span>
                <MathText content={validationResult.explanation} />
              </div>
            )}

            <div className="text-xs font-mono pt-1 text-slate-800">
              <span className="font-semibold font-sans">Answer Key: </span>
              {validationResult.expectedAnswerDisplay}
            </div>
          </div>
        )}

        {/* Action button */}
        <div className="pt-4 border-t border-slate-100 flex justify-end">
          {!validationResult ? (
            <Button
              variant="primary"
              onClick={handleTestSubmit}
              disabled={testAnswer === null || testAnswer === undefined || testAnswer === ""}
              className="gap-1.5"
            >
              <span>Test Submit Answer</span>
              <Send className="w-3.5 h-3.5" />
            </Button>
          ) : (
            <Button variant="outline" onClick={handleResetTest} className="gap-1.5">
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Test Another Answer</span>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
