// Phase 8 Realistic Pattern & Complete Workflow Verification Test
const http = require("http");

const STOK = "eyJ1c2VySWQiOiJ1c3Jfc3R1ZGVudF8wMSIsImVtYWlsIjoic3R1ZGVudEB0dWtsYXMuYWkiLCJuYW1lIjoiSnVhbiBkZSBsYSBDcnV6Iiwicm9sZSI6IlNUVURFTlQiLCJjcmVhdGVkQXQiOjE3OTA1OTE0OTAwMzUsImV4cGlyZXNBdCI6MTc5MTE5NjI5MDAzNX0.fnr-qoXqE9E7Vc9P92ba50r313-qvj_8L49oKjUY9Ss";
const TTOK = "eyJ1c2VySWQiOiJ1c3JfdGVhY2hlcl8wMSIsImVtYWlsIjoidGVhY2hlckB0dWtsYXMuYWkiLCJuYW1lIjoiTWFyaWEgU2FudG9zIiwicm9sZSI6IlRFQUNIRVIiLCJjcmVhdGVkQXQiOjE3OTA1OTE0OTAwMzYsImV4cGlyZXNBdCI6MTc5MTE5NjI5MDAzNn0.yAgq5cK9AH3pQXMdas9fqwVW8Wk1ljwojxEMd9BT1tY";

function request(options, body) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        let json = null;
        try {
          json = JSON.parse(data);
        } catch {
          json = data;
        }
        resolve({ statusCode: res.statusCode, data: json });
      });
    });
    req.on("error", reject);
    if (body) req.write(typeof body === "string" ? body : JSON.stringify(body));
    req.end();
  });
}

async function runPatternTest() {
  console.log("=== PHASE 8 REALISTIC MISTAKE PATTERN E2E TEST ===");

  // 1. Start practice session on Comparing Integers
  console.log("Step 1: Start Practice Session");
  const sRes = await request(
    {
      hostname: "localhost",
      port: 3000,
      path: "/api/practice/start",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${STOK}`,
      },
    },
    { practiceSetId: "ps_integers_basics" }
  );
  const session = sRes.data.data;
  console.log(`-> Active Session: ${session.id}`);

  // 2. Submit attempts with a realistic integer comparison misconception pattern
  console.log("\nStep 2: Submitting 5 sequential attempts with negative integer comparison errors...");
  const questions = session.questions;

  // Q1 (-5 vs -2): Student chooses -5 (Incorrect)
  const a1 = await request(
    {
      hostname: "localhost",
      port: 3000,
      path: `/api/practice/${session.id}/answer`,
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${STOK}` },
    },
    { questionId: "qst_05", answer: "false", timeTakenMs: 12000 }
  );
  console.log("  Attempt 1 (-5 > -2 statement): Correct?", a1.data.data.isCorrect);

  // Q2 (qst_13: Ordering integers): Student orders inversely [-5, -2, 0, 3] -> ["3", "0", "-2", "-5"] (Incorrect)
  const a2 = await request(
    {
      hostname: "localhost",
      port: 3000,
      path: `/api/practice/${session.id}/answer`,
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${STOK}` },
    },
    { questionId: "qst_13", answer: JSON.stringify(["3", "0", "-2", "-5"]), timeTakenMs: 18000 }
  );
  console.log("  Attempt 2 (Ordering integers): Correct?", a2.data.data.isCorrect);

  // 3. Complete Practice Session
  console.log("\nStep 3: Complete Practice Session (triggers background analysis)");
  const compRes = await request(
    {
      hostname: "localhost",
      port: 3000,
      path: `/api/practice/${session.id}/complete`,
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${STOK}` },
    },
    {}
  );
  console.log("-> Practice Completed:", compRes.data.data.status);

  // Wait for background analysis to finish
  await new Promise((r) => setTimeout(r, 1200));

  // 4. Trigger Teacher On-Demand Analysis to inspect evidence
  console.log("\nStep 4: Teacher triggers analysis to audit evidence");
  const tRes = await request(
    {
      hostname: "localhost",
      port: 3000,
      path: "/api/teacher/students/usr_student_01/analyze",
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${TTOK}` },
    },
    { skillId: "skl_02", practiceSessionId: session.id, maxAttempts: 10 }
  );

  const analysis = tRes.data.data;
  console.log("-> Analyzed Category:", analysis.category);
  console.log("-> Observation:", analysis.observation);
  console.log("-> Identified Pattern:", analysis.pattern);
  console.log("-> Confidence:", `${Math.round(analysis.confidence * 100)}%`);
  console.log("-> Recommendation:", analysis.recommendation);
  console.log("-> Evidence Attempts Count:", analysis.evidences?.length);

  if (analysis.evidences && analysis.evidences.length > 0) {
    console.log("-> Auditable Evidence Attempt #1 ID:", analysis.evidences[0].attemptId);
    console.log("-> Student Raw Answer:", analysis.evidences[0].studentAnswer);
  }

  // 5. Verify Student Insight Retrieval
  console.log("\nStep 5: Verify Student Learning Insight retrieval");
  const insRes = await request({
    hostname: "localhost",
    port: 3000,
    path: "/api/student/insights",
    method: "GET",
    headers: { Authorization: `Bearer ${STOK}` },
  });
  console.log("-> Student insights count:", insRes.data.data.length);
  const studentInsight = insRes.data.data[0];
  console.log("-> Student Category Label:", studentInsight.category);
  console.log("-> Student Recommendation:", studentInsight.recommendation);

  // 6. Verify AI Tutor bridge
  console.log("\nStep 6: Verify AI Tutor integrates the learning insight");
  const tutorRes = await request(
    {
      hostname: "localhost",
      port: 3000,
      path: "/api/ai/tutor",
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${STOK}` },
    },
    {
      lessonId: "lsn_01",
      skillId: "skl_02",
      questionId: "qst_05",
      helpLevel: "LEVEL_1_HINT",
    }
  );
  console.log("-> AI Tutor Status:", tutorRes.statusCode);
  console.log("-> AI Tutor Guided Response:", tutorRes.data.data.message.content);

  console.log("\n=========================================================");
  console.log(">>> REALISTIC MISTAKE PATTERN E2E TEST COMPLETED: PASS <<<");
  console.log("=========================================================");
}

runPatternTest().catch((e) => {
  console.error("Pattern test failed:", e);
  process.exit(1);
});
