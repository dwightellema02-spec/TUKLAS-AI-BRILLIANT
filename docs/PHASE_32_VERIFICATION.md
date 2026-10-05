# Phase 32 — Voice tutor (Module 14): verification report

**Status:** implemented and verified with unit/property tests, HTTP tests (in-memory and PostgreSQL), mutation checks and a Chromium test **using a simulated speech engine**. **Nothing here has been tested with a real microphone, a real speech service, or a real phone.** Treat voice as "built and wired, awaiting a real-device trial" (section 6).

## 1. What was built

| Piece | File |
|---|---|
| Spoken-maths → digits/symbols ("negative five plus three" → `-5 + 3`; English, Filipino number words, Taglish mixes, speech-engine homophones such as "to"→2 next to an operator) | `src/lib/voice/spoken-math.ts` |
| Reply → text that sounds right when spoken (LaTeX, Markdown, signs, emoji, links removed or spoken as words; split into short utterances) | `src/lib/voice/speech-text.ts` |
| Capability detection, error codes → plain-language guidance | `src/lib/voice/capabilities.ts` |
| Recognition and synthesis hooks (browser Web Speech API) | `src/lib/voice/use-speech.ts` |
| Microphone, read-aloud, hands-free, language selector, "heard as" line, privacy notice | `src/components/ai/AITutorPanel.tsx` |
| `inputChannel` ("voice"/"text") accepted and validated; spoken text understood by the same evaluator; channel + understood-as stored in message metadata (no schema change) | `server.ts`, `src/lib/ai/tutor.ts`, `src/lib/ai/types.ts` |

Design decisions (assumed from my earlier recommendation; change them if you disagree):
- **Browser built-in speech engine**, no paid/third-party service added by us.
- **Only text leaves the browser and only text is stored.** No audio is recorded, uploaded or kept by Tuklas (verified: no audio/voice/recording table exists). *Caveat:* in Chrome the browser itself may send audio to Google's speech service; the panel's notice says only that Tuklas receives text.
- Voice is an **input/output channel on the same tutor**, not a second tutor: same conversation, same pedagogy, same answer-disclosure rules.
- A transcript is placed in the text box for the student to check and fix; it is only auto-sent in hands-free mode. An **edited** transcript is recorded as typed input.

## 2. Defect found while building this (pre-existing)

`findNumberInText` read "fourteen" as **4** (the pattern matched "four" first), and likewise "sixteen" etc. Typed answers like "negative fourteen" were therefore mis-evaluated since Phase 23. Fixed; regression table covers 11–19 and negatives.

Two further defects found by the new suite and fixed before commit: "a negative times a negative" was rewritten to `a negative * a negative` (ordinary talk altered); unmatched `$` or `\` could reach the speech output.

## 3. Evidence

| Check | Result |
|---|---|
| Phrase table (EN/Taglish/homophones/negatives/abs/opposite/equation/compare) | 53 phrases exact |
| Property: 3,000 random spoken English integer expressions → intended problem | 3000/3000 |
| Property: 2,000 random Taglish expressions | 2000/2000 |
| Every English number phrase 0–9999 and Filipino 0–99 | 10,000/10,000 and 100/100 |
| 5,000 random token soups, 50,000-char transcript, non-string input | no exception |
| Speech-text: markup never leaks; 3,000 random fragments | no `$`/`\` left |
| HTTP: voice+text one conversation; spoken "fourteen" judged correct; original transcript stored; channel recorded per message; 5-turn script behaves identically by voice and typing; "just tell me the answer" by voice discloses nothing; invalid channel/over-long voice/non-text query → 400; other student cannot write into the conversation | pass |
| `scripts/test-phase32-voice.ts` | 135 passed, 0 failed |
| `scripts/test-phase32-prisma.ts` (fresh PostgreSQL DB) | 10 passed, 0 failed (rows hold original transcript, `inputChannel`, `understoodAs`; no audio tables) |
| `scripts/test-phase32-browser.mjs` (Chromium, **simulated** engine): unsupported browser, permission denied, interim + final transcript, edit-then-send, unedited send, read-aloud text clean, barge-in, Escape, close, hands-free relisten, language `fil-PH`, 390 px viewport, no page errors | 28/28 |
| Mutation checks | sign handling, parenthesising negatives, homophone map ("to", "ate"), channel validation, voice length cap, barge-in: each makes a test fail |
| Regression | tsc, vite build, suites 9, 10, 12, 13, 14, 22–31, browser scripts (see commit message / run output) |

## 4. How to run

```
npm run test:phase32          # unit + property + HTTP
npm run test:phase32:pg       # needs DATABASE_URL (PostgreSQL, CREATE DATABASE allowed)
node scripts/test-phase32-browser.mjs
```

## 5. Known limitations

- Speech recognition quality (accents, background noise, Filipino/Taglish pronunciation, children's voices) is entirely the browser engine's; the normalizer can only fix what the engine returns. Homophone repairs are flagged "uncertain" and shown to the student ("heard as…"), but we do not yet prompt a confirmation.
- Support differs by browser: Chrome/Edge (Android, desktop) work in principle; Safari/iOS support is partial; Firefox has none (the mic button is hidden and typing remains). Needs HTTPS in production (localhost is exempt).
- Spoken output uses whatever voices the device has; a Filipino voice may not exist, in which case the device default reads Filipino text with English phonetics.
- Spoken-math coverage: integers, the four operations, absolute value, opposite, one-variable equations, comparisons. Fractions/decimals/exponents spoken aloud are not normalized (decimals like "three point five" are not handled).
- The normalizer is also applied to typed text; this is intended (typing "five plus three" works) but it means a typed sentence containing number words and operator words is rewritten for understanding only; the stored/displayed text is unchanged.
- Filipino wording is unreviewed by a Filipino-speaking teacher.
- Voice usage metrics are not surfaced to teachers or researchers (the channel is stored, nothing reads it yet).

## 6. Needs a real person (👤)

1. Open the student lesson on a **real phone (Android Chrome) and a laptop**, over HTTPS; allow the microphone; speak 10 problems in English and 10 in Taglish; note misheard ones.
2. Try with a noisy room and with a student's actual voice; try iOS Safari and confirm the fallback to typing is clear.
3. Listen to the read-aloud on each device: is the maths pronounced sensibly ("negative 14", "absolute value of…")?
4. Deny the microphone permission and confirm the guidance is understandable to a student.
5. Decide whether the "Chrome sends audio to Google" caveat needs wording for parents/guardians (a privacy/consent decision for the school, not a code question).
6. Barge-in (tap the mic while the tutor talks) and hands-free mode in a classroom-like setting.
