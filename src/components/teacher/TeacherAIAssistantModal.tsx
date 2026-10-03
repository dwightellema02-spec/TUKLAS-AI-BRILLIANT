import React, { useState } from "react";
import { Sparkles, X, Send, Bot, Lightbulb, CheckCircle2, Loader2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/Button";

export interface TeacherAIAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  classId?: string;
  className?: string;
}

export function TeacherAIAssistantModal({
  isOpen,
  onClose,
  classId,
  className,
}: TeacherAIAssistantModalProps) {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const quickPrompts = [
    "Which skills are most difficult for my class?",
    "Which students may need additional support?",
    "Summarize the common mistakes in this class",
    "What lesson should I review next based on current mastery?",
  ];

  const handleQuery = async (queryText: string) => {
    if (!queryText.trim() || loading) return;
    setLoading(true);
    setError(null);
    setResponse(null);

    try {
      const res = await fetch("/api/teacher/ai-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: queryText, classId }),
      });

      if (!res.ok) {
        throw new Error("Assistant inquiry failed");
      }

      const json = await res.json();
      setResponse(json.data);
    } catch (err: unknown) {
      setError("Unable to process inquiry. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-2xl bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-gradient-to-r from-indigo-900 via-slate-900 to-blue-950 text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 text-teal-300 flex items-center justify-center shadow-xs">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-white">
                Teacher AI Assistant
              </h2>
              <p className="text-xs text-indigo-200">
                {className ? `Scored for ${className}` : "Grounded Class Analytics & Pedagogical Strategies"}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* Quick Prompt Chips */}
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-2">
              Common Inquiries:
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {quickPrompts.map((qp, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setPrompt(qp);
                    handleQuery(qp);
                  }}
                  className="text-left text-xs p-2.5 rounded-xl border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/50 text-slate-700 transition-all font-medium flex items-center justify-between gap-2"
                >
                  <span className="line-clamp-1">{qp}</span>
                  <ArrowRight className="w-3 h-3 text-slate-400 shrink-0" />
                </button>
              ))}
            </div>
          </div>

          {/* AI Response Display */}
          {loading && (
            <div className="p-8 text-center space-y-2 bg-slate-50 rounded-2xl border border-slate-200">
              <Loader2 className="w-6 h-6 animate-spin text-indigo-600 mx-auto" />
              <p className="text-xs font-bold text-slate-700">
                Analyzing authorized classroom evidence...
              </p>
              <p className="text-[11px] text-slate-400">
                Grounding with Mastery Engine and Mistake Analyzer data.
              </p>
            </div>
          )}

          {error && (
            <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">
              {error}
            </div>
          )}

          {response && (
            <div className="space-y-4 animate-in fade-in duration-300">
              <div className="p-5 rounded-2xl bg-indigo-50/60 border border-indigo-200 space-y-3">
                <div className="flex items-center gap-2 text-indigo-900 font-bold text-xs">
                  <Bot className="w-4 h-4 text-indigo-600" />
                  <span>Synthesized Pedagogical Insight</span>
                </div>
                <div className="text-xs text-slate-800 leading-relaxed whitespace-pre-line font-normal">
                  {response.answer}
                </div>
              </div>

              {response.suggestedActions?.length > 0 && (
                <div className="p-4 rounded-2xl bg-teal-50/60 border border-teal-200 space-y-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-teal-800 block">
                    Recommended Formative Actions:
                  </span>
                  <ul className="space-y-1.5 text-xs text-teal-900">
                    {response.suggestedActions.map((act: string, idx: number) => (
                      <li key={idx} className="flex items-start gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-teal-600 shrink-0 mt-0.5" />
                        <span>{act}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Query Input */}
        <div className="p-4 border-t border-slate-100 bg-slate-50">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleQuery(prompt);
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Ask about class mastery, difficult skills, or specific students..."
              className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <Button
              type="submit"
              variant="primary"
              disabled={loading || !prompt.trim()}
              className="gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-10 px-4 text-xs shrink-0"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Ask</span>
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
