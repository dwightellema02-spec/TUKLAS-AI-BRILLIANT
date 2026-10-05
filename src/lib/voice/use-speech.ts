/**
 * React hooks for the voice tutor (Phase 32): listening (speech recognition) and speaking (speech synthesis).
 * Both are thin wrappers over the browser's own engines and degrade to "unavailable" instead of throwing.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { chunkForSpeech } from "./speech-text";
import { describeRecognitionError, detectVoiceSupport, getSpeechRecognitionCtor, VOICE_LANG_TAG, type VoiceLang, type VoiceSupport } from "./capabilities";

export type ListenState = "idle" | "starting" | "listening" | "processing";

export interface UseSpeechRecognition {
  support: VoiceSupport;
  state: ListenState;
  /** Words recognised so far in the current utterance (updates live). */
  interim: string;
  /** A plain-language problem to show the student, or null. */
  problem: string | null;
  /** True once the browser has refused the microphone: do not offer it again until the page reloads. */
  blocked: boolean;
  start: () => void;
  stop: () => void;
}

export function useSpeechRecognition(opts: { lang: VoiceLang; onFinal: (transcript: string) => void }): UseSpeechRecognition {
  const [support, setSupport] = useState<VoiceSupport>(() => detectVoiceSupport());
  const [state, setState] = useState<ListenState>("idle");
  const [interim, setInterim] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [blocked, setBlocked] = useState(false);
  const recRef = useRef<any>(null);
  const onFinalRef = useRef(opts.onFinal);
  onFinalRef.current = opts.onFinal;
  const deliveredRef = useRef(false);

  useEffect(() => { setSupport(detectVoiceSupport()); }, []);

  const teardown = useCallback(() => {
    const r = recRef.current;
    recRef.current = null;
    if (r) { try { r.onresult = r.onerror = r.onend = r.onstart = null; r.abort(); } catch { /* already stopped */ } }
  }, []);

  useEffect(() => teardown, [teardown]);

  const start = useCallback(() => {
    const Ctor = getSpeechRecognitionCtor();
    const current = detectVoiceSupport();
    if (!Ctor || !current.recognition) { setProblem(current.recognitionProblem ?? "Voice input is not available."); return; }
    if (blocked) return;
    teardown();
    setProblem(null);
    setInterim("");
    deliveredRef.current = false;
    let rec: any;
    try { rec = new Ctor(); } catch { setProblem("Voice input could not start. You can still type."); return; }
    rec.lang = VOICE_LANG_TAG[opts.lang];
    rec.continuous = false;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    rec.onstart = () => setState("listening");
    rec.onresult = (ev: any) => {
      let finalText = "";
      let live = "";
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const res = ev.results[i];
        const text = res[0]?.transcript ?? "";
        if (res.isFinal) finalText += text; else live += text;
      }
      if (live) setInterim(live.trim());
      if (finalText.trim() && !deliveredRef.current) {
        deliveredRef.current = true;
        setInterim("");
        setState("processing");
        onFinalRef.current(finalText.trim());
      }
    };
    rec.onerror = (ev: any) => {
      const info = describeRecognitionError(String(ev?.error ?? "unknown"));
      if (info.fatal) setBlocked(true);
      if (info.message) setProblem(info.message);
    };
    rec.onend = () => { recRef.current = null; setInterim(""); setState("idle"); };
    recRef.current = rec;
    setState("starting");
    try { rec.start(); } catch { recRef.current = null; setState("idle"); setProblem("Voice input could not start. You can still type."); }
  }, [blocked, opts.lang, teardown]);

  const stop = useCallback(() => {
    const r = recRef.current;
    if (r) { try { r.stop(); } catch { /* ignore */ } }
  }, []);

  return { support, state, interim, problem, blocked, start, stop };
}

export interface UseSpeechSynthesis {
  available: boolean;
  speaking: boolean;
  speak: (text: string, onDone?: () => void) => void;
  /** Stops speaking immediately (barge-in). Safe to call when nothing is playing. */
  cancel: () => void;
}

export function useSpeechSynthesis(opts: { lang: VoiceLang }): UseSpeechSynthesis {
  const available = typeof window !== "undefined" && "speechSynthesis" in window && typeof (window as any).SpeechSynthesisUtterance === "function";
  const [speaking, setSpeaking] = useState(false);
  const runRef = useRef(0); // increments on every speak/cancel so stale callbacks are ignored

  const cancel = useCallback(() => {
    runRef.current += 1;
    if (typeof window !== "undefined" && "speechSynthesis" in window) { try { window.speechSynthesis.cancel(); } catch { /* ignore */ } }
    setSpeaking(false);
  }, []);

  const speak = useCallback((text: string, onDone?: () => void) => {
    if (!available || !text.trim()) { onDone?.(); return; }
    const synth = window.speechSynthesis;
    try { synth.cancel(); } catch { /* ignore */ }
    const run = ++runRef.current;
    const chunks = chunkForSpeech(text);
    const tag = VOICE_LANG_TAG[opts.lang];
    const voices = synth.getVoices?.() ?? [];
    const voice = voices.find((v) => v.lang?.toLowerCase() === tag.toLowerCase()) ?? voices.find((v) => v.lang?.toLowerCase().startsWith(tag.slice(0, 2).toLowerCase()));
    setSpeaking(true);
    chunks.forEach((chunk, idx) => {
      const u = new SpeechSynthesisUtterance(chunk);
      u.lang = tag;
      if (voice) u.voice = voice;
      u.rate = 0.95;
      const finish = () => {
        if (run !== runRef.current) return; // interrupted or replaced
        if (idx === chunks.length - 1) { setSpeaking(false); onDone?.(); }
      };
      u.onend = finish;
      u.onerror = finish;
      synth.speak(u);
    });
  }, [available, opts.lang]);

  useEffect(() => () => { runRef.current += 1; try { window.speechSynthesis?.cancel(); } catch { /* ignore */ } }, []);

  return { available, speaking, speak, cancel };
}
