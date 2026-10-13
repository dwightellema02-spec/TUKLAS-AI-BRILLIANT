/**
 * Local stand-in for Vercel (Phase 48): loads the REAL bundle that `npm run build:vercel` makes (build/serverless.mjs) through the committed api/index.js, as a function the way Vercel
 * does (nothing listens inside it), and gives it a port plus the built web app. It also makes the disk read-only for the project folder, as
 * on Vercel, so any code that tries to write a file fails here too.
 *   npm run build && npm run build:vercel && PORT=3100 node scripts/serverless-shim.mjs
 */
process.env.VERCEL = process.env.VERCEL || "1";
process.env.NODE_ENV = process.env.NODE_ENV || "production";
import fs from "fs";
import os from "os";
import path from "path";
import { pathToFileURL } from "url";
import express from "express";

const root = process.cwd();
const tmp = os.tmpdir();
const readOnly = (p) => { const full = path.resolve(String(p)); return full.startsWith(root + path.sep) && !full.startsWith(tmp + path.sep) && !full.includes(`${path.sep}node_modules${path.sep}.prisma${path.sep}`); };
const deny = (name, p) => { const e = new Error(`EROFS: read-only file system, ${name} '${p}'`); e.code = "EROFS"; throw e; };
for (const name of ["writeFileSync", "mkdirSync", "appendFileSync", "unlinkSync", "renameSync", "createWriteStream"]) {
  const real = fs[name].bind(fs);
  fs[name] = (p, ...rest) => (readOnly(p) ? deny(name, p) : real(p, ...rest));
}
const realWriteFile = fs.promises.writeFile.bind(fs.promises);
fs.promises.writeFile = (p, ...rest) => (readOnly(p) ? Promise.reject(Object.assign(new Error(`EROFS: read-only file system, open '${p}'`), { code: "EROFS" })) : realWriteFile(p, ...rest));

const bundle = path.resolve(root, "api/index.js"); // the committed wrapper, as Vercel sees it
if (!fs.existsSync(path.resolve(root, "build/serverless.mjs"))) { console.error("Run `npm run build:vercel` first."); process.exit(1); }
const app = (await import(pathToFileURL(bundle).href)).default;

const dist = path.resolve(root, "dist");
const outer = express();
outer.disable("x-powered-by");
// the host (not the function) adds vercel.json's headers to the web app's files: do the same, so the page is checked under the real policy
const vercelHeaders = (JSON.parse(fs.readFileSync(path.resolve(root, "vercel.json"), "utf-8")).headers ?? []).flatMap((h) => h.headers);
outer.use((req, res, next) => { if (!req.path.startsWith("/api/")) for (const h of vercelHeaders) res.setHeader(h.key, h.value); next(); });
outer.use(app); // like Vercel: /api/* goes to the function
outer.use(express.static(dist));
outer.get("*", (_req, res) => res.sendFile(path.join(dist, "index.html")));
const port = Number(process.env.PORT || 3100);
outer.listen(port, "127.0.0.1", () => console.log(`🚀 serverless shim on http://127.0.0.1:${port}`));
