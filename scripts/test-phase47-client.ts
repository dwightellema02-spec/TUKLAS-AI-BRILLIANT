/**
 * Tuklas AI - Phase 47: the browser side of "the server is waking up": which failed requests are tried again, which never are, how long, and
 * when the notice shows. Pure logic with a fake network and clock.
 *   npx tsx scripts/test-phase47-client.ts
 */
import { createResilientFetch } from "../src/lib/net/resilient-fetch";

let passed = 0, failed = 0;
const assert = (c: boolean, m: string) => { if (c) { passed++; console.log(`  ✅ ${m}`); } else { failed++; console.error(`  ❌ FAILED: ${m}`); } };
const R = (status: number, body: unknown = {}) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

function harness(script: Array<() => Response | Promise<Response>>, opts: { readBudgetMs?: number; writeBudgetMs?: number } = {}) {
  let t = 0; let calls = 0; const sleeps: number[] = []; const waiting: boolean[] = [];
  const inner = (async () => { const step = script[Math.min(calls, script.length - 1)]; calls++; return step(); }) as unknown as typeof fetch;
  const f = createResilientFetch(inner, { ...opts, now: () => t, sleep: async (ms) => { sleeps.push(ms); t += ms; }, onWaiting: (w) => waiting.push(w) });
  return { f, calls: () => calls, sleeps, waiting };
}
const down = () => { throw new TypeError("Failed to fetch"); };

async function main() {
  console.log("--- reads ---");
  let h = harness([() => R(503), () => R(503), () => R(200, { ok: 1 })]);
  let res = await h.f("/api/skills");
  assert(res.status === 200 && h.calls() === 3 && h.sleeps.join() === "1000,2000", `A read answered 503 twice is tried again and succeeds (waited ${h.sleeps.join(" + ")} ms)`);
  assert(h.waiting.join() === "true,false", "The notice turns on while waiting and off afterwards");
  h = harness([down, () => R(200)]);
  assert((await h.f("/api/skills")).status === 200 && h.calls() === 2, "A read that failed with a network error is tried again");
  h = harness([() => R(502), () => R(504), () => R(200)]);
  assert((await h.f("/api/skills")).status === 200, "502 and 504 are treated like 503");
  for (const code of [200, 400, 401, 403, 404, 409, 429, 500]) {
    h = harness([() => R(code)]);
    const r = await h.f("/api/skills");
    assert(r.status === code && h.calls() === 1 && h.waiting.length === 0, `${code} is a real answer: returned as it is, no waiting`);
  }
  h = harness([() => R(503)], { readBudgetMs: 10_000 });
  res = await h.f("/api/skills");
  assert(res.status === 503 && h.sleeps.reduce((a, b) => a + b, 0) <= 10_000 && h.calls() >= 3 && h.waiting.join() === "true,false", `A server that stays away: gives up inside the budget (${h.calls()} tries) and hands back the last answer; the notice goes off`);
  h = harness([down], { readBudgetMs: 6000 });
  let threw = false; try { await h.f("/api/skills"); } catch (e) { threw = (e as Error).message === "Failed to fetch"; }
  assert(threw && h.waiting.join() === "true,false", "...or the original network error, never a hang");
  h = harness([() => R(503)]);
  const reader = await h.f(new Request("http://localhost/api/skills", { method: "HEAD" }));
  assert(h.calls() > 1 && reader.status === 503, "HEAD counts as a read");

  console.log("\n--- writes ---");
  h = harness([() => R(503, { code: "DATABASE_UNAVAILABLE" }), () => R(201)]);
  res = await h.f("/api/practice/x/answer", { method: "POST", body: "{}" });
  assert(res.status === 201 && h.calls() === 2, "A write the server says it did NOT process (503 DATABASE_UNAVAILABLE) is tried again");
  h = harness([() => R(503)]);
  res = await h.f("/api/practice/x/answer", { method: "POST", body: "{}" });
  assert(res.status === 503 && h.calls() === 1, "A write answered with a plain 503 is NOT repeated (we cannot tell whether it was applied)");
  h = harness([down, () => R(201)]);
  threw = false; try { await h.f("/api/lessons", { method: "POST", body: "{}" }); } catch { threw = true; }
  assert(threw && h.calls() === 1, "A write that failed with a network error is NEVER repeated: it might have been applied");
  for (const m of ["PUT", "PATCH", "DELETE"]) { h = harness([() => R(502)]); await h.f("/api/x", { method: m }); assert(h.calls() === 1, `${m} is not repeated after a 502`); }
  h = harness([() => R(503, { code: "DATABASE_UNAVAILABLE" })], { writeBudgetMs: 8000 });
  res = await h.f("/api/x", { method: "POST" });
  assert(res.status === 503 && h.sleeps.reduce((a, b) => a + b, 0) <= 8000, "A write is retried for a shorter time than a read");

  console.log("\n--- everything else is left alone ---");
  h = harness([() => R(503)]);
  assert((await h.f("/assets/index.js")).status === 503 && h.calls() === 1, "Requests that are not under /api/ are not touched");
  h = harness([() => R(503)]);
  const ctl = new AbortController();
  h = harness([() => R(503)]);
  const f2 = createResilientFetch((async () => R(503)) as unknown as typeof fetch, { sleep: (ms, signal) => new Promise((_r, rej) => { signal?.addEventListener("abort", () => rej(new DOMException("Aborted", "AbortError"))); }), onWaiting: (w) => h.waiting.push(w) });
  const p = f2("/api/skills", { signal: ctl.signal }).then(() => "done", (e) => (e as Error).name);
  await new Promise((r) => setTimeout(r, 10)); ctl.abort();
  assert((await p) === "AbortError" && h.waiting.join() === "true,false", "When the page cancels a request while it is waiting, the wait stops and the notice goes off");
  const two = harness([() => R(503), () => R(503), () => R(200), () => R(200)]);
  await Promise.all([two.f("/api/a"), two.f("/api/b")]);
  assert(two.waiting.filter((w) => w).length === 1 && two.waiting[two.waiting.length - 1] === false, "Two requests waiting at once show ONE notice, which goes off when both are done");

  console.log(`\nPHASE 47 CLIENT RESULTS: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}
main().catch((e) => { console.error("crashed:", e); process.exit(1); });
