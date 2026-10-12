# Putting Tuklas AI online with Neon (database) and Render (app)

Everything is done in a web browser, on a laptop or a phone. No Linux, no Docker on your own machine. **Not yet exercised end to end:** the Docker image has never been built outside the project's test environment, so the first Render build is the real test; send the log if it fails.

## 1. Before you start
* Code on GitHub: the branch you deploy (normally `main`) must contain the latest work.
* Decide the plan. **Free** costs nothing but sleeps when idle (the first visit after a pause is slow) and deletes uploaded lesson documents on every restart (lesson text is safe in the database). **Paid with a disk** keeps documents and does not sleep (see the end of `render.yaml`).
* Have ready: an email and password for the first administrator, the school's name and a privacy contact email.

## 2. Neon (the database)
1. neon.tech → sign up → **Create project** (PostgreSQL 16 or newer; pick a region near the school, e.g. Singapore).
2. Open **Connection details**. Turn **Connection pooling OFF** (use the *direct* connection: the app applies migrations on every start).
3. Copy the connection string. It looks like `postgresql://USER:PASSWORD@ep-xxxx.region.aws.neon.tech/neondb?sslmode=require`. Keep it private. It must end with `?sslmode=require`.

## 3. Render (the app)
1. render.com → sign up with GitHub → allow access to the `TUKLAS-AI-BRILLIANT` repository.
2. **New → Blueprint** → choose the repository and branch → Render reads `render.yaml`.
3. Fill the values it asks for (the ones marked "sync: false"):
   * `DATABASE_URL`: the Neon string from step 2.3.
   * `APP_URL`: the address Render will give the service (shown on the service page, e.g. `https://tuklas-ai.onrender.com`). If you do not know it yet, put a placeholder, deploy, then correct it and redeploy.
   * `ADMIN_EMAIL`, `ADMIN_NAME`, `ADMIN_PASSWORD`: the first administrator (a strong password).
   * `SCHOOL_NAME`, `PRIVACY_CONTACT_EMAIL`: shown to students in the privacy notice.
   * `GEMINI_API_KEY`: leave empty for now. `AI_PROVIDER` stays `local`.
   * `AUTH_SECRET` is generated for you. Do not change it later (everyone would be signed out).
4. **Apply**. The first build takes several minutes. If it fails, copy the last 40 lines of the log.
5. When it says live: open `https://YOUR-ADDRESS/api/ready`. Expect `{"ready":true}`.

## 4. First use
1. Open the site, sign in as the administrator.
2. Admin page → create the teacher accounts.
3. In Render → the service → **Environment** → delete `ADMIN_PASSWORD` → save (Render redeploys).
4. Open `/privacy` as a student would; have the school's data protection officer review it.
5. On a phone: open the address, create a test student, try a lesson and the tutor.

## 5. Keep it healthy
* **Watching:** a free uptime service (e.g. UptimeRobot) pointed at `https://YOUR-ADDRESS/api/ready`, alert by email after 2-3 failures. On the free plan it will also keep the app awake while it is being checked.
* **Backups:** Neon keeps history; also take your own copies as in `docs/RUNBOOK.md` section 5 (run `scripts/backup-db.sh` from any computer that has PostgreSQL tools, with the Neon string as `DATABASE_URL`).
* **Updating:** push to the deployed branch; Render rebuilds, the app applies new migrations on start. Take a backup first.

## 6. Before every class (free plan checklist)
1. **10 minutes before:** open `https://YOUR-ADDRESS/api/ready`. The first visit after a pause can take up to a minute while Render wakes the app (nothing to do but wait). You should then see `{"ready":true}`.
2. Open the site, sign in as the teacher and open the class page once. This also wakes the Neon database (a few seconds).
3. If students see "The server is waking up or reconnecting", tell them to wait: the page retries by itself and their work is not lost. If it lasts more than a minute, check `/api/ready`; if it says `false`, see `docs/RUNBOOK.md` section 9.
4. After class nothing needs doing. The app sleeps by itself after 15 minutes without visitors and the database after 5 minutes.
5. An uptime service pointed at `/api/ready` every 5 minutes keeps both awake during school hours (and tells you if something breaks).

## 7. The Gemini tutor (later)
Only after the live evaluation passes: in Render → Environment add `GEMINI_API_KEY` and change `AI_PROVIDER` to `gemini`.
