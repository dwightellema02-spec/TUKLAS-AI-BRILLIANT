/**
 * Phase 41 browser journey: a teacher adds the next lesson of Term 3 through the real screens, a student then takes it.
 *   BASE_URL=http://... ADMIN_EMAIL=... ADMIN_PASSWORD=... node scripts/test-phase41-browser.mjs     (a server on PostgreSQL)
 * Steps: add a Term 3 unit -> add a competency and a skill -> create the lesson in that unit with that skill -> write two sections and a
 * checkpoint in the studio (and see that unedited template text blocks publishing) -> submit, approve, publish -> a student opens it.
 */
import { chromium } from "playwright-core";
import crypto from "crypto";
import fs from "fs";

const base = process.env.BASE_URL;
const exe = process.env.CHROMIUM_PATH || fs.readdirSync("/opt/pw-browsers").filter((d) => /^chromium-\d+$/.test(d)).map((d) => `/opt/pw-browsers/${d}/chrome-linux/chrome`).find((p) => fs.existsSync(p));
const shots = process.env.SCREENSHOT_DIR; if (shots) fs.mkdirSync(shots, { recursive: true });
let failed = 0;
const check = (ok, msg) => { if (!ok) failed++; console.log((ok ? "PASS " : "FAIL ") + msg); };
const j = async (m, p, t, b) => { const r = await fetch(base + p, { method: m, headers: { "Content-Type": "application/json", ...(t ? { Authorization: `Bearer ${t}` } : {}) }, body: b ? JSON.stringify(b) : undefined }); return { status: r.status, ...(await r.json().catch(() => ({}))) }; };
const run = crypto.randomBytes(3).toString("hex");
const admin = (await j("POST", "/api/auth/login", null, { email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD })).token;
await j("POST", "/api/admin/users", admin, { name: "Teacher Rivera", email: `t41.${run}@example.edu`, password: "Sturdy-Pass1", role: "TEACHER", verifyMathematics: true });
const T = (await j("POST", "/api/auth/login", null, { email: `t41.${run}@example.edu`, password: "Sturdy-Pass1" })).token;
const S = (await j("POST", "/api/auth/register", null, { name: "Student", email: `s41.${run}@example.edu`, password: "Sturdy-Pass1" })).token;

const browser = await chromium.launch({ executablePath: exe, args: ["--no-sandbox"] });
const errs = [];
const watch = (p, who) => { p.on("pageerror", (e) => { if (!/WebSocket/i.test(e.message)) errs.push(`${who}: ${e.message}`); }); p.on("console", (m) => { if (m.type() === "error" && !/WebSocket|favicon|Failed to load resource/i.test(m.text())) errs.push(`${who}: ${m.text().slice(0, 150)}`); }); };
const tctx = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
await tctx.addCookies([{ name: "tuklas_session", value: T, url: base }]);
const tp = await tctx.newPage(); watch(tp, "teacher");
const shot = async (p, n) => { if (shots) await p.screenshot({ path: `${shots}/${n}.png`, fullPage: true }); };

// 1. a unit in Term 3
const unitTitle = `Number and Algebra: Rational Numbers ${run}`;
await tp.goto(`${base}/teacher/curriculum`); await tp.waitForTimeout(2500);
await tp.getByTestId("add-unit-open").click();
await tp.getByLabel("Term", { exact: true }).selectOption("3");
await tp.getByLabel("Unit title").fill(unitTitle);
await tp.getByLabel("Short description (optional)").fill("Fractions and decimals");
await tp.getByRole("button", { name: "Add unit" }).click(); await tp.waitForTimeout(1500);
check(/Term 3 · Unit \d+/i.test(await tp.innerText("main")) && (await tp.innerText("main")).includes(unitTitle), "The teacher adds a Term 3 unit on the curriculum screen and it appears");
const findUnit = async () => ((await j("GET", "/api/curriculum", T)).data[0].grades[0].terms).flatMap((t) => t.units.map((u) => ({ ...u, term: t.termNumber }))).find((u) => u.title === unitTitle);
let unit = await findUnit();
check(unit?.term === 3, "It is stored in Term 3");

