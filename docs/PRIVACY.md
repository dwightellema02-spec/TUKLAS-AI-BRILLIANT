# Student data privacy — for the school (operator guide)

Tuklas AI holds children's learning records. **This is a technical guide, not legal advice.** The school is the "personal information controller" and remains responsible for its own notice, consent forms and any registration or reporting duties under the Data Privacy Act of 2012 (Philippines) or other law that applies. The notice text in `src/config/privacy-notice.ts` is a **template** for your data protection officer to review and complete; it describes what the software actually does.

## What the software does
| Need | How |
|---|---|
| Tell people what is collected and why | `/privacy` (public) and a gate that asks every signed-in person to accept the current notice. Registration requires the tick. Bump `PRIVACY_NOTICE_VERSION` when the meaning changes: everyone is asked again |
| Guardian consent | A teacher (of a class the student is in) or an administrator records it in the class list. With `REQUIRE_GUARDIAN_CONSENT=true` the AI tutor stays closed until it is recorded. The software records that consent exists; it does not collect or verify the guardian's signature — keep the school's own form |
| Access | Account page → "Download my data" (JSON). An administrator can export any account |
| Erasure | Admin page → find the student → Erase (types the email to confirm). Removes the account and everything linked to it (checked against every foreign key in the database). Staff who still teach classes or own assessments are refused (it would delete students' records); the last administrator and your own account cannot be erased |
| Less data kept | `scripts/retention.ts` deletes tutor conversations older than `RETENTION_TUTOR_DAYS` and clears addresses from audit entries older than `RETENTION_AUDIT_IP_DAYS`; it only reports long-disabled accounts |
| Research | Exports use a code (`S-…`, a keyed hash, stable in this installation) instead of name and id. Names are included only when the teacher ticks "Include student names", which is audited |
| External AI | The tutor prompts never contain the student's name, email or account id (tested). What a student *types* is sent as written when `AI_PROVIDER=gemini`; the notice tells them not to write personal details. The notice states honestly whether an external service is used |
| Logs | The audit log and server log carry no names or emails (tested); the erase entry records only the role |

## Limits (honest)
* Backups made before an erasure still contain the erased person until they rotate out (`backup-db.sh` keeps the newest N). Decide how long to keep backups and tell your DPO.
* Erasure in demo (in-memory) mode removes only the profile and class links; use a database for real students.
* Free text a student types in the tutor can contain anything; retention limits how long it stays.
* The tutor's own consent gate depends on teachers recording consent; nothing checks the paper form.
* Not covered: breach notification procedure, data-sharing agreements, the school's registration with the regulator.
