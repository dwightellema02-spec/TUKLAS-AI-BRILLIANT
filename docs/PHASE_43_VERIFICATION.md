# Phase 43 — Student data privacy (Module 21)

**Objective:** a school can put children's data in this system and answer: what do you hold, why, who sees it, can I see mine, can you delete it, does it go to an outside AI?

## What was built
* Privacy notice (public `/privacy`, template for the school's DPO), acceptance at registration and a gate for existing accounts (`REQUIRE_PRIVACY_ACCEPTANCE`, on in production); enforced on the server, not only in the page.
* Guardian consent recorded by the class teacher/admin; optional tutor gate (`REQUIRE_GUARDIAN_CONSENT`). The class roster shows it.
* Personal-data export (own and admin) and erasure (admin, with safeguards), an admin student search so students can actually be found, retention script, de-identified research exports (identified only on request and audited), contact check in `check:env`.
* Migration `privacy_consent` (four nullable columns on User); `db-migrate.ts` adoption updated.

## Verification
| Check | Result |
|---|---|
| `test-phase43-privacy.ts` (HTTP, in-memory) | 47 passed |
| same suite on PostgreSQL, inside `test-phase43-prisma.ts` | 49 passed (adds: a teacher who still teaches cannot be erased) |
| `test-phase43-prisma.ts` | 22 passed: built from the real migrations; erasure leaves **0 rows in all 19 user-pointing columns** (read from the database's own foreign keys), other student untouched; export has the tutor conversation; retention dry run changes nothing, `--apply` deletes only old data, safe to re-run |
| `test-phase43-prompts.ts` | 6 passed: captured prompts (incl. the retry prompt) contain no name, email or account id. **Mutation check:** putting the name into the prompt makes it fail |
| `test-phase43-browser.mjs` | 17 checks: registration box, gate, class consent checkbox, "Download my data", admin find/export/erase (wrong confirmation does not erase), `/privacy` |

## Full regression (all phases)
`tsc` and `build` clean. Every in-memory and PostgreSQL suite passes after two kinds of fixes:
* **Tests that encoded the old behaviour, updated deliberately:** Phase 29 research CSV checks now ask for `?identified=true` (and a new check proves the default export carries a code, not the name); Phase 31 allows the new public `GET /api/privacy-notice`; Phase 30's production test now accepts the privacy notice first (production asks a new administrator to).
* **Environment, not code:** older PostgreSQL suites share one dev database whose schema lacked the new columns (`prisma db push` fixed it); a real deployment gets them from the migration.
Browser journeys (Phases 34, 39 and the new 43) pass; Phase 38's browser check runs through its `:pg` wrapper (passes). The 22–30/32/33 browser scripts that need a server on :3000 were not re-run for this phase.

## Defects found while building it
* The admin page listed only staff, so an administrator **could not find a student to erase** — added a search.
* Adoption of a db-push database would have re-run the privacy migration (fixed: all migrations are marked applied only if the schema matches).

## Not done / limits
* The notice is a template; **no lawyer or DPO has reviewed it.** Guardian consent is a recorded flag, not verified.
* Backups keep erased data until they rotate; no breach-notification process; demo mode erasure is partial.
* Nothing here has been tested with a real school, real guardians or a live Gemini key.
