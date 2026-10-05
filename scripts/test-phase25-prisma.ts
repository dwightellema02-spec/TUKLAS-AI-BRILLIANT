/**
 * Tuklas AI - Phase 25 on PostgreSQL: production account security + the full classroom suite against the database.
 * Needs DATABASE_URL (PostgreSQL with the schema applied). Skips otherwise, clearly labelled.
 */
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { spawn, spawnSync, type ChildProcess } from "child_process";

async function main() {
  if (!/^postgres(ql)?:\/\//.test(process.env.DATABASE_URL ?? "")) {
    console.log("SKIPPED: DATABASE_URL is not a PostgreSQL URL. Nothing was verified by this script.");
    return;
  }
  let passed = 0, failed = 0;
  const assert = (c: boolean, m: string) => {
    if (c) { passed++; console.log(`  ✅ ${m}`); } else { failed++; console.error(`  ❌ FAILED: ${m}`); }
  };

  const run = crypto.randomBytes(3).toString("hex");
  const adminEmail = `p25.admin.${run}@example.edu`;
  const adminPassword = `Boot-strap-${run}9`;
  const env = { ...process.env, ADMIN_EMAIL: adminEmail, ADMIN_NAME: "Bootstrap Admin", ADMIN_PASSWORD: adminPassword };

  console.log("--- A. Admin bootstrap and production account security ---");
  const created = spawnSync("npx", ["tsx", "scripts/create-admin.ts"], { env, encoding: "utf-8" });
  assert(created.status === 0 && /Administrator created/.test(created.stdout) && !created.stdout.includes(adminPassword), "create-admin.ts creates the first admin and never prints the password");
  const again = spawnSync("npx", ["tsx", "scripts/create-admin.ts"], { env, encoding: "utf-8" });
  assert(again.status !== 0 && /already exists/.test(again.stderr), "...and refuses to overwrite an existing account");
  const weak = spawnSync("npx", ["tsx", "scripts/create-admin.ts"], { env: { ...env, ADMIN_EMAIL: `w.${adminEmail}`, ADMIN_PASSWORD: "weak" }, encoding: "utf-8" });
  assert(weak.status !== 0 && /Password must/.test(weak.stderr), "...and enforces the password policy");
  const noDb = spawnSync("npx", ["tsx", "scripts/create-admin.ts"], { env: { ...env, DATABASE_URL: "" }, encoding: "utf-8" });
  assert(noDb.status !== 0 && /Refusing to run/.test(noDb.stderr), "...and refuses to run without a PostgreSQL URL (would create an in-memory ghost)");
  const seedProd = spawnSync("npx", ["tsx", "prisma/seed.ts"], { env: { ...process.env, NODE_ENV: "production" }, encoding: "utf-8" });
  assert(seedProd.status !== 0 && /Refusing to seed in production/.test(seedProd.stderr + seedProd.stdout), "The demo seed (public password) refuses to run in production");

  // A production-mode server: demo accounts that exist ONLY in memory must not be able to sign in
  const port = 3400 + Math.floor(Math.random() * 90);
  const prod: ChildProcess = spawn("npx", ["tsx", "server.ts"], {
    env: { ...process.env, PORT: String(port), NODE_ENV: "production", AUTH_SECRET: crypto.randomBytes(32).toString("hex"), AI_PROVIDER: "local" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  try {
    let up = false;
    for (let i = 0; i < 90 && !up; i++) {
      await new Promise((r) => setTimeout(r, 500));
      try { up = (await fetch(`http://127.0.0.1:${port}/api/health`)).ok; } catch { /* waiting */ }
    }
    assert(up, "Production-mode server boots against PostgreSQL");
    const login = async (e: string, p: string) =>
      (await fetch(`http://127.0.0.1:${port}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: e, password: p }) })).status;
    for (const demo of ["maria.clara@tuklas.ai", "crisostomo.ibarra@tuklas.ai", "basilio.magalang@tuklas.ai", "elias.salvi@tuklas.ai"]) {
      assert((await login(demo, "Tuklas2026!")) === 401, `Demo account ${demo} (in-memory only, public password) can NOT sign in in production`);
    }
    assert((await login(adminEmail, adminPassword)) === 200, "The bootstrapped administrator signs in");
    assert((await login(adminEmail, "Wrong-pass-1")) === 401, "Wrong password is rejected");
  } finally {
    prod.kill("SIGTERM");
  }

  // Users created in DB mode are never mirrored to the JSON file
  const persisted = path.join(process.cwd(), "data", "users-persistence.json");
  const fileText = fs.existsSync(persisted) ? fs.readFileSync(persisted, "utf-8") : "";
  assert(!fileText.includes(adminEmail), "A database user is never written to data/users-persistence.json");

  console.log("\n--- B. The full classroom suite against PostgreSQL ---");
  const suite = spawnSync("npx", ["tsx", "scripts/test-phase25-classrooms.ts"], { env: { ...env, NODE_ENV: "development" }, encoding: "utf-8", maxBuffer: 20 * 1024 * 1024 });
  process.stdout.write(suite.stdout.split("\n").filter((l) => /❌|RESULTS|Failures| - |crashed|Server up/.test(l)).join("\n") + "\n");
  assert(suite.status === 0, "Classroom suite passes on PostgreSQL");

  console.log("\n--- C. What is actually in the database ---");
  const { prisma } = await import("../src/lib/db");
  const classes = await prisma.classroom.findMany({ where: { name: { in: ["Grade 7 - Rizal", "Grade 7 - Bonifacio"] } }, include: { enrollments: true, assignments: true }, orderBy: { createdAt: "desc" } });
  assert(classes.length >= 2 && classes.every((c) => !!c.joinCode && /^[A-HJ-KM-NP-Z2-9]{6}$/.test(c.joinCode!)), "Classrooms and unique join codes are rows in PostgreSQL");
  const rizal = classes.find((c) => c.name === "Grade 7 - Rizal")!;
  assert(rizal.enrollments.length >= 2 && rizal.enrollments.some((e) => e.source === "JOIN_CODE" || e.source === "TEACHER"), "Enrolments persisted with their source");
  assert(rizal.assignments.length >= 1 && rizal.assignments.every((a) => !!a.createdById), "Assignments persisted with their creator");
  let dup = false;
  try { await prisma.classroom.update({ where: { id: classes.find((c) => c.id !== rizal.id)!.id }, data: { joinCode: rizal.joinCode } }); } catch (e: any) { dup = e?.code === "P2002"; }
  assert(dup, "The database itself rejects a duplicate join code");
  const before = await prisma.classroomEnrollment.count({ where: { classroomId: rizal.id } });
  await prisma.classroom.delete({ where: { id: rizal.id } });
  assert(before > 0 && (await prisma.classroomEnrollment.count({ where: { classroomId: rizal.id } })) === 0 && (await prisma.assignment.count({ where: { classroomId: rizal.id } })) === 0, "Deleting a class cascades to its enrolments and assignments");

  console.log(`\nPOSTGRES PHASE 25 RESULTS: ${passed} passed, ${failed} failed`);
  if (failed) process.exit(1);
}
main().then(() => process.exit(0)).catch((e) => { console.error("Crashed:", e); process.exit(1); });
