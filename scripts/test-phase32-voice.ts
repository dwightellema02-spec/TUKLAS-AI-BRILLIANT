/**
 * Tuklas AI - Phase 32: voice tutor. Spoken-math normalisation, speech-friendly replies, voice/text parity.
 *   AI_PROVIDER=local npx tsx scripts/test-phase32-voice.ts
 * Parts 1-4 are pure unit/property tests; part 5 is black-box over HTTP against a spawned server.
 * NOTE: nothing here uses a microphone or a speech engine. Real-device behaviour needs a physical test.
 */
import crypto from "crypto";
import { spawn, type ChildProcess } from "child_process";
import { normalizeSpokenMath } from "../src/lib/voice/spoken-math";
import { toSpeechText, chunkForSpeech } from "../src/lib/voice/speech-text";
import { parseAnyProblem, findNumberInText } from "../src/lib/ai/conversation/arith";
import { describeRecognitionError } from "../src/lib/voice/capabilities";
const DB_MODE = /^postgres(ql)?:\/\//.test(process.env.DATABASE_URL ?? "");
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@tuklas.ai";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "Tuklas2026!";
const PASSWORD = "Sturdy-Pass1";
const run = crypto.randomBytes(3).toString("hex");
const email = (t: string) => `p32.${t}.${run}@example.edu`;

let passed = 0, failed = 0;
const assert = (c: boolean, m: string) => {
  if (c) { passed++; if (process.env.VERBOSE) console.log(`  ✅ ${m}`); } else { failed++; console.error(`  ❌ FAILED: ${m}`); }
};
const section = (t: string) => console.log(`\n--- ${t} ---`);
const meta = (o: object) => JSON.stringify(o);


// -------------------------------------------------------------------------------------------------
// deterministic pseudo-random numbers so any failure is reproducible
let seed = 20261005;
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 0x100000000; };
const pick = <T,>(xs: T[]): T => xs[Math.floor(rnd() * xs.length)];
const int = (lo: number, hi: number) => lo + Math.floor(rnd() * (hi - lo + 1));

const EN_ONES = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const EN_TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
function enWords(n: number, hyphen: boolean): string {
  if (n < 20) return EN_ONES[n];
  if (n < 100) return n % 10 === 0 ? EN_TENS[n / 10] : `${EN_TENS[Math.floor(n / 10)]}${hyphen ? "-" : " "}${EN_ONES[n % 10]}`;
  if (n < 1000) return `${EN_ONES[Math.floor(n / 100)]} hundred${n % 100 ? (rnd() < 0.5 ? " and " : " ") + enWords(n % 100, hyphen) : ""}`;
  return `${enWords(Math.floor(n / 1000), hyphen)} thousand${n % 1000 ? " " + enWords(n % 1000, hyphen) : ""}`;
}
const FIL_ONES = ["wala", "isa", "dalawa", "tatlo", "apat", "lima", "anim", "pito", "walo", "siyam", "sampu"];
const FIL_TENS = ["", "", "dalawampu", "tatlumpu", "apatnapu", "limampu", "animnapu", "pitumpu", "walumpu", "siyamnapu"];
function filWords(n: number): string {
  if (n <= 10) return FIL_ONES[n];
  if (n < 20) return `labing${rnd() < 0.5 ? "-" : ""}${FIL_ONES[n - 10]}`;
  if (n % 10 === 0) return FIL_TENS[n / 10];
  return `${FIL_TENS[Math.floor(n / 10)]}${rnd() < 0.5 ? "'t " : " at "}${FIL_ONES[n % 10]}`;
}
const NEG_WORDS = ["negative", "minus"];


