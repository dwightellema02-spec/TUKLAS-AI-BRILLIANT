/**
 * Tuklas AI - Phase 45: importing a draft lesson from a document, black-box over HTTP (same suite in-memory and on PostgreSQL).
 *   AI_PROVIDER=local npx tsx scripts/test-phase45-import.ts
 *   DATABASE_URL=... ADMIN_EMAIL=... ADMIN_PASSWORD=... npx tsx scripts/test-phase45-import.ts   (the PostgreSQL wrapper does this)
 */
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { spawn, type ChildProcess } from "child_process";

process.env.AI_PROVIDER = "local";
const DB_MODE = /^postgres(ql)?:\/\//.test(process.env.DATABASE_URL ?? "");
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@tuklas.ai", ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "Tuklas2026!";
let passed = 0, failed = 0;
const assert = (c: boolean, m: string) => { if (c) { passed++; if (process.env.VERBOSE) console.log(`  ✅ ${m}`); } else { failed++; console.error(`  ❌ FAILED: ${m}`); } };
const section = (t: string) => console.log(`\n--- ${t} ---`);
const P45 = path.join(process.cwd(), "scripts", "fixtures", "phase45"), P22 = path.join(process.cwd(), "scripts", "fixtures", "phase22");
const KEY = "ZZ-ANSWER-KEY-7491";
const run = crypto.randomBytes(3).toString("hex");

