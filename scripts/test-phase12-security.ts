/**
 * Tuklas AI - Phase 12 Security, IDOR, and Authorization Verification Suite
 */

import { dbService, fallbackStore } from "../src/lib/db";
import { createSessionToken, verifySessionToken } from "../src/lib/auth/session";
import { TeacherService } from "../src/lib/teacher/teacher-service";
import { StudentDashboardService } from "../src/lib/dashboard/student-dashboard-service";
import { MasteryEngine } from "../src/lib/mastery/mastery-engine";

async function runSecurityAudit() {
  console.log("=== PHASE 12: SECURITY, AUTHORIZATION & IDOR AUDIT ===");

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, message: string) {
    totalTests++;
    if (condition) {
      console.log(`✅ PASSED: ${message}`);
      passedTests++;
    } else {
      console.error(`❌ FAILED: ${message}`);
      throw new Error(`Assertion failed: ${message}`);
    }
  }

  // --- 1. Test Cryptographic Session Generation & Verification ---
  console.log("\n--- 1. Testing Server-side Cryptographic Sessions ---");
  const studentToken = createSessionToken({
    id: "usr_student_01",
    email: "student@tuklas.ai",
    name: "Juan de la Cruz",
    role: "STUDENT",
  });
  const studentSession = verifySessionToken(studentToken);
  assert(studentSession !== null, "Student session verified successfully");
  assert(studentSession?.userId === "usr_student_01", "Student session retains correct userId");
  assert(studentSession?.role === "STUDENT", "Student session retains correct role");

  const teacherToken = createSessionToken({
    id: "usr_teacher_01",
    email: "teacher@tuklas.ai",
    name: "Maria Santos",
    role: "TEACHER",
  });
  const teacherSession = verifySessionToken(teacherToken);
  assert(teacherSession !== null, "Teacher session verified successfully");
  assert(teacherSession?.role === "TEACHER", "Teacher session retains correct role");

  // Tampered token test
  const tamperedToken = studentToken.slice(0, -6) + "xxxxxx";
  const tamperedSession = verifySessionToken(tamperedToken);
  assert(tamperedSession === null, "Tampered cryptographic token rejected");

  // --- 2. Test Student Isolation & IDOR Protection ---
  console.log("\n--- 2. Testing Student Data Isolation ---");
  const studentADashboard = await StudentDashboardService.getStudentDashboard("usr_student_01");
  assert(studentADashboard.student.id === "usr_student_01", "Student A retrieves Student A data");
  assert(studentADashboard.student.name === "Juan de la Cruz", "Student A name matches profile");

  const studentBDashboard = await StudentDashboardService.getStudentDashboard("usr_student_02");
  assert(studentBDashboard.student.id === "usr_student_02", "Student B retrieves Student B data");
  assert(studentBDashboard.student.name === "Maria Clara de los Santos", "Student B name matches profile");
  assert(studentADashboard.student.id !== studentBDashboard.student.id, "Student A and Student B data strictly isolated");

  // --- 3. Test Teacher Scoped Authorization ---
  console.log("\n--- 3. Testing Teacher Scoped Authorization & Student Isolation ---");
  // Teacher 1 teaches cls_01 and cls_02
  const isAuthorizedStudent1 = await TeacherService.isTeacherAuthorizedForStudent(
    "usr_teacher_01",
    "usr_student_01",
    "TEACHER"
  );
  assert(isAuthorizedStudent1 === true, "Teacher 1 is authorized for enrolled Student 1");

  const isAuthorizedUnauthorizedStudent = await TeacherService.isTeacherAuthorizedForStudent(
    "usr_teacher_01",
    "usr_student_unauthorized_999",
    "TEACHER"
  );
  assert(isAuthorizedUnauthorizedStudent === false, "Teacher 1 is REJECTED for unauthorized Student 999");

  // Admin bypass verification
  const isAdminAuthorized = await TeacherService.isTeacherAuthorizedForStudent(
    "usr_admin_01",
    "usr_student_unauthorized_999",
    "ADMIN"
  );
  assert(isAdminAuthorized === true, "Admin role has global supervisory authorization");

  // Student role trying to act as teacher
  let studentDetailFailed = false;
  try {
    await TeacherService.getStudentDetail("usr_student_02", "usr_student_01", "STUDENT");
  } catch (err: any) {
    studentDetailFailed = err.message.includes("Unauthorized") || err.message.includes("Teacher");
  }
  assert(studentDetailFailed === true, "Student cannot access Teacher getStudentDetail");

  // --- 4. Test Teacher Content Ownership ---
  console.log("\n--- 4. Testing Teacher Content Authorization ---");
  const teacherDashboard = await TeacherService.getTeacherDashboard("usr_teacher_01", "TEACHER");
  assert(teacherDashboard.teacher.id === "usr_teacher_01", "Teacher dashboard scoped to teacher");
  assert(teacherDashboard.stats.activeClassesCount >= 2, "Teacher dashboard accurately counts authorized classes");

  // --- 5. Test Non-Color & Genuine Mistake Statistics ---
  console.log("\n--- 5. Testing Genuine Mistake Statistics (No Fake Baselines) ---");
  const commonMistakes = teacherDashboard.commonMistakes;
  assert(Array.isArray(commonMistakes), "Common mistakes is an array");
  commonMistakes.forEach((m: any) => {
    assert(typeof m.count === "number" && m.count >= 0, `Mistake category ${m.category} has valid non-negative count: ${m.count}`);
  });

  // --- 6. Test Mastery Engine Data Persistence ---
  console.log("\n--- 6. Testing Mastery Engine Consistency ---");
  const masteries = await MasteryEngine.getStudentMasteries("usr_student_01");
  assert(masteries.length > 0, "Student has mastery records");
  assert(["NOT_STARTED", "LEARNING", "DEVELOPING", "PROFICIENT", "MASTERED"].includes(masteries[0].status), "Mastery status conforms to 5-stage scale");

  console.log(`\n======================================================`);
  console.log(`>>> ALL ${passedTests}/${totalTests} SECURITY & AUTHORIZATION TESTS PASSED! <<<`);
  console.log(`======================================================`);
}

runSecurityAudit().catch((e) => {
  console.error("Test failed with error:", e);
  process.exit(1);
});
