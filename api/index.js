// Vercel finds this file as the function for /api/*. The server itself is bundled into build/serverless.mjs by `npm run vercel-build`
// (see serverless/entry.ts); keeping this wrapper committed lets Vercel see the function before the bundle exists.
export { default } from "../build/serverless.mjs";
