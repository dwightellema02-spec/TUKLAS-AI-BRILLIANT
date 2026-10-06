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

## Defects found while building it
* The admin page listed only staff, so an administrator **could not find a student to erase** — added a search.
* Adoption of a db-push database would have re-run the privacy migration (fixed: all migrations are marked applied only if the schema matches).

## Not done / limits
* The notice is a template; **no lawyer or DPO has reviewed it.** Guardian consent is a recorded flag, not verified.
* Backups keep erased data until they rotate; no breach-notification process; demo mode erasure is partial.
* Nothing here has been tested with a real school, real guardians or a live Gemini key.
