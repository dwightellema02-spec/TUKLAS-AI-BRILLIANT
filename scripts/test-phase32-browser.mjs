/**
 * Phase 32 real-browser check of the voice tutor UI in Chromium against a spawned dev server.
 *
 * SIMULATED SPEECH ENGINE: a headless server has no microphone and no speech service, so this script injects a FAKE
 * SpeechRecognition / speechSynthesis (addInitScript) that behaves like the standard Web Speech API. It proves the UI,
 * state handling, transcript -> tutor -> reply flow, barge-in, error handling and the typing fallback. It does NOT prove
 * that a real phone/laptop microphone, accent, noise level or browser speech service works. That needs a person.
 *   node scripts/test-phase32-browser.mjs
 */
import { chromium } from "playwright-core";
import { spawn } from "child_process";
import crypto from "crypto";
import fs from "fs";

const port = 4700 + Math.floor(Math.random() * 90);
const base = `http://127.0.0.1:${port}`;
const exe = process.env.CHROMIUM_PATH ||
  fs.readdirSync("/opt/pw-browsers").filter((d) => /^chromium-\d+$/.test(d)).map((d) => `/opt/pw-browsers/${d}/chrome-linux/chrome`)[0];
try { fs.rmSync("data/users-persistence.json", { force: true }); } catch { /* */ }
const srv = spawn("npx", ["tsx", "server.ts"], {
  env: { ...process.env, PORT: String(port), NODE_ENV: "development", AI_PROVIDER: "local", AUTH_SECRET: crypto.randomBytes(32).toString("hex"), DATABASE_URL: "" },
  stdio: "ignore", detached: true,
});
let failed = 0;
const check = (ok, msg) => { if (!ok) failed++; console.log((ok ? "PASS " : "FAIL ") + msg); };
const finish = async (browser) => {
  try { await browser?.close(); } catch { /* */ }
  try { process.kill(-srv.pid, "SIGTERM"); } catch { /* */ }
  console.log(failed === 0 ? "\nALL BROWSER CHECKS PASSED (simulated speech engine; see header)" : `\n${failed} CHECK(S) FAILED`);
  process.exit(failed === 0 ? 0 : 1);
};
for (let i = 0; i < 90; i++) { await new Promise((r) => setTimeout(r, 500)); try { if ((await fetch(base + "/api/health")).ok) break; } catch { /* waiting */ } }

const FAKE_ENGINE = () => {
  window.__spoken = []; window.__cancels = 0; window.__recStarts = 0; window.__rec = null; window.__speaking = null;
  class FakeRec {
    constructor() { this.lang = ""; window.__rec = this; }
    start() {
      window.__recStarts++;
      if (window.__recMode === "denied") { setTimeout(() => { this.onerror?.({ error: "not-allowed" }); this.onend?.(); }, 20); return; }
      setTimeout(() => this.onstart?.(), 10);
    }
    stop() { setTimeout(() => this.onend?.(), 10); }
    abort() { this.onend = null; }
  }
  window.__say = (text, isFinal = true) => {
    const r = window.__rec; if (!r) return false;
    const res = [{ transcript: text }]; res.isFinal = isFinal;
    r.onresult?.({ resultIndex: 0, results: [res] });
    if (isFinal) setTimeout(() => r.onend?.(), 10);
    return true;
  };
  class Utt { constructor(t) { this.text = t; this.lang = ""; } }
  window.SpeechSynthesisUtterance = Utt;
  const fakeSynth = {
    speak(u) { window.__spoken.push(u.text); window.__speaking = u; fakeSynth.speaking = true; },
    cancel() { window.__cancels++; fakeSynth.speaking = false; window.__speaking = null; },
    getVoices() { return []; }, speaking: false,
  };
  Object.defineProperty(window, "speechSynthesis", { value: fakeSynth, configurable: true });
  window.__finishSpeech = () => { const u = window.__speaking; window.__speaking = null; fakeSynth.speaking = false; u?.onend?.(); };
  if (window.__recMode !== "none") { window.SpeechRecognition = FakeRec; window.webkitSpeechRecognition = FakeRec; }
};

