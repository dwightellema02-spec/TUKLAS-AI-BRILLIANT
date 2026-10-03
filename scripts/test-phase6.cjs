// Phase 6 Full Acceptance Test Script
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
  console.log("=== PHASE 6 FULL ACCEPTANCE TEST SUITE ===");

  // 1. Student Forbidden to create question
  console.log("\n[TEST 1] Student Attempt to Create Question (RBAC Gating)");
  const r1 = await request(
    {
      hostname: "localhost",
      port: 3000,
      path: "/api/questions",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${STOK}`,
      },
    },
    { type: "TEXT_INPUT", prompt: "Unauthorized question" }
  );
  console.log(`Status: ${r1.statusCode} (Expected: 403)`);
  if (r1.statusCode !== 403) throw new Error("RBAC Failure: Student was not forbidden!");

  // 2. Teacher Creates Question
  console.log("\n[TEST 2] Teacher Creates Question");
  const r2 = await request(
    {
      hostname: "localhost",
      port: 3000,
      path: "/api/questions",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${TTOK}`,
      },
    },
    {
      type: "NUMERIC_INPUT",
      prompt: "What is -10 + 25?",
      skillId: "skl_05",
      difficulty: "EASY",
      status: "DRAFT",
      questionData: { correctAnswer: "15" },
      correctFeedback: "Awesome job!",
    }
  );
  console.log(`Status: ${r2.statusCode} (Expected: 201)`);
  const newQ = r2.data.data;
  console.log(`Created Question ID: ${newQ.id}, Status: ${newQ.status}`);

  // 3. Teacher Transitions Status to PUBLISHED
  console.log("\n[TEST 3] Teacher Publishes Question");
  const r3 = await request(
    {
      hostname: "localhost",
      port: 3000,
      path: `/api/questions/${newQ.id}/status`,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${TTOK}`,
      },
    },
    { status: "PUBLISHED" }
  );
  console.log(`Status: ${r3.statusCode}, New Status: ${r3.data.data.status}`);

  // 4. Student views Question (Check Redaction)
  console.log("\n[TEST 4] Student Views Published Question (Security & Redaction)");
  const r4 = await request({
    hostname: "localhost",
    port: 3000,
    path: `/api/questions/${newQ.id}`,
    method: "GET",
    headers: { Authorization: `Bearer ${STOK}` },
  });
  const studentQ = r4.data.data;
  const qData = JSON.parse(studentQ.questionData);
  console.log(`Has correctAnswer exposed? ${qData.correctAnswer !== undefined}`);
  if (qData.correctAnswer !== undefined) throw new Error("Security Breach: Correct answer was exposed to student!");
  console.log("Passed: Correct answer is safely redacted for student.");

  // 5. Student Starts Practice Session
  console.log("\n[TEST 5] Student Starts Practice Session for 'ps_integers_basics'");
  const r5 = await request(
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
  console.log(`Status: ${r5.statusCode}`);
  const sess = r5.data.data;
  console.log(`Session ID: ${sess.id}, Total Questions: ${sess.totalQuestions}`);

  // 6. Student Submits Correct Answer
  console.log("\n[TEST 6] Student Submits Correct Answer to qst_01 (Multiple Choice)");
  const r6 = await request(
    {
      hostname: "localhost",
      port: 3000,
      path: `/api/practice/${sess.id}/answer`,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${STOK}`,
      },
    },
    { questionId: "qst_01", answer: "opt_c", timeTakenMs: 22000 }
  );
  console.log("Result isCorrect:", r6.data.data.isCorrect);
  console.log("Feedback:", r6.data.data.feedback);
  if (!r6.data.data.isCorrect) throw new Error("Validation Failed on correct answer!");

  // 7. Student Submits Wrong Answer with Retry
  console.log("\n[TEST 7] Student Submits Incorrect Answer with Retry (qst_03)");
  const r7 = await request(
    {
      hostname: "localhost",
      port: 3000,
      path: `/api/practice/${sess.id}/answer`,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${STOK}`,
      },
    },
    { questionId: "qst_03", answer: "999", timeTakenMs: 12000 }
  );
  console.log("Result isCorrect:", r7.data.data.isCorrect);
  console.log("Allow Retry?", r7.data.data.allowRetry);
  console.log("Attempts Remaining:", r7.data.data.attemptsRemaining);
  if (r7.data.data.isCorrect !== false || !r7.data.data.allowRetry) {
    throw new Error("Validation / Retry check failed!");
  }

  // 8. Student Retries and Gets it Right
  console.log("\n[TEST 8] Student Retries and Gets Correct Answer (qst_03 -> 14)");
  const r8 = await request(
    {
      hostname: "localhost",
      port: 3000,
      path: `/api/practice/${sess.id}/answer`,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${STOK}`,
      },
    },
    { questionId: "qst_03", answer: "14", timeTakenMs: 18000 }
  );
  console.log("Retry Result isCorrect:", r8.data.data.isCorrect);
  console.log("Attempt Number:", r8.data.data.attemptNumber);
  if (!r8.data.data.isCorrect || r8.data.data.attemptNumber !== 2) {
    throw new Error("Retry attempt number tracking failed!");
  }

  // 9. Complete Practice Session
  console.log("\n[TEST 9] Complete Practice Session & Verify Review");
  const r9 = await request(
    {
      hostname: "localhost",
      port: 3000,
      path: `/api/practice/${sess.id}/complete`,
      method: "POST",
      headers: { Authorization: `Bearer ${STOK}` },
    },
    {}
  );
  const review = r9.data.data;
  console.log(`Session Status: ${review.status}`);
  console.log(`Score: ${review.score}%, Correct: ${review.correctAnswers}/${review.totalQuestions}`);
  console.log(`Review Items Length: ${review.questions.length}`);

  // 10. Student Practice History
  console.log("\n[TEST 10] Student Practice History Check");
  const r10 = await request({
    hostname: "localhost",
    port: 3000,
    path: "/api/student/practice-history",
    method: "GET",
    headers: { Authorization: `Bearer ${STOK}` },
  });
  console.log(`History count: ${r10.data.data.length}`);
  const latestHist = r10.data.data[0];
  console.log(`Latest Session in History: ${latestHist.id}, Status: ${latestHist.status}`);

  console.log("\n==========================================");
  console.log(">>> ALL 10 PHASE 6 ACCEPTANCE TESTS PASSED <<<");
  console.log("==========================================");
}

runTests().catch((err) => {
  console.error("Test failed with error:", err);
  process.exit(1);
});
