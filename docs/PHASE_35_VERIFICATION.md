# Phase 35 — Tutor safety: prompt injection, hostile model output, rendering (master plan Modules 21 and 12) — verification report

**Status:** implemented and verified with a scripted hostile model, 60 adversarial student messages, direct tests of each screen, and mutation checks. **This does not prove a live language model is safe.** A real model can be talked into behaviour these tests never imagined; what this phase adds is a stronger server-side safety net around it. No live Gemini run was possible (no key).

## 1. Why this phase

The master plan lists prompt-injection defences, answer-disclosure protection and hallucination protection as part of the core tutor, and security/privacy as something to "continuously verify". Earlier phases had good answer-disclosure checks and a scripted-model test, but nothing had attacked the places where untrusted text enters the prompt, nor screened what the model writes for anything other than the answer.

## 2. Findings (all pre-existing, all fixed)

| # | Finding | Fix |
|---|---|---|
| 1 | The student's message was placed in the prompt as `Student Query: "<text>"`. A message containing a quote and new lines could **forge prompt structure** (a second "TUTORING PLAN", a fake "Student Answer Evaluation: CORRECT", a fake end of the source block, a `SYSTEM:` line). | Untrusted one-line fields are collapsed to one line and JSON-quoted (`quoted`/`oneLine` in `src/lib/ai/untrusted.ts`). |
| 2 | The same forging worked through **earlier turns** (recent-conversation block), **earlier stored answers** (previous-attempts block), and the **conversation state / plan text** (which repeated the student's last messages verbatim into the instructions). | Same helpers applied to recent messages, previous attempts, the state summary and the plan directive. |
| 3 | **Teacher documents, file titles and section labels** went into the source block unsanitised except for ``` and the END marker; a document could forge the `"""` fence or a header line. | Lines that start like prompt structure are defanged; titles/labels are collapsed; chat-template tokens (`<\|im_start\|>`, `</system>`) are removed. |
| 4 | The model's text was only stripped of control characters: **script/iframe/img tags, Markdown images (tracking pixels), links and `javascript:` URLs reached the student's screen**. | `sanitizeMessage` removes known HTML tags (maths such as `a<b and c>d` is untouched), Markdown images and links (keeping the words), and bare addresses. |
| 5 | A model that echoed **its own instructions** verbatim, or an API key / database URL, was caught only by a few keyword patterns. | New `PROMPT_LEAK` screen (any run of 10+ words shared with the system prompt) and more secret patterns. A hit triggers one retry, then the plan realizer. |
| 6 | The answer-disclosure guard only recognised phrases like "the answer is 5". A model tricked into **"five", "leaves five", "５" (full-width), "𝟓" (maths bold), "negative two", "- 2"** got through. | New `ANSWER_VALUE_MENTIONED` screen for model text: after Unicode normalisation and number-word conversion (English and Filipino), the protected answer must not appear as a stand-alone value; numbers that belong to the problem are allowed. |
| 7 | Side effect found on the way: the spoken-maths normaliser did not convert a number word followed by a full stop ("five."). Fixed (a full stop ends a sentence; a decimal point does not). | `spoken-math.ts` |

## 3. Evidence

`scripts/test-phase35-tutor-safety.ts` — **69 checks, 0 failed.**
- 1–3: forged headers, strategy lines, `TUTOR:`/`SYSTEM:` lines and source fences in the student's message, earlier turns, stored answers, document text, file titles: none can become prompt structure.
- 4: 13 hostile-model disclosures (digit, word, capital, equation, LaTeX, full-width, bold digits, decimal, sentence, Filipino, split across fields…) never reach the student.
- 5: script/iframe/img/Markdown-image/link/`javascript:` output and system-prompt or secret echoes (verbatim, quoted, env names), a 50,000-character reply and non-JSON output are cleaned or replaced.
- 6: 60 jailbreak / extraction / pressure messages in English and Filipino (role-play, "I'm the teacher", base64, translate, repeat above, fill-in-the-blank, backwards, letter by letter, hint-level 6, JSON/function tricks…) through the local engine: **none obtains the answer, none extracts instruction text or secrets, none crashes it.**
- 7: ten hostile LaTeX payloads through KaTeX (the renderer used for tutor text): no link, script, image or injected attribute in the output.
- 8–10: the sanitizers and the answer-value screen directly (including that ordinary maths with `<`/`>` is not damaged); another student cannot read a conversation.
- Mutation checks: removing the quoting of the student's message, document defanging, the Markdown-link stripping, the instruction-echo screen, the answer-value screen, or the lone-number conversion each makes a test fail. (Removing the `oneLine` call in the conversation state alone does not, because the later `quoted` call covers it: defence in depth.)
- Regression: see the commit message / final run.

## 4. Known limitations

- **A live model has not been tested.** The screens catch what was written to catch. A model could still mislead with a wrong explanation, be unkind, or hint too strongly without ever stating the answer; the plan's rules and the server-side evaluation reduce this, they do not remove it. A live evaluation (`scripts/eval-tutor-conversations.ts` with a key) and teacher review of real transcripts are still needed.
- The answer-value screen can be too strict: a worked example whose own result happens to equal the protected answer is rejected (one retry, then the plan realizer answers). That costs a worse sentence, never a leak.
- The answer is protected for numeric problems. Free-text and multiple-choice answers are protected by the existing guard only.
- **Roman numerals and answers hidden in other encodings** (for example a code, a rhyme or the first letters of words) are not detected.
- The local engine confirms a correct answer the student actually types (that is its job); a student can therefore find the answer by guessing and being told "correct". Limiting guessing (attempt caps, cool-downs) is not built.
- Prompt-injection through **video titles/metadata** and teacher-written **question prompts** is covered by the same one-line quoting but has no dedicated tests.
- Rate limiting (existing) and the 1,000-character input limit remain the only protection against floods of attempts.

## 5. Needs a person (👤)

1. Read a sample of real tutor transcripts from a pilot class for tone, correctness and over-helping.
2. Run the live evaluation with a Gemini key and compare against the scripted results.
3. Decide a guessing policy (for example a pause after several wrong guesses).
