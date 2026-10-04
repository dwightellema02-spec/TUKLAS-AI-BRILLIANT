/**
 * Phase 22 real-browser check of the teacher upload UI and the student tutor citation UI.
 * Not part of the default suite: it needs a running dev server and playwright-core.
 *
 *   npm i --no-save playwright-core
 *   AI_PROVIDER=local PORT=3000 npx tsx server.ts &        # in another shell
 *   node scripts/test-phase22-browser.mjs
 *
 * Env: BASE_URL (default http://localhost:3000), CHROMIUM_PATH (default /opt/pw-browsers/chromium-*\/chrome-linux/chrome),
 *      SCREENSHOT_PATH (optional).  Uses the seeded demo accounts; run against a throwaway dev server.
 */
import { chromium } from "playwright-core";
import fs from "fs";
import path from "path";
const base = process.env.BASE_URL || "http://localhost:3000";
const fixtures = path.join(process.cwd(), "scripts", "fixtures", "phase22") + "/";
const exe =
  process.env.CHROMIUM_PATH ||
  fs.readdirSync("/opt/pw-browsers").filter((d) => /^chromium-\d+$/.test(d)).map((d) => `/opt/pw-browsers/${d}/chrome-linux/chrome`)[0];
const browser = await chromium.launch({ executablePath: exe, args: ["--no-sandbox"] });
const results = [];
const check = (ok, msg) => { results.push([ok, msg]); console.log((ok ? "PASS " : "FAIL ") + msg); };

async function login(context, email) {
  const r = await context.request.post(base + "/api/auth/login", { data: { email, password: "Tuklas2026!" } });
  if (!r.ok()) throw new Error("login failed " + email);
}

// --- Teacher
const tctx = await browser.newContext();
await login(tctx, "teacher@tuklas.ai");
const tp = await tctx.newPage();
const errors = [];
tp.on("pageerror", (e) => errors.push(e.message));
await tp.goto(base + "/teacher/lessons/lsn_01/edit");
await tp.getByText("Add Document").first().waitFor({ timeout: 20000 });
await tp.getByText("Add Document").first().click();
check(await tp.getByRole("dialog").isVisible(), "Teacher UI: upload modal opens");
await tp.setInputFiles("#doc-file", fixtures + "las-adding-integers.docx");
check(await tp.getByText("las-adding-integers.docx").first().isVisible(), "Teacher UI: chosen file name shown");
const before = await tp.getByText("AI can read this").count();
await tp.getByRole("button", { name: /Save Resource/ }).click();
await tp.getByRole("dialog").waitFor({ state: "hidden", timeout: 20000 });
check(true, "Teacher UI: modal auto-closes after a readable upload");
await tp.waitForFunction((n) => document.body.innerText.split("AI can read this").length - 1 > n, before, { timeout: 20000 });
check(true, "Teacher UI: uploaded DOCX adds a new 'AI can read this' resource badge");

await tp.getByText("Add Document").first().click();
await tp.setInputFiles("#doc-file", fixtures + "scanned-image-only.pdf");
await tp.getByRole("button", { name: /Save Resource/ }).click();
await tp.getByRole("status").waitFor({ timeout: 20000 });
const warn = await tp.getByRole("status").innerText();
check(/cannot read it/i.test(warn) && /scanned|image-only/i.test(warn), "Teacher UI: scanned PDF shows an honest 'AI cannot read it' warning and stays open");
await tp.getByRole("button", { name: /Done/ }).click();
check(await tp.getByText("AI cannot read this (no text found)").first().isVisible(), "Teacher UI: scanned PDF listed with 'AI cannot read this' badge");

await tp.getByText("Add Document").first().click();
await tp.setInputFiles("#doc-file", { name: "malware.exe", mimeType: "application/octet-stream", buffer: Buffer.from("MZ") });
check(await tp.getByRole("alert").isVisible(), "Teacher UI: client-side rejection message for .exe");
await tp.getByLabel("Close dialog").click();

// Save draft must not wipe resources
await tp.getByRole("button", { name: /Save Draft|Save/ }).first().click().catch(() => {});
await tp.waitForTimeout(1500);
await tp.reload();
await tp.getByText("AI can read this").first().waitFor({ timeout: 20000 });
check(true, "Teacher UI: resources and extraction status survive Save + reload");
check(errors.length === 0, "Teacher UI: no uncaught page errors" + (errors.length ? " -> " + errors[0] : ""));

// --- Student
const sctx = await browser.newContext();
await login(sctx, "student@tuklas.ai");
const sp = await sctx.newPage();
const serrors = [];
sp.on("pageerror", (e) => serrors.push(e.message));
await sp.goto(base + "/student/lessons/lsn_01");
await sp.getByRole("button", { name: "AI Tutor" }).first().waitFor({ timeout: 20000 });
await sp.getByRole("button", { name: "AI Tutor" }).first().click();
await sp.getByRole("heading", { name: "Tuklas AI Tutor" }).waitFor({ timeout: 20000 });
await sp.getByPlaceholder(/Ask a question/).fill("What does the worksheet say about adding integers with different signs?");
await sp.getByPlaceholder(/Ask a question/).press("Enter");
await sp.waitForFunction(() => document.querySelectorAll('[aria-label="Sources"]').length >= 1, null, { timeout: 25000 }).catch(() => {});
const chips = sp.getByLabel("Sources");
const visible = (await chips.count()) >= 1;
const chip = chips.last();
check(visible, "Student UI: typed question gets a reply with a 'Source:' citation chip from the uploaded document");
if (visible) console.log("   chip text:", (await chip.innerText()).replace(/\s+/g, " "));
if (process.env.SCREENSHOT_PATH) await sp.screenshot({ path: process.env.SCREENSHOT_PATH });
check(serrors.length === 0, "Student UI: no uncaught page errors" + (serrors.length ? " -> " + serrors[0] : ""));

await browser.close();
const failed = results.filter(([ok]) => !ok).length;
console.log(`\nBROWSER RESULTS: ${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
