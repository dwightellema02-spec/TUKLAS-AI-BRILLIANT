/**
 * Phase 37 real-browser check (Chromium): the question editor no longer silently tags the first skill, warns when none is chosen,
 * asks before publishing without one; the question bank flags and filters questions without a skill; the assessment picker marks them.
 *   node scripts/test-phase37-browser.mjs
 */
import { chromium } from "playwright-core";
import { spawn } from "child_process";
import crypto from "crypto";
import fs from "fs";

const port = 6200 + Math.floor(Math.random() * 90), base = `http://127.0.0.1:${port}`;
const exe = process.env.CHROMIUM_PATH || fs.readdirSync("/opt/pw-browsers").filter((d) => /^chromium-\d+$/.test(d)).map((d) => `/opt/pw-browsers/${d}/chrome-linux/chrome`)[0];
try { fs.rmSync("data/users-persistence.json", { force: true }); } catch { /* */ }
const srv = spawn("npx", ["tsx", "server.ts"], { env: { ...process.env, PORT: String(port), NODE_ENV: "development", AI_PROVIDER: "local", AUTH_SECRET: crypto.randomBytes(32).toString("hex"), DATABASE_URL: process.env.DATABASE_URL ?? "" }, stdio: "ignore", detached: true });
let failed = 0;
const check = (ok, msg) => { if (!ok) failed++; console.log((ok ? "PASS " : "FAIL ") + msg); };
const finish = async (b) => { try { await b?.close(); } catch { /* */ } try { process.kill(-srv.pid, "SIGTERM"); } catch { /* */ } console.log(failed === 0 ? "\nALL BROWSER CHECKS PASSED" : `\n${failed} CHECK(S) FAILED`); process.exit(failed === 0 ? 0 : 1); };
for (let i = 0; i < 90; i++) { await new Promise((r) => setTimeout(r, 500)); try { if ((await fetch(base + "/api/health")).ok) break; } catch { /* */ } }

const run = crypto.randomBytes(3).toString("hex");
const browser = await chromium.launch({ executablePath: exe, args: ["--no-sandbox"] });
const errors = [];
const adminCtx = await browser.newContext();
await adminCtx.request.post(base + "/api/auth/login", { data: { email: process.env.ADMIN_EMAIL || "admin@tuklas.ai", password: process.env.ADMIN_PASSWORD || "Tuklas2026!" } });
await adminCtx.request.post(base + "/api/admin/users", { data: { name: "Mr. Santos", email: `p37.${run}@example.edu`, password: "Sturdy-Pass1", role: "TEACHER", verifyMathematics: true } });
const T = await browser.newContext({ viewport: { width: 1280, height: 900 } });
await T.request.post(base + "/api/auth/login", { data: { email: `p37.${run}@example.edu`, password: "Sturdy-Pass1" } });
// the teacher writes one lesson (a teacher can attach questions only to their own lessons)
const curriculum = (await (await T.request.get(base + "/api/curriculum")).json()).data;
const unitId = (function find(o) { if (!o || typeof o !== "object") return null; if (Array.isArray(o)) { for (const x of o) { const r = find(x); if (r) return r; } return null; } if (o.units?.length) return o.units[0].id; for (const k of Object.keys(o)) { const r = find(o[k]); if (r) return r; } return null; })(curriculum);
const skillsList = (await (await T.request.get(base + "/api/skills")).json()).data;
const myLesson = (await (await T.request.post(base + "/api/lessons", { data: { title: `P37 lesson ${run}`, unitId, skillIds: [skillsList[2]?.id ?? skillsList[0].id], estimatedMinutes: 10 } })).json()).data;
const page = await T.newPage();
page.on("pageerror", (e) => { if (!/WebSocket/i.test(e.message)) errors.push(e.message); });
let posts = 0;
page.on("request", (r) => { if (r.method() === "POST" && r.url().endsWith("/api/questions")) posts++; });

await page.goto(base + "/teacher/questions/new");
await page.getByTestId("skill-select").waitFor({ timeout: 15000 });
check((await page.getByTestId("skill-select").inputValue()) === "", "a new question has NO skill pre-selected (it used to default to the first skill)");
check(/cannot count towards mastery/.test(await page.getByTestId("skill-warning").innerText()), "a warning explains what happens without a skill");
const options = await page.getByTestId("skill-select").locator("option").allInnerTexts();
check(options[0].includes("Choose a skill") && options.length > 1, "the list starts with 'Choose a skill…' followed by the real skills");

const prompt = `P37 browser ${run}`;
await page.locator("textarea").first().fill(prompt);
await page.locator("input[type=text], input[type=number], input:not([type])").filter({ hasNot: page.locator("[readonly]") }).first().waitFor({ timeout: 5000 }).catch(() => {});
// make the question valid: a numeric answer
const numeric = page.locator("input[placeholder*='answer' i], input[type=number]").first();
if (await numeric.count()) await numeric.fill("3");

