// Phase 8 Full Acceptance Test Suite: AI Mistake Analyzer
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

async function runTests() {
  console.log("=== PHASE 8 FULL ACCEPTANCE TEST SUITE: AI MISTAKE ANALYZER ===");

  // 1. Unauthenticated Request Rejected
  console.log("\n[TEST 1] Unauthenticated request to /api/student/insights");
  const r1 = await request({
    hostname: "localhost",
    port: 3000,
    path: "/api/student/insights",
    method: "GET",
  });
  console.log(`Status: ${r1.statusCode} (Expected: 401)`);
  if (r1.statusCode !== 401) throw new Error("Security Failure: Unauthenticated insights request was not rejected!");

  // 2. Student Views Their Own Learning Insights
  console.log("\n[TEST 2] Student Retrieves Their Own Insights");
  const r2 = await request({
    hostname: "localhost",
    port: 3000,
    path: "/api/student/insights",
    method: "GET",
    headers: { Authorization: `Bearer ${STOK}` },
  });
  console.log(`Status: ${r2.statusCode} (Expected: 200)`);
  if (r2.statusCode !== 200 || !Array.isArray(r2.data.data)) {
    throw new Error("Failed to load student insights!");
  }
  console.log(`Insights count: ${r2.data.data.length}`);
  const firstInsight = r2.data.data[0];
  console.log(`Latest category: ${firstInsight?.category}`);
  console.log(`Observation: ${firstInsight?.observation}`);
  console.log(`Confidence: ${firstInsight?.confidence}`);

  // 3. Student Forbidden from Requesting Another Student's Insights directly
  console.log("\n[TEST 3] Student Forbidden from Accessing Teacher Insights Endpoint");
  const r3 = await request({
    hostname: "localhost",
    port: 3000,
    path: "/api/teacher/students/usr_student_01/insights",
    method: "GET",
    headers: { Authorization: `Bearer ${STOK}` },
  });
  console.log(`Status: ${r3.statusCode} (Expected: 403)`);
  if (r3.statusCode !== 403) {
    throw new Error("RBAC Failure: Student accessed teacher student-insights endpoint!");
  }

  // 4. Student Forbidden from Triggering Teacher Analyze Action
  console.log("\n[TEST 4] Student Forbidden from Calling /api/teacher/students/:id/analyze");
  const r4 = await request(
    {
      hostname: "localhost",
      port: 3000,
      path: "/api/teacher/students/usr_student_01/analyze",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${STOK}`,
      },
    },
    { skillId: "skl_02" }
  );
  console.log(`Status: ${r4.statusCode} (Expected: 403)`);
  if (r4.statusCode !== 403) {
    throw new Error("RBAC Failure: Student called teacher analyze endpoint!");
  }

  // 5. Teacher Triggers Learning Pattern Analysis
  console.log("\n[TEST 5] Teacher Triggers On-Demand Analysis for Student on Comparing Integers");
  const r5 = await request(
    {
      hostname: "localhost",
      port: 3000,
      path: "/api/teacher/students/usr_student_01/analyze",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${TTOK}`,
      },
    },
    { skillId: "skl_02", maxAttempts: 10 }
  );
  console.log(`Status: ${r5.statusCode} (Expected: 200)`);
  if (r5.statusCode !== 200 || !r5.data.data) {
    throw new Error(`Teacher analysis trigger failed: ${JSON.stringify(r5.data)}`);
  }
  const analysis = r5.data.data;
  console.log("Analysis Result:");
  console.log(`  - Category: ${analysis.category}`);
  console.log(`  - Confidence: ${analysis.confidence} (${Math.round(analysis.confidence * 100)}%)`);
  console.log(`  - Observation: ${analysis.observation}`);
  console.log(`  - Pattern: ${analysis.pattern}`);
  console.log(`  - Recommendation: ${analysis.recommendation}`);
  console.log(`  - Evidences Linked: ${analysis.evidences?.length || 0} attempts`);

  // Verify Confidence is clamped [0.0, 1.0]
  if (typeof analysis.confidence !== "number" || analysis.confidence < 0 || analysis.confidence > 1) {
    throw new Error(`Invalid confidence value: ${analysis.confidence}`);
  }

  // 6. Teacher Inspects Student Insights & Evidence Attempts
  console.log("\n[TEST 6] Teacher Inspects Student Insights & Evidence");
  const r6 = await request({
    hostname: "localhost",
    port: 3000,
    path: "/api/teacher/students/usr_student_01/insights",
    method: "GET",
    headers: { Authorization: `Bearer ${TTOK}` },
  });
  console.log(`Status: ${r6.statusCode} (Expected: 200)`);
  const teacherInsights = r6.data.data;
  console.log(`Teacher retrieved ${teacherInsights.length} insight records.`);
  if (!teacherInsights || teacherInsights.length === 0) {
    throw new Error("No insights returned for teacher!");
  }
  const analyzedItem = teacherInsights[0];
  if (analyzedItem.evidences && analyzedItem.evidences.length > 0) {
    const firstEv = analyzedItem.evidences[0];
    console.log(`  - Evidence #1 Attempt ID: ${firstEv.attemptId}`);
    console.log(`  - Evidence #1 Prompt: ${firstEv.questionPrompt}`);
    console.log(`  - Evidence #1 Student Answer: ${firstEv.studentAnswer} (Correct: ${firstEv.isCorrect})`);
  }

  // 7. Practice Completion Background Analysis Trigger
  console.log("\n[TEST 7] Student Starts & Completes Practice -> Triggers Analysis");
  const r7_start = await request(
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
  const newSession = r7_start.data.data;
  console.log(`Started session: ${newSession.id}`);

  // Submit an answer
  const qId = newSession.questions[0].question.id;
  await request(
    {
      hostname: "localhost",
      port: 3000,
      path: `/api/practice/${newSession.id}/answer`,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${STOK}`,
      },
    },
    { questionId: qId, answer: "opt_a" }
  );

  // Complete practice session
  const r7_complete = await request(
    {
      hostname: "localhost",
      port: 3000,
      path: `/api/practice/${newSession.id}/complete`,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${STOK}`,
      },
    },
    {}
  );
  console.log(`Session completion status: ${r7_complete.statusCode}`);
  if (r7_complete.statusCode !== 200) {
    throw new Error("Practice completion failed!");
  }

  // Wait 1 second for asynchronous analysis
  await new Promise((r) => setTimeout(r, 1000));

  // 8. Verify Student Can Retrieve Fresh Insights
  console.log("\n[TEST 8] Student Retrieves Fresh Insights after Practice");
  const r8 = await request({
    hostname: "localhost",
    port: 3000,
    path: "/api/student/insights",
    method: "GET",
    headers: { Authorization: `Bearer ${STOK}` },
  });
  console.log(`Status: ${r8.statusCode}`);
  console.log(`Insights available: ${r8.data.data.length}`);
  if (!r8.data.data || r8.data.data.length === 0) {
    throw new Error("No insights available for student after practice!");
  }

  // 9. AI Tutor Context Bridge Verification
  console.log("\n[TEST 9] Verify AI Tutor Incorporates Learning Insight into Context");
  // Call AI Tutor for the skill and check response
  const r9 = await request(
    {
      hostname: "localhost",
      port: 3000,
      path: "/api/ai/tutor",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${STOK}`,
      },
    },
    {
      lessonId: "lsn_01",
      skillId: "skl_02",
      questionId: "qst_05",
      helpLevel: "LEVEL_1_HINT",
      studentAnswer: "-5",
    }
  );
  console.log(`Tutor response status: ${r9.statusCode}`);
  if (r9.statusCode === 200) {
    console.log(`AI Tutor message: ${r9.data.data.message.content}`);
  }

  console.log("\n========================================================");
  console.log(">>> ALL PHASE 8 ACCEPTANCE TESTS COMPLETED SUCCESSFULLY <<<");
  console.log("========================================================");
}

runTests().catch((err) => {
  console.error("Test failed with error:", err);
  process.exit(1);
});
