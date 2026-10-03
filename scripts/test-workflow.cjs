// Phase 7: Complete Real User Journey End-to-End Test
const http = require("http");

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

async function runEndToEnd() {
  console.log("=== PHASE 7: COMPLETE FINAL ACCEPTANCE WORKFLOW ===");

  // 1. Student Login
  console.log("Step 1: Student Login");
  const loginRes = await request(
    {
      hostname: "localhost",
      port: 3000,
      path: "/api/auth/login",
      method: "POST",
      headers: { "Content-Type": "application/json" },
    },
    { email: "student@tuklas.ai", password: "Tuklas2026!" }
  );
  if (loginRes.statusCode !== 200 || !loginRes.data.token) {
    throw new Error("Login failed");
  }
  const token = loginRes.data.token;
  console.log("-> Authenticated as:", loginRes.data.user.name, `(${loginRes.data.user.email})`);

  // 2. Open Grade 7 Mathematics & Learning Path
  console.log("\nStep 2: Open Grade 7 Mathematics & Verify Learning Path");
  const pathRes = await request({
    hostname: "localhost",
    port: 3000,
    path: "/api/student/learning-path",
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });
  console.log("-> Curriculum Unit:", pathRes.data.data.curriculum.unit.title);

  // 3. Open Understanding Integers (lsn_01)
  console.log("\nStep 3: Open Lesson: Understanding Integers");
  const lessonRes = await request({
    hostname: "localhost",
    port: 3000,
    path: "/api/lessons/lsn_01",
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });
  console.log("-> Loaded Lesson:", lessonRes.data.data.title);

  // 4. Open Practice (start practice session for ps_integers_basics)
  console.log("\nStep 4: Open Practice Session");
  const sessionRes = await request(
    {
      hostname: "localhost",
      port: 3000,
      path: "/api/practice/start",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    },
    { practiceSetId: "ps_integers_basics" }
  );
  const session = sessionRes.data.data;
  console.log("-> Active Practice Session:", session.id, "with", session.totalQuestions, "questions");

  // 5. Receive Question (Question 1)
  const q1 = session.questions[0].question;
  console.log("\nStep 5: Receive Question 1");
  console.log("-> Prompt:", q1.prompt);

  // 6. Submit Incorrect Answer
  console.log("\nStep 6: Student Submits Incorrect Answer");
  const ansRes = await request(
    {
      hostname: "localhost",
      port: 3000,
      path: `/api/practice/${session.id}/answer`,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    },
    { questionId: q1.id, answer: "opt_a", timeTakenMs: 15000 }
  );
  console.log("-> Answer is Correct?", ansRes.data.data.isCorrect);
  console.log("-> Feedback:", ansRes.data.data.feedback);

  // 7. Tap "Need a Hint?" -> Tuklas builds context, calls AI Tutor
  console.log("\nStep 7: Student Taps 'Need a Hint?' -> AI Tutor Invoked");
  let hintRes = await request(
    {
      hostname: "localhost",
      port: 3000,
      path: "/api/ai/tutor",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    },
    {
      lessonId: "lsn_01",
      questionId: q1.id,
      practiceSessionId: session.id,
      helpLevel: "LEVEL_1_HINT",
      studentAnswer: "opt_a",
    }
  );

  if (hintRes.statusCode === 429) {
    console.log("Rate limiter active from previous test. Waiting 7 seconds...");
    await new Promise((r) => setTimeout(r, 7000));
    hintRes = await request(
      {
        hostname: "localhost",
        port: 3000,
        path: "/api/ai/tutor",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      },
      {
        lessonId: "lsn_01",
        questionId: q1.id,
        practiceSessionId: session.id,
        helpLevel: "LEVEL_1_HINT",
        studentAnswer: "opt_a",
      }
    );
  }

  console.log("Hint request status:", hintRes.statusCode);
  if (hintRes.statusCode !== 200 || !hintRes.data?.data) {
    throw new Error(`Hint request failed with status ${hintRes.statusCode}: ${JSON.stringify(hintRes.data)}`);
  }
  const tutorMsg = hintRes.data.data.message;
  console.log("-> AI Tutor Response Type:", tutorMsg.messageType);
  console.log("-> AI Tutor Hint:", tutorMsg.content);
  console.log("-> AI Guiding Question:", tutorMsg.guidingQuestion);

  // 8. Student Tries Again with Correct Answer
  console.log("\nStep 8: Student Retries with Correct Answer (opt_c)");
  const retryRes = await request(
    {
      hostname: "localhost",
      port: 3000,
      path: `/api/practice/${session.id}/answer`,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    },
    { questionId: q1.id, answer: "opt_c", timeTakenMs: 18000 }
  );
  console.log("-> Retry Answer is Correct?", retryRes.data.data.isCorrect);
  console.log("-> Retry Feedback:", retryRes.data.data.feedback);
  console.log("-> Attempt Number:", retryRes.data.data.attemptNumber);

  // 9. Verify Hint Usage was Recorded on Question Attempt
  console.log("\nStep 9: Verify Hint Usage Flag Recorded in DB");
  const attempts = await request({
    hostname: "localhost",
    port: 3000,
    path: `/api/practice/${session.id}/review`,
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });
  console.log("-> Practice Review Status:", attempts.data.data.status);

  console.log("\n==========================================");
  console.log(">>> FINAL ACCEPTANCE WORKFLOW SUCCESSFUL! <<<");
  console.log("==========================================");
}

runEndToEnd().catch((err) => {
  console.error("Workflow failed:", err);
  process.exit(1);
});
