/**
 * Tuklas AI - Phase 41 on PostgreSQL. Brand-new database + the real Term 1 course, then: the structure suite (units in Term 3, competencies,
 * skills, prerequisites), the lesson-save suite, and the teacher browser journey; finally a look at the rows.
 */
import crypto from "crypto";
import { spawn, spawnSync, type ChildProcess } from "child_process";
import { PrismaClient } from "@prisma/client";

async function main() {
  const url = process.env.DATABASE_URL ?? "";
  if (!/^postgres(ql)?:\/\//.test(url)) { console.log("SKIPPED: DATABASE_URL is not a PostgreSQL URL. Nothing was verified by this script."); return; }
  let passed = 0, failed = 0;
  const assert = (c: boolean, m: string) => { if (c) { passed++; console.log(`  ✅ ${m}`); } else { failed++; console.error(`  ❌ FAILED: ${m}`); } };
  const run = crypto.randomBytes(3).toString("hex");
  const dbName = `tuklas_p41_${run}`;
  const u = new URL(url); const adminUrl = new URL(url); adminUrl.pathname = "/postgres"; u.pathname = `/${dbName}`;
  const freshUrl = u.toString();
  const root = new PrismaClient({ datasources: { db: { url: adminUrl.toString() } } });
  await root.$executeRawUnsafe(`CREATE DATABASE "${dbName}"`); await root.$disconnect();
  const env = { ...process.env, DATABASE_URL: freshUrl, NODE_ENV: "production" } as NodeJS.ProcessEnv;
  const sh = (cmd: string, args: string[], extra: Record<string, string> = {}) => spawnSync(cmd, args, { env: { ...env, ...extra }, encoding: "utf-8", maxBuffer: 20 * 1024 * 1024 });
  const db = new PrismaClient({ datasources: { db: { url: freshUrl } } });
  let server: ChildProcess | undefined;
  try {
    console.log("--- A. Bootstrap ---");
    assert(sh("npx", ["prisma", "db", "push", "--skip-generate"]).status === 0, "Schema applied");
    assert(sh("npx", ["tsx", "prisma/seed.ts"], { SEED_CURRICULUM_ONLY: "true" }).status === 0, "Real Term 1 course seeded (Term 3 does not exist yet)");
    const adminEmail = `p41.admin.${run}@example.edu`, adminPassword = `Boot-strap-${run}9`;
    assert(sh("npx", ["tsx", "scripts/create-admin.ts"], { ADMIN_EMAIL: adminEmail, ADMIN_NAME: "P41 Admin", ADMIN_PASSWORD: adminPassword }).status === 0, "Admin bootstrapped");
    assert((await db.term.count({ where: { termNumber: 3 } })) === 0, "(setup) no Term 3 in the database");

    console.log("\n--- B. Suites ---");
    const env2 = { ADMIN_EMAIL: adminEmail, ADMIN_PASSWORD: adminPassword, NODE_ENV: "development", AI_PROVIDER: "local" };
    for (const [script, label] of [["scripts/test-phase41-structure.ts", "Structure suite"], ["scripts/test-phase41-lesson-save.ts", "Lesson-save suite"]] as const) {
      const r = sh("npx", ["tsx", script], env2);
      process.stdout.write(r.stdout.split("\n").filter((l) => /❌|RESULTS|crashed/.test(l)).join("\n") + "\n");
      if (r.status !== 0) console.error(r.stderr.slice(-500));
      assert(r.status === 0, `${label} passes on PostgreSQL`);
    }

    console.log("\n--- C. Teacher journey in a browser ---");
    const port = 6700 + Math.floor(Math.random() * 90), base = `http://127.0.0.1:${port}`;
    server = spawn("npx", ["tsx", "server.ts"], { env: { ...env, ...env2, PORT: String(port), AUTH_SECRET: crypto.randomBytes(16).toString("hex") }, stdio: "ignore", detached: true });
    for (let i = 0; i < 90; i++) { await new Promise((r) => setTimeout(r, 500)); try { if ((await fetch(`${base}/api/health`)).ok) break; } catch { /* */ } }
    const br = sh("node", ["scripts/test-phase41-browser.mjs"], { ...env2, BASE_URL: base });
    process.stdout.write((br.stdout || "").split("\n").filter((l) => /^(PASS|FAIL)|ALL BROWSER|CHECK\(S\)/.test(l)).map((l) => "  " + l).join("\n") + "\n");
    if (br.status !== 0) console.error((br.stderr || "").slice(-500));
    assert(br.status === 0, "Add unit, competency, skill, lesson, sections, publish; the student takes it");

    console.log("\n--- D. Rows ---");
    const term3 = await db.term.findFirst({ where: { termNumber: 3 }, include: { units: { include: { competencies: { include: { skills: true } } } } } });
    assert(!!term3 && term3.name === "Term 3", "Term 3 was created by the first unit added to it");
    assert((term3?.units ?? []).every((x) => !!x.createdById), "Units added by teachers record who added them; the seeded ones do not");
    assert((await db.unit.count({ where: { createdById: null } })) === 3, "The 3 seeded units have no creator (any teacher may edit them)");
    const lessonRows = await db.lessonContentBlock.count({ where: { lesson: { title: { startsWith: "Adding and subtracting fractions" } } } });
    assert(lessonRows === 2, `The studio's lesson is stored with its 2 sections (${lessonRows})`);
    const tmpl = await db.lessonContentBlock.count({ where: { lesson: { status: "PUBLISHED" }, content: { contains: "Replace this text" } } });
    assert(tmpl === 0, "No published lesson contains template text");
  } finally {
    if (server?.pid) { try { process.kill(-server.pid, "SIGKILL"); } catch { /* */ } }
    await db.$disconnect();
    const drop = new PrismaClient({ datasources: { db: { url: adminUrl.toString() } } });
    await drop.$executeRawUnsafe(`DROP DATABASE "${dbName}" WITH (FORCE)`); await drop.$disconnect();
  }
  console.log(`\nPOSTGRES PHASE 41 RESULTS: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}
main().catch((e) => { console.error("crashed:", e); process.exit(1); });