function unitTests() {
  section("1. Spoken maths -> digits and symbols (phrase table)");
  const table: Array<[string, string]> = [
    ["negative five plus three", "-5 + 3"], ["minus five plus three", "-5 + 3"], ["five minus negative two", "5 - (-2)"],
    ["negative eight times three", "-8 * 3"], ["twelve divided by negative four", "12 / (-4)"], ["five times negative three", "5 * (-3)"],
    ["seven minus ten", "7 - 10"], ["eight minus twelve", "8 - 12"], ["negative 5 plus 3", "-5 + 3"], ["negative five plus 3", "-5 + 3"],
    ["negative five plus negative three", "-5 + (-3)"], ["seven plus negative two", "7 + (-2)"], ["twenty plus thirty", "20 + 30"],
    ["absolute value of negative fourteen", "absolute value of -14"], ["the absolute value of minus fourteen", "the absolute value of -14"],
    ["what is the opposite of negative nine", "what is the opposite of -9"], ["the additive inverse of five", "the additive inverse of 5"],
    ["x plus five equals twelve", "x + 5 = 12"], ["y minus four equals nine", "y - 4 = 9"], ["ex plus five equals twelve", "x + 5 = 12"],
    ["is negative three greater than negative seven", "is -3 greater than -7"], ["which is greater negative five or negative two", "which is greater -5 or -2"],
    ["negative twenty three", "-23"], ["negative twenty-three", "-23"], ["one hundred minus five", "100 - 5"], ["one hundred and five", "105"], ["a hundred", "100"],
    ["two thousand three hundred forty five", "2345"], ["nineteen", "19"], ["fourteen", "14"], ["negative fourteen", "-14"], ["the answer is fourteen", "the answer is 14"],
    ["what is minus five", "what is -5"], ["the answer is minus three", "the answer is -3"], ["five multiplied by two", "5 * 2"], ["five added to three", "5 + 3"],
    ["negative lima plus tatlo", "-5 + 3"], ["negatibo lima plus tatlo", "-5 + 3"], ["labing-apat", "14"], ["labinlima", "15"], ["dalawampu't lima", "25"],
    ["dalawampu at lima", "25"], ["tatlumpu", "30"], ["siyamnapu't siyam", "99"], ["isang daan", "100"], ["negative labing-apat", "-14"],
    ["ano po ang absolute value ng negative lima", "ano po ang absolute value ng -5"], ["x plus tatlo equals sampu", "x + 3 = 10"],
    ["five plus to", "5 + 2"], ["to plus five", "2 + 5"], ["negative to plus for", "-2 + 4"], ["five minus won", "5 - 1"], ["ate plus tree", "8 + 3"],
    ["I have two questions", "i have 2 questions"],
  ];
  for (const [input, expected] of table) {
    const r = normalizeSpokenMath(input);
    assert(r.text === expected, `"${input}" -> "${r.text}"${r.text === expected ? "" : `   (expected "${expected}")`}`);
  }
  assert(normalizeSpokenMath("five plus to").uncertain === true && normalizeSpokenMath("five plus two").uncertain === false, "A repaired homophone is flagged as uncertain; a clear phrase is not");

  section("2. Ordinary talk is left alone");
  const talk = ["I don't understand this one", "which one is bigger", "can you give me one more example", "what is the answer", "just tell me the answer", "for example", "I want to know why", "to be honest I'm lost", "thanks for helping", "I'm looking for the rule", "what does absolute value mean", "can you explain negative numbers", "why is a negative times a negative positive", "equal to what", "I am waiting for you", "hello", "", "   ", "ano po ang ibig sabihin niyan", "hindi ko po maintindihan", "pwede po ba ng isa pang halimbawa" ];
  for (const t of talk) {
    const r = normalizeSpokenMath(t);
    assert(r.changed === false && (r.text === t.trim() || r.text === ""), `unchanged: "${t}"${r.changed ? ` (became "${r.text}")` : ""}`);
  }
  assert(normalizeSpokenMath("which one is bigger").changed === false && normalizeSpokenMath("give me one more").changed === false, "'one' inside a sentence is not guessed to be the number 1 (it is usually a pronoun)");
  assert(normalizeSpokenMath("one").text === "1" && normalizeSpokenMath("isa").text === "1", "...but a whole answer of just 'one' / 'isa' is the number");
  assert(normalizeSpokenMath("one plus one").text === "1 + 1", "...but 'one plus one' is");

  section("3. Property test: spoken integer arithmetic is understood exactly (English, 3,000 cases)");
  let okEn = 0, badEn: string[] = [];
  for (let n = 0; n < 3000; n++) {
    const a = int(-99, 99); let b = int(-99, 99);
    const op = pick(["+", "-", "*", "/"] as const);
    if (op === "/") { b = b === 0 ? 7 : b; }
    const numWords = (x: number) => (x < 0 ? `${pick(NEG_WORDS)} ${enWords(-x, rnd() < 0.5)}` : enWords(x, rnd() < 0.5));
    const opWord = { "+": pick(["plus", "added to"]), "-": "minus", "*": pick(["times", "multiplied by"]), "/": "divided by" }[op];
    const spoken = `${pick(["", "what is ", "compute ", "so "])}${numWords(a)} ${opWord} ${numWords(b)}`;
    const expectedVal = op === "+" ? a + b : op === "-" ? a - b : op === "*" ? a * b : a / b;
    const parsed = parseAnyProblem(normalizeSpokenMath(spoken).text);
    const integerResult = Number.isInteger(expectedVal);
    if (!integerResult) { if (parsed === undefined) okEn++; else badEn.push(`${spoken} -> parsed a non-integer division`); continue; }
    if (parsed && parsed.kind === "BINARY" && parsed.a === a && parsed.b === b && parsed.op === op && parsed.expected === expectedVal) okEn++;
    else if (badEn.length < 5) badEn.push(`${spoken} -> ${JSON.stringify(normalizeSpokenMath(spoken).text)} -> ${JSON.stringify(parsed)}`);
  }
  assert(okEn === 3000, `3000/3000 spoken English expressions parse to exactly the intended problem${okEn === 3000 ? "" : ` (${okEn}; first failures: ${badEn.join(" | ")})`}`);

  section("4. Property test: Taglish numbers (Filipino number words, 2,000 cases)");
  let okFil = 0; const badFil: string[] = [];
  for (let n = 0; n < 2000; n++) {
    const a = int(-99, 99); const b = int(-99, 99);
    const op = pick(["+", "-", "*"] as const);
    const w = (x: number) => (x < 0 ? `${pick(["negative", "negatibo", "minus"])} ${filWords(-x)}` : filWords(x));
    const opWord = { "+": "plus", "-": "minus", "*": "times" }[op];
    const spoken = `${w(a)} ${opWord} ${w(b)}`;
    const expected = op === "+" ? a + b : op === "-" ? a - b : a * b;
    const parsed = parseAnyProblem(normalizeSpokenMath(spoken).text);
    if (parsed && parsed.kind === "BINARY" && parsed.a === a && parsed.b === b && parsed.op === op && parsed.expected === expected) okFil++;
    else if (badFil.length < 5) badFil.push(`${spoken} -> ${JSON.stringify(normalizeSpokenMath(spoken).text)}`);
  }
  assert(okFil === 2000, `2000/2000 Taglish expressions parse to exactly the intended problem${okFil === 2000 ? "" : ` (${okFil}; ${badFil.join(" | ")})`}`);

  section("5. Every number word on its own, 0-9999, both languages");
  let numOk = 0;
  for (let n = 0; n <= 9999; n++) { const r = normalizeSpokenMath(n === 1 ? "plus one" : enWords(n, n % 2 === 0)); if ((n === 1 ? r.text === "1" : r.text === String(n))) numOk++; }
  assert(numOk === 10000, `All 10,000 English number phrases 0-9999 convert exactly (${numOk}/10000)`);
  let filOk = 0;
  for (let n = 0; n <= 99; n++) { if (normalizeSpokenMath(n === 1 ? "plus isa" : filWords(n)).text === String(n)) filOk++; }
  assert(filOk === 100, `All Filipino number phrases 0-99 convert exactly (${filOk}/100)`);

  section("6. Other problem kinds, spoken");
  for (let n = 0; n < 300; n++) {
    const a = int(1, 40);
    const spokenNeg = `${pick(NEG_WORDS)} ${enWords(a, true)}`;
    const abs = parseAnyProblem(normalizeSpokenMath(`what is the absolute value of ${spokenNeg}`).text);
    if (!(abs?.kind === "ABS" && abs.a === -a && abs.expected === a)) { assert(false, `absolute value of ${spokenNeg} -> ${JSON.stringify(abs)}`); break; }
    const opp = parseAnyProblem(normalizeSpokenMath(`the opposite of ${spokenNeg}`).text);
    if (!(opp?.kind === "OPPOSITE" && opp.a === -a && opp.expected === a)) { assert(false, `opposite of ${spokenNeg} -> ${JSON.stringify(opp)}`); break; }
    const k = int(1, 20), r = int(1, 60);
    const eq = parseAnyProblem(normalizeSpokenMath(`x plus ${enWords(k, true)} equals ${enWords(r, true)}`).text);
    if (!(eq?.kind === "EQUATION" && eq.a === k && eq.b === r && eq.expected === r - k)) { assert(false, `x plus ${k} equals ${r} -> ${JSON.stringify(eq)}`); break; }
    const x = -int(1, 30), y = -int(31, 60);
    const cmp = parseAnyProblem(normalizeSpokenMath(`is ${pick(NEG_WORDS)} ${enWords(-x, true)} greater than ${pick(NEG_WORDS)} ${enWords(-y, true)}`).text);
    if (!(cmp?.kind === "COMPARE" && cmp.a === x && cmp.b === y && cmp.expected === 1)) { assert(false, `compare ${x} ${y} -> ${JSON.stringify(cmp)}`); break; }
    if (n === 299) assert(true, "300 spoken absolute-value, opposite, equation and comparison problems all parse to the intended problem");
  }

  section("7. Robustness");
  let idem = 0, total = 0;
  for (const [input] of table) { total++; const once = normalizeSpokenMath(input).text; if (normalizeSpokenMath(once).text === once) idem++; }
  assert(idem === total, `Normalising twice changes nothing more (${idem}/${total})`);
  const soup = ["negative", "minus", "plus", "five", "to", "for", "ate", "one", "hundred", "and", "x", "equals", "labing-apat", "dalawampu't", "at", "isa", "over", "🙂", "−", "3.5", "∞", "a", "of", "by", "divided", "equal"];
  let threw = false; let maxLen = 0;
  for (let n = 0; n < 5000; n++) {
    const len = int(0, 14);
    const phrase = Array.from({ length: len }, () => pick(soup)).join(" ");
    try { const r = normalizeSpokenMath(phrase); maxLen = Math.max(maxLen, r.text.length); if (typeof r.text !== "string") threw = true; } catch { threw = true; }
  }
  assert(!threw, "5,000 random token soups never throw");
  assert(maxLen < 200, "...and never grow the text unreasonably");
  const huge = normalizeSpokenMath("five plus ".repeat(5000) + "three");
  assert(typeof huge.text === "string", "A 50,000-character transcript is handled without error");
  assert(normalizeSpokenMath(undefined as any).text === "" && normalizeSpokenMath(null as any).changed === false, "Non-string input returns empty text");

  section("8. The typed-number parser (bug found while building voice: 'fourteen' was read as 4)");
  const teens: Array<[string, number]> = [["eleven", 11], ["twelve", 12], ["thirteen", 13], ["fourteen", 14], ["fifteen", 15], ["sixteen", 16], ["seventeen", 17], ["eighteen", 18], ["nineteen", 19]];
  for (const [w, v] of teens) assert(findNumberInText(w) === v && findNumberInText(`negative ${w}`) === -v, `findNumberInText("${w}") = ${v}`);
  assert(findNumberInText("twenty one") === 21 && findNumberInText("twenty-three") === 23 && findNumberInText("four") === 4 && findNumberInText("negative four") === -4, "tens + ones and plain digits still work");

  section("9. Replies prepared for speaking");
  const speak = (c: string, g?: string) => toSpeechText({ content: c, guidingQuestion: g });
  assert(speak("What is $|-14|$?") === "What is absolute value of negative 14?", "|-14| is read as 'absolute value of negative 14'");
  assert(/negative 5 plus 3 equals negative 2/.test(speak("Think of $-5 + 3 = -2$.")), "an equation is read with 'negative', 'plus' and 'equals'");
  assert(speak("The fraction $\\frac{1}{2}$ is not an integer.").includes("1 over 2"), "a fraction is read as 'one over two'");
  assert(speak("Try 8 − 12 and 5 × (−2) and 12 ÷ 4.") === "Try 8 minus 12 and 5 times negative 2 and 12 divided by 4.", "Unicode signs are read as words");
  assert(speak("Is −3 > −7?") === "Is negative 3 greater than negative 7?", "a comparison is read naturally (no doubled 'is')");
  assert(speak("**Bold** and _italic_ and `code`") === "Bold and italic and code.", "Markdown marks are not spoken");
  assert(speak("- one\n- two").startsWith("one") , "A bullet list is read as separate sentences without a leading mark");
  assert(speak("See [the lesson](https://x.test/a) now 😊").trim() === "See the lesson now.", "links read as their text; emoji are dropped");
  assert(speak("Which way?", "Is it left or right?").includes("Think about this. Is it left or right?"), "the guiding question is spoken after the reply");
  const leaksMarkup = (t: string) => /[$\\*_#`|^{}]/.test(t);
  const mixed = ["$$\\frac{3}{4} + \\frac{1}{4}$$", "# Title\n**a** _b_ `c` $x^2$", "$\\sqrt{16} = 4$ and $\\left(-3\\right)$", "|−5| = 5", "$a \\times b \\div c$"];
  assert(mixed.every((m) => !leaksMarkup(speak(m))), "no LaTeX, Markdown or bar/brace characters survive into the spoken text");
  let fuzzOk = true;
  const frag = ["$", "\\frac{", "}{", "}", "**", "_", "|", "-", "5", " ", "x", "^2", "\\times", "(", ")", "=", "\n", "😀", "−", "<", ">", "http://a.b", "[a](b)"];
  for (let n = 0; n < 3000; n++) { try { const t = speak(Array.from({ length: int(0, 30) }, () => pick(frag)).join("")); if (typeof t !== "string" || /\$|\\/.test(t)) fuzzOk = false; } catch { fuzzOk = false; } }
  assert(fuzzOk, "3,000 random markup/LaTeX fragments never throw and never leave $ or \\ in the spoken text");
  const long = "This is a sentence about integers. ".repeat(40) + "word ".repeat(100);
  const chunks = chunkForSpeech(long, 180);
  assert(chunks.every((c) => c.length <= 180) && chunks.length > 5, `A long reply is split into short utterances (${chunks.length} chunks, longest ${Math.max(...chunks.map((c) => c.length))})`);
  assert(chunks.join(" ").replace(/\s+/g, " ").trim() === long.replace(/\s+/g, " ").trim(), "...and no words are lost or duplicated");
  assert(chunkForSpeech("", 180).length === 0 && chunkForSpeech("Short.", 180).length === 1, "Empty text gives no chunks; short text gives one");

  section("10. Microphone errors become plain-language guidance");
  assert(describeRecognitionError("not-allowed").fatal && /blocked/.test(describeRecognitionError("not-allowed").message), "'not-allowed' -> blocked, fatal, tells the student what to do");
  assert(describeRecognitionError("audio-capture").fatal && /No microphone/.test(describeRecognitionError("audio-capture").message), "'audio-capture' -> no microphone found");
  assert(!describeRecognitionError("no-speech").fatal && describeRecognitionError("no-speech").retry, "'no-speech' -> try again, not fatal");
  assert(describeRecognitionError("aborted").message === "", "'aborted' (we stopped it ourselves) shows no error");
  assert(!describeRecognitionError("something-new").fatal, "an unknown error code is not treated as fatal");
}

async function main() {
  unitTests();

  const port = 4600 + Math.floor(Math.random() * 90);
  const base = `http://127.0.0.1:${port}`;
  const secret = crypto.randomBytes(32).toString("hex");
  let server: ChildProcess | undefined;
  const start = async () => {
    server = spawn("npx", ["tsx", "server.ts"], {
      env: { ...process.env, PORT: String(port), NODE_ENV: "development", AI_PROVIDER: "local", AUTH_SECRET: secret },
      stdio: ["ignore", "ignore", "ignore"], detached: true,
    });
    for (let i = 0; i < 90; i++) { await new Promise((r) => setTimeout(r, 500)); try { if ((await fetch(`${base}/api/health`)).ok) return; } catch { /* waiting */ } }
    throw new Error("server did not start");
  };
  const stop = async () => { try { if (server?.pid) process.kill(-server.pid, "SIGTERM"); } catch { /* gone */ } await new Promise((r) => setTimeout(r, 1500)); };
  const api = async (method: string, path: string, token?: string, body?: unknown) => {
    const res = await fetch(`${base}${path}`, { method, headers: { ...(body !== undefined ? { "Content-Type": "application/json" } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body !== undefined ? JSON.stringify(body) : undefined });
    const text = await res.text(); let json: any = {}; try { json = JSON.parse(text); } catch { /* */ }
    return { status: res.status, json, text };
  };
  const reg = async (tag: string) => {
    const r = await api("POST", "/api/auth/register", undefined, { name: `P32 ${tag}`, email: `p32.${tag}.${Date.now()}@example.edu`, password: "Sturdy-Pass1" });
    return { token: r.json.token as string, id: r.json.user.id as string };
  };

  try {
    await start();
    console.log(`\nServer up`);
    const S = await reg("a");
    const tutor = (tok: string, body: any) => api("POST", "/api/ai/tutor", tok, { helpLevel: "LEVEL_1_HINT", ...body });

    section("11. Voice and text are the same tutor");
    const t1 = await tutor(S.token, { studentQuery: "what is the absolute value of negative fourteen", inputChannel: "voice" });
    assert(t1.status === 200 && t1.json.data.input?.channel === "voice" && t1.json.data.input?.understoodAs === "what is the absolute value of -14", `A spoken problem is understood as digits (understoodAs: ${JSON.stringify(t1.json.data?.input?.understoodAs)})`);
    assert(t1.json.data.pedagogy?.strategy === "OPEN_PROBLEM", `...and the tutor opens the problem Socratically (strategy ${t1.json.data?.pedagogy?.strategy})`);
    const conv = t1.json.data.conversationId as string;
    const reply1 = t1.json.data.message.content + " " + (t1.json.data.message.guidingQuestion ?? "");
    assert(!/\b14\b/.test(reply1) || /\|-14\||-14|negative 14/.test(reply1) && !/(equals|is|=)\s*14\b/.test(reply1), "The reply does not hand over the answer");
    const t2 = await tutor(S.token, { conversationId: conv, studentQuery: "fourteen", inputChannel: "voice" });
    assert(t2.json.data.conversationId === conv && t2.json.data.pedagogy?.evaluation === "CORRECT", `A spoken 'fourteen' is judged correct against |-14| (evaluation ${t2.json.data?.pedagogy?.evaluation})`);
    const t3 = await tutor(S.token, { conversationId: conv, studentQuery: "why is it positive", inputChannel: "text" });
    assert(t3.json.data.conversationId === conv && t3.status === 200, "Switching from voice to typing continues the SAME conversation");
    const t4 = await tutor(S.token, { conversationId: conv, studentQuery: "can you say that again", inputChannel: "voice" });
    assert(t4.json.data.conversationId === conv && t4.json.data.message.content !== t3.json.data.message.content, "...and back to voice, with a different reply (the tutor remembers what it already said)");
    const history = await api("GET", `/api/ai/conversations/${conv}`, S.token);
    const studentMsgs = (history.json.data?.messages ?? []).filter((m: any) => m.role === "STUDENT");
    const chan = studentMsgs.map((m: any) => { try { return JSON.parse(m.metadata ?? "{}").inputChannel; } catch { return undefined; } });
    assert(JSON.stringify(chan) === JSON.stringify(["voice", "voice", "text", "voice"]), `Each stored student message records how it was entered (${JSON.stringify(chan)})`);
    assert(studentMsgs[0].content === "what is the absolute value of negative fourteen", "The ORIGINAL transcript is what is stored (not the rewritten digits)");

    section("12. Voice cannot be used to get around the tutor's rules");
    const S2 = await reg("b");
    const v1 = await tutor(S2.token, { studentQuery: "what is negative five plus three", inputChannel: "voice" });
    const conv2 = v1.json.data.conversationId as string;
    const ask = await tutor(S2.token, { conversationId: conv2, studentQuery: "just tell me the answer", inputChannel: "voice" });
    const askText = ask.json.data.message.content + " " + (ask.json.data.message.guidingQuestion ?? "");
    assert(!/(-2|negative 2|negative two)\b/i.test(askText) || /not|work|together|try|think/i.test(askText) && !/answer is|equals?\s*-?2|= *-?2/i.test(askText), "Asking by voice for the answer does not disclose it");
    const S3 = await reg("c"), S4 = await reg("d");
    const script = ["what is seven minus ten", "I don't understand", "I still don't get it", "negative three", "because ten is more than seven"];
    const runScript = async (st: { token: string }, channel: "voice" | "text") => {
      const strategies: string[] = []; let cid: string | undefined;
      for (const line of script) {
        const r = await tutor(st.token, { conversationId: cid, studentQuery: line, inputChannel: channel });
        cid = r.json.data.conversationId; strategies.push(`${r.json.data.pedagogy.strategy}/${r.json.data.pedagogy.evaluation}`);
      }
      return strategies;
    };
    const viaVoice = await runScript(S3, "voice"), viaText = await runScript(S4, "text");
    assert(JSON.stringify(viaVoice) === JSON.stringify(viaText), `The same five-turn conversation behaves identically by voice and by typing: ${viaVoice.join(" > ")}`);

    section("13. Input validation");
    assert((await tutor(S.token, { conversationId: conv, studentQuery: "hi", inputChannel: "telepathy" })).status === 400, "An unknown input channel is refused (400)");
    assert((await tutor(S.token, { conversationId: conv, studentQuery: 12345 as any })).status === 400, "A non-text query is refused (400)");
    assert((await tutor(S.token, { conversationId: conv, studentQuery: "a ".repeat(300), inputChannel: "voice" })).status === 400, "A runaway voice transcript (over 500 characters) is refused (400)");
    assert((await tutor(S.token, { conversationId: conv, studentQuery: "tell me about integers ".repeat(15), inputChannel: "text" })).status === 200, "...while typing the same length is fine");
    assert((await api("POST", "/api/ai/tutor", undefined, { studentQuery: "hi", inputChannel: "voice" })).status === 401, "Signed out -> 401");
    const noQuery = await tutor(S.token, { conversationId: conv, inputChannel: "voice" });
    assert(noQuery.status === 200, "A request with no query and a channel is still a normal hint request");
    const other = await reg("e");
    const stolen = await tutor(other.token, { conversationId: conv, studentQuery: "hello", inputChannel: "voice" });
    assert(stolen.json.data?.conversationId !== conv, "Another student cannot write into this conversation (a new one is started for them)");
  } finally {
    await stop();
  }

  console.log(`\n======================================================\nPHASE 32 RESULTS: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
  console.log("ALL PHASE 32 AUTOMATED CHECKS PASSED. These do not use a microphone or a speech engine; see docs/PHASE_32_VERIFICATION.md for what needs a real device.");
  process.exit(0);
}
main().catch((e) => { console.error("Phase 32 suite crashed:", e); process.exit(1); });
