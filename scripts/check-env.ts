/**
 * Checks the settings the server is started with and says, in plain words, what is wrong (Phase 42). Run before starting:
 *   npm run check:env            exits 1 if something would make the server unsafe or unable to run; warnings do not fail it
 * The server itself still enforces the fatal ones; this tells you about all of them at once.
 */
import fs from "fs";
import path from "path";

export interface EnvReport { fatal: string[]; warnings: string[]; notes: string[] }

export function checkEnv(env: NodeJS.ProcessEnv = process.env): EnvReport {
  const fatal: string[] = [], warnings: string[] = [], notes: string[] = [];
  const prod = env.NODE_ENV === "production";
  const db = env.DATABASE_URL ?? "";
  const hasDb = /^postgres(ql)?:\/\//.test(db);

  if (!prod) notes.push("NODE_ENV is not 'production': this is a development run (insecure-cookie friendly, no API rate limit).");
  if (db && !hasDb) fatal.push("DATABASE_URL is set but is not a PostgreSQL URL (it must start with postgresql://).");
  if (prod && !hasDb) {
    if (env.ALLOW_DEMO_MODE === "I_UNDERSTAND_DEMO_ACCOUNTS_ARE_PUBLIC") warnings.push("No database and ALLOW_DEMO_MODE is on: public demo accounts, everything resets on restart. Never use this with real students.");
    else fatal.push("Production needs DATABASE_URL (PostgreSQL). Without it the server refuses to start.");
  }
  if (hasDb && /@(localhost|127\.0\.0\.1)[:/]/.test(db) && prod) warnings.push("DATABASE_URL points at localhost: fine inside one machine, wrong if the app runs in a container separate from the database.");
  if (hasDb && !/sslmode=|ssl=true/.test(db) && !/@(localhost|127\.0\.0\.1|db|postgres)[:/]/.test(db)) warnings.push("DATABASE_URL has no sslmode: a hosted database (Neon, RDS...) normally needs ?sslmode=require.");

  const secret = env.AUTH_SECRET ?? "";
  if (prod && (secret.length < 32 || /^placeholder/i.test(secret))) fatal.push("AUTH_SECRET must be at least 32 random characters in production (generate one with: openssl rand -hex 32). Changing it signs everyone out.");
  else if (!prod && secret.length < 32) notes.push("AUTH_SECRET is short or missing: the dev server makes a temporary one.");

  if (env.VERCEL && hasDb && !/-pooler\./.test(db)) warnings.push("On Vercel, DATABASE_URL should be Neon's POOLED address (the host contains \"-pooler\"): each function instance opens its own connections, and the direct address runs out of them under load. Use the direct address only for `npm run setup:db`.");
  if (prod) {
    if (!/^https:\/\//.test(env.APP_URL ?? "")) warnings.push("APP_URL is not an https:// address. Students' browsers keep the secure session cookie only over https.");
    if (env.TRUST_PROXY !== "true" && env.TRUST_PROXY !== "1") warnings.push("TRUST_PROXY is not set. Behind a proxy or load balancer (Render, nginx...) every student then looks like one address to the rate limit; set TRUST_PROXY=true.");
  }
  const provider = (env.AI_PROVIDER ?? "gemini").toLowerCase();
  if (provider === "gemini" && !(env.GEMINI_API_KEY || env.AI_API_KEY)) warnings.push("AI_PROVIDER is gemini but no GEMINI_API_KEY: the tutor will use the built-in rule-based engine.");
  if (provider === "local") notes.push("AI_PROVIDER=local: the tutor uses the built-in rule-based engine (no external model).");

  const dir = path.resolve(env.DOCUMENT_STORAGE_DIR || "./storage/documents");
  if (env.VERCEL && env.STORE_ORIGINALS !== "true") notes.push("Running on Vercel: uploaded documents keep their extracted text (database) but not the original file; uploads are limited to 4 MB.");
  else try { fs.mkdirSync(dir, { recursive: true }); fs.accessSync(dir, fs.constants.W_OK); notes.push(`Uploaded lesson documents are stored in ${dir}: this must be a persistent volume, or originals are lost on redeploy (their extracted text stays in the database).`); }
  catch { warnings.push(`DOCUMENT_STORAGE_DIR (${dir}) is not writable: teachers' document uploads will fail.`); }

  if (env.ADMIN_PASSWORD) warnings.push("ADMIN_PASSWORD is still set. It is only used to create the first administrator; remove it after the first start.");
  if (prod && !(env.PRIVACY_CONTACT_EMAIL ?? "").trim()) warnings.push("PRIVACY_CONTACT_EMAIL is not set: the privacy notice tells students to ask 'your teacher or the school office' instead of naming a contact. Set it (and SCHOOL_NAME).");
  const limit = env.API_RATE_LIMIT_PER_MINUTE;
  if (limit !== undefined && Number(limit) === 0 && prod) warnings.push("API_RATE_LIMIT_PER_MINUTE=0 turns the request ceiling off in production.");
  return { fatal, warnings, notes };
}

if (process.argv[1] && /check-env\.(ts|js)$/.test(process.argv[1])) {
  const r = checkEnv();
  for (const n of r.notes) console.log(`note:    ${n}`);
  for (const w of r.warnings) console.log(`WARNING: ${w}`);
  for (const f of r.fatal) console.log(`FATAL:   ${f}`);
  console.log(r.fatal.length ? `\ncheck-env: ${r.fatal.length} problem(s) must be fixed before starting.` : `\ncheck-env: ok${r.warnings.length ? ` (${r.warnings.length} warning(s))` : ""}.`);
  process.exit(r.fatal.length ? 1 : 0);
}