// publish without a skill: the teacher is asked; declining saves nothing
await page.locator("select").filter({ has: page.locator("option[value=PUBLISHED]") }).first().selectOption("PUBLISHED");
page.once("dialog", (d) => d.dismiss());
await page.getByRole("button", { name: /Save Question/ }).click();
await page.waitForTimeout(500);
check(posts === 0, "saving as Published without a skill asks first, and declining saves nothing");
// choose a skill: warning disappears
await page.getByTestId("skill-select").selectOption({ index: 1 });
check((await page.getByTestId("skill-warning").count()) === 0, "choosing a skill removes the warning");
await page.getByTestId("skill-select").selectOption("");
// accept: saved without a skill
let dialogText = "";
page.once("dialog", (d) => { dialogText = d.message(); d.accept(); });
await page.getByRole("button", { name: /Save Question/ }).click();
await page.waitForFunction(() => /\/edit$/.test(location.pathname) && !/\/new\//.test(location.pathname), null, { timeout: 10000 }).catch(() => {});
await page.waitForTimeout(500);
check(posts >= 1 && /no skill/i.test(dialogText), "accepting the warning saves the question (the dialog said what it means)");

// a lesson chosen, no skill: the lesson's skill is used (and the warning says so)
await page.goto(base + "/teacher/questions/new");
await page.getByTestId("lesson-select").waitFor();
check((await page.getByTestId("lesson-select").inputValue()) === "", "a new question starts with no lesson (it used to be attached to a demo lesson that does not exist in a real database)");
await page.getByTestId("lesson-select").locator("option", { hasText: `P37 lesson ${run}` }).waitFor({ state: "attached", timeout: 15000 }).catch(() => {});
const lessonOptions = await page.getByTestId("lesson-select").locator("option").count();
check(lessonOptions === 2, `the lesson list offers only the teacher's own lessons (${lessonOptions - 1}), because the server only lets a teacher attach to those`);
await page.getByTestId("lesson-select").selectOption({ label: `P37 lesson ${run}` });
check(/lesson's first skill/.test(await page.getByTestId("skill-warning").innerText()), "choosing a lesson changes the warning: the lesson's skill will be used");
const prompt2 = `P37 lesson ${run}`;
await page.locator("textarea").first().fill(prompt2);
const numeric2 = page.locator("input[placeholder*='answer' i], input[type=number]").first();
if (await numeric2.count()) await numeric2.fill("3");
const before2 = posts;
await page.getByRole("button", { name: /Save Question/ }).click();
await page.waitForFunction(() => /\/edit$/.test(location.pathname) && !/\/new\//.test(location.pathname), null, { timeout: 15000 }).catch(() => {});
check(posts > before2 && !/\/new$/.test(new URL(page.url()).pathname), "the question is saved from the editor (this failed on a real database before)");
const saved = (await (await T.request.get(base + `/api/questions?search=${encodeURIComponent(prompt2)}`)).json()).data?.[0];
check(saved?.lessonId === myLesson?.id && saved?.skillId === (skillsList[2]?.id ?? skillsList[0].id), `...with the lesson and the lesson's skill attached (${saved?.skillId})`);

// practice set from the screen
await page.goto(base + "/teacher/practice-sets");
await page.getByRole("button", { name: /New Practice Set/ }).first().click();
await page.getByPlaceholder("e.g. Integer Addition & Sign Rules Practice").fill(`P37 set ${run}`);
await page.getByRole("button", { name: /Create Practice Set/ }).last().click();
await page.getByText(`P37 set ${run}`).first().waitFor({ timeout: 10000 }).catch(() => {});
check((await page.getByText(`P37 set ${run}`).count()) > 0, "a practice set can be created from the screen (it was attached to a demo lesson that does not exist in a real database)");

// question bank
await page.goto(base + "/teacher/question-bank");
await page.getByText(prompt).first().waitFor({ timeout: 15000 });
const row = page.locator("div,li,tr").filter({ hasText: prompt }).filter({ has: page.getByTestId("no-skill-badge") }).first();
check((await row.count()) === 1, "the question bank flags it with a 'No skill' badge");
await page.getByTestId("no-skill-filter").check();
await page.waitForTimeout(800);
const shown = await page.getByTestId("no-skill-badge").count();
check(shown >= 1 && (await page.locator("body").innerText()).includes(prompt), `the 'only questions without a skill' filter shows it (${shown} shown)`);
const withSkillShown = await page.locator("text=/Skill: /").count();
check(withSkillShown === 0, "...and hides questions that have a skill");

// assessment picker
await page.goto(base + "/teacher/assessments");
await page.getByTestId("new-assessment").click();
await page.getByTestId("question-picker").waitFor();
check((await page.getByTestId("picker-no-skill").count()) >= 1, "the assessment question picker marks questions that have no skill");

check(errors.length === 0, `no uncaught page errors${errors.length ? ": " + errors.join(" | ") : ""}`);
await finish(browser);
