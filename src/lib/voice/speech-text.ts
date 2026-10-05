/**
 * Turns a tutor reply into text that sounds natural when read aloud (Phase 32).
 * Markdown, LaTeX and symbols are read badly (or literally) by speech synthesis: "dollar sign backslash frac...".
 * Pure and deterministic. The on-screen message is never changed; this only prepares what is spoken.
 */

const UNICODE_MINUS = /[−–—]/g;

function spokenLatex(src: string): string {
  let s = src;
  // \frac{a}{b} -> "a over b" (repeat for nesting)
  for (let i = 0; i < 4; i++) s = s.replace(/\\d?frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, "$1 over $2");
  s = s
    .replace(/\\sqrt\s*\{([^{}]*)\}/g, "square root of $1")
    .replace(/\\left|\\right/g, "")
    .replace(/\\times|\\cdot/g, " times ")
    .replace(/\\div/g, " divided by ")
    .replace(/\\leq?|\\le\b/g, " is less than or equal to ")
    .replace(/\\geq?|\\ge\b/g, " is greater than or equal to ")
    .replace(/\\neq?/g, " is not equal to ")
    .replace(/\\pi/g, " pi ")
    .replace(/\\text\s*\{([^{}]*)\}/g, "$1")
    .replace(/\^\{?2\}?/g, " squared ")
    .replace(/\^\{?3\}?/g, " cubed ")
    .replace(/\^\{?([^{}\s]+)\}?/g, " to the power of $1 ")
    .replace(/[{}]/g, "")
    .replace(/\\[a-zA-Z]+/g, " ");
  return s;
}

/** Symbols and signs as they appear in plain text -> words. */
function spokenSymbols(src: string): string {
  let s = src.replace(UNICODE_MINUS, "-");
  // |x| -> absolute value of x
  s = s.replace(/\|\s*(\(?-?\d+(?:\.\d+)?\)?|[a-z])\s*\|/gi, "absolute value of $1");
  // a negative number: a minus sign that starts a number and is not preceded by a digit/closing bracket/letter
  s = s.replace(/(^|[\s(=<>+*/×÷:])-(?=\d)/g, "$1negative ");
  s = s.replace(/\(\s*negative\s+(\d+(?:\.\d+)?)\s*\)/g, "negative $1");
  // binary minus written with spaces: "5 - 3"
  s = s.replace(/(?<=[\d)a-z])\s+-\s+(?=[\d(a-z])/gi, " minus ");
  s = s
    .replace(/×/g, " times ")
    .replace(/÷/g, " divided by ")
    .replace(/(?<=[\d)a-z])\s*\*\s*(?=[\d(a-z])/gi, " times ")
    .replace(/(?<=[\d)a-z])\s*\/\s*(?=[\d(a-z])/gi, " divided by ")
    .replace(/(?<=[\d)a-z])\s*\+\s*(?=[\d(a-z])/gi, " plus ")
    .replace(/\s*≥\s*/g, " is greater than or equal to ")
    .replace(/\s*≤\s*/g, " is less than or equal to ")
    .replace(/(?<=[\d)a-z\s])\s*>\s*(?=[\d(a-z\s-])/gi, " greater than ")
    .replace(/(?<=[\d)a-z\s])\s*<\s*(?=[\d(a-z\s-])/gi, " less than ")
    .replace(/\s*=\s*/g, " equals ")
    .replace(/[()]/g, " ");
  return s;
}

export function toSpeechText(parts: { content: string; guidingQuestion?: string | null }): string {
  const pieces = [parts.content, parts.guidingQuestion ? `Think about this. ${parts.guidingQuestion}` : ""].filter(Boolean);
  let t = pieces.join(" ");

  // LaTeX in $...$ / $$...$$
  t = t.replace(/\$\$([\s\S]+?)\$\$/g, (_m, inner) => ` ${spokenLatex(inner)} `);
  t = t.replace(/\$([^$\n]+?)\$/g, (_m, inner) => ` ${spokenLatex(inner)} `);
  t = t.replace(/\\\(([\s\S]+?)\\\)/g, (_m, inner) => ` ${spokenLatex(inner)} `);
  t = t.replace(/\\\[([\s\S]+?)\\\]/g, (_m, inner) => ` ${spokenLatex(inner)} `);
  // bare LaTeX commands that were not wrapped in dollars
  t = spokenLatex(t);

  // Markdown
  t = t
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^\s{0,3}#{1,6}\s*/gm, "")
    .replace(/^\s*[-*•]\s+/gm, ". ")
    .replace(/^\s*\d+[.)]\s+/gm, ". ")
    .replace(/(\*\*|__)(.*?)\1/g, "$2")
    .replace(/(\*|_)(?=\S)(.*?\S)\1/g, "$2")
    .replace(/https?:\/\/\S+/g, " ");

  t = spokenSymbols(t);

  // Emoji and other pictographs are read as their names ("smiling face..."): drop them
  t = t.replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, " ");

  // unmatched LaTeX delimiters or commands must never be read aloud
  t = t.replace(/[$\\]/g, " ");

  t = t.replace(/\s+/g, " ").replace(/^[\s.,;:]+/, "").replace(/\s+([.,;:!?])/g, "$1").replace(/(?:\.\s*){2,}/g, ". ").trim();
  if (t && !/[.!?]$/.test(t)) t += ".";
  return t;
}

/**
 * Splits text into utterances of at most `max` characters at sentence (then comma, then space) boundaries.
 * Some browsers cut off or stall on one long utterance, so long replies are spoken piece by piece.
 */
export function chunkForSpeech(text: string, max = 180): string[] {
  const out: string[] = [];
  const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean);
  let buf = "";
  const flush = () => { if (buf.trim()) out.push(buf.trim()); buf = ""; };
  const pushLong = (piece: string) => {
    let rest = piece;
    while (rest.length > max) {
      let cut = rest.lastIndexOf(", ", max);
      if (cut < max * 0.4) cut = rest.lastIndexOf(" ", max);
      if (cut <= 0) cut = max;
      out.push(rest.slice(0, cut + 1).trim());
      rest = rest.slice(cut + 1).trim();
    }
    if (rest) buf = rest;
  };
  for (const s of sentences) {
    if (s.length > max) { flush(); pushLong(s); continue; }
    if ((buf + " " + s).trim().length > max) flush();
    buf = (buf + " " + s).trim();
  }
  flush();
  return out;
}
