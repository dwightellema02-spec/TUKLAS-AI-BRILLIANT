# Running Tuklas AI for real students: the runbook

For the person who looks after the server. Everything here is exercised by tests in the repository except where it says **not tested**.

## 1. What you need
* A server (or a hosted service) that can run a container, with **PostgreSQL 16** (the compose file includes one; Neon / RDS also work).
* An **HTTPS address** in front of the app (a reverse proxy such as Caddy or nginx, or your host's). Browsers keep the secure session cookie only over https.
* A place to **copy backups to** that is not the same disk.

## 2. First start
1. `cp .env.production.example .env` and fill it in. Generate `AUTH_SECRET` with `openssl rand -hex 32` (changing it later signs everyone out).
2. `docker compose up -d --build` (**not tested here**: the project's test environment cannot download images; a clean-checkout rehearsal, `scripts/simulate-container.sh`, passes).
3. On every start the container runs `scripts/start-production.sh`: checks the settings (`npm run check:env` explains each problem), applies database **migrations**, loads the Grade 7 curriculum (never accounts), creates the first administrator if `ADMIN_*` are set (never overwrites), then starts the server.
4. Sign in as that administrator, create teacher accounts on the Admin page, then **remove `ADMIN_PASSWORD`** from `.env`.
5. Check: `GET /api/health` is `ok`; `GET /api/ready` is `{"ready":true}`.

## 3. Health
* `/api/health` = the process is alive (does not look at the database beyond "connected or not").
* `/api/ready` = it can do its job: the database answers and every migration finished. 503 = do not send traffic. The reason is in the server log (`NOT READY: ...`).
* The container's own `HEALTHCHECK` uses `/api/ready`.

## 4. Updating to a new version
1. **Back up first** (section 5).
2. `git pull && docker compose up -d --build`. The new container applies any new migration itself before serving.
3. Requests being handled when the old container stops are finished; the server exits cleanly (SIGTERM is honoured; `stop_grace_period` is 20 s).
4. Check `/api/ready`. If a migration fails, the container does not start serving and the log says which one; the database keeps its state from before that migration (a migration runs in one transaction). Roll back by restoring the backup and starting the previous version.

## 5. Backup and restore
* `sh scripts/backup-db.sh` writes `backups/tuklas-<time>.dump`, checks it can be read back, keeps the newest 14 (`BACKUP_KEEP`). The compose file runs it nightly. The files hold **students' names, emails and learning data**: they are private to the owner (700/600); **copy them off the server regularly** and treat the copies like the database.
* Uploaded lesson **documents** are in the `documents` volume (`DOCUMENT_STORAGE_DIR`). Their extracted text is in the database, so losing the volume loses only the originals. Back the volume up too if the originals matter.
* **Restore** into an *empty* database: create it, then `RESTORE_CONFIRM=yes DATABASE_URL=postgresql://.../newdb sh scripts/restore-db.sh backups/tuklas-....dump`, and point the app at it. Without `RESTORE_CONFIRM=yes` the script only checks the file. A restore was tested table by table (42 tables identical).
* **Practise a restore once before you need one.**

## 6. Changing the database schema (developers)
`prisma db push` is no longer used in deployment. After editing `prisma/schema.prisma`: `npx prisma migrate dev --name what_changed`, commit the new folder in `prisma/migrations/`. `npm run test:phase42` fails if the schema and the migrations disagree, and tests that a new migration keeps existing rows. A database created by the old `db push` is adopted automatically on first start **if** it matches the baseline; if it differs, the start stops with the differences listed and changes nothing (back it up, bring it up to date once with `npx prisma db push`, restart).

## 7. Settings you may want to change
| Setting | Meaning |
|---|---|
| `TRUST_PROXY=true` | Required behind a proxy so the app sees real client addresses |
| `API_RATE_LIMIT_USER_PER_MINUTE` (600) | Per signed-in account |
| `API_RATE_LIMIT_PER_MINUTE` (1200) | Anonymous requests, per address (sign-in/registration floods) |
| `API_RATE_LIMIT_SIGNED_IN_IP_PER_MINUTE` (20000) | Signed-in requests, per shared address (a whole school is one address) |
| `AI_PROVIDER` / `GEMINI_API_KEY` | `local` = built-in rule-based tutor; `gemini` = external model (**not tested with a live model**) |
| `DOCUMENT_STORAGE_DIR` | Must be a persistent volume |
| `SCHOOL_NAME`, `PRIVACY_CONTACT_EMAIL` | Named in the privacy notice shown to students (see `docs/PRIVACY.md`) |
| `REQUIRE_PRIVACY_ACCEPTANCE` (on in production) | Accounts must accept the notice before using anything |
| `REQUIRE_GUARDIAN_CONSENT` (off) | The AI tutor stays closed to a student until a teacher records guardian consent |
| `RETENTION_TUTOR_DAYS` (365), `RETENTION_AUDIT_IP_DAYS` (90) | Used by `scripts/retention.ts` (schedule it weekly: `npx tsx scripts/retention.ts --apply`) |

## 8. Capacity (measured, not promised)
One app container and PostgreSQL on a small dev machine: **45 students on one address**, in production mode, each doing a full lesson, a 12-question practice and two tutor questions while a teacher watches: **1,960 requests, none refused, none failed, p95 0.75 s**; a 6× faster burst (3,700 requests/min) also passed. Slowest steps: all 45 registering at the same instant (p95 4 s, password hashing is deliberately slow) and the teacher dashboard during that burst (p95 2.9 s). **Not measured:** several classes at once, a hosted database across a network, a slow school connection.

## 9. When something is wrong
| Symptom | Look at |
|---|---|
| Nobody can sign in | `/api/ready`; the log for `NOT READY`; `AUTH_SECRET` changed? (signs everyone out) |
| Students are told "too many requests" | The log; one account being hammered (limit is per account) or `TRUST_PROXY` not set (everyone looks like the proxy) |
| Teachers' document uploads fail | `DOCUMENT_STORAGE_DIR` writable? (`npm run check:env`) |
| The site shows an old page after an update | Browser cache; hard refresh |
| After a restart the tutor says it uses the rule-based engine | `AI_PROVIDER` / `GEMINI_API_KEY` (`npm run check:env`) |
| Disk full | `backups/` and the `dbdata` volume; reduce `BACKUP_KEEP` or move backups off the server |

## 10. Not covered here
Monitoring and alerting (nothing watches `/api/ready` for you: point your host's uptime check at it); log shipping; student-data privacy tasks (consent, export, deletion) are described in the privacy documentation, not here.