const browser = await chromium.launch({ executablePath: exe, args: ["--no-sandbox"] });
const errors = [];
const replies = [];
async function open({ mode = "ok", viewport = { width: 1280, height: 900 }, fresh = true } = {}) {
  const ctx = await browser.newContext({ viewport });
  const email = `p32.${crypto.randomBytes(4).toString("hex")}@example.edu`;
  const reg = await ctx.request.post(base + "/api/auth/register", { data: { name: "Voice Tester", email, password: "Sturdy-Pass1" } });
  if (!reg.ok()) throw new Error("register failed " + reg.status());
  const page = await ctx.newPage();
  await page.addInitScript((m) => { window.__recMode = m; }, mode);
  if (mode !== "unsupported") await page.addInitScript(FAKE_ENGINE);
  else await page.addInitScript(() => { delete window.SpeechRecognition; delete window.webkitSpeechRecognition; try { Object.defineProperty(window, "webkitSpeechRecognition", { value: undefined, configurable: true }); } catch { /* */ } });
  page.on("pageerror", (e) => { if (!/WebSocket/i.test(e.message)) errors.push(e.message); });
  page.on("response", async (r) => {
    if (r.url().endsWith("/api/ai/tutor") && r.request().method() === "POST") {
      try { replies.push({ req: JSON.parse(r.request().postData() || "{}"), res: (await r.json()).data }); } catch { /* */ }
    }
  });
  await page.goto(base + "/student/lessons/lsn_01");
  await page.getByRole("button", { name: "AI Tutor" }).first().click();
  await page.getByRole("heading", { name: "Tuklas AI Tutor" }).waitFor({ timeout: 20000 });
  await page.waitForFunction(() => document.querySelectorAll("[class*='rounded-bl']").length >= 1, null, { timeout: 20000 });
  await page.waitForTimeout(600);
  replies.length = 0; // ignore the automatic opening hint; tests count only what they send
  return { ctx, page };
}
const waitReplies = async (n, ms = 20000) => { const t0 = Date.now(); while (replies.length < n && Date.now() - t0 < ms) await new Promise((r) => setTimeout(r, 100)); };
const tid = (p, id) => p.getByTestId(id);

// ---------- 1. unsupported browser: no mic, typing works
{
  const { ctx, page } = await open({ mode: "unsupported" });
  // drop the injected engine entirely for this scenario
  check((await tid(page, "mic-button").count()) === 0, "unsupported browser: no microphone button is shown");
  check((await tid(page, "voice-unavailable").count()) === 1, "unsupported browser: the reason is available to screen readers");
  const before = replies.length;
  await page.getByPlaceholder(/Ask a question/).fill("what is negative five plus three");
  await page.getByPlaceholder(/Ask a question/).press("Enter");
  await waitReplies(before + 1);
  check(replies.length > before && replies.at(-1).req.inputChannel === "text", "unsupported browser: typing works and is recorded as text");
  await ctx.close();
}

// ---------- 2. permission denied
{
  const { ctx, page } = await open({ mode: "denied" });
  await tid(page, "mic-button").click();
  await page.waitForFunction(() => /blocked|allow/i.test(document.querySelector("[data-testid=voice-status]")?.textContent || ""), null, { timeout: 5000 }).catch(() => {});
  const status = (await tid(page, "voice-status").textContent()) ?? "";
  check(/blocked|allow|permission|microphone/i.test(status), `permission denied: a plain explanation is shown ("${status.trim().slice(0, 90)}")`);
  check(await tid(page, "mic-button").isDisabled(), "permission denied: the microphone button is disabled rather than retrying forever");
  const before = replies.length;
  await page.getByPlaceholder(/Ask a question/).fill("hello");
  await page.getByPlaceholder(/Ask a question/).press("Enter");
  await waitReplies(before + 1);
  check(replies.length > before, "permission denied: typing still works");
  await ctx.close();
}

// ---------- 3. successful voice turn, transcript is editable, reply is read aloud
{
  const { ctx, page } = await open();
  check((await tid(page, "voice-notice").count()) === 1 && /text|recording/i.test(await tid(page, "voice-notice").textContent()), "first use: the privacy notice says only text is kept");
  await tid(page, "mic-button").click();
  await page.waitForFunction(() => window.__recStarts === 1);
  await page.waitForFunction(() => /listening/i.test(document.querySelector("[data-testid=voice-status]")?.textContent || ""), null, { timeout: 3000 }).catch(() => {});
  check(/listening/i.test((await tid(page, "voice-status").textContent()) ?? ""), "pressing the microphone shows that it is listening");
  await page.evaluate(() => window.__say("what is the absolute value of negative fourteen", false));
  check(((await tid(page, "voice-status").textContent()) ?? "").includes("absolute value"), "the live (interim) transcript is shown while speaking");
  await page.evaluate(() => window.__say("what is the absolute value of negative fourteen", true));
  const input = page.getByPlaceholder(/Ask a question/);
  await page.waitForFunction(() => (document.querySelector("input[aria-label='Message to the tutor']")?.value || "").includes("negative fourteen"));
  check(replies.length === 0, "the final transcript goes into the text box and is NOT sent automatically (student can fix it)");
  await input.fill("what is the absolute value of negative fourteen please");
  await input.press("Enter");
  await waitReplies(1);
  check(replies[0].req.inputChannel === "text", "a transcript the student edited is recorded as typed input (it is no longer exactly what was heard)");
  check(replies[0].res.input?.understoodAs?.includes("-14"), `the server understood the words as digits (${replies[0].res.input?.understoodAs})`);
  await page.waitForFunction(() => document.querySelector("[data-testid=heard-as]"), null, { timeout: 5000 });
  check(/-14/.test((await tid(page, "heard-as").textContent()) ?? ""), "the student is shown how their words were understood");
  // an unedited transcript is recorded as voice
  await tid(page, "mic-button").click();
  await page.waitForFunction(() => window.__recStarts >= 1);
  await page.evaluate(() => window.__say("fourteen", true));
  await page.waitForFunction(() => document.querySelector("input[aria-label='Message to the tutor']")?.value === "fourteen");
  await input.press("Enter");
  await waitReplies(2);
  check(replies[1].req.inputChannel === "voice" && replies[1].res.input?.understoodAs === "14", "an unedited transcript is recorded as voice and 'fourteen' is understood as 14");
  // typed message after a voice one goes back to channel text
  await input.fill("why is it positive");
  await input.press("Enter");
  await waitReplies(3);
  check(replies[2].req.inputChannel === "text", "a typed message after a voice one is recorded as text");
  check(replies[2].res.conversationId === replies[0].res.conversationId, "voice and typing are one conversation");
  await ctx.close();
}

