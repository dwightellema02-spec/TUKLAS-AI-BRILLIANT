/**
 * Tuklas AI - Authentication & Account Creation Repair Test Suite
 *
 * Verifies:
 * 1. Registration (HTTP 201, User created, password hashed, Role = STUDENT, session created)
 * 2. Login (HTTP 200, Session created, authenticated user returned)
 * 3. Authenticated Request (/api/auth/me & /api/student/dashboard returns correct student)
 * 4. Wrong Password rejection (HTTP 401, no authenticated session)
 * 5. Duplicate Registration (HTTP 409 rejection with clear message)
 * 6. Persistence across restart (account still exists, login succeeds)
 * 7. Student Data Isolation (Student A cannot access Student B's private data)
 */

import { dbService, fallbackStore, loadPersistedUsers } from "../src/lib/db";
import { verifyPassword } from "../src/lib/auth/password";
import { createSessionToken, verifySessionToken } from "../src/lib/auth/session";

const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:3000";

let totalTests = 0;
let passedTests = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✓ [PASS] ${testName}`);
  } else {
    console.error(`  ✗ [FAIL] ${testName}${detail ? ` - ${detail}` : ""}`);
  }
}

async function runAuthRepairTests() {
  console.log("=================================================");
  console.log("  TUKLAS AI - AUTHENTICATION REPAIR TEST SUITE   ");
  console.log("=================================================\n");

  const timestamp = Date.now();
  const testStudentEmail = `repair_student_${timestamp}@example.com`;
  const testPassword = "Password123!";
  const testName = "Dalisay Dimagiba";

  let studentSessionCookie = "";
  let studentBearerToken = "";
  let createdUserId = "";

  // -------------------------------------------------------------------------
  // TEST 1 — REGISTRATION
  // -------------------------------------------------------------------------
  console.log("[1] Registration Verification");
  try {
    const regRes = await fetch(`${BASE_URL}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: testName,
        email: testStudentEmail,
        password: testPassword,
        role: "ADMIN", // Attacker attempts to register as ADMIN - must be forced to STUDENT
        gradeLevel: 7,
      }),
    });

    const regData = await regRes.json();
    const setCookie = regRes.headers.get("set-cookie") || "";
    if (setCookie) {
      studentSessionCookie = setCookie.split(";")[0];
    }

    assert(regRes.status === 201, "Registration returns HTTP 201 Created", `Got status ${regRes.status}`);
    assert(Boolean(regData.success), "Response payload contains success: true");
    assert(regData.user?.role === "STUDENT", "Registration strictly enforces STUDENT role, rejecting privilege escalation");
    assert(Boolean(regData.token), "Registration issues session token");

    studentBearerToken = regData.token;
    createdUserId = regData.user.id;

    // Direct database verification (sync persistence across test process)
    loadPersistedUsers();
    const dbRecord = await dbService.findUserByEmail(testStudentEmail);
    assert(Boolean(dbRecord && dbRecord.id === createdUserId), "User record physically saved in repository");
    assert(dbRecord?.passwordHash !== testPassword, "Password is cryptographically hashed, never plaintext");
    const passMatches = await verifyPassword(testPassword, dbRecord?.passwordHash || "");
    assert(passMatches, "Password hash verifies successfully against original password");
  } catch (err) {
    assert(false, "Registration threw an exception", String(err));
  }

  // -------------------------------------------------------------------------
  // TEST 2 — LOGIN
  // -------------------------------------------------------------------------
  console.log("\n[2] Login Verification");
  try {
    // Test Case E & F: Email with uppercase letters and accidental spaces
    const messyEmail = `  ${testStudentEmail.toUpperCase()}  `;
    const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: messyEmail,
        password: testPassword,
      }),
    });

    const loginData = await loginRes.json();
    assert(loginRes.status === 200, "Login returns HTTP 200 OK with normalized email", `Status: ${loginRes.status}`);
    assert(Boolean(loginData.success && loginData.token), "Login response contains success: true and valid session token");
    assert(loginData.user?.id === createdUserId, "Authenticated user ID matches registered user ID");
    assert(loginData.user?.email === testStudentEmail.toLowerCase().trim(), "User email is consistently normalized");
  } catch (err) {
    assert(false, "Login threw an exception", String(err));
  }

  // -------------------------------------------------------------------------
  // TEST 3 — AUTHENTICATED REQUESTS (COOKIE & BEARER)
  // -------------------------------------------------------------------------
  console.log("\n[3] Authenticated Requests (/api/auth/me & /api/student/dashboard)");
  try {
    // 3.1 Via Bearer Token (iFrame resiliency)
    const meResBearer = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${studentBearerToken}` },
    });
    const meDataBearer = await meResBearer.json();
    assert(meResBearer.status === 200, "/api/auth/me succeeds with Bearer token header");
    assert(meDataBearer.user?.id === createdUserId, "Returns correct user profile from Bearer session");

    // 3.2 Via Cookie
    const meResCookie = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: { Cookie: studentSessionCookie },
    });
    const meDataCookie = await meResCookie.json();
    assert(meResCookie.status === 200, "/api/auth/me succeeds with HTTP-only cookie");
    assert(meDataCookie.user?.id === createdUserId, "Returns correct user profile from Cookie session");

    // 3.3 Access Student Dashboard Area
    const dashRes = await fetch(`${BASE_URL}/api/student/dashboard`, {
      headers: { Authorization: `Bearer ${studentBearerToken}` },
    });
    const dashData = await dashRes.json();
    assert(dashRes.status === 200, "Authenticated student dashboard loads successfully with HTTP 200");
    assert(dashData.data?.student?.id === createdUserId, "Dashboard accurately reflects newly created student account");
    assert(dashData.data?.continueLearning?.lessonId === "lsn_01", "New student initialized with foundational lesson");
  } catch (err) {
    assert(false, "Authenticated requests threw an exception", String(err));
  }

  // -------------------------------------------------------------------------
  // TEST 4 — WRONG PASSWORD REJECTION
  // -------------------------------------------------------------------------
  console.log("\n[4] Wrong Password Rejection");
  try {
    const wrongRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: testStudentEmail,
        password: "WrongPassword999!",
      }),
    });
    const wrongData = await wrongRes.json();
    assert(wrongRes.status === 401, "Wrong password rejected with HTTP 401 Unauthorized");
    assert(!wrongData.success && !wrongData.token, "No session token issued on failed login");
  } catch (err) {
    assert(false, "Wrong password test threw an exception", String(err));
  }

  // -------------------------------------------------------------------------
  // TEST 5 — DUPLICATE REGISTRATION REJECTION
  // -------------------------------------------------------------------------
  console.log("\n[5] Duplicate Registration Rejection");
  try {
    const dupRes = await fetch(`${BASE_URL}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Duplicate Person",
        email: testStudentEmail,
        password: "AnotherPassword123!",
      }),
    });
    const dupData = await dupRes.json();
    assert(dupRes.status === 409, "Duplicate email registration rejected with HTTP 409 Conflict");
    assert(dupData.error?.includes("already exists"), "Returns clear error indicating account already exists");
  } catch (err) {
    assert(false, "Duplicate registration test threw an exception", String(err));
  }

  // -------------------------------------------------------------------------
  // TEST 6 — PERSISTENCE ACROSS RESTART
  // -------------------------------------------------------------------------
  console.log("\n[6] Persistence Verification (Simulate Server Restart)");
  try {
    // Simulate server reboot by clearing volatile in-memory cache and re-loading from persistent store
    fallbackStore.users = fallbackStore.users.filter((u) => u.id !== createdUserId);

    // Verify user temporarily missing from in-memory array
    const beforeReload = fallbackStore.users.find((u) => u.id === createdUserId);
    assert(beforeReload === undefined, "In-memory RAM cleared to simulate process crash/restart");

    // Re-hydrate from persistent disk store
    loadPersistedUsers();
    const afterReload = await dbService.findUserByEmail(testStudentEmail);
    assert(Boolean(afterReload && afterReload.id === createdUserId), "Account successfully reloaded from persistent storage");

    // Perform live login with rehydrated account
    const restartLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: testStudentEmail,
        password: testPassword,
      }),
    });
    assert(restartLoginRes.status === 200, "User can successfully login after simulated restart");
  } catch (err) {
    assert(false, "Persistence test threw an exception", String(err));
  }

  // -------------------------------------------------------------------------
  // TEST 7 — STUDENT DATA ISOLATION
  // -------------------------------------------------------------------------
  console.log("\n[7] Student Data Isolation & IDOR Protection");
  try {
    // Student A tries to query Student B's dashboard by passing studentId query
    const idorRes = await fetch(`${BASE_URL}/api/student/dashboard?studentId=usr_student_02`, {
      headers: { Authorization: `Bearer ${studentBearerToken}` },
    });
    const idorData = await idorRes.json();
    assert(
      idorData.data?.student?.id === createdUserId,
      "Server ignores studentId query parameter for STUDENT role and enforces authenticated user's own data"
    );
  } catch (err) {
    assert(false, "Student isolation test threw an exception", String(err));
  }

  // -------------------------------------------------------------------------
  // SUMMARY
  // -------------------------------------------------------------------------
  console.log("\n=================================================");
  console.log(`  AUTH REPAIR TEST RESULTS: ${passedTests}/${totalTests} PASS`);
  console.log("=================================================\n");

  if (passedTests === totalTests) {
    console.log("ALL AUTHENTICATION REPAIR INTEGRATION TESTS PASSED.");
    process.exit(0);
  } else {
    console.error(`FAILED: ${totalTests - passedTests} tests failed.`);
    process.exit(1);
  }
}

runAuthRepairTests().catch((err) => {
  console.error("Unhandled test execution error:", err);
  process.exit(1);
});