async function main() {
  const port = 3700 + Math.floor(Math.random() * 90), base = `http://127.0.0.1:${port}`;
  const server: ChildProcess = spawn("npx", ["tsx", "server.ts"], { env: { ...process.env, PORT: String(port), NODE_ENV: "development", AI_PROVIDER: "local", AUTH_SECRET: crypto.randomBytes(32).toString("hex") }, stdio: "ignore", detached: true });
  try {
    for (let i = 0; i < 120; i++) { await new Promise((r) => setTimeout(r, 500)); try { if ((await fetch(`${base}/api/health`)).ok) break; } catch { /* */ } }
    type R = { status: number; json: any };
    const api = async (m: string, p: string, t?: string, b?: unknown): Promise<R> => { const r = await fetch(base + p, { method: m, headers: { ...(b !== undefined ? { "Content-Type": "application/json" } : {}), ...(t ? { Authorization: `Bearer ${t}` } : {}) }, body: b !== undefined ? JSON.stringify(b) : undefined }); return { status: r.status, json: await r.json().catch(() => ({})) }; };
    const upload = async (tok: string | undefined, file: Buffer | string, name: string, query = "") => {
      const body = typeof file === "string" ? fs.readFileSync(file) : file;
      const r = await fetch(`${base}/api/teacher/lessons/import${query}`, { method: "POST", headers: { "Content-Type": "application/octet-stream", "x-file-name": encodeURIComponent(name), ...(tok ? { Authorization: `Bearer ${tok}` } : {}) }, body: new Uint8Array(body) });
      return { status: r.status, json: (await r.json().catch(() => ({}))) as any };
    };
    const login = async (e: string, p: string) => (await api("POST", "/api/auth/login", undefined, { email: e, password: p })).json.token as string;
    const admin = await login(ADMIN_EMAIL, ADMIN_PASSWORD);
    const mkT = async (tag: string) => { await api("POST", "/api/admin/users", admin, { name: `Teacher ${tag}`, email: `p45.${tag}.${run}@example.edu`, password: "Sturdy-Pass1", role: "TEACHER", verifyMathematics: true }); return login(`p45.${tag}.${run}@example.edu`, "Sturdy-Pass1"); };
    const T1 = await mkT("t1"), T2 = await mkT("t2"), T3 = await mkT("t3");
    const S = (await api("POST", "/api/auth/register", undefined, { name: "Pupil", email: `p45.s.${run}@example.edu`, password: "Sturdy-Pass1" })).json.token as string;
    const cur = (await api("GET", "/api/curriculum", T1)).json.data;
    const unitId = (cur[0].grades[0].terms as any[]).flatMap((t) => t.units)[0].id as string;
    const lessonCount = async () => ((await api("GET", "/api/lessons?limit=500", T1)).json.data ?? []).length;
    const Q = `?unitId=${encodeURIComponent(unitId)}`;
    const structured = path.join(P45, "lesson-structured.docx");

    section("1. Who may import");
    assert([401, 403].includes((await upload(undefined, structured, "x.docx", Q)).status), "Signed-out: refused");
    assert((await upload(S, structured, "x.docx", Q)).status === 403, "A student: refused");
    assert((await upload(T1, structured, "x.docx")).status === 400, "No unit named: 400");
    assert((await upload(T1, structured, "x.docx", "?unitId=does-not-exist")).status === 400, "A unit that does not exist: 400");
    const before = await lessonCount();
    assert((await upload(T1, Buffer.alloc(0), "x.docx", Q)).status === 400, "An empty upload: 400");

    section("2. A good document becomes a draft the teacher owns");
    const ok = await upload(T1, structured, "Fractions week 3.docx", Q);
    assert(ok.status === 201 && ok.json.data.status === "DRAFT" && ok.json.data.blocks.length === 4, `Imported as a DRAFT with 4 sections (${ok.status})`);
    const lid = ok.json.data.lessonId as string;
    const got = (await api("GET", `/api/lessons/${lid}`, T1)).json.data;
    assert(got.status === "DRAFT" && got.title === "Subtracting Fractions with Unlike Denominators" && got.contentBlocks.length === 4, "The lesson is stored as a draft with its title and 4 sections");
    assert(got.contentBlocks.map((b: any) => b.sequenceOrder).join() === "1,2,3,4" && got.contentBlocks[1].type === "EXAMPLE", "Sections are in order and keep their kind");
    assert((got.learningObjectives ?? []).length === 2, "The 2 learning objectives are stored on the lesson");
    assert(!JSON.stringify(got).includes(KEY), "The answer key text is nowhere in the stored lesson");
    assert(ok.json.data.skipped.length === 1 && ok.json.data.warnings.length >= 1, "The answer says what was skipped and what to check");
    assert(new Set(got.contentBlocks.map((b: any) => b.id)).size === 4, "Section ids are unique (the demo store once reused an id for sections created in the same millisecond)");
    assert((await api("GET", `/api/lessons/${lid}`, S)).status === 403, "A student cannot open the draft");
    assert(!JSON.stringify((await api("GET", "/api/lessons", S)).json).includes(lid), "...and it is not in the student's lesson list");
    assert((await api("PUT", `/api/lessons/${lid}`, T2, { title: "Hijack" })).status === 403, "Another teacher cannot edit it");
    assert((await api("PUT", `/api/lessons/${lid}`, T1, { title: "Subtracting Fractions (checked)" })).status === 200, "The author can edit it in the studio");
    assert((await upload(T1, structured, "x.docx", Q)).json.data.lessonId !== lid, "Importing the same file again makes a separate lesson (no overwrite)");

    section("3. Other formats and a title typed by the teacher");
    const txt = await upload(T1, path.join(P45, "lesson-plain.txt"), "percent.txt", Q + "&title=" + encodeURIComponent("Percent of a number (week 5)"));
    assert(txt.status === 201 && txt.json.data.title === "Percent of a number (week 5)" && txt.json.data.blocks.length === 4, "A text file imports, with the teacher's own title");
    const img = await upload(T1, path.join(P45, "lesson-with-image.docx"), "pic.docx", Q);
    assert(img.status === 201 && img.json.data.stats.imagesNotImported === 1, "A picture is reported as not imported");
    const many = await upload(T1, path.join(P45, "too-many-sections.docx"), "many.docx", Q);
    assert(many.status === 201 && many.json.data.blocks.length === 40 && many.json.data.warnings.some((w: string) => /only the first 40/.test(w)), "45 sections: 40 imported, the teacher is told");

    const withDoc = await upload(T1, structured, "attach.docx", Q + "&attach=true");
    assert(withDoc.status === 201 && withDoc.json.data.attached === true, "With attach=true the document is also kept for the AI tutor");
    const attachedLesson = (await api("GET", `/api/lessons/${withDoc.json.data.lessonId}`, T1)).json.data;
    assert((attachedLesson.resources ?? []).length === 1 && attachedLesson.resources[0].extractionStatus === "EXTRACTED" && !JSON.stringify(attachedLesson.resources).includes("storagePath"), "...as one resource, extracted, without exposing where the file is stored");
    assert(got.resources.length === 0 && ok.json.data.attached === false, "Without it, nothing is attached (the default)");
    const attachBad = await upload(T1, path.join(P22, "scanned-image-only.pdf"), "scan.pdf", Q + "&attach=true");
    assert(attachBad.status === 422, "A document that cannot be read is refused even when attaching was asked for");

    section("4. Bad files change nothing");
    const n0 = await lessonCount();
    const bad: Array<[string, Buffer | string, string, number]> = [
      ["only an answer key", path.join(P45, "only-answer-key.docx"), "key.docx", 422],
      ["a scanned PDF", path.join(P22, "scanned-image-only.pdf"), "scan.pdf", 422],
      ["an encrypted PDF", path.join(P22, "encrypted.pdf"), "enc.pdf", 422],
      ["an empty Word file", path.join(P22, "empty.docx"), "empty.docx", 422],
      ["a decompression bomb", path.join(P22, "bomb.docx"), "bomb.docx", 413],
      ["a non-Word file named .docx", path.join(P22, "not-word.docx"), "fake.docx", 415],
      ["a PDF disguised as .docx", path.join(P22, "las-adding-integers.pdf"), "disguised.docx", 415],
      ["an unsupported type", Buffer.from("MZ binary"), "virus.exe", 415],
    ];
    for (const [label, file, name, want] of bad) { const r = await upload(T1, file, name, Q); assert(r.status === want && !!r.json.error, `${label}: ${want} with a reason (${r.status})`); }
    assert((await lessonCount()) === n0, "No lesson was created by any of the bad files");
    assert(before < n0, "(sanity) the good imports did create lessons");

    section("5. The audit log");
    const audit = await api("GET", "/api/admin/audit?limit=200&action=lesson.import_draft", admin);
    const rows: any[] = audit.json.data?.entries ?? audit.json.data?.rows ?? audit.json.data ?? [];
    assert(Array.isArray(rows) && rows.length >= 4 && rows.every((r) => r.action === "lesson.import_draft"), `Imports are audited (${rows.length})`);
    assert(!JSON.stringify(rows).includes("Fractions week 3") && !JSON.stringify(rows).includes("percent.txt"), "...without the file names");

    section("6. Upload rate limit");
    let limited = 0;
    for (let i = 0; i < 24; i++) if ((await upload(T3, path.join(P45, "lesson-plain.txt"), "p.txt", Q)).status === 429) limited++;
    assert(limited >= 3, `One teacher cannot import without limit (${limited} of 24 refused)`);
  } finally { try { process.kill(-server.pid!, "SIGTERM"); } catch { /* */ } }
  console.log(`\nPHASE 45 IMPORT RESULTS (${DB_MODE ? "PostgreSQL" : "in-memory"}): ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}
main().catch((e) => { console.error("crashed:", e); process.exit(1); });
