/**
 * What this browser can do for the voice tutor (Phase 32). Feature-detects; never assumes.
 * Speech recognition is the browser's own service (Chrome, Edge, Safari): the page receives TEXT, never audio, and the
 * app stores only the text. Where it is missing (Firefox, many in-app browsers) the tutor stays fully usable by typing.
 */

export interface VoiceSupport {
  recognition: boolean;
  synthesis: boolean;
  /** Microphone access needs https (or localhost). */
  secureContext: boolean;
  /** One plain-language sentence for the student when voice input is not available, else null. */
  recognitionProblem: string | null;
}

export function getSpeechRecognitionCtor(): any | null {
  if (typeof window === "undefined") return null;
  const w = window as any;
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export function detectVoiceSupport(): VoiceSupport {
  const hasWindow = typeof window !== "undefined";
  const secure = hasWindow ? window.isSecureContext !== false : false;
  const recognition = !!getSpeechRecognitionCtor();
  const synthesis = hasWindow && "speechSynthesis" in window && typeof (window as any).SpeechSynthesisUtterance === "function";
  let problem: string | null = null;
  if (!recognition) problem = "Voice input is not available in this browser. You can still type your answers.";
  else if (!secure) problem = "Voice input needs a secure (https) connection. You can still type your answers.";
  return { recognition: recognition && secure, synthesis, secureContext: secure, recognitionProblem: problem };
}

export type VoiceLang = "en" | "fil";

/** Recognition / synthesis language tags. Filipino and Taglish are best served by fil-PH; English by en-US. */
export const VOICE_LANG_TAG: Record<VoiceLang, string> = { en: "en-US", fil: "fil-PH" };

/** Maps the browser's speech error codes to what a student should read and what the app should do. */
export function describeRecognitionError(code: string): { message: string; retry: boolean; fatal: boolean } {
  switch (code) {
    case "not-allowed":
    case "service-not-allowed":
      return { message: "The microphone is blocked. Allow the microphone for this site in your browser settings, or type instead.", retry: false, fatal: true };
    case "audio-capture":
      return { message: "No microphone was found. Check that one is connected, or type instead.", retry: false, fatal: true };
    case "no-speech":
      return { message: "I didn't hear anything. Tap the microphone and try again.", retry: true, fatal: false };
    case "network":
      return { message: "Voice recognition could not reach its service. Check your connection, or type instead.", retry: true, fatal: false };
    case "language-not-supported":
      return { message: "This browser can't recognise that language by voice. Try the other language, or type.", retry: false, fatal: true };
    case "aborted":
      return { message: "", retry: true, fatal: false };
    default:
      return { message: "Voice input had a problem. You can try again or type instead.", retry: true, fatal: false };
  }
}
