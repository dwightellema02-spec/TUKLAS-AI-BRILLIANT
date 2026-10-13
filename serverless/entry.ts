/**
 * Vercel entry (Phase 48). `npm run build:vercel` bundles this file into api/index.js; Vercel calls the exported Express app once per request.
 * A bad setting is reported at the first request (in the function log and as an error to the caller) instead of half-working.
 */
import { checkEnv } from "../scripts/check-env.ts";
import app from "../server.ts";

const report = checkEnv();
for (const w of report.warnings) console.warn(`WARNING: ${w}`);
if (report.fatal.length) {
  const message = `Tuklas cannot start: ${report.fatal.join(" ")}`;
  console.error(message);
  throw new Error(message);
}

export default app;
