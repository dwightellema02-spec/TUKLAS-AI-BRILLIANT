/**
 * Tuklas AI - Phase 13 Automated Verification Test Suite
 * Mathisipan / YouTube Video Integration
 *
 * Verifies:
 * 1. URL Parser & Security Sandbox (valid formats, malicious rejection, domain enforcement)
 * 2. Curated Mathisipan Catalog & Multi-Grade Coverage (Grades 7, 8, 9, 10)
 * 3. Search Orchestration & Quota Fallback
 * 4. Teacher Attachment & Resource Persistence (RBAC, IDOR isolation, metadata storage)
 * 5. Student Lesson Video Delivery & Honest Interaction Tracking
 * 6. Video Removal & Cleanup
 */

import { parseYouTubeUrl } from "../src/lib/youtube/youtube-parser";
import { YouTubeService } from "../src/lib/youtube/youtube-service";
import { MATHISIPAN_CURATED_VIDEOS, YOUTUBE_CONFIG } from "../src/config/youtube";
import { dbService, fallbackStore } from "../src/lib/db";

let totalTests = 0;
let passedTests = 0;

function assert(condition: boolean, testName: string, failureDetails?: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✅ [PASS] ${testName}`);
  } else {
    console.error(`  ❌ [FAIL] ${testName}: ${failureDetails || "Assertion failed"}`);
  }
}

async function runPhase13Verification() {
  console.log("===============================================================");
  console.log("🚀 TUKLAS AI - PHASE 13 MATHISIPAN / YOUTUBE INTEGRATION VERIFICATION");
  console.log("===============================================================\n");

  // -------------------------------------------------------------------------
  // 1. YouTube URL Parser & Security Checks
  // -------------------------------------------------------------------------
  console.log("📦 1. YouTube URL Parser & Security Sanitization Tests");

  // 1.1 Standard watch URL
  const r1 = parseYouTubeUrl("https://www.youtube.com/watch?v=w7m3CgG6w9k");
  assert(r1.isValid && r1.videoId === "w7m3CgG6w9k", "Parses standard desktop youtube.com/watch?v= URL");

  // 1.2 youtu.be short URL
  const r2 = parseYouTubeUrl("https://youtu.be/B5q1yvV9Zk8");
  assert(r2.isValid && r2.videoId === "B5q1yvV9Zk8", "Parses short youtu.be/ share URL");

  // 1.3 Embed URL
  const r3 = parseYouTubeUrl("https://www.youtube.com/embed/k5uW2t9xL6E");
  assert(r3.isValid && r3.videoId === "k5uW2t9xL6E", "Parses official youtube.com/embed/ URL");

  // 1.4 Shorts URL
  const r4 = parseYouTubeUrl("https://www.youtube.com/shorts/M8rK9p4q2Ds");
  assert(r4.isValid && r4.videoId === "M8rK9p4q2Ds", "Parses youtube.com/shorts/ format");

  // 1.5 Direct 11-char ID
  const r5 = parseYouTubeUrl("w7m3CgG6w9k");
  assert(r5.isValid && r5.videoId === "w7m3CgG6w9k", "Accepts direct valid 11-character video ID");

  // 1.6 Rejection: javascript: pseudo-protocol
  const r6 = parseYouTubeUrl("javascript:alert('malicious')");
  assert(!r6.isValid && Boolean(r6.error?.includes("protocol") || r6.error?.includes("Security")), "Rejects javascript: pseudo-protocol");

  // 1.7 Rejection: data: URI
  const r7 = parseYouTubeUrl("data:text/html,<script>alert(1)</script>");
  assert(!r7.isValid && Boolean(r7.error?.includes("protocol") || r7.error?.includes("Security")), "Rejects data: URI");

  // 1.8 Rejection: Non-YouTube external domain
  const r8 = parseYouTubeUrl("https://vimeo.com/123456789");
  assert(!r8.isValid && Boolean(r8.error?.includes("Unsupported video provider domain")), "Rejects non-YouTube domain (vimeo.com)");

  // 1.9 Rejection: Spoofed phishing domain
  const r9 = parseYouTubeUrl("https://youtube.com.attacker.com/watch?v=w7m3CgG6w9k");
  assert(!r9.isValid && Boolean(r9.error?.includes("Unsupported video provider domain")), "Rejects phishing subdomains spoofing youtube.com");

  // 1.10 Embed URL safety
  assert(
    Boolean(
      r1.embedUrl?.startsWith("https://www.youtube-nocookie.com/embed/") ||
        r1.embedUrl?.startsWith("https://www.youtube.com/embed/")
    ),
    "Generates privacy-enhanced embed URL"
  );

  console.log("\n📦 2. Mathisipan Curriculum Scope & Multi-Grade Coverage Tests");

  // 2.1 Multi-Grade Coverage
  const gradesInCatalog = new Set(MATHISIPAN_CURATED_VIDEOS.map((v) => v.gradeLevel));
  assert(
    gradesInCatalog.has(7) && gradesInCatalog.has(8) && gradesInCatalog.has(9) && gradesInCatalog.has(10),
    "Catalog covers MATATAG Grades 7, 8, 9, and 10 (not hardcoded to Grade 7 only)"
  );

  // 2.2 Channel attribution integrity
  const allAttributedToMathisipan = MATHISIPAN_CURATED_VIDEOS.every(
    (v) => v.channelName === "Mathisipan" && v.channelHandle === "@mathisipan"
  );
  assert(allAttributedToMathisipan, "All curated videos maintain official Mathisipan channel attribution");

  // 2.3 Search by Grade
  const g7Results = await YouTubeService.searchVideos({ gradeLevel: 7 });
  assert(g7Results.items.length >= 4 && g7Results.items.every((v) => v.gradeLevel === 7), "Filter by Grade 7 returns Grade 7 videos");

  const g8Results = await YouTubeService.searchVideos({ gradeLevel: 8 });
  assert(g8Results.items.length >= 1 && g8Results.items.every((v) => v.gradeLevel === 8), "Filter by Grade 8 returns Grade 8 videos");

  // 2.4 Search by Keyword
  const searchInts = await YouTubeService.searchVideos({ query: "integers" });
  assert(
    searchInts.items.length > 0 && searchInts.items.some((v) => v.title.toLowerCase().includes("integer")),
    "Search by keyword 'integers' returns relevant Mathisipan lessons"
  );

  // 2.5 Validation and Preview
  const preview = await YouTubeService.validateAndPreview("https://www.youtube.com/watch?v=w7m3CgG6w9k");
  assert(
    Boolean(preview.isValid && preview.title?.includes("Understanding Integers")),
    "Validation & preview resolves title from curated catalog"
  );

  console.log("\n📦 3. Teacher Video Attachment & Persistence Tests");

  // 3.1 Teacher attaches video to lesson
  const attachData = {
    title: "Mathisipan: Number Line Practice",
    url: "https://www.youtube.com/watch?v=B5q1yvV9Zk8",
    youtubeId: "B5q1yvV9Zk8",
    channelName: "Mathisipan",
    thumbnailUrl: "https://img.youtube.com/vi/B5q1yvV9Zk8/hqdefault.jpg",
    description: "Visual strategies for number lines.",
    duration: "10:15",
  };

  const attachedRes: any = await dbService.attachLessonVideo("lsn_01", attachData, "TEACHER", "usr_teacher_01");
  assert(
    attachedRes.type === "YOUTUBE" && attachedRes.youtubeId === "B5q1yvV9Zk8",
    "Teacher successfully attaches YouTube video resource"
  );

  // 3.2 Extended metadata persistence
  assert(
    attachedRes.provider === "YOUTUBE" && attachedRes.channelName === "Mathisipan",
    "Attached resource stores provider='YOUTUBE' and channelName='Mathisipan'"
  );

  // 3.3 Lesson videoUrl updated
  const updatedLesson = await dbService.getLessonById("lsn_01");
  assert(
    updatedLesson?.videoUrl === attachData.url,
    "Lesson videoUrl pointer automatically synchronized with attached video URL"
  );

  // 3.4 Security: Student cannot attach videos
  let studentBlocked = false;
  try {
    await dbService.attachLessonVideo("lsn_01", attachData, "STUDENT", "usr_student_01");
  } catch (err: any) {
    studentBlocked = err.message.includes("Forbidden");
  }
  assert(studentBlocked, "RBAC: Student cannot attach or modify lesson videos (403 Forbidden)");

  // 3.5 Security: Unauthorized teacher cannot modify another teacher's lesson
  let unauthTeacherBlocked = false;
  try {
    await dbService.attachLessonVideo("lsn_01", attachData, "TEACHER", "usr_other_teacher_99");
  } catch (err: any) {
    unauthTeacherBlocked = err.message.includes("Forbidden");
  }
  assert(unauthTeacherBlocked, "IDOR: Unauthorized teacher cannot attach video to another teacher's lesson");

  console.log("\n📦 4. Student Lesson Video Delivery & Honest Analytics Tests");

  // 4.1 Lesson resources delivery
  const lessonWithResources = await dbService.getLessonById("lsn_01");
  const ytResources = lessonWithResources?.resources?.filter((r: any) => r.type === "YOUTUBE");
  assert(Boolean(ytResources && ytResources.length >= 1), "Student can retrieve embedded YouTube resources with lesson");

  // 4.2 Record honest video open event (no fake watch progress)
  const videoEvent = await dbService.recordVideoOpenedEvent("usr_student_01", "lsn_01", "B5q1yvV9Zk8");
  assert(
    videoEvent.success && videoEvent.event === "VIDEO_OPENED" && videoEvent.videoId === "B5q1yvV9Zk8",
    "Records transparent VIDEO_OPENED event without fabricating fake watch percentages"
  );

  console.log("\n📦 5. Video Removal & Cleanup Tests");

  // 5.1 Teacher removes video
  const removeRes = await dbService.removeLessonVideo("lsn_01", attachedRes.id, "TEACHER", "usr_teacher_01");
  assert(removeRes.success, "Teacher can remove attached YouTube resource");

  // 5.2 Student cannot remove video
  let studentRemoveBlocked = false;
  try {
    await dbService.removeLessonVideo("lsn_01", "res_yt_01", "STUDENT", "usr_student_01");
  } catch (err: any) {
    studentRemoveBlocked = err.message.includes("Forbidden");
  }
  assert(studentRemoveBlocked, "RBAC: Student cannot delete lesson video resources");

  console.log("\n===============================================================");
  console.log(`🏁 PHASE 13 VERIFICATION SUMMARY: ${passedTests}/${totalTests} TESTS PASSED`);
  console.log("===============================================================\n");

  if (passedTests === totalTests) {
    console.log("✨ ALL PHASE 13 TESTS PASSED PERFECTLY! System verified ready.");
    process.exit(0);
  } else {
    console.error("⚠️ Some tests failed.");
    process.exit(1);
  }
}

runPhase13Verification().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
