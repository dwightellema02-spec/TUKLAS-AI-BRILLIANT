# Phase 47 — Making the free hosting setup behave well

**Why:** the plan is Neon (free database) + Render (free web service). Both sleep when idle, and nothing in the app was built for that: the first request after a pause could fail, and a database that was briefly unreachable made the app treat a signed-in person as signed out.

## What was built
1. **A database that wakes up** (`src/lib/db-resilience.ts`, wired into `src/lib/db.ts`). Every query is tried again, for at most 12 s (`DB_RETRY_BUDGET_MS`), but only where that is safe:
   * the database could not be reached at all (nothing was sent): any query, writes included;
   * a connection was closed under us (the query may or may not have run): **reads only, never writes** (a write might be applied twice);
   * real answers (duplicate key, missing row, bad value) are never retried. The first retries after a cut are immediate, because each attempt discards only one dead pooled connection.
   The connection address also gets sensible defaults unless it sets them: `connect_timeout=15`, `connection_limit=5`, `max_idle_connection_lifetime=120` (idle connections are closed by us before the host suspends the database, so none are dead when it wakes).
2. **An outage is not a sign-out** (`server.ts`). When the account check cannot reach the database, the server answers **503 "try again" (`DATABASE_UNAVAILABLE`)** instead of treating the person as signed out (401). The browser app no longer clears the signed-in user on anything but a real 401.
3. **A "waking up" notice and retrying in the browser** (`src/lib/net/resilient-fetch.ts`, `ConnectionNotice`). Requests to `/api/` that fail with a network error or 502/503/504 are retried for up to 45 s (reads) with a notice "The server is waking up or reconnecting... Your work is not lost". Writes are retried **only** when the server says it did not process them (503 `DATABASE_UNAVAILABLE`), for up to 15 s, and a write that failed with a network error is never repeated.
4. **A phone-size pass**: 19 screens (student, teacher, admin) at 390 px wide in a real browser. Found and fixed: the teacher's Curriculum page overflowed sideways (the unit header did not wrap), footer links and the "Recalculate" button were too small to tap.
5. **A "before class" checklist** for the free plan in `docs/DEPLOY_RENDER_NEON.md`; the new settings are in `docs/RUNBOOK.md`.
6. A defect of my own found on the way: the Phase 42 load test (not part of the regular regression) had silently stopped working when Phase 43 made every account accept the privacy notice in production. Fixed. With the new pool of 5 connections the load test (45 students on one address, production mode, PostgreSQL) still passes: 1,960 requests, none refused or failed, p95 774 ms (it was about 750 ms before).

## Verification
| Check | Result |
|---|---|
| `test-phase47-client.ts` (fake network and clock) | 25 passed: reads retried on 502/503/504 and network errors; real answers (200, 400, 401, 403, 404, 409, 429, 500) never; writes only on `DATABASE_UNAVAILABLE`, never after a network error; time limits; one notice for many waiting requests; cancelling stops the wait. Mutation checks: repeating network-failed writes, or retrying plain 503 writes, make 1 and 4 checks fail |
| `test-phase47-resilience.ts` part A (fake clock) | 18 passed: which database errors count as "not reached", "closed" or real answers; what may be retried; the 5 s budget; a budget of 0 switches it off; connection settings added without overriding the address |
| same, part B: **the real server behind a proxy that switches the database off and on** (fresh database from the real migrations) | 14 passed: a read arriving during a 4 s sleep succeeds after ~5 s; a sign-up arriving during a 3 s sleep succeeds **exactly once** (a second sign-up gets 409); a database away for longer than the budget gives **503 after ~12 s, not a hang**, the server stays up and `/api/health` answers; when it returns the next request works at once and `/api/ready` is ready; after a connection cut a read recovers in under 4 s. **Mutation checks:** without the retry 8 checks fail; without the 503 on outage the "no hang, 503" check fails (it was 401) |
| `test-phase47-browser.mjs` | The app shows the notice while the server answers 503, retries by itself, **does not show the sign-in screen**, repeats a read that failed with a connection error and loads; 19 phone-size screens: no sideways scrolling, no errors |
| Full regression | see the end of this file |

## Not done / limits (please read)
* **A write straight after the database connection was cut may fail once** (it is never repeated automatically, because it might have been applied); the next try works. This is the price of never risking a double write. Idle connections are closed by the app before Neon suspends, so this should be rare on the free plan.
* **Render's own wake-up page.** When the free web service itself is asleep, Render holds the very first request for up to about a minute before the app answers. The app cannot show anything during that time; only the uptime-service ping and the before-class checklist avoid it.
* Many routes handle their own errors and answer 500 with a message when the database stays away longer than 12 s; only the account check turns that into 503.
* An unsaved lesson being typed in the studio is not kept if the page is closed during an outage (not changed).
* Small tap targets remain on the teacher and admin screens (icon buttons, "Disable" / "Erase" links); the student screens are fine. Not tested on a physical phone.
* Not tested against a real Neon database (a proxy that refuses connections was used to imitate one).

## Full regression
Running when this was committed; the result is recorded in the next commit.
