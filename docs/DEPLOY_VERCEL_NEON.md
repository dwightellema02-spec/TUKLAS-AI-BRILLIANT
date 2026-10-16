# Putting Tuklas AI online with Neon (database) and Vercel (app)

Phase 48. Everything is done in a browser, except one short command on your own computer (Windows is fine) to prepare the database. **Not yet exercised on a real Vercel account:** the build and the function were tested locally with a stand-in for Vercel (`docs/PHASE_48_VERIFICATION.md` says exactly what was and was not proven). The first real deploy is the real test; send the log if it fails.

## 0. Read this first: how Vercel differs from the Render/Docker setup
| | Vercel | Render/Docker (`docs/DEPLOY_RENDER_NEON.md`) |
|---|---|---|
| Sleeping | No sleeping; each request starts a function (first one after a pause is slower) | Free plan sleeps after 15 minutes |
| Uploaded documents | **Text is kept (database); the original file is not.** Largest upload **4 MB** | Original kept only with a paid disk; 25 MB |
| Request limits | Sign-in lock-outs, the tutor limit, uploads and AI question generation are counted in the database, so they hold across instances. The broad per-minute request ceiling is per instance | Whole app in one process |
| Slow tutor answers | A function may run at most the time set in `vercel.json` (60 s). Hobby plan limits apply | No such limit |
| Plan | Hobby is free but for **non-commercial** use only. Check Vercel's current terms for a school | Free or about $7/month |

If any of these is a problem for your school, use the Render guide instead. The same code runs on both.

## 1. Before you start
* Code on GitHub: the branch you deploy (normally `main`) must contain Phase 48.
* On your computer (only for step 4): **Node.js 22** and **Git** (windows: download the installers from nodejs.org and git-scm.com).
* Have ready: an email and strong password for the first administrator, the school's name, a privacy contact email.

## 2. Neon (the database)
1. neon.tech → sign up → **Create project** (PostgreSQL 16+; a region near the school, e.g. Singapore).
2. Open **Connection details**. You need **two** addresses (the *Connection pooling* switch changes which one is shown):
   * **Direct** (pooling OFF; host like `ep-xxxx.region.aws.neon.tech`): used once, from your computer, to prepare the database (step 4).
   * **Pooled** (pooling ON; host contains `-pooler`): used by the app on Vercel.
3. Both must end with `?sslmode=require`. Keep them private; never paste them in chat or commit them.

## 3. Vercel (the app)
1. vercel.com → sign up with GitHub (Hobby plan).
2. **Add New → Project** → import `TUKLAS-AI-BRILLIANT`. Framework preset: **Other**. Leave the build settings alone (`vercel.json` sets them: `npm run vercel-build`, output `dist`).
3. Open **Environment Variables** and add (see `.env.vercel.example`):
   * `DATABASE_URL`: the **pooled** Neon address
   * `AUTH_SECRET`: 32+ random characters (a password manager can generate one). Never change it later.
   * `APP_URL`: a placeholder for now (e.g. `https://tuklas.vercel.app`); correct it in step 5
   * `TRUST_PROXY` = `true`
   * `AI_PROVIDER` = `local`
   * `SCHOOL_NAME`, `PRIVACY_CONTACT_EMAIL`
   * `GEMINI_API_KEY`: leave out for now
4. **Deploy**. The first build takes a few minutes. If it fails, copy the last 40 lines of the build log.

## 4. Prepare the database (once, from your computer)
Open PowerShell (Windows) and run:
```
git clone https://github.com/dwightellema02-spec/TUKLAS-AI-BRILLIANT.git
cd TUKLAS-AI-BRILLIANT
npm ci --legacy-peer-deps
npx prisma generate
$env:DATABASE_URL = "PASTE-THE-DIRECT-NEON-ADDRESS-HERE"
$env:ADMIN_EMAIL = "you@school.edu"
$env:ADMIN_NAME = "Your Name"
$env:ADMIN_PASSWORD = "a-strong-password-1"
npm run setup:db
```
(macOS/Linux: put `DATABASE_URL=... ADMIN_EMAIL=... npm run setup:db` on one line.) It applies the migrations, loads the course (no student accounts) and creates the first administrator. It refuses Neon's pooled address and explains why. It is safe to run again. Close the window afterwards so the password is not kept.

## 5. Check and first use
1. In Vercel → the project → **Domains**: copy the address. Put it in `APP_URL`, then **Redeploy**.
2. Open `https://YOUR-ADDRESS/api/ready`. Expect `{"ready":true}`.
3. Sign in as the administrator; create the teacher accounts on the Admin page.
4. On a phone: register a test student, open a lesson, ask the tutor.
5. Have the school's data protection officer review `/privacy`.
6. Teacher uploads: the lesson text is kept; the original file is not. Files over 4 MB are refused with a plain message (split the document).

## 6. Keep it healthy
* Free uptime check (e.g. UptimeRobot) on `https://YOUR-ADDRESS/api/ready`. It also keeps Neon from sleeping during school hours.
* Backups: `docs/RUNBOOK.md` section 5, with the Neon direct address.
* Updating: push to `main`; Vercel rebuilds. New migrations are **not** applied by Vercel: run `npm run setup:db` again (direct address) after a release that adds a migration, before or right after the deploy.

## 7. The Gemini tutor (later)
Only after the live evaluation passes: add `GEMINI_API_KEY` in Vercel and set `AI_PROVIDER=gemini`. Tutor calls to an outside model may be slow; the function limit in `vercel.json` is 60 s.
