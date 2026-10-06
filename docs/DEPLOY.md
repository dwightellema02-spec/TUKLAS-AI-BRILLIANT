# Running Tuklas AI so you can open it on a phone

The app is one Node server (API + web app). A phone can only reach it if it runs somewhere with a public address, or on your own computer on the same Wi-Fi.

## Option A: your computer, same Wi-Fi (fastest, demo data)

```bash
git clone <repo> && cd TUKLAS-AI-BRILLIANT && git checkout ccr-d5d3f1ee-004qqa
npm install --legacy-peer-deps
AI_PROVIDER=local npm run dev          # listens on 0.0.0.0:3000
```
Find the computer's address (`ipconfig` on Windows, `ifconfig`/`ip a` on Mac/Linux, e.g. `192.168.1.20`) and open `http://192.168.1.20:3000` on the phone. Use development mode here (not `npm start`): production mode sets secure cookies that a plain `http://` address will not keep. Demo accounts: `student@tuklas.ai`, `teacher@tuklas.ai`, `admin@tuklas.ai`, password `Tuklas2026!`. Data resets when you stop the server. If the phone cannot connect, the computer's firewall is blocking port 3000.

## Option B: a public test site (Render + free Neon database)

Needs a GitHub account (already linked to this repo), a Render account and a Neon account. About 10 minutes.

1. **Database:** create a free project at neon.tech and copy its connection string (starts with `postgresql://`).
2. **Web service:** on render.com choose *New > Blueprint*, pick this repository and branch. `render.yaml` and the `Dockerfile` do the rest. When asked, paste `DATABASE_URL`.
3. **First administrator:** in the Render service's *Environment* tab add `ADMIN_EMAIL`, `ADMIN_NAME` and `ADMIN_PASSWORD` (8+ characters with a letter and a digit), then redeploy. The container creates that account on startup (it never overwrites an existing one). Remove `ADMIN_PASSWORD` afterwards.
4. Open the `https://...onrender.com` address on your phone and sign in as that administrator. Create a teacher on the Admin page, then register a student account from the sign-in screen.

On startup the container checks its settings, applies the database **migrations** (no longer `prisma db push`), loads the Grade 7 curriculum (no accounts), and starts the server. No demo accounts exist in this setup: the demo password is public, so the server refuses to start in production without a PostgreSQL database.

Notes: the free Render plan sleeps when idle (the first load takes about a minute) and has no persistent disk, so **uploaded lesson documents are lost on redeploy**; database content is kept in Neon. The tutor uses the built-in rule-based engine; to try the real model set `AI_PROVIDER=gemini` and `GEMINI_API_KEY`.

## Option C: a throwaway public demo with demo data (not for real students)

Same as B but without a database: set `ALLOW_DEMO_MODE=I_UNDERSTAND_DEMO_ACCOUNTS_ARE_PUBLIC`. Anyone with the link can sign in with the public demo password, and everything resets on restart. Only for a short look.

## Real students: use the runbook
`docs/RUNBOOK.md` covers a school server with `docker-compose.yml` (app + PostgreSQL + nightly backup), updates, backup and restore, settings and what was measured. Render's free plan is fine for a look, not for a class: it sleeps when idle and has no persistent disk.

## Checks you can run yourself

`GET /api/health` should return `{"status":"ok"}` and `GET /api/ready` `{"ready":true}`. `npm run check:env` lists problems with your settings. Sign in as the administrator; the demo accounts must be rejected (401).
