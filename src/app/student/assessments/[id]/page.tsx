import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { authFetch } from "@/lib/auth/auth-context";
import { Button } from "@/components/ui/Button";
import { MathText } from "@/components/ui/MathText";
import { AssessmentQuestionInput, isAnswered, type AnswerValue } from "@/components/assessment/AssessmentQuestionInput";
import { ArrowLeft, CheckCircle2, Clock, XCircle, Loader2 } from "lucide-react";

interface Item { id: string; questionId: string; points: number; question: { id: string; prompt: string; type: string; questionData?: any } }
interface Assessment { id: string; title: string; description?: string; type: string; timeLimitMinutes?: number; passingScorePercent: number; items: Item[]; totalPoints: number }
interface Result {
  id: string; score: number; maxScore: number; scorePercent: number; isPassed: boolean; timedOut?: boolean; answersHidden?: boolean;
  skillBreakdown: Record<string, { skillTitle: string; correct: number; total: number; accuracy: number }>;
  responses: Array<{ id: string; prompt: string; studentAnswer: string; correctAnswer?: string; isCorrect: boolean; feedbackGiven?: string }>;
}

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

export default function StudentAssessmentPage({ assessmentId, onNavigate }: { assessmentId: string; onNavigate?: (path: string) => void }) {
  const go = (p: string) => (onNavigate ? onNavigate(p) : (window.location.pathname = p));
  const resultId = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("result") : null;
  const [asm, setAsm] = useState<Assessment | null>(null);
  const [phase, setPhase] = useState<"loading" | "intro" | "taking" | "done" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});
  const [index, setIndex] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const submittedRef = useRef(false);
  const storeKey = attemptId ? `tuklas_asm_${attemptId}` : null;

  // load the assessment (and the result, when one was asked for)
  useEffect(() => {
    (async () => {
      try {
        const res = await authFetch(`/api/student/assessments/${assessmentId}`);
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error || "Could not open this assessment");
        setAsm(json.data);
        if (resultId) {
          const r = await authFetch(`/api/student/assessments/attempts/${resultId}`);
          const rj = await r.json().catch(() => ({}));
          if (!r.ok) throw new Error(rj.error || "Could not load the result");
          setResult(rj.data);
          setPhase("done");
        } else setPhase("intro");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not open this assessment");
        setPhase("error");
      }
    })();
  }, [assessmentId, resultId]);

  // answers survive a refresh (this device only; cleared once submitted)
  useEffect(() => {
    if (!storeKey) return;
    try { const saved = sessionStorage.getItem(storeKey); if (saved) setAnswers(JSON.parse(saved)); } catch { /* storage unavailable */ }
  }, [storeKey]);
  useEffect(() => {
    if (!storeKey || phase !== "taking") return;
    try { sessionStorage.setItem(storeKey, JSON.stringify(answers)); } catch { /* storage unavailable */ }
  }, [answers, storeKey, phase]);

  const begin = async () => {
    setBusy(true); setError(null);
    try {
      const res = await authFetch(`/api/student/assessments/${assessmentId}/start`, { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Could not start");
      setAttemptId(json.data.attemptId);
      setSecondsLeft(json.data.secondsLeft);
      setPhase("taking");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start");
    } finally { setBusy(false); }
  };

  const submit = useCallback(async () => {
    if (!attemptId || !asm || submittedRef.current) return;
    submittedRef.current = true;
    setBusy(true); setError(null); setConfirming(false);
    try {
      const responses = asm.items.map((it) => ({ assessmentItemId: it.id, questionId: it.questionId, studentAnswer: answers[it.id] ?? "" }));
      const res = await authFetch(`/api/student/assessments/attempts/${attemptId}/submit`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ responses }) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Could not submit");
      try { if (storeKey) sessionStorage.removeItem(storeKey); } catch { /* */ }
      setResult(json.data);
      setPhase("done");
    } catch (e) {
      submittedRef.current = false;
      setError(e instanceof Error ? e.message : "Could not submit. Your answers are still here, so you can try again.");
    } finally { setBusy(false); }
  }, [attemptId, asm, answers, storeKey]);

  // Countdown from a fixed deadline (not by counting ticks: background tabs throttle timers). At zero the attempt is submitted.
  const deadlineRef = useRef<number | null>(null);
  useEffect(() => {
    if (phase !== "taking" || secondsLeft === null) return;
    if (deadlineRef.current === null) deadlineRef.current = Date.now() + secondsLeft * 1000;
    const tick = () => {
      const left = Math.max(0, Math.ceil(((deadlineRef.current as number) - Date.now()) / 1000));
      setSecondsLeft(left);
      if (left <= 0) submit();
    };
    const t = setInterval(tick, 500);
    return () => clearInterval(t);
  }, [phase, secondsLeft === null, submit]);

  const unanswered = useMemo(() => (asm ? asm.items.filter((it) => !isAnswered(it.question, answers[it.id])).length : 0), [asm, answers]);

  const back = <button type="button" onClick={() => go("/student/assessments")} className="text-xs font-bold text-slate-500 hover:text-slate-800 inline-flex items-center gap-1 mb-4"><ArrowLeft className="w-3.5 h-3.5" /> My assessments</button>;
  const shell = (children: React.ReactNode) => <div className="min-h-[calc(100vh-140px)] bg-slate-50/70"><div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">{children}</div></div>;

  if (phase === "loading") return shell(<p className="text-sm text-slate-500 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</p>);
  if (phase === "error") return shell(<>{back}<p role="alert" className="text-sm text-red-600">{error}</p></>);
  if (!asm) return null;

  if (phase === "intro") {
    const once = asm.type === "PRE_TEST" || asm.type === "POST_TEST";
    return shell(<>
      {back}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
        <h1 className="text-xl font-black text-slate-900">{asm.title}</h1>
        {asm.description && <p className="text-sm text-slate-600 mt-1">{asm.description}</p>}
        <ul className="text-sm text-slate-700 mt-4 space-y-1 list-disc pl-5">
          <li>{asm.items.length} question{asm.items.length === 1 ? "" : "s"}, {asm.totalPoints} point{asm.totalPoints === 1 ? "" : "s"}</li>
          {asm.timeLimitMinutes ? <li>You have {asm.timeLimitMinutes} minutes. The timer starts when you press Start and your answers are sent automatically when it ends.</li> : <li>There is no time limit.</li>}
          {once ? <li>You can take this only once. Your answers are not shown afterwards, so please do your own best work.</li> : <li>You will see which answers were right after you submit.</li>}
          <li>The AI tutor is not available during an assessment.</li>
        </ul>
        {error && <p role="alert" className="text-sm text-red-600 mt-3">{error}</p>}
        <Button variant="primary" data-testid="begin-assessment" disabled={busy} onClick={begin} className="mt-5 bg-teal-600 hover:bg-teal-700 text-white font-bold text-sm">{busy ? "Starting…" : "Start"}</Button>
      </div>
    </>);
  }

  if (phase === "taking") {
    const it = asm.items[index];
    const low = secondsLeft !== null && secondsLeft <= 60;
    return shell(<>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-base font-black text-slate-900">{asm.title}</h1>
        {secondsLeft !== null && <span data-testid="timer" role="timer" aria-live="off" className={`inline-flex items-center gap-1 text-sm font-mono font-bold ${low ? "text-red-600" : "text-slate-700"}`}><Clock className="w-4 h-4" />{fmt(secondsLeft)}</span>}
      </div>
      <div role="progressbar" aria-valuemin={1} aria-valuemax={asm.items.length} aria-valuenow={index + 1} className="flex gap-1 mb-5">
        {asm.items.map((x, i) => (
          <button key={x.id} type="button" aria-label={`Question ${i + 1}${isAnswered(x.question, answers[x.id]) ? " (answered)" : ""}`} onClick={() => setIndex(i)}
            className={`h-2 flex-1 rounded-full ${i === index ? "bg-teal-600" : isAnswered(x.question, answers[x.id]) ? "bg-teal-300" : "bg-slate-200"}`} />
        ))}
      </div>
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
        <p className="text-[11px] font-bold text-slate-500 mb-2">Question {index + 1} of {asm.items.length} · {it.points} point{it.points === 1 ? "" : "s"}</p>
        <AssessmentQuestionInput key={it.id} q={it.question} value={answers[it.id]} onChange={(v) => setAnswers((a) => ({ ...a, [it.id]: v }))} disabled={busy} />
      </div>
      {error && <p role="alert" className="text-sm text-red-600 mt-3">{error}</p>}
      <div className="flex items-center justify-between mt-4">
        <Button variant="outline" size="sm" disabled={index === 0 || busy} onClick={() => setIndex(index - 1)} className="text-xs font-bold">Previous</Button>
        {index < asm.items.length - 1 ? (
          <Button variant="primary" size="sm" data-testid="next-question" disabled={busy} onClick={() => setIndex(index + 1)} className="bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold">Next</Button>
        ) : (
          <Button variant="primary" size="sm" data-testid="review-submit" disabled={busy} onClick={() => setConfirming(true)} className="bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold">Finish</Button>
        )}
      </div>
      {confirming && (
        <div role="dialog" aria-modal="true" aria-label="Submit your answers" className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <h2 className="text-base font-black text-slate-900 mb-2">Submit your answers?</h2>
            <p className="text-sm text-slate-600 mb-4">{unanswered > 0 ? `${unanswered} question${unanswered === 1 ? " is" : "s are"} not answered yet and will count as wrong.` : "All questions are answered."} You cannot change them after you submit.</p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setConfirming(false)} className="text-xs font-bold">Keep working</Button>
              <Button variant="primary" size="sm" data-testid="confirm-submit" disabled={busy} onClick={submit} className="bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold">{busy ? "Submitting…" : "Submit"}</Button>
            </div>
          </div>
        </div>
      )}
    </>);
  }

  // done
  const r = result!;
  const skills = Object.values(r.skillBreakdown ?? {});
  return shell(<>
    {back}
    <div data-testid="assessment-result" className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
      <h1 className="text-xl font-black text-slate-900">{asm.title}</h1>
      <p className="mt-3 text-4xl font-black text-slate-900">{r.scorePercent}%</p>
      <p className="text-sm text-slate-600">{r.score} of {r.maxScore} points · {r.isPassed ? "Passed" : `The passing score is ${asm.passingScorePercent}%`}</p>
      {r.timedOut && <p className="text-xs text-amber-700 mt-2">This was handed in after the time limit.</p>}
      {skills.length > 0 && (
        <div className="mt-5">
          <h2 className="text-sm font-bold text-slate-900 mb-2">By skill</h2>
          <ul className="space-y-1 text-sm">{skills.map((s) => <li key={s.skillTitle} className="flex justify-between"><span>{s.skillTitle}</span><span className="font-semibold">{s.correct}/{s.total}</span></li>)}</ul>
        </div>
      )}
      {r.answersHidden ? (
        <p data-testid="answers-hidden" className="mt-5 text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-xl p-3">Your teacher uses this test to see how the class is learning, so the right answers are not shown. Your tutor and lessons will help you with anything that was tricky.</p>
      ) : (
        <ol className="mt-5 space-y-3">
          {r.responses.map((x, i) => (
            <li key={x.id} className="border border-slate-100 rounded-xl p-3 text-sm">
              <div className="flex items-start gap-2">{x.isCorrect ? <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" /> : <XCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />}<span><b>{i + 1}.</b> <MathText content={x.prompt} /></span></div>
              <p className="text-xs text-slate-600 mt-1 ml-6">Your answer: {x.studentAnswer || "(blank)"}{!x.isCorrect && x.correctAnswer ? ` · Correct: ${x.correctAnswer}` : ""}</p>
              {x.feedbackGiven && <div className="text-xs text-slate-500 mt-1 ml-6"><MathText content={x.feedbackGiven} /></div>}
            </li>
          ))}
        </ol>
      )}
      <Button variant="outline" size="sm" onClick={() => go("/student/assessments")} className="mt-5 text-xs font-bold">Back to my assessments</Button>
    </div>
  </>);
}
