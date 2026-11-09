/**
 * Phase 48 on PostgreSQL - the Vercel build, end to end, the way Vercel runs it.
 *   Brand-new database -> `npm run setup:db` (the Windows-friendly bootstrap) -> the REAL bundle (build/serverless.mjs from `npm run build:vercel`, reached through api/index.js)
 *   loaded as a function behind scripts/serverless-shim.mjs (read-only project disk, nothing listening inside the function).
 *   TWO instances share the database, as two Vercel function instances would; two more run with the shared limits switched OFF to prove the
 *   difference is real (the lock-out test must pass with sharing and fail without it).
 */
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { spawn, spawnSync, type ChildProcess } from "child_process";
import { PrismaClient } from "@prisma/client";

let passed = 0, failed = 0;
const assert = (c: boolean, m: string) => { if (c) { passed++; console.log(`  ✅ ${m}`); } else { failed++; console.error(`  ❌ FAILED: ${m}`); } };
const section = (t: string) => console.log(`\n--- ${t} ---`);
const run = crypto.randomBytes(3).toString("hex");
const P45 = path.join(process.cwd(), "scripts", "fixtures", "phase45");

async function main() {
  const url = process.env.DATABASE_URL ?? "";
  if (!/^postgres(ql)?:\/\//.test(url)) { console.log("SKIPPED: DATABASE_URL is not a PostgreSQL URL. Nothing was verified by this script."); return; }
  const dbName = `tuklas_p48_${run}`;
  const u = new URL(url), adminUrl = new URL(url); adminUrl.pathname = "/postgres"; u.pathname = `/${dbName}`;
  const freshUrl = u.toString();
  const root = new PrismaClient({ datasources: { db: { url: adminUrl.toString() } } });
  await root.$executeRawUnsafe(`CREATE DATABASE "${dbName}"`); await root.$disconnect();
  const db = new PrismaClient({ datasources: { db: { url: freshUrl } } });
  const adminEmail = `p48.admin.${run}@example.edu`, adminPassword = `Boot-strap-${run}9`;
  const authSecret = crypto.randomBytes(16).toString("hex");
  const servers: ChildProcess[] = [];
  const storageBefore = fs.existsSync("storage/documents") ? fs.readdirSync("storage/documents").length : 0;
  try {
    section("0. The Vercel bundle builds");
    const build = spawnSync("npm", ["run", "build:vercel"], { encoding: "utf-8" });
    assert(build.status === 0 && fs.existsSync("build/serverless.mjs") && fs.existsSync("api/index.js"), "npm run build:vercel makes build/serverless.mjs (api/index.js is the committed wrapper Vercel finds)");
    if (!fs.existsSync("dist/index.html")) assert(spawnSync("npm", ["run", "build"], { encoding: "utf-8" }).status === 0, "(the web app was built first)");

    section("1. setup:db prepares an empty database (no shell script, works on Windows)");
    const env0 = { ...process.env, DATABASE_URL: freshUrl, ADMIN_EMAIL: adminEmail, ADMIN_NAME: "P48 Admin", ADMIN_PASSWORD: adminPassword } as NodeJS.ProcessEnv;
    const setup = spawnSync("npx", ["tsx", "scripts/setup-database.ts"], { env: env0, encoding: "utf-8", maxBuffer: 20 * 1024 * 1024 });
    assert(setup.status === 0 && /setup:db finished/.test(setup.stdout), "setup:db succeeds on an empty database");
    assert(/rate_events/.test(setup.stdout + setup.stderr), "...applying the Phase 48 migration too");
    assert((await db.$queryRawUnsafe<any[]>(`SELECT table_name FROM information_schema.tables WHERE table_name = 'RateEvent'`)).length === 1, "The RateEvent table exists");
    assert((await db.unit.count()) > 0 && (await db.user.count({ where: { email: adminEmail, role: "ADMIN" } })) === 1, "The course is loaded and the administrator exists");
    const again = spawnSync("npx", ["tsx", "scripts/setup-database.ts"], { env: env0, encoding: "utf-8", maxBuffer: 20 * 1024 * 1024 });
    assert(again.status === 0 && (await db.user.count({ where: { role: "ADMIN" } })) === 1, "Running it again is safe (nothing duplicated, administrator not overwritten)");
    const pooled = spawnSync("npx", ["tsx", "scripts/setup-database.ts"], { env: { ...process.env, DATABASE_URL: "postgresql://u:p@ep-x-pooler.region.aws.neon.tech/neondb?sslmode=require" } as NodeJS.ProcessEnv, encoding: "utf-8" });
    assert(pooled.status === 1 && /POOLED/.test(pooled.stderr), "Neon's pooled address is refused with a plain explanation (migrations need the direct one)");
    const noUrl = spawnSync("npx", ["tsx", "scripts/setup-database.ts"], { env: { ...process.env, DATABASE_URL: "" } as NodeJS.ProcessEnv, encoding: "utf-8" });
    assert(noUrl.status === 1 && /needs DATABASE_URL/.test(noUrl.stderr), "No address: refused");

    section("1b. The limit store on this fresh database (shared mode must really run, not be skipped)");
    const storeRun = spawnSync("npx", ["tsx", "scripts/test-phase48-store.ts"], { env: { ...process.env, DATABASE_URL: freshUrl } as NodeJS.ProcessEnv, encoding: "utf-8", maxBuffer: 20 * 1024 * 1024 });
    assert(storeRun.status === 0 && /Shared \(database\) mode/.test(storeRun.stdout) && !/Shared mode skipped/.test(storeRun.stdout), "The store test runs its database half and passes");
    assert(/RESULTS: (\d+) passed, 0 failed/.test(storeRun.stdout) && Number(/RESULTS: (\d+) passed/.exec(storeRun.stdout)?.[1]) >= 41, `...with at least 41 checks (${/RESULTS: (\d+) passed/.exec(storeRun.stdout)?.[1]})`);

    section("2. Start the function instances");
    const start = async (port: number, extra: Record<string, string> = {}) => {
      const p = spawn("node", ["scripts/serverless-shim.mjs"], { env: { ...process.env, DATABASE_URL: freshUrl, VERCEL: "1", NODE_ENV: "production", AI_PROVIDER: "local", AUTH_SECRET: authSecret, APP_URL: "https://tuklas.example.edu", PRIVACY_CONTACT_EMAIL: "privacy@example.edu", PORT: String(port), ...extra }, stdio: ["ignore", "pipe", "pipe"], detached: true });
      let log = ""; p.stdout?.on("data", (d) => (log += d)); p.stderr?.on("data", (d) => (log += d));
      servers.push(p);
      for (let i = 0; i < 120; i++) { await new Promise((r) => setTimeout(r, 500)); try { if ((await fetch(`http://127.0.0.1:${port}/api/health`)).ok) break; } catch { /* */ } }
      return { base: `http://127.0.0.1:${port}`, log: () => log };
    };
    const basePort = 6100 + Math.floor(Math.random() * 300);
    const [A, B, C, D] = [await start(basePort), await start(basePort + 1), await start(basePort + 2, { DURABLE_RATE_LIMITS: "false" }), await start(basePort + 3, { DURABLE_RATE_LIMITS: "false" })];
    type R = { status: number; json: any; headers: Headers };
    const api = (base: string) => async (m: string, p: string, t?: string, b?: unknown): Promise<R> => {
      const r = await fetch(base + p, { method: m, headers: { ...(b !== undefined ? { "Content-Type": "application/json" } : {}), ...(t ? { Authorization: `Bearer ${t}` } : {}) }, body: b !== undefined ? JSON.stringify(b) : undefined });
      return { status: r.status, json: await r.json().catch(() => ({})), headers: r.headers };
    };
    const a = api(A.base), b = api(B.base), c = api(C.base), d = api(D.base);

    section("3. Basics");
    const ready = await a("GET", "/api/ready");
    assert(ready.status === 200 && ready.json.ready === true, "/api/ready answers ready from the function");
    const missing = await a("GET", "/api/does-not-exist");
    assert(missing.status === 404 && missing.json.error === "Not found", "An unknown /api address is a JSON 404, not a page");
    assert(!missing.headers.get("x-powered-by") && missing.headers.get("x-content-type-options") === "nosniff", "No X-Powered-By; security headers present");
    const page = await fetch(`${A.base}/`);
    assert(page.status === 200 && /<div id="root">/.test(await page.text()), "The web app is served (by the host in real life, by the shim here)");
    const health = (await a("GET", "/api/health")).json;
    assert(health.version && health.version !== "unknown", `The app version is found inside the bundle (${health.version})`);

    section("4. Sessions are stateless: sign in on one instance, be known on the other");
    const admin = (await a("POST", "/api/auth/login", undefined, { email: adminEmail, password: adminPassword })).json.token as string;
    assert(!!admin, "Administrator signs in on instance A");
    await a("POST", "/api/auth/accept-privacy", admin);
    const me = await b("GET", "/api/auth/me", admin);
    assert(me.status === 200 && me.json.user?.email === adminEmail, "The same token is accepted by instance B");

    section("5. A lock-out holds across instances (the reason for the shared store)");
    const mkStudent = async (call: ReturnType<typeof api>, tag: string) => { const email = `p48.${tag}.${run}@example.edu`; const r = await call("POST", "/api/auth/register", undefined, { name: `Pupil ${tag}`, email, password: "Sturdy-Pass1", acceptPrivacy: true }); return { email, tok: r.json.token as string, id: r.json.user?.id as string }; };
    const S1 = await mkStudent(a, "s1");
    let last = 0;
    for (let i = 0; i < 8; i++) last = (await a("POST", "/api/auth/login", undefined, { email: S1.email, password: "wrong-Pass-1" })).status;
    assert(last === 401, "8 wrong passwords on instance A are each refused (401)");
    const blockedB = await b("POST", "/api/auth/login", undefined, { email: S1.email, password: "Sturdy-Pass1" });
    assert(blockedB.status === 429 && Number(blockedB.headers.get("retry-after")) > 800, `Instance B refuses even the RIGHT password (429, retry in ${blockedB.headers.get("retry-after")}s)`);
    const S2 = await mkStudent(c, "s2");
    for (let i = 0; i < 8; i++) await c("POST", "/api/auth/login", undefined, { email: S2.email, password: "wrong-Pass-1" });
    const openD = await d("POST", "/api/auth/login", undefined, { email: S2.email, password: "Sturdy-Pass1" });
    assert(openD.status === 200, "Control: with sharing switched off, another instance does NOT know about the lock-out (200) - this is the gap the store closes");

    section("6. The tutor limit is shared too");
    await a("POST", "/api/admin/users", admin, { name: "Teach", email: `p48.t.${run}@example.edu`, password: "Sturdy-Pass1", role: "TEACHER", verifyMathematics: true });
    const T = (await a("POST", "/api/auth/login", undefined, { email: `p48.t.${run}@example.edu`, password: "Sturdy-Pass1" })).json.token as string;
    await a("POST", "/api/auth/accept-privacy", T);
    const S3 = await mkStudent(a, "s3");
    const sets = (await a("GET", "/api/practice-sets", S3.tok)).json.data as any[];
    const st = (await a("POST", "/api/practice/start", S3.tok, { practiceSetId: sets[0].id })).json.data;
    const item = st.questions[0].question ?? st.questions[0];
    const ask = (call: ReturnType<typeof api>) => call("POST", "/api/ai/tutor", S3.tok, { practiceSessionId: st.id, questionId: item.id ?? item.questionId, studentQuery: "I need a hint", helpLevel: 1 });
    const codes: number[] = [];
    for (let i = 0; i < 24; i++) codes.push((await ask(i % 2 ? b : a)).status);
    const okCount = codes.filter((x) => x === 200).length, limited = codes.filter((x) => x === 429).length;
    assert(okCount === 20 && limited === 4, `24 questions alternating between instances: 20 answered, 4 refused (${okCount}/${limited})`);

    section("7. Uploads without a disk");
    const unit = ((await a("GET", "/api/curriculum", T)).json.data[0].grades[0].terms as any[]).flatMap((t) => t.units)[0].id as string;
    const upload = async (call: string, body: Buffer, name: string, query: string) => {
      const base = call === "A" ? A.base : B.base;
      const r = await fetch(`${base}/api/teacher/lessons/import${query}`, { method: "POST", headers: { "Content-Type": "application/octet-stream", "x-file-name": encodeURIComponent(name), Authorization: `Bearer ${T}` }, body: new Uint8Array(body) });
      return { status: r.status, json: (await r.json().catch(() => ({}))) as any };
    };
    const Q = `?unitId=${encodeURIComponent(unit)}`;
    const small = await upload("A", fs.readFileSync(path.join(P45, "lesson-structured.docx")), "Fractions week 3.docx", `${Q}&attach=true`);
    assert(small.status === 201 && small.json.data.blocks.length === 4, `A small document still becomes a 4-section draft (${small.status})`);
    assert(small.json.data.attached === true, "...and the text is attached for the AI tutor (the extracted text lives in the database)");
    const res = await db.lessonResource.findMany({ where: { lessonId: small.json.data.lessonId } });
    assert(res.length === 1 && !res[0].storagePath, "...with no original file stored (no storage path) because the disk is read-only");
    const storageAfter = fs.existsSync("storage/documents") ? fs.readdirSync("storage/documents").length : 0;
    assert(storageAfter === storageBefore, "Nothing was written to the project's storage folder");
    const big = await upload("B", Buffer.alloc(5 * 1024 * 1024, 65), "big.txt", Q);
    assert(big.status === 413 && /4MB upload limit on this host/.test(big.json.error), `A 5 MB file: 413 with a plain message (${big.json.error})`);
    const docUpload = await fetch(`${A.base}/api/lessons/${small.json.data.lessonId}/documents`, { method: "POST", headers: { "Content-Type": "application/octet-stream", "x-file-name": "plain.txt", Authorization: `Bearer ${T}` }, body: fs.readFileSync(path.join(P45, "lesson-plain.txt")) });
    const docJson: any = await docUpload.json().catch(() => ({}));
    assert(docUpload.status === 201 && docJson.extraction?.originalKept === false && /does not keep the original/.test(docJson.extraction?.note ?? ""), "The ordinary upload route says plainly that the original is not kept");
    assert(!JSON.stringify(docJson).includes("storagePath"), "...and never shows a storage path");

    section("8. A bad setting stops the function loudly");
    const bad = spawn("node", ["scripts/serverless-shim.mjs"], { env: { ...process.env, DATABASE_URL: freshUrl, VERCEL: "1", NODE_ENV: "production", AI_PROVIDER: "local", AUTH_SECRET: "too-short", PORT: String(basePort + 9) }, stdio: ["ignore", "pipe", "pipe"] });
    let badLog = ""; bad.stdout?.on("data", (x) => (badLog += x)); bad.stderr?.on("data", (x) => (badLog += x));
    const code: number | null = await new Promise((r) => { bad.on("exit", (c) => r(c)); setTimeout(() => { bad.kill("SIGKILL"); r(null); }, 20000); });
    assert(code !== 0 && code !== null && /(Tuklas cannot start|AUTH_SECRET must be set)/.test(badLog) && /AUTH_SECRET/.test(badLog), "A short AUTH_SECRET: the function refuses to start and says why");
    assert(!badLog.includes("too-short"), "...without printing the secret");

    section("9. The web app in a real browser, under vercel.json's headers");
    const bro = spawnSync("node", ["scripts/test-phase48-browser.mjs"], { env: { ...process.env, BASE_URL: A.base, ADMIN_EMAIL: adminEmail, ADMIN_PASSWORD: adminPassword }, encoding: "utf-8", maxBuffer: 20 * 1024 * 1024, timeout: 240000 });
    process.stdout.write((bro.stdout || "").split("\n").filter((l) => /^(FAIL|PASS)|ALL BROWSER|FAILED/.test(l)).map((l) => "  " + l).join("\n") + "\n");
    if (bro.status !== 0) console.error((bro.stderr || "").slice(-600));
    assert(bro.status === 0, "Chromium (phone size): student and teacher screens load with no script errors or policy violations");

    section("10. The housekeeping row count is bounded");
    const rows = await db.rateEvent.count();
    assert(rows > 0 && rows < 200, `Only counted events are stored (${rows} rows after this run)`);
  } finally {
    for (const s of servers) if (s.pid) { try { process.kill(-s.pid, "SIGKILL"); } catch { /* */ } }
    await db.$disconnect();
    const drop = new PrismaClient({ datasources: { db: { url: adminUrl.toString() } } });
    await drop.$executeRawUnsafe(`DROP DATABASE "${dbName}" WITH (FORCE)`); await drop.$disconnect();
  }
  console.log(`\nPOSTGRES PHASE 48 RESULTS: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}
main().catch((e) => { console.error("crashed:", e); process.exit(1); });