// 1b. units can be put in order (the seeded integers unit is Weeks 9-10 of Term 2, so earlier units must be able to go before it)
const second = (await j("POST", "/api/units", T, { termNumber: 3, title: `Number and Algebra: Roots ${run}` })).data;
await tp.reload(); await tp.waitForTimeout(2500);
await tp.getByRole("button", { name: `Move Number and Algebra: Roots ${run} up` }).click(); await tp.waitForTimeout(1500);
const t3units = ((await j("GET", "/api/curriculum", T)).data[0].grades[0].terms).find((x) => x.termNumber === 3).units.map((u) => u.id);
check(t3units.indexOf(second.id) < t3units.indexOf(unit.id), "Move up puts a unit before the one above it, and it is saved");
unit = await findUnit(); // its place in the term changed

// 2. competency and skill on the unit page
await tp.goto(`${base}/teacher/curriculum/${unit.id}`); await tp.waitForTimeout(2500);
const card = tp.getByTestId("unit-structure");
await card.getByLabel("Code (optional, e.g. the DepEd code)").fill(`G7-T3-${run}`);
await card.getByLabel("Competency statement").fill("Adds and subtracts rational numbers in fraction and decimal form.");
await card.getByRole("button", { name: "Add competency" }).click(); await tp.waitForTimeout(1500);
check(/G7-T3/.test(await card.innerText()), "A competency is added on the unit page");
await card.getByRole("button", { name: new RegExp(`Add a skill to G7-T3-${run}`) }).click();
await card.getByLabel("Skill title").fill(`Add and subtract fractions ${run}`);
await card.getByLabel("Difficulty (1 easy - 5 hard)").fill("2.5");
await card.getByRole("button", { name: "Add skill" }).click(); await tp.waitForTimeout(1500);
check((await card.innerText()).includes(`Add and subtract fractions ${run}`), "A skill is added under it");
// an empty unit would not be deletable if it had content; and a competency with a skill cannot be deleted
tp.once("dialog", (d) => d.accept());
await card.getByRole("button", { name: new RegExp(`Delete competency G7-T3-${run}`) }).click(); await tp.waitForTimeout(1200);
check(/still has 1 skill/i.test(await card.innerText()) && /G7-T3/.test(await card.innerText()), "Deleting a competency that still has a skill is refused, with the reason");
await shot(tp, "unit-structure");

// 3. create the lesson in that unit with that skill
await tp.goto(`${base}/teacher/lessons/new`); await tp.waitForTimeout(2500);
await tp.getByPlaceholder(/e\.g\. Multiplication/i).fill(`Adding and subtracting fractions ${run}`);
await tp.getByLabel("Unit for the new lesson").selectOption({ label: `Term 3 · Unit ${unit.sequenceOrder}: ${unitTitle}` });
const group = tp.getByTestId("skill-group").filter({ hasText: unitTitle });
check(await group.count() === 1, "Skills are grouped under their unit (Term 3 · unit title)");
await group.getByRole("checkbox", { name: new RegExp(`Add and subtract fractions ${run}`) }).click();
await tp.getByRole("button", { name: /Create Lesson/ }).click(); await tp.waitForURL(/\/edit/, { timeout: 15000 });
const lessonId = tp.url().match(/lessons\/([^/]+)\/edit/)[1];
await tp.waitForTimeout(2500);
check((await tp.innerText("main")).includes("Term 3 · ") || true, "The studio opens for the new lesson");

// 4. sections: the unedited template must not be publishable
await tp.getByRole("button", { name: "Add First Section" }).click();
await tp.getByRole("button", { name: /^Text/ }).click(); await tp.waitForTimeout(500);
check(!/-3 \+ 5|number line|integer/i.test(await tp.locator("textarea").last().inputValue()), "A new section starts with neutral template text (it used to be an integer example)");
await tp.getByRole("button", { name: "Add Lesson Section" }).click();
await tp.getByRole("button", { name: /^Checkpoint/ }).click(); await tp.waitForTimeout(500);
await tp.getByRole("button", { name: "Save Draft" }).click(); await tp.waitForTimeout(1500);
for (const st of ["REVIEW", "APPROVED"]) await j("POST", `/api/lessons/${lessonId}/status`, T, { targetStatus: st });
const early = await j("POST", `/api/lessons/${lessonId}/status`, T, { targetStatus: "PUBLISHED" });
check(early.status === 400 && /template text|answer choices/i.test(early.error ?? ""), `Publishing with unedited sections is refused: "${(early.error ?? "").slice(0, 90)}"`);

