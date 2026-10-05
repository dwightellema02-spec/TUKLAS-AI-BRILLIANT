/**
 * Phase 23 real-browser check of a multi-turn tutor conversation in the student UI.
 *   npm i --no-save playwright-core
 *   AI_PROVIDER=local PORT=3000 npx tsx server.ts &      # throwaway dev server
 *   node scripts/test-phase23-browser.mjs

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

const r1 = await say("what is (-8) + 13?");
check(r1?.pedagogy?.strategy === "OPEN_PROBLEM", "UI: student-typed problem is guided, not solved (OPEN_PROBLEM)");
const r2 = await say("I don't understand");
const r3 = await say("i still dont get it");
check(r2?.pedagogy?.strategy !== r3?.pedagogy?.strategy, `UI: strategy changed after repeated confusion (${r2?.pedagogy?.strategy} -> ${r3?.pedagogy?.strategy})`);
const r4 = await say("21");
check(r4?.pedagogy?.evaluation === "INCORRECT", "UI: wrong answer judged INCORRECT");
const r5 = await say("5");
check(r5?.pedagogy?.evaluation === "CORRECT" && r5?.pedagogy?.strategy === "CONFIRM_AND_PROBE", "UI: correct answer confirmed");
const r6 = await say("because 13 is bigger and positive");
check(r6?.pedagogy?.strategy === "TRANSFER_PROBLEM", "UI: tutor poses a new problem to verify independence");
const m = /\$([^$]+)\$/.exec(r6?.message?.content ?? "");
const expr = (m?.[1] ?? "").replace(/\\times/g, "*").replace(/\\div/g, "/");
let answer = "0";
try { answer = String(Function(`"use strict"; return (${expr.replace(/−/g, "-")})`)()); } catch { /* keep default */ }
const r7 = await say(answer);
check(r7?.pedagogy?.evaluation === "CORRECT" && r7?.pedagogy?.strategy === "CELEBRATE_AND_NEXT", `UI: solving the new problem (${expr} = ${answer}) is verified and celebrated`);

const texts = replies.map((r) => `${r.message.content} ${r.message.guidingQuestion ?? ""}`);
check(new Set(texts).size === texts.length, "UI: every tutor message in the conversation is different");
const earlier = texts.slice(1, 5).join(" ");
check(!/\b= 5\b|answer is 5\b/.test(earlier), "UI: the answer (5) is never stated while the student is still working");
const bubbles = await page.locator("[class*='rounded-bl']").count();
check(bubbles >= 7, `UI: ${bubbles} tutor bubbles rendered`);
if (process.env.SCREENSHOT_PATH) await page.screenshot({ path: process.env.SCREENSHOT_PATH });
check(errors.length === 0, "UI: no uncaught page errors" + (errors.length ? " -> " + errors[0] : ""));

await browser.close();
const failed = results.filter((x) => !x).length;
console.log(`\nBROWSER RESULTS: ${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
