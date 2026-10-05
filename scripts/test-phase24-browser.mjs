/**
 * Phase 24 real-browser check of a Taglish multi-turn tutor conversation (absolute value) in the student UI.
 *   npm i --no-save playwright-core
 *   AI_PROVIDER=local PORT=3000 npx tsx server.ts &      # throwaway dev server
 *   node scripts/test-phase24-browser.mjs

 * Run against a FRESH server: the tutor continues a student's live conversation (by design), so a previous session skews it.
 * Env: BASE_URL, CHROMIUM_PATH, SCREENSHOT_PATH (optional).
 */
import { chromium } from "playwright-core";
import fs from "fs";

const base = process.env.BASE_URL || "http://localhost:3000";
const exe =
  process.env.CHROMIUM_PATH ||
  fs.readdirSync("/opt/pw-browsers").filter((d) => /^chromium-\d+$/.test(d)).map((d) => `/opt/pw-browsers/${d}/chrome-linux/chrome`)[0];
const browser = await chromium.launch({ executablePath: exe, args: ["--no-sandbox"] });
const results = [];
const check = (ok, msg) => { results.push(ok); console.log((ok ? "PASS " : "FAIL ") + msg); };

const ctx = await browser.newContext();
const login = await ctx.request.post(base + "/api/auth/login", { data: { email: "student@tuklas.ai", password: "Tuklas2026!" } });
if (!login.ok()) throw new Error("login failed");
const page = await ctx.newPage();
const errors = [];
// Vite's dev-server HMR websocket can close in headless runs; that is tooling noise, not an app error.
page.on("pageerror", (e) => { if (!/WebSocket/i.test(e.message)) errors.push(e.message); });
const replies = [];
page.on("response", async (r) => {
  if (r.url().endsWith("/api/ai/tutor") && r.request().method() === "POST") {
    try { replies.push((await r.json()).data); } catch { /* ignore */ }
  }
});

await page.goto(base + "/student/lessons/lsn_01");
await page.getByRole("button", { name: "AI Tutor" }).first().click();
await page.getByRole("heading", { name: "Tuklas AI Tutor" }).waitFor({ timeout: 20000 });
await page.waitForFunction(() => document.querySelectorAll("[class*='rounded-bl']").length >= 1, null, { timeout: 20000 });

const input = page.getByPlaceholder(/Ask a question/);
async function say(text) {
  const before = replies.length;
  await input.fill(text);
  await input.press("Enter");
  await page.waitForFunction((n) => window.__n === undefined || true, before);
  const t0 = Date.now();
  while (replies.length <= before && Date.now() - t0 < 20000) await page.waitForTimeout(100);
  await page.waitForTimeout(250);
  return replies[replies.length - 1];
}

const r1 = await say("ano po ang |-14|?");
check(r1?.pedagogy?.strategy === "OPEN_PROBLEM", "UI: Taglish absolute-value problem is guided, not solved");
const r2 = await say("hindi ko po maintindihan");
const r3 = await say("di ko pa rin gets");
check(r2?.pedagogy?.strategy !== r3?.pedagogy?.strategy, `UI: approach changes after repeated Taglish confusion (${r2?.pedagogy?.strategy} -> ${r3?.pedagogy?.strategy})`);
check(/\b(ang|ko|mo|natin|sa)\b/i.test(r3?.message?.content ?? ""), "UI: the tutor answers a Taglish student with Filipino");
const r4 = await say("-14");
check(r4?.pedagogy?.evaluation === "INCORRECT" && /distance|negative/i.test(`${r4.message.content} ${r4.message.guidingQuestion}`), "UI: |-14| answered -14 gets the absolute-value misconception question");
const r5 = await say("labing-apat po");
check(r5?.pedagogy?.evaluation === "CORRECT", "UI: 'labing-apat po' (fourteen in Filipino) judged correct");
const r7 = await say("kasi distansya po siya");
check(r7?.pedagogy?.strategy === "TRANSFER_PROBLEM", "UI: a Taglish justification leads to a new absolute-value problem");
const texts = replies.map((r) => `${r.message.content} ${r.message.guidingQuestion ?? ""}`);
check(new Set(texts).size === texts.length, "UI: every tutor message is different");
check(!/\|-14\|\s*=\s*14|answer is 14/.test(texts.slice(0, 5).join(" ")), "UI: the answer (14) is never stated before the student earns it");
const bubbles = await page.locator("[class*='rounded-bl']").count();
check(bubbles >= 6, `UI: ${bubbles} tutor bubbles rendered`);
if (process.env.SCREENSHOT_PATH) await page.screenshot({ path: process.env.SCREENSHOT_PATH });
check(errors.length === 0, "UI: no uncaught page errors" + (errors.length ? " -> " + errors[0] : ""));

await browser.close();
const failed = results.filter((x) => !x).length;
console.log(`\nBROWSER RESULTS: ${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