// ---------- 4. reading replies aloud, barge-in, Escape, close
{
  const { ctx, page } = await open({ viewport: { width: 390, height: 780 } });
  check(await tid(page, "speak-toggle").isVisible() && await tid(page, "mic-button").isVisible(), "mobile viewport: microphone and read-aloud controls are visible");
  await tid(page, "speak-toggle").click();
  const input = page.getByPlaceholder(/Ask a question/);
  await input.fill("what is negative five plus three");
  await input.press("Enter");
  await waitReplies(1);
  await page.waitForFunction(() => window.__spoken.length > 0, null, { timeout: 5000 });
  const spoken = await page.evaluate(() => window.__spoken.join(" "));
  check(!/[$\\*_#`|^{}]/.test(spoken) && spoken.length > 10, `what is spoken has no LaTeX/Markdown ("${spoken.slice(0, 80)}...")`);
  const cancelsBefore = await page.evaluate(() => window.__cancels);
  await tid(page, "mic-button").click();
  check((await page.evaluate(() => window.__cancels)) > cancelsBefore, "barge-in: pressing the microphone while the tutor talks stops the speech");
  await page.waitForFunction(() => window.__recStarts >= 1);
  check(true, "barge-in: ...and starts listening");
  await page.evaluate(() => window.__rec.onend?.());
  // Escape stops
  await input.fill("one more");
  await input.press("Enter");
  await waitReplies(2);
  await page.waitForFunction(() => window.__spoken.length >= 2);
  const c2 = await page.evaluate(() => window.__cancels);
  await input.press("Escape");
  check((await page.evaluate(() => window.__cancels)) > c2, "Escape stops the tutor talking");
  // close panel stops
  await input.fill("again");
  await input.press("Enter");
  await waitReplies(3);
  await page.waitForFunction(() => window.__spoken.length >= 3);
  const c3 = await page.evaluate(() => window.__cancels);
  await page.getByRole("button", { name: /close/i }).first().click().catch(() => {});
  await page.waitForTimeout(300);
  check((await page.evaluate(() => window.__cancels)) > c3, "closing the tutor stops speech");
  await ctx.close();
}

// ---------- 5. hands-free
{
  const { ctx, page } = await open();
  await tid(page, "handsfree-toggle").click();
  await tid(page, "mic-button").click();
  await page.waitForFunction(() => window.__recStarts === 1);
  await page.evaluate(() => window.__say("seven minus ten", true));
  await waitReplies(1);
  check(replies[0].req.inputChannel === "voice" && replies[0].req.studentQuery === "seven minus ten", "hands-free: the transcript is sent automatically");
  check(/7 - 10/.test(replies[0].res.input?.understoodAs ?? ""), "hands-free: 'seven minus ten' understood as 7 - 10");
  await page.waitForFunction(() => window.__spoken.length >= 1, null, { timeout: 5000 });
  await page.evaluate(() => window.__finishSpeech());
  await page.waitForFunction(() => window.__recStarts >= 2, null, { timeout: 5000 }).catch(() => {});
  check((await page.evaluate(() => window.__recStarts)) >= 2, "hands-free: after the tutor finishes speaking it listens again");
  await tid(page, "handsfree-toggle").click();
  check((await tid(page, "handsfree-toggle").getAttribute("aria-pressed")) === "false", "hands-free can be turned off");
  await ctx.close();
}

// ---------- 6. language selector
{
  const { ctx, page } = await open();
  await tid(page, "voice-lang").selectOption({ index: 1 });
  await tid(page, "mic-button").click();
  await page.waitForFunction(() => window.__rec);
  check(/fil/i.test(await page.evaluate(() => window.__rec.lang)), "choosing Filipino sets the recogniser language to fil-PH");
  await ctx.close();
}

check(errors.length === 0, `no uncaught page errors${errors.length ? ": " + errors.join(" | ") : ""}`);
await finish(browser);
