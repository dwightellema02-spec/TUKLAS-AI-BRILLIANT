/**
 * Tuklas AI - Phase 24: Filipino/Taglish understanding and judging beyond two-number arithmetic.
 *
 * Run:  AI_PROVIDER=local npx tsx scripts/test-phase24-taglish-kinds.ts
 *
 * LIMITS: the Filipino utterances below were written by the developer, NOT by native-speaking students or
 * teachers. Passing here shows the matcher handles these phrasings; it does not show coverage of how real
 * students write. Collect real messages and extend the table (docs/PHASE_24_VERIFICATION.md).
 */
import crypto from "crypto";

process.env.AI_PROVIDER = "local";
process.env.AUTH_SECRET = crypto.randomBytes(32).toString("hex");

let passed = 0, failed = 0;
const failures: string[] = [];
const assert = (c: boolean, m: string) => {
  if (c) { passed++; if (process.env.VERBOSE) console.log(`  ✅ ${m}`); }
  else { failed++; failures.push(m); console.error(`  ❌ FAILED: ${m}`); }
};
const section = (t: string) => console.log(`\n--- ${t} ---`);

function mulberry(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

async function main() {
  const { classifyStudentMessage } = await import("../src/lib/ai/conversation/signals");
  const { evaluateAttempt } = await import("../src/lib/ai/conversation/evaluate");
  const prob = await import("../src/lib/ai/conversation/problems");
  const stateMod = await import("../src/lib/ai/conversation/state");
  const { checkTutorOutput, disclosesAnswer, similarity } = await import("../src/lib/ai/conversation/guards");
  const { realizePlan } = await import("../src/lib/ai/conversation/realizer");
  const ar = await import("../src/lib/ai/conversation/arith");
  const { AITutorService } = await import("../src/lib/ai/tutor");
  const { dbService } = await import("../src/lib/db");
  type PP = ReturnType<typeof prob.makeProblem>;

  // ------------------------------------------------------------------
  section("1. Filipino/Taglish intent understanding (developer-written phrasings)");
  {
    const cases: Array<[string, string]> = [
      ["ano po ang sagot", "REQUEST_ANSWER"],
      ["pasagot po", "REQUEST_ANSWER"],
      ["sabihin mo na ang sagot", "REQUEST_ANSWER"],
      ["sagot po", "REQUEST_ANSWER"],
      ["hindi ko po maintindihan", "CONFUSED"],
      ["di ko gets", "CONFUSED"],
      ["hindi ko pa rin gets", "CONFUSED"],
      ["naguguluhan ako", "CONFUSED"],
      ["nalilito po ako", "CONFUSED"],
      ["ang labo naman", "CONFUSED"],
      ["hindi ko alam", "DONT_KNOW"],
      ["ewan ko po", "DONT_KNOW"],
      ["wala akong idea", "DONT_KNOW"],
      ["ang hirap naman", "FRUSTRATED"],
      ["ayoko na", "FRUSTRATED"],
      ["suko na ako", "FRUSTRATED"],
      ["nakakainis", "FRUSTRATED"],
      ["sobrang hirap po", "FRUSTRATED"],
      ["halimbawa po", "REQUEST_EXAMPLE"],
      ["pa-example naman", "REQUEST_EXAMPLE"],
      ["mas madali po", "REQUEST_EASIER"],
      ["pasimple naman", "REQUEST_EASIER"],
      ["ang dali naman", "REQUEST_HARDER"],
      ["mas mahirap po", "REQUEST_HARDER"],
      ["balik-aral po", "REQUEST_REVIEW"],
      ["hint po", "REQUEST_HINT"],
      ["tulong po", "REQUEST_HINT"],
      ["bakit po kailangan i-subtract", "REQUEST_EXPLANATION"],
      ["ipaliwanag mo po", "REQUEST_EXPLANATION"],
      ["ano po ang absolute value", "REQUEST_EXPLANATION"],
      ["kumusta po", "GREETING"],
      ["magandang umaga po", "GREETING"],
      ["sige po", "ACKNOWLEDGE"],
      ["salamat po", "ACKNOWLEDGE"],
      ["opo", "ACKNOWLEDGE"],
      ["kasi mas malaki yung 13", "REASONING"],
      ["dahil positibo siya", "REASONING"],
      ["lima po", "ANSWER_ATTEMPT"],
      ["negative lima", "ANSWER_ATTEMPT"],
      ["ang sagot ko ay -5", "ANSWER_ATTEMPT"],
      ["siguro 12", "ANSWER_ATTEMPT"],
      ["tama ba ang 7", "ANSWER_ATTEMPT"],
      ["ano po ang (-3) + 5", "STUDENT_PROBLEM"],
      ["paano po i-solve ang x + 5 = 12", "STUDENT_PROBLEM"],
    ];
    for (const [text, expected] of cases) {
      const s = classifyStudentMessage(text, { hasQuestion: true });
      assert(s.intent === expected, `"${text}" -> ${expected} (got ${s.intent})`);
    }
    assert(classifyStudentMessage("hindi ko po maintindihan", { hasQuestion: true }).language === "TL", "Filipino message flagged TL");
    assert(classifyStudentMessage("I don't understand", { hasQuestion: true }).language === "EN", "English message stays EN");
    assert(classifyStudentMessage("lima po", { hasQuestion: true }).attempt?.number === 5, "'lima po' parsed as 5");
    assert(classifyStudentMessage("negative lima", { hasQuestion: true }).attempt?.number === -5, "'negative lima' parsed as -5");
    assert(classifyStudentMessage("siguro 12", { hasQuestion: true }).hedged, "'siguro' marks a hedged answer");
    assert(ar.parseSpokenNumber("negatibo tatlo") === -3 && ar.parseSpokenNumber("sampu") === 10 && ar.parseSpokenNumber("minus siyam") === -9 && ar.parseSpokenNumber("minus 5") === -5, "Filipino number words parsed");
    assert(ar.parseSpokenNumber("labing-apat") === 14 && ar.parseSpokenNumber("labinlima") === 15 && ar.parseSpokenNumber("labing-isa") === 11 && ar.parseSpokenNumber("labimpito") === 17 && ar.parseSpokenNumber("dalawampu") === 20 && ar.parseSpokenNumber("negatibo labing-anim") === -16, "Filipino teens and round tens parsed");
    assert(classifyStudentMessage("labing-apat po", { hasQuestion: true }).attempt?.number === 14, "'labing-apat po' is the answer 14");
    assert(classifyStudentMessage("negative labindalawa", { hasQuestion: true }).attempt?.number === -12, "'negative labindalawa' is -12");
    assert(ar.parseTruth("tama po") === true && ar.parseTruth("mali") === false && ar.parseTruth("true ba") === true && ar.parseTruth("hmm") === undefined, "True/false words in English and Filipino");
    const tf = classifyStudentMessage("mali po", { hasQuestion: true, expectTruth: true });
    assert(tf.intent === "ANSWER_ATTEMPT" && tf.attempt?.truth === false, "'mali po' is a FALSE answer when a true/false answer is expected");
    assert(classifyStudentMessage("mali po", { hasQuestion: true }).intent !== "ANSWER_ATTEMPT", "...but not an answer when none is expected");
    // English intents must not regress or be hijacked by Filipino markers ("ko", "po", "ba"...)
    for (const [t, e] of [["I don't understand", "CONFUSED"], ["what is the answer", "REQUEST_ANSWER"], ["5", "ANSWER_ATTEMPT"], ["give me a hint", "REQUEST_HINT"], ["ok", "ACKNOWLEDGE"]] as const) {
      assert(classifyStudentMessage(t, { hasQuestion: true }).intent === e, `English "${t}" unchanged -> ${e}`);
    }
    // Words that only look Filipino inside English messages should not break classification
    assert(classifyStudentMessage("The answer to the problem ba", { hasQuestion: true }).intent !== "OFF_TOPIC", "Mixed text is not treated as off-topic");
  }

  // ------------------------------------------------------------------
  section("2. Parsing further problem kinds");
  {
    const abs = ar.parseAnyProblem("Find the absolute value of $-14$:\n\n$$|-14| = ?$$");
    assert(abs?.kind === "ABS" && abs.expected === 14 && abs.a === -14, "|-14| -> ABS, 14");
    assert(ar.parseAnyProblem("what is the absolute value of 9")?.expected === 9, "'absolute value of 9' -> 9");
    assert(ar.parseAnyProblem("ano ang absolute value ng -6")?.expected === 6, "Filipino 'absolute value ng -6' -> 6");
    const opp = ar.parseAnyProblem("What is the opposite (additive inverse) of $-8$?");
    assert(opp?.kind === "OPPOSITE" && opp.expected === 8, "opposite of -8 -> 8");
    assert(ar.parseAnyProblem("additive inverse of 5")?.expected === -5, "additive inverse of 5 -> -5");
    assert(ar.parseAnyProblem("opposite of 0")?.expected === 0, "opposite of 0 -> 0 (no negative zero)");
    const eq = ar.parseAnyProblem("Solve the linear equation for $x$:\n\n$$x + 5 = 12$$");
    assert(eq?.kind === "EQUATION" && eq.op === "x+" && eq.expected === 7, "x + 5 = 12 -> x = 7");
    const eq2 = ar.parseAnyProblem("Solve for $y$ using the additive inverse property:\n\n$$y - (-4) = 11$$");
    assert(eq2?.kind === "EQUATION" && eq2.op === "x-" && eq2.a === -4 && eq2.expected === 7 && eq2.variable === "y", "y - (-4) = 11 -> y = 7");
    assert(ar.parseAnyProblem("x - 3 = -8")?.expected === -5, "x - 3 = -8 -> x = -5");
    const cmp = ar.parseAnyProblem("True or False: On a standard horizontal number line, $-5$ is greater than $-2$.");
    assert(cmp?.kind === "COMPARE" && cmp.op === ">" && cmp.expected === 0, "'-5 is greater than -2' -> statement is FALSE");
    assert(ar.parseAnyProblem("-3 < 4")?.expected === 1, "-3 < 4 -> true");
    const which = ar.parseAnyProblem("which is greater: -5 or -2");
    assert(which?.op === "max" && which.expected === -2, "'which is greater: -5 or -2' -> -2");
    assert(ar.parseAnyProblem("which is less: 3 or -4")?.expected === -4, "'which is less: 3 or -4' -> -4");
    assert(ar.parseAnyProblem("(-8) + 13")?.kind === "BINARY", "plain arithmetic still BINARY");
    assert(ar.parseAnyProblem("x + 5 = 12")?.kind === "EQUATION", "equation is not mistaken for arithmetic");
    assert(ar.parseAnyProblem("hello there") === undefined && ar.parseAnyProblem("Arrange the integers: 3, -5, 0, -2") === undefined, "Non-problems and ordering lists are not parsed (no guessing)");
  }

  // ------------------------------------------------------------------
  section("3. Judging and diagnosing each kind (random property tests)");
  {
    const rand = mulberry(31);
    const ri = (lo: number, hi: number) => lo + Math.floor(rand() * (hi - lo + 1));
    const sg = () => (rand() < 0.5 ? -1 : 1);
    const att = (n: number | string) => classifyStudentMessage(String(n), { hasQuestion: true });
    let absOk = 0, absTot = 0, oppOk = 0, oppTot = 0, eqOk = 0, eqTot = 0, cmpOk = 0, cmpTot = 0, corr = 0, total = 0, far = 0;
    for (let i = 0; i < 400; i++) {
      const a = sg() * ri(2, 40);
      const ap = prob.makeProblem(a, "abs");
      const op = prob.makeProblem(a, "opp");
      const c = ri(2, 15), b = ri(-30, 30);
      const eqp = prob.makeProblem(sg() * c, rand() < 0.5 ? "x+" : "x-", b);
      const x = sg() * ri(2, 20), y = sg() * ri(2, 20);
      const cp = x === y ? undefined : prob.makeProblem(x, rand() < 0.5 ? "max" : "min", y);
      for (const p of [ap, op, eqp, ...(cp ? [cp] : [])]) {
        total++;
        if (evaluateAttempt(att(p.expected), p).kind === "CORRECT") corr++;
        if (evaluateAttempt(att(p.expected + 101), p).kind === "INCORRECT") far++;
      }
      if (a < 0) { absTot++; const e = evaluateAttempt(att(a), ap); if (e.diagnosis === "ABS_KEPT_SIGN") absOk++; }
      if (a !== 0) { oppTot++; const e = evaluateAttempt(att(a), op); if (e.diagnosis === "OPPOSITE_SAME_NUMBER") oppOk++; }
      { eqTot++; const wrong = eqp.op === "x+" ? eqp.b + eqp.a : eqp.b - eqp.a; if (wrong !== eqp.expected) { const e = evaluateAttempt(att(wrong), eqp); if (e.diagnosis === "EQ_WRONG_INVERSE") eqOk++; } else eqOk++; }
      if (cp && cp.op === "max" && x < 0 && y < 0 && Math.abs(x) !== Math.abs(y)) { cmpTot++; const wrongPick = Math.abs(x) > Math.abs(y) ? x : y; if (wrongPick !== cp.expected) { if (evaluateAttempt(att(wrongPick), cp).diagnosis === "COMPARED_MAGNITUDE") cmpOk++; } else cmpOk++; }
    }
    assert(corr === total, `Correct answers judged CORRECT across ABS/OPPOSITE/EQUATION/COMPARE (${corr}/${total})`);
    assert(far === total, `Far-off answers INCORRECT (${far}/${total})`);
    assert(absOk === absTot, `|-n| answered -n -> ABS_KEPT_SIGN (${absOk}/${absTot})`);
    assert(oppOk === oppTot, `opposite answered with the number itself -> OPPOSITE_SAME_NUMBER (${oppOk}/${oppTot})`);
    assert(eqOk === eqTot, `x±a=b answered with the same operation -> EQ_WRONG_INVERSE (${eqOk}/${eqTot})`);
    assert(cmpOk === cmpTot, `Choosing the larger SIZE among negatives as 'greater' -> COMPARED_MAGNITUDE (${cmpOk}/${cmpTot})`);

    const stmt = ar.parseAnyProblem("-5 > -2")!; // false
    const tfAtt = (t: string) => classifyStudentMessage(t, { hasQuestion: true, expectTruth: true });
    assert(evaluateAttempt(tfAtt("mali"), stmt).kind === "CORRECT", "Statement -5 > -2: 'mali' is CORRECT");
    const wrongTF = evaluateAttempt(tfAtt("true"), stmt);
    assert(wrongTF.kind === "INCORRECT" && wrongTF.diagnosis === "COMPARED_MAGNITUDE", "...'true' is INCORRECT with the negative-comparison diagnosis");
    const rec = evaluateAttempt(tfAtt("tama"), undefined, { type: "TRUE_FALSE", expectedAnswer: "true" });
    assert(rec.kind === "CORRECT", "TRUE_FALSE record: 'tama' vs true -> CORRECT");
    assert(evaluateAttempt(tfAtt("false"), undefined, { type: "TRUE_FALSE", expectedAnswer: "true" }).kind === "INCORRECT", "TRUE_FALSE record: false vs true -> INCORRECT");
    assert(evaluateAttempt(tfAtt("true"), undefined, undefined).kind === "NONE", "True/false with nothing to check against -> NONE (no claim)");
  }

  // ------------------------------------------------------------------
  section("4. Generation invariants for every kind (400 originals x 3 levels)");
  {
    const rand = mulberry(77);
    const ri = (lo: number, hi: number) => lo + Math.floor(rand() * (hi - lo + 1));
    const sg = () => (rand() < 0.5 ? -1 : 1);
    let n = 0, differ = 0, sameKind = 0, nonzero = 0, steps = 0, harder = 0, simpler = 0, signOk = 0;
    for (let i = 0; i < 400; i++) {
      const originals: PP[] = [
        prob.makeProblem(sg() * ri(2, 30), "abs"),
        prob.makeProblem(sg() * ri(2, 30), "opp"),
        prob.makeProblem(sg() * ri(2, 12), rand() < 0.5 ? "x+" : "x-", ri(-20, 20)),
        prob.makeProblem(-ri(2, 20), "max", -ri(21, 40)),
      ];
      for (const orig of originals) {
        for (const kind of ["TRANSFER", "SIMPLER", "HARDER"] as const) {
          n++;
          const g = prob.generateRelatedProblem(orig, kind, i * 7 + 3);
          if (prob.problemKey(g) !== prob.problemKey(orig)) differ++;
          if (prob.kindOf(g) === prob.kindOf(orig)) sameKind++;
          if (g.expected !== 0) nonzero++;
          if (Math.sign(g.a) === Math.sign(orig.a)) signOk++;
          const st = prob.workedSteps(g);
          const last = st[st.length - 1];
          const want = prob.kindOf(g) === "COMPARE" ? String(g.expected < 0 ? `-${Math.abs(g.expected)}` : g.expected) : (g.expected < 0 ? `-${Math.abs(g.expected)}` : String(g.expected));
          if (last.includes(`= ${want}`) || last.includes(`= ${want}.`)) steps++;
          if (kind === "HARDER" && (Math.abs(g.a) >= 6 || Math.abs(g.b) >= 6)) harder++;
          if (kind === "SIMPLER" && Math.abs(g.a) <= 9 + (prob.kindOf(g) === "EQUATION" ? 0 : 0) && Math.abs(g.expected) <= 20) simpler++;
        }
      }
    }
    assert(differ === n, `Always a different problem (${differ}/${n})`);
    assert(sameKind === n, "Same problem kind (exercises the same idea)");
    assert(nonzero === n, "Never a zero answer");
    assert(signOk === n, "Sign pattern of the first number preserved");
    assert(steps === n, `Worked-example last step states the true result (${steps}/${n})`);
    assert(harder === n / 3, "HARDER levels use bigger numbers");
    assert(simpler === n / 3, "SIMPLER levels use small numbers");
    const cmpT = prob.generateRelatedProblem(prob.makeProblem(-5, ">", -2), "TRANSFER", 1);
    assert(cmpT.op === "max", "A true/false comparison transfers to 'which is greater' (a number answer, not a 50% guess)");
    const ids = new Set<string>();
    for (let i = 0; i < 20; i++) ids.add(prob.problemKey(prob.generateRelatedProblem(prob.makeProblem(4, "x+", 11), "TRANSFER", i)));
    assert(ids.size > 5, "Equation transfers vary across seeds");
  }

  // ------------------------------------------------------------------
  // Conversation harness (uses real AITutorService.planTurn + realizer + state)
  const questionFor = (p: PP) =>
    p.op === ">" || p.op === "<"
      ? { id: "q", type: "TRUE_FALSE", prompt: `True or False: ${p.display.replace(/[()]/g, "")}`, difficulty: "EASY", expectedAnswer: p.expected === 1 ? "true" : "false" }
      : { id: "q", type: "NUMERIC_INPUT", prompt: `Evaluate: ${p.display}`, difficulty: "EASY", expectedAnswer: String(p.expected) };
  const ctxFor = (p: PP, mastery = "LEARNING") => ({
    student: { id: "s", name: "S", gradeLevel: 7 },
    curriculum: { subject: "Mathematics", grade: 7, term: 1, lessonTitle: "Integers" },
    question: questionFor(p), skill: { id: "sk", title: "Integers" }, previousAttempts: [], recentMessages: [], helpLevel: "LEVEL_1_HINT",
    grounding: { sources: [], inventory: [] }, masteryInsight: { status: mastery, accuracy: 50, recentAccuracy: 50 },
  }) as any;
  type T = { student: string; strategy: string; evaluation: string; message: string; question: string; plan: any };
  function simulate(p: PP, policy: (i: number, pending?: PP) => string | null, max = 12): T[] {
    const ctx = ctxFor(p);
    let state = stateMod.parseState(null, "LEARNING");
    const out: T[] = [];
    for (let i = 0; i < max; i++) {
      const text = policy(i, state.pendingTransfer?.problem);
      if (text === null) break;
      const turn = AITutorService.planTurn(ctx, state, { studentId: "s", studentQuery: text, helpLevel: "LEVEL_1_HINT" } as any);
      const r = realizePlan(turn.plan, { state: turn.state, lessonTitle: "Integers", skillTitle: "Integers", sources: [] });
      state = stateMod.recordTutorTurn(turn.state, turn.plan, r.message, r.guidingQuestion);
      out.push({ student: text, strategy: turn.plan.strategy, evaluation: turn.plan.evaluation.kind, message: r.message, question: r.guidingQuestion, plan: turn.plan });
    }
    return out;
  }
  const full = (t: T) => `${t.message} ${t.question}`;

  // ------------------------------------------------------------------
  section("5. Realizer property test: every strategy x kind x language (guards, one question, no disclosure)");
  {
    const rand = mulberry(5);
    const ri = (lo: number, hi: number) => lo + Math.floor(rand() * (hi - lo + 1));
    const sg = () => (rand() < 0.5 ? -1 : 1);
    const strategies = ["OPEN_LESSON", "OPEN_PROBLEM", "ASK_WHAT_THEY_THINK", "ACTIVATE_PRIOR", "VISUAL_NUMBER_LINE", "DECOMPOSE_STEPS", "WORKED_ANALOGOUS", "REAL_CONTEXT", "TARGET_MISCONCEPTION", "ASK_FOR_REASONING", "CONFIRM_AND_PROBE", "TRANSFER_PROBLEM", "SIMPLER_PROBLEM", "HARDER_PROBLEM", "REVIEW_KEY_IDEAS", "REDIRECT_TO_THINKING", "EMPATHIZE_AND_SHRINK", "NUDGE_TO_RESPOND", "SUGGEST_TEACHER", "REDIRECT_OFF_TOPIC", "CELEBRATE_AND_NEXT"] as const;
    const diagnoses = ["SIGN_ERROR", "ABS_KEPT_SIGN", "OPPOSITE_SAME_NUMBER", "EQ_WRONG_INVERSE", "COMPARED_MAGNITUDE", "CALCULATION_SLIP", "UNKNOWN_INCORRECT"] as const;
    let combos = 0, clean = 0, oneQ = 0, noDisc = 0, tlFilipino = 0, tlTotal = 0;
    const tlOffenders: string[] = [];
    let fallbacks = 0; const fbList: string[] = [];
    for (let i = 0; i < 60; i++) {
      const problems: PP[] = [
        prob.makeProblem(sg() * ri(2, 30), "abs"), prob.makeProblem(sg() * ri(2, 30), "opp"),
        prob.makeProblem(sg() * ri(2, 12), rand() < 0.5 ? "x+" : "x-", ri(-20, 20)), prob.makeProblem(-ri(2, 20), "max", -ri(21, 40)),
        prob.makeProblem(-ri(2, 20), ">", -ri(21, 40)),
      ];
      for (const p of problems) {
        if (p.expected === 0 && p.op !== ">") continue;
        for (const lang of ["EN", "TL"] as const) {
          for (const strategy of strategies) {
            for (const diagnosis of strategy === "TARGET_MISCONCEPTION" ? diagnoses : ([undefined] as const)) {
              const state: any = { ...stateMod.initialState("LEARNING"), turn: ri(1, 9), baseProblem: p, activeProblem: p, language: lang };
              const posed = ["TRANSFER_PROBLEM", "SIMPLER_PROBLEM", "HARDER_PROBLEM"].includes(strategy) ? prob.generateRelatedProblem(p, "TRANSFER", i) : undefined;
              let ex: PP | undefined;
              if (strategy === "WORKED_ANALOGOUS") {
                for (let k = 0; k < 25; k++) {
                  ex = prob.generateRelatedProblem(p, "TRANSFER", i + 3 + k * 101);
                  const txt = `${ex.display} ${prob.workedSteps(ex).join(" ")}`;
                  if (p.op === ">" || p.op === "<" || !new RegExp(`(?<![\\d.])${Math.abs(p.expected)}(?![\\d])`).test(txt)) break;
                }
              }
              const prot = posed ?? p;
              const plan: any = {
                strategy, scaffold: 3, phase: "SCAFFOLDING", directive: "", mustAskOneQuestion: true, mayStateFinalAnswer: false,
                problemToPose: posed, protectedAnswer: prob.answerText(prot), protectedAnswerAliases: [prob.answerText(prot)],
                avoidStrategies: [], rationale: "", intent: "ANSWER_ATTEMPT", needsTeacherAttention: false, activeProblem: p,
                evaluation: strategy === "CONFIRM_AND_PROBE" ? { kind: "CORRECT", attempted: prob.answerText(p) } : { kind: "INCORRECT", attempted: "1", diagnosis },
                example: ex ? { problem: ex, steps: prob.workedSteps(ex) } : undefined, hintOrdinal: 2, diagnosis, studentQuote: "ang labo",
              };
              if (strategy === "CONFIRM_AND_PROBE" || strategy === "CELEBRATE_AND_NEXT") { plan.protectedAnswer = undefined; plan.protectedAnswerAliases = []; }
              combos++;
              const r = realizePlan(plan, { state, lessonTitle: "Integers", skillTitle: "Integers", sources: [] });
              const text = `${r.message} ${r.guidingQuestion}`;
              if (r.usedSafeFallback) { fallbacks++; if (fbList.length < 6) fbList.push(`${strategy}|${p.display}|${lang}`); }
              if (checkTutorOutput({ message: r.message, guidingQuestion: r.guidingQuestion }, plan, { ...state, recentTutorMessages: [] }).length === 0) clean++;
              if ((text.match(/\?/g) || []).length === 1) oneQ++;
              if (!disclosesAnswer(text, plan)) noDisc++;
              if (lang === "TL" && ["EMPATHIZE_AND_SHRINK", "SUGGEST_TEACHER", "NUDGE_TO_RESPOND", "CELEBRATE_AND_NEXT", "CONFIRM_AND_PROBE", "REDIRECT_TO_THINKING", "ASK_FOR_REASONING", "ASK_WHAT_THEY_THINK", "OPEN_PROBLEM", "TRANSFER_PROBLEM", "SIMPLER_PROBLEM", "HARDER_PROBLEM", "REDIRECT_OFF_TOPIC"].includes(strategy)) {
                tlTotal++;
                if (/\b(ang|mo|ka|na|ito|ako|po|natin|kita|sa)\b/i.test(text)) tlFilipino++;
                else if (tlOffenders.length < 5) tlOffenders.push(`${strategy} | ${p.display} | ${text.slice(0, 100)}`);
              }
            }
          }
        }
      }
    }
    assert(clean === combos, `All guards pass in every case (${clean}/${combos})`);
    assert(fallbacks === 0, `The rich response is used, never silently swapped for the generic safe reply (${fallbacks} swaps) ${fbList.join(" || ")}`);
    assert(oneQ === combos, `Exactly one question everywhere (${oneQ}/${combos})`);
    assert(noDisc === combos, `Never discloses the protected answer (${noDisc}/${combos})`);
    assert(tlFilipino === tlTotal, `Taglish responses actually contain Filipino (${tlFilipino}/${tlTotal}) ${tlOffenders.join(" || ")}`);
  }

  // ------------------------------------------------------------------
  section("6. Scripted conversations on every problem kind, English and Taglish (200 problems)");
  {
    const rand = mulberry(2024);
    const ri = (lo: number, hi: number) => lo + Math.floor(rand() * (hi - lo + 1));
    const sg = () => (rand() < 0.5 ? -1 : 1);
    const tally: Record<string, number> = {};
    const bump = (k: string, ok: boolean) => { tally[k] = (tally[k] ?? 0) + (ok ? 1 : 0); };
    let N = 0;
    const wrongFor = (p: PP) => (p.op === "x+" ? p.b + p.a : p.op === "x-" ? p.b - p.a : p.op === "abs" ? -p.expected : p.op === "opp" ? p.a : p.op === "max" || p.op === "min" ? [p.a, p.b].find((v) => v !== p.expected)! : p.expected + 3);
    for (let i = 0; i < 200; i++) {
      const orig: PP[] = [
        prob.makeProblem(-ri(2, 30), "abs"),
        prob.makeProblem(-ri(2, 30), "opp"),
        prob.makeProblem(sg() * ri(2, 12), "x+", ri(-20, 20)),
        prob.makeProblem(-ri(2, 20), ">", -ri(21, 40)),
      ];
      const p = orig[i % 4];
      if (p.expected === 0 && p.op !== ">") continue;
      N++;
      const tl = i % 2 === 0;
      const say = (en: string, fil: string) => (tl ? fil : en);
      const isStmt = p.op === ">" || p.op === "<";
      const ans = (n: PP) => prob.answerText(n);

      // A) repeated confusion: approach changes, no repeats, no disclosure
      const conf = simulate(p, (t) => (t < 5 ? [say("I don't understand", "hindi ko po maintindihan"), say("i still dont get it", "di ko pa rin gets"), say("still confused", "naguguluhan pa rin ako"), say("I really dont understand", "wala talaga akong maintindihan, di ko gets"), say("idk", "ewan ko po")][t] : null));
      const st = conf.map((c) => c.strategy);
      bump("A_varies", new Set(st.slice(0, 4)).size >= 3);
      bump("A_noConsecutive", st.every((s, k) => k === 0 || s !== st[k - 1]));
      bump("A_noDisclosure", conf.every((c) => !disclosesAnswer(full(c), c.plan)));
      bump("A_noRepeat", conf.every((c, k) => conf.slice(0, k).every((o) => similarity(full(o), full(c)) < 0.85)));
      bump("A_oneQuestion", conf.every((c) => (full(c).match(/\?/g) || []).length === 1));
      bump("A_language", !tl || conf.slice(1).some((c) => /\b(ang|mo|ka|natin|ko|sa)\b/i.test(c.message)));

      // B) wrong -> targeted -> right -> why -> NEW problem of the same kind -> right -> celebrate
      const learner = simulate(p, (t, pending) => {
        if (t === 0) return isStmt ? (p.expected === 1 ? "false" : "true") : String(wrongFor(p));
        if (t === 1) return isStmt ? ans(p) : ans(p);
        if (t === 2) return say("because I thought about the number line", "kasi inisip ko sa number line");
        if (t === 3) return pending ? ans(pending) : "ok";
        return null;
      });
      bump("B_wrongJudged", learner[0].evaluation === "INCORRECT");
      bump("B_targeted", learner[0].strategy === "TARGET_MISCONCEPTION" || learner[0].strategy === "ASK_FOR_REASONING");
      bump("B_rightJudged", learner[1].evaluation === "CORRECT" && learner[1].strategy === "CONFIRM_AND_PROBE");
      bump("B_transfer", learner[2].strategy === "TRANSFER_PROBLEM" && !!learner[2].plan.problemToPose && prob.kindOf(learner[2].plan.problemToPose) === prob.kindOf(p));
      bump("B_transferNew", !!learner[2].plan.problemToPose && prob.problemKey(learner[2].plan.problemToPose) !== prob.problemKey(p));
      bump("B_celebrate", learner[3]?.evaluation === "CORRECT" && learner[3].strategy === "CELEBRATE_AND_NEXT");
      bump("B_noEarlyDisclosure", !disclosesAnswer(full(learner[0]), learner[0].plan));

      // C) answer seeker
      const seeker = simulate(p, (t) => (t < 3 ? [say("just tell me the answer", "ano po ang sagot"), say("give me the answer please", "pasagot po"), say("tell me the answer now", "sabihin mo na ang sagot")][t] : null));
      bump("C_neverDisclosed", seeker.every((c) => !disclosesAnswer(full(c), c.plan)));
      bump("C_escalates", seeker[0].strategy === "REDIRECT_TO_THINKING" && seeker[1].strategy === "WORKED_ANALOGOUS" && !!seeker[1].plan.example && prob.kindOf(seeker[1].plan.example.problem) === prob.kindOf(p));
    }
    for (const [k, v] of Object.entries(tally)) assert(v >= N * 0.97, `${k}: ${v}/${N}`);
  }

  // ------------------------------------------------------------------
  section("7. Guards for statements and Filipino correctness claims");
  {
    const stmt = ar.parseAnyProblem("-5 > -2")!;
    const plan: any = { protectedAnswer: "false", protectedAnswerAliases: ["false"], activeProblem: stmt, mustAskOneQuestion: true, strategy: "DECOMPOSE_STEPS", evaluation: { kind: "NONE" } };
    for (const t of ["The statement is false.", "It's false, because -5 is to the left.", "ito ay mali", "The answer is false"]) assert(disclosesAnswer(t, plan), `Discloses truth value: "${t}"`);
    for (const t of ["Is the statement true or false?", "Which is farther right: -5 or -2?", "Is it true that bigger size means greater?", "Can you decide if it is true?"]) assert(!disclosesAnswer(t, plan), `No false alarm: "${t}"`);
    const truePlan: any = { ...plan, protectedAnswer: "true", protectedAnswerAliases: ["true"] };
    assert(disclosesAnswer("So it's true!", truePlan) && !disclosesAnswer("So it's false!", truePlan), "Only the protected truth value is flagged");
    const abs = prob.makeProblem(-14, "abs");
    const absPlan: any = { protectedAnswer: "14", protectedAnswerAliases: ["14"], activeProblem: abs, mustAskOneQuestion: true, strategy: "DECOMPOSE_STEPS", evaluation: { kind: "NONE" } };
    assert(disclosesAnswer("So |-14| = 14.", absPlan) && disclosesAnswer("The answer is 14.", absPlan), "ABS: answer equal to the operand's size is still flagged (no operand exemption)");
    assert(!disclosesAnswer("How many steps from 0 is -14?", absPlan), "ABS: asking about the operand is fine");
    const pos = prob.makeProblem(24, "abs");
    const posPlan: any = { ...absPlan, protectedAnswer: "24", protectedAnswerAliases: ["24"], activeProblem: pos };
    assert(!disclosesAnswer("How far is 24 from 0 on the number line?", posPlan) && !disclosesAnswer("Is 24 a positive number?", posPlan), "ABS(24): describing the operand (position/sign) is not a disclosure");
    assert(disclosesAnswer("It is 24 from zero, so |24| is 24.", { ...posPlan, activeProblem: prob.makeProblem(-24, "abs") }), "ABS(-24): '... is 24 from zero' IS a disclosure (the written 24 is not the operand -24)");
    assert(disclosesAnswer("The answer is 24 on the number line.", posPlan), "A strong phrase ('the answer is') is always a disclosure, whatever follows");
    const base = stateMod.initialState();
    const inc: any = { ...plan, evaluation: { kind: "INCORRECT" } };
    assert(checkTutorOutput({ message: "Tama! Magaling.", guidingQuestion: "Bakit?" }, inc, base).includes("WRONG_CORRECTNESS_CLAIM"), "Filipino 'Tama!' on an incorrect answer is rejected");
    assert(!checkTutorOutput({ message: "Hindi pa iyon ang tamang sagot.", guidingQuestion: "Paano mo ito nakuha?" }, inc, base).includes("WRONG_CORRECTNESS_CLAIM"), "'tamang sagot' (a different word form) is not mistaken for praise");
    const cor: any = { ...plan, evaluation: { kind: "CORRECT" }, protectedAnswer: undefined, protectedAnswerAliases: [] };
    assert(checkTutorOutput({ message: "Mali iyan.", guidingQuestion: "Bakit?" }, cor, base).includes("WRONG_CORRECTNESS_CLAIM"), "Filipino 'Mali' on a correct answer is rejected");
    const posed: any = { ...plan, strategy: "TRANSFER_PROBLEM", problemToPose: prob.makeProblem(-5, "abs") };
    assert(checkTutorOutput({ message: "Try this one: |7|.", guidingQuestion: "What do you get?" }, posed, base).includes("MISSING_POSED_PROBLEM"), "Posed absolute-value problem must contain its number");
    assert(!checkTutorOutput({ message: "Try this one: $|-5|$.", guidingQuestion: "What do you get?" }, { ...posed, protectedAnswer: undefined, protectedAnswerAliases: [] }, base).includes("MISSING_POSED_PROBLEM"), "...and passes when it does");
  }

  // ------------------------------------------------------------------
  section("8. Pipeline on the real seeded questions (all kinds), English and Taglish");
  {
    const ask = async (sid: string, qid: string, text: string, lessonId = "lsn_01") => {
      AITutorService.resetRateLimit();
      return AITutorService.interact({ studentId: sid, lessonId, questionId: qid, studentQuery: text });
    };
    const meta = async (r: any, sid: string) => {
      const conv = (await dbService.getAITutorConversation(r.conversationId, sid)) as any;
      return JSON.parse(conv.messages.filter((m: any) => m.role === "TUTOR").pop().metadata).pedagogy;
    };
    const cases: Array<[string, string[], string[], string]> = [
      ["qst_03", ["-14", "14"], ["INCORRECT", "CORRECT"], "ABS_KEPT_SIGN"],
      ["qst_04", ["-8", "8"], ["INCORRECT", "CORRECT"], "OPPOSITE_SAME_NUMBER"],
      ["qst_10", ["17", "7"], ["INCORRECT", "CORRECT"], "EQ_WRONG_INVERSE"],
      ["qst_11", ["15", "7"], ["INCORRECT", "CORRECT"], "EQ_WRONG_INVERSE"],
    ];
    let k = 0;
    for (const [qid, texts, evals, diag] of cases) {
      const sid = `usr_student_0${(k++ % 4) + 2}`;
      const r1 = await ask(sid, qid, texts[0]);
      const m1 = await meta(r1, sid);
      assert(m1.evaluation === evals[0] && m1.diagnosis === diag, `${qid}: "${texts[0]}" -> ${evals[0]} / ${diag} (got ${m1.evaluation}/${m1.diagnosis})`);
      const r2 = await ask(sid, qid, texts[1]);
      assert((await meta(r2, sid)).evaluation === evals[1], `${qid}: "${texts[1]}" -> ${evals[1]}`);
      assert(!JSON.stringify(r1).match(new RegExp(`answer is ${texts[1]}\\b`)), `${qid}: the answer is not stated after a wrong attempt`);
    }
    // true/false question, Taglish
    const sidTF = "usr_student_05";
    const t1 = await ask(sidTF, "qst_05", "totoo po");
    assert((await meta(t1, sidTF)).evaluation === "INCORRECT" && (await meta(t1, sidTF)).diagnosis === "COMPARED_MAGNITUDE", "qst_05 (-5 > -2 is false): 'totoo po' -> INCORRECT, negative-comparison misconception");
    const t2 = await ask(sidTF, "qst_05", "mali po");
    assert((await meta(t2, sidTF)).evaluation === "CORRECT", "qst_05: 'mali po' -> CORRECT");
    assert(/Tama|Magaling/.test(`${t2.message.content}`), "Taglish student gets Filipino confirmation");
    const t3 = await ask("usr_student_04", "qst_06", "true");
    assert((await meta(t3, "usr_student_04")).evaluation === "CORRECT", "qst_06 (zero is neither positive nor negative = true): record-based true/false judged");

    // A full Taglish conversation on qst_09
    const sid = "usr_student_03";
    const seq = ["ano po ang sagot", "hindi ko po maintindihan", "di ko pa rin gets", "21", "negative lima", "lima po", "kasi mas malaki yung 13 at positibo"];
    const outs: any[] = [];
    for (const m of seq) outs.push(await ask(sid, "qst_09", m, "lsn_02"));
    const conv = (await dbService.getOrCreateAITutorConversation({ studentId: sid, lessonId: "lsn_02", questionId: "qst_09" })) as any;
    const st = stateMod.parseState(conv.stateJson);
    assert(st.language === "TL", "Language preference persisted in conversation state");
    const texts = outs.map((o) => `${o.message.content} ${o.message.guidingQuestion ?? ""}`);
    assert(new Set(texts).size === texts.length, "Seven distinct tutor messages in the Taglish conversation");
    assert(outs.slice(1).some((o) => /\b(ang|mo|ka|natin|ko|sa)\b/i.test(o.message.content)), "Tutor replies contain Filipino");
    assert(outs[5].pedagogy?.evaluation === "CORRECT" && outs[4].pedagogy?.evaluation === "INCORRECT", "'negative lima' judged wrong, 'lima po' judged right");
    assert(outs[6].pedagogy?.strategy === "TRANSFER_PROBLEM", "Taglish justification leads to a new problem");
    assert(!texts.slice(0, 5).some((t) => /\b5\b/.test(t.replace(/\(-8\)|13|-5|Tama,? 5/g, ""))), "The answer (5) is not stated before the student earns it");

    // Prompt to the LLM carries the language instruction, and Filipino praise on a wrong answer is overruled
    const caps: string[] = [];
    let script = "";
    (AITutorService as any).providerOverride = { name: "s", defaultModel: "s", async generateTutorResponse(r: any) { caps.push(r.userPrompt); return { text: script, provider: "s", model: "s" }; } };
    try {
      script = JSON.stringify({ message: "Tama! Magaling ka.", guidingQuestion: "Bakit?", responseType: "FEEDBACK", hintLevel: 1, encouragement: "x" });
      AITutorService.resetRateLimit();
      const r = await AITutorService.interact({ studentId: "usr_student_02", lessonId: "lsn_02", questionId: "qst_09", studentQuery: "ang sagot ko ay 21" });
      assert(/LANGUAGE: the student writes in Filipino\/Taglish/.test(caps[0]), "LLM prompt tells the model to reply in simple Taglish");
      assert(caps.length === 2 && !/^Tama/.test(r.message.content), "LLM saying 'Tama!' to a wrong answer is overruled (retry, then realizer)");
    } finally {
      (AITutorService as any).providerOverride = null;
    }
  }

  console.log("\n======================================================");
  console.log(`PHASE 24 RESULTS: ${passed} passed, ${failed} failed`);
  if (failed > 0) { console.log("Failures:\n - " + failures.join("\n - ")); process.exit(1); }
  console.log("ALL PHASE 24 AUTOMATED CHECKS PASSED (see docs/PHASE_24_VERIFICATION.md for what is NOT covered).");
  process.exit(0);
}
main().catch((e) => { console.error("Test harness crashed:", e); process.exit(1); });
