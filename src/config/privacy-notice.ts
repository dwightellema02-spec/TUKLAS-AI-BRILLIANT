/**
 * Privacy notice (Phase 43). The text is a TEMPLATE for the school's data protection officer to review and complete: it describes what this
 * software actually does, but it is not legal advice and the school (the "personal information controller") remains responsible for its own
 * notice, consent forms and any registration or reporting duties under the Data Privacy Act of 2012 (Philippines) or other law that applies.
 * Bump PRIVACY_NOTICE_VERSION whenever the meaning of the notice changes: everyone is then asked to accept it again.
 */
export const PRIVACY_NOTICE_VERSION = "2026-10-v1";

export interface PrivacyNoticeSettings {
  schoolName: string;
  contactEmail: string | null;
  /** True when the tutor's messages are sent to an external AI service (AI_PROVIDER=gemini with a key). */
  externalAi: boolean;
  tutorRetentionDays: number;
  requireGuardianConsent: boolean;
}

export function privacySettingsFromEnv(env: NodeJS.ProcessEnv = process.env): PrivacyNoticeSettings {
  const provider = (env.AI_PROVIDER ?? "gemini").toLowerCase();
  const days = Number(env.RETENTION_TUTOR_DAYS ?? 365);
  return {
    schoolName: (env.SCHOOL_NAME ?? "").trim() || "your school",
    contactEmail: (env.PRIVACY_CONTACT_EMAIL ?? "").trim() || null,
    externalAi: provider === "gemini" && !!(env.GEMINI_API_KEY || env.AI_API_KEY),
    tutorRetentionDays: Number.isFinite(days) && days > 0 ? Math.round(days) : 365,
    requireGuardianConsent: env.REQUIRE_GUARDIAN_CONSENT === "true",
  };
}

export interface NoticeSection { id: string; title: string; paragraphs: string[] }

export function buildPrivacyNotice(s: PrivacyNoticeSettings) {
  const contact = s.contactEmail ? `at ${s.contactEmail}` : "through your teacher or the school office";
  const sections: NoticeSection[] = [
    { id: "who", title: "Who runs this", paragraphs: [`Tuklas AI is used by ${s.schoolName} to help Grade 7 students practise Mathematics and to help teachers see how their class is doing. ${s.schoolName} decides what is collected and why, and is responsible for your information.`] },
    { id: "what", title: "What is collected", paragraphs: [
      "Your account: your name, your email address, your grade level and your password (stored only in scrambled form, never readable).",
      "What you do in lessons: which lessons and sections you open, your answers to checkpoints, practice questions and tests, whether they were right, how long you took, and the skills you are working on (your \"mastery\").",
      "Your conversations with the AI tutor: what you type or say to it and what it answers. Please do not write personal details (your full name, address, phone number) in the tutor chat.",
      "Which classes you belong to.",
      "Technical records: when you sign in and an internet address for security checks. A short log of important actions (for example an account being disabled) is kept for safety.",
    ] },
    { id: "why", title: "Why it is collected", paragraphs: ["To give you lessons and practice that fit what you already know, to let your teacher see who needs help and which skills are hard for the class, to keep the system secure, and (without your name) to study whether the lessons are working."] },
    { id: "who-sees", title: "Who can see it", paragraphs: [
      "You can see your own information. Your teachers can see your results and activity for the classes they teach. School administrators can manage accounts.",
      "Research summaries are made without names: a code replaces your name and identifying details are left out unless an administrator or teacher deliberately exports them for a class they teach.",
    ] },
    { id: "ai", title: "The AI tutor", paragraphs: s.externalAi
      ? ["The tutor uses an external AI service (Google Gemini). When you talk to it, what you wrote and the question or lesson you were working on are sent to that service to produce a reply. Your name and email address are not sent. The service has its own privacy terms, which the school has accepted on your behalf."]
      : ["The tutor runs inside this system and does not send your messages to any outside AI service."] },
    { id: "keep", title: "How long it is kept", paragraphs: [`Your tutor conversations are deleted after ${s.tutorRetentionDays} days. Your account and learning records are kept while you are a student here and are deleted when the school removes your account or you ask for it to be removed. Security records of internet addresses are kept for 90 days.`] },
    { id: "rights", title: "Your rights", paragraphs: [
      "You can ask to see what is held about you: the Account page has a button that downloads it. You can ask for mistakes to be corrected, and you can ask for your account and everything linked to it to be erased.",
      `To ask, contact the school ${contact}. Students under 18 may be asked to have a parent or guardian confirm requests.`,
    ] },
    { id: "minors", title: "Students under 18", paragraphs: [s.requireGuardianConsent
      ? "Your parent or guardian must have given consent before you can use the AI tutor. Your teacher records that consent in the class list."
      : "Your parent or guardian should be informed about this system. Your teacher can record in the class list that their consent is on file."] },
  ];
  return { version: PRIVACY_NOTICE_VERSION, schoolName: s.schoolName, contactEmail: s.contactEmail, externalAi: s.externalAi, tutorRetentionDays: s.tutorRetentionDays, requireGuardianConsent: s.requireGuardianConsent, sections };
}