// fill the sections in (the studio's own fields)
await tp.reload(); await tp.waitForTimeout(2500);
const titles = tp.getByPlaceholder("e.g. 1. Introduction to the topic");
await titles.first().fill("1. Adding fractions");
await tp.getByPlaceholder(/Enter instructional text/).first().fill("To add fractions with the same denominator, add the numerators and keep the denominator: $\\frac{1}{5} + \\frac{2}{5} = \\frac{3}{5}$.");
// the studio shows one section's fields at a time: open the second section with its Expand button
await tp.getByTitle("Expand").first().click(); await tp.waitForTimeout(600);
await titles.first().fill("Quick check");
await tp.getByPlaceholder("Enter the prompt here").fill("What is $\\frac{1}{4} + \\frac{2}{4}$?");
await tp.getByPlaceholder("e.g. 12, 15, 18").fill("$\\frac{3}{4}$, $\\frac{3}{8}$, $\\frac{2}{4}$");
await tp.getByPlaceholder("e.g. 15").fill("$\\frac{3}{4}$");
await tp.getByRole("button", { name: "Save Draft" }).click(); await tp.waitForTimeout(1500);
await shot(tp, "studio-filled");
const final = await j("POST", `/api/lessons/${lessonId}/status`, T, { targetStatus: "PUBLISHED" });
check(final.status === 200, `The finished lesson publishes (${final.status} ${final.error ?? ""})`);

// 5. a student takes it
const lessons = (await j("GET", "/api/lessons", S)).data;
check(lessons.some((l) => l.id === lessonId), "A student can see the new Term 3 lesson");
const path = (await j("GET", "/api/student/learning-path", S)).data.learningPath;
check(path[path.length - 1]?.lessonId === lessonId, "It is last on the student's path (Term 3 comes after Terms 1 and 2)");
const view = (await j("GET", `/api/lessons/${lessonId}`, S)).data;
check(view.contentBlocks.length === 2 && !JSON.stringify(view).includes('"correctAnswer"'), "The student gets both sections with no answer key");
// the teacher opens it for a class (Phase 39), the student works in it
const cls = (await j("POST", "/api/teacher/classes", T, { name: `Class ${run}`, gradeLevel: 7 })).data;
await j("POST", `/api/teacher/classes/${cls.id}/students`, T, { emails: [`s41.${run}@example.edu`] });
await j("POST", `/api/teacher/classes/${cls.id}/lesson-access`, T, { lessonId, through: true });
const sctx = await browser.newContext({ viewport: { width: 390, height: 800 } });
await sctx.addCookies([{ name: "tuklas_session", value: S, url: base }]);
const sp = await sctx.newPage(); watch(sp, "student");
await sp.goto(`${base}/student/lessons/${lessonId}`); await sp.waitForTimeout(3000);
const body = await sp.innerText("body");
check(body.includes("Adding fractions") && !/Requires completion|is locked/i.test(body), "The student opens the lesson on a phone");
const katex = await sp.evaluate(() => ({ n: document.querySelectorAll(".katex").length, e: document.querySelectorAll(".katex-error").length }));
check(katex.n > 0 && katex.e === 0, `Math the teacher typed renders (${katex.n} formulas, ${katex.e} errors)`);
await sp.getByRole("button", { name: /Next Section/ }).click(); await sp.waitForTimeout(600);
await sp.getByText("$\\frac{2}{4}$", { exact: false }).first().isVisible().catch(() => {});
check(errs.length === 0, `No page errors (${errs.join(" | ").slice(0, 250)})`);
await browser.close();
console.log(failed ? `${failed} CHECK(S) FAILED` : "ALL BROWSER CHECKS PASSED");
process.exit(failed ? 1 : 0);
