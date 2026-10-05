import crypto from "crypto";
import fs from "fs";
import { spawn } from "child_process";
const src = fs.readFileSync("server.ts", "utf-8");
const routes: Array<{ method: string; path: string }> = [];
const re = /app\.(get|post|put|patch|delete)\(\s*(\[[^\]]*\]|"[^"]+")/g;
let m: RegExpExecArray | null;
while ((m = re.exec(src))) {
  const paths = m[2].startsWith("[") ? Array.from(m[2].matchAll(/"([^"]+)"/g)).map((x) => x[1]) : [m[2].slice(1, -1)];
  for (const p of paths) if (p.startsWith("/api")) routes.push({ method: m[1].toUpperCase(), path: p });
}
const port = 4300 + Math.floor(Math.random() * 90);
const base = `http://127.0.0.1:${port}`;
const srv = spawn("npx", ["tsx", "server.ts"], { env: { ...process.env, PORT: String(port), NODE_ENV: "development", AI_PROVIDER: "local", AUTH_SECRET: crypto.randomBytes(32).toString("hex") }, stdio: "ignore", detached: true });
(async () => {
  for (let i = 0; i < 90; i++) { await new Promise((r) => setTimeout(r, 500)); try { if ((await fetch(`${base}/api/health`)).ok) break; } catch { /* wait */ } }
  const reg = await (await fetch(`${base}/api/auth/register`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Sweep Student", email: `sweep${Date.now()}@x.test`, password: "Sweep-Pass-1" }) })).json() as any;
  const stu = reg.token as string;
  const fill = (p: string) => p.replace(/:[A-Za-z]+/g, "x");
  const out: string[] = [];
  const seen = new Set<string>();
  for (const r of routes) {
    const key = `${r.method} ${r.path}`; if (seen.has(key)) continue; seen.add(key);
    for (const who of ["anon", "student"] as const) {
      const res = await fetch(`${base}${fill(r.path)}`, { method: r.method, headers: { ...(who === "student" ? { Authorization: `Bearer ${stu}` } : {}), "Content-Type": "application/json" }, body: r.method === "GET" ? undefined : "{}" });
      const text = await res.text();
      out.push(`${who}\t${r.method}\t${r.path}\t${res.status}\t${text.slice(0, 60).replace(/\s+/g, " ")}`);
    }
  }
  fs.writeFileSync("/tmp/sweep.tsv", out.join("\n"));
  try { process.kill(-srv.pid!, "SIGTERM"); } catch { /* */ }
  process.exit(0);
})();
