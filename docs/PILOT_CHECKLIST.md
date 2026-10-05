# Tuklas AI — classroom pilot checklist

Use this before and during a first small pilot (one class, 2–4 weeks). Boxes marked 👤 need a person; nothing here can be verified by the software or by me.

## A. Decisions (before anything starts)
- [ ] 👤 **Who is responsible** for the installation (admin, backups, accounts) and who do teachers contact?
- [ ] 👤 **Permission and privacy.** Check what your school/division requires before students use an online tool. A short notice to parents/guardians should say, in plain words: students' names, class, answers, scores and tutor messages are stored; the AI tutor only sees what students type or say; **no audio is recorded or stored by Tuklas**; with voice input, the *browser* (for example Chrome) may send the audio to its own speech service (for example Google) to turn it into text. (Draft wording is a starting point only; the school should review it.)
- [ ] 👤 **Research use.** If you will use results for a study, get the approvals your institution requires **before** collecting data, and decide who may see the exports.
- [ ] 👤 **Pre/post design.** Decide the two tests (same or parallel items), when each is taken, and that pre-test answers are not discussed with students beforehand.

## B. Setup (administrator)
- [ ] Deployed with a production database (see `docs/DEPLOY.md`); `AUTH_SECRET` set; HTTPS on; **no demo accounts** (demo mode is refused in production).
- [ ] First admin created; admin signs in and creates each teacher account.
- [ ] Teachers sign in, change their temporary password.
- [ ] 👤 **Real-device trial** before students: one phone (Android Chrome) and one laptop — register, join a class, take a short test, use the tutor by typing and (if supported) by voice, finish a practice set.
- [ ] A backup of the database exists and 👤 someone has tried restoring it.

## C. In the first week
- [ ] Class created, code shared, **all students joined** (class page shows the roster).
- [ ] Pre-test assigned; **everyone** completed it (Assessments → Results shows "Not started" students).
- [ ] 👤 Watch the first lesson in the room: where do students get stuck on the screen, not in the maths?
- [ ] Note anything the tutor says that is wrong, confusing, or too leading. (The tutor is checked by automated tests against a scripted conversation set; it has **not** been evaluated with real students, nor with the live Gemini model.)

## D. After the post-test
- [ ] Compare pre/post for the class. Small groups give noisy numbers; treat as observation.
- [ ] 👤 Ask students and the teacher what to change (screens, wording, Filipino/Taglish phrasing, voice).
- [ ] Archive the tests; decide what data to keep or delete and for how long.

## What is known to be incomplete
Real classroom use has not happened yet. Not built or not verified: live Gemini responses; Docker image build (never completed in the build environment); video transcripts; image/OCR input; spoken fractions and decimals; per-teacher AI settings; teacher-controlled release of test results; extra time for individual students. See each `docs/PHASE_*_VERIFICATION.md` for details.
