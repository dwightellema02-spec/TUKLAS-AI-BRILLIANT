# Thesis defense: demo checklist (Render free + Neon free)

The app sleeps after 15 minutes without visitors (Render free) and its database after 5 minutes (Neon free). Activity keeps both awake. This list makes sure neither surprises you. Never write passwords or database addresses on this page.

## One week before
- [ ] Deployed with `docs/DEPLOY_RENDER_NEON.md`; `https://YOUR-ADDRESS/api/ready` shows `{"ready":true}`.
- [ ] Admin password removed from Render's environment (guide, step 4.3). Privacy contact and school name set.
- [ ] Made your own database backup (`docs/RUNBOOK.md` section 5).
- [ ] Practiced the whole demo twice, once on a phone.
- [ ] Decided the fallback: laptop copy (commands below) and a screen recording.

## The day before
- [ ] Create the demo accounts now, not live: 1 teacher, 1 class, 3 students (note them on paper, not in chat). Sign in to each once.
- [ ] Teacher: have one lesson ready to open (for example Week 5, Day 1) and one practice set.
- [ ] Student: finish one lesson and one practice set so the progress and analytics screens show data.
- [ ] Charge laptop and phone. Install the laptop fallback: Node 22, Git, `git clone`, `git checkout` the branch you deploy, `npm ci --legacy-peer-deps`.
- [ ] Save screenshots or a 2-minute screen recording of the full flow.

## Defense day
- [ ] **30 min before:** open `/api/ready` (it may take up to a minute). Expect `{"ready":true}`.
- [ ] **20 min before:** sign in as teacher, open the class page, sign in as a student on the phone. This wakes the database too.
- [ ] **15 min before:** turn ON a free uptime monitor (for example UptimeRobot) checking `/api/ready` every 5 minutes. This keeps it awake through breaks and Q&A.
- [ ] Check the venue Wi-Fi; have a phone hotspot ready.
- [ ] Keep one browser tab per role (teacher, student, admin) already signed in.
- [ ] If a click is slow, say "it is waking up" and wait; the page retries by itself and nothing is lost. If `/api/ready` says `false` for more than a minute, switch to the laptop copy or the recording.

## After
- [ ] Turn OFF the uptime monitor (it would use up Neon's free compute hours).
- [ ] Optional: switch Render back from Starter ($7) to free if you upgraded for the day.

## What to say honestly
- Automated tests and browser checks passed; the app has **not** been used by real students or teachers.
- This is a pilot demonstration on free hosting that sleeps when idle.
- The built-in tutor (`AI_PROVIDER=local`) is rule-based; the Gemini tutor has not been evaluated live.
- Lessons follow the Budget of Work and Lesson Exemplars for Term 1, Weeks 1-6 only; a teacher has not yet reviewed them.
