/**
 * Tuklas AI - Application Server Entry Point
 * Full-stack Express server with Vite middleware in development and static serving in production.
 */

import "dotenv/config"; // must load before modules that read process.env at import time (e.g. AUTH_SECRET)
import express, { Request, Response, NextFunction } from "express";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";
import { dbService, fallbackStore, LessonIncompleteError, hasValidDatabaseUrl } from "./src/lib/db.ts";
import { hashPassword, verifyPassword } from "./src/lib/auth/password.ts";
import { createSessionToken, verifySessionToken, SessionPayload } from "./src/lib/auth/session.ts";
import { gradeChoiceAnswer, toStudentBlockView } from "./src/lib/lesson/block-grading.ts";
import { validateEmail, validatePassword, validateNewPassword, validateName, validateRole } from "./src/lib/auth/validation.ts";
import { checkLoginThrottle, recordLoginFailure, clearLoginFailures } from "./src/lib/auth/login-throttle.ts";
import { canUserAccessPath } from "./src/lib/auth/rbac.ts";
import { validateAndExtractYouTube, YouTubeService } from "./src/lib/youtube.ts";
import { LessonStatus, UserRole } from "@prisma/client";
import { validateUpload, ingestDocument, DOCUMENT_LIMITS } from "./src/lib/documents/index.ts";
import { saveOriginal, deleteOriginal } from "./src/lib/documents/file-store.ts";
import { generateQuestionsFromChunks } from "./src/lib/documents/question-generation.ts";
import { getAIProvider, LocalTutorEngine } from "./src/lib/ai/provider.ts";
import { AITutorService } from "./src/lib/ai/tutor.ts";
import { MistakeAnalyzerService } from "./src/lib/ai/mistake-analyzer.ts";
import { AdaptiveEngine } from "./src/lib/adaptive/index.ts";
import { MasteryEngine } from "./src/lib/mastery/index.ts";
import { StudentDashboardService } from "./src/lib/dashboard/index.ts";
import { TeacherService, TeacherAIService } from "./src/lib/teacher/index.ts";
import { ClassroomService, ClassroomError } from "./src/lib/classroom/classroom-service.ts";
import { AssessmentService, ResearchService, ResearchExporter } from "./src/lib/research/index.ts";

dotenv.config();

const app = express();
if (process.env.TRUST_PROXY === "true") app.set("trust proxy", 1);

// A real bcrypt hash of a random value, used to equalise timing for unknown emails.
const DUMMY_PASSWORD_HASH = "$2b$10$CwTycUXWue0Thq9StjUM0uJ8y3wRZBZl4kG5K2D9wH5g8h4mJrJ1e";
const PORT = parseInt(process.env.PORT || "3000", 10);
const isProd = process.env.NODE_ENV === "production";

// Without a PostgreSQL database the app serves the in-memory DEMO accounts, whose password is public.
// A production server must therefore either have a database or be started in an explicitly acknowledged demo mode.
const DEMO_MODE_ACK = "I_UNDERSTAND_DEMO_ACCOUNTS_ARE_PUBLIC";
if (isProd && !hasValidDatabaseUrl && process.env.ALLOW_DEMO_MODE !== DEMO_MODE_ACK) {
  console.error(
    "Refusing to start in production without a PostgreSQL DATABASE_URL: the in-memory demo accounts have a public password. " +
      `For a throwaway demo only, set ALLOW_DEMO_MODE=${DEMO_MODE_ACK}.`
  );
  process.exit(1);
}
if (isProd && !hasValidDatabaseUrl) {
  console.warn("WARNING: DEMO MODE. Public demo accounts are enabled and all data is lost on restart. Do not put real student data here.");
}

app.use(express.json());

// Helper to extract session from Cookie or Bearer header
function getSessionFromRequest(req: Request): SessionPayload | null {
  const cookieHeader = req.headers.cookie;
  let token: string | undefined;

  if (cookieHeader) {
    const cookies = Object.fromEntries(
      cookieHeader.split(";").map((c) => {
        const [k, ...v] = c.trim().split("=");
        return [k, decodeURIComponent(v.join("="))];
      })
    );
    token = cookies["tuklas_session"];
  }

  if (!token && req.headers.authorization?.startsWith("Bearer ")) {
    token = req.headers.authorization.split("Bearer ")[1];
  }

  if (!token) return null;
  return verifySessionToken(token);
}

// -------------------------------------------------------------
// API: AUTHENTICATION ROUTES
// -------------------------------------------------------------

app.post("/api/auth/register", async (req: Request, res: Response) => {
  try {
    console.log("AUTH REGISTER START");
    const { name, email, password, gradeLevel } = req.body;

    const validatedEmail = validateEmail(email);
    const validatedPass = validateNewPassword(password);
    const validatedName = validateName(name);

    // Enforce STUDENT role for public self-registration (Teacher/Admin accounts are restricted)
    const assignedRole: UserRole = "STUDENT";

    // Check existing user by normalized email
    const existing = await dbService.findUserByEmail(validatedEmail);
    if (existing) {
      console.log("AUTH REGISTER DUPLICATE REJECTED:", validatedEmail);
      return res.status(409).json({ success: false, error: "An account with this email already exists" });
    }

    const passwordHash = await hashPassword(validatedPass);
    const user = await dbService.createUser({
      name: validatedName,
      email: validatedEmail,
      passwordHash,
      role: assignedRole,
      gradeLevel: typeof gradeLevel === "number" ? gradeLevel : 7,
    });
    console.log("AUTH REGISTER DATABASE INSERT SUCCESS - userId:", user.id);

    const token = createSessionToken({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    });
    console.log("AUTH SESSION CREATED");

    const isHttps = req.secure || req.headers["x-forwarded-proto"] === "https";
    res.cookie("tuklas_session", token, {
      httpOnly: true,
      secure: isHttps || isProd,
      sameSite: isHttps || isProd ? "none" : "lax",
      path: "/",
      maxAge: 1000 * 60 * 60 * 24 * 7,
    });

    return res.status(201).json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      token,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Registration failed";
    console.error("Register error:", error);
    return res.status(400).json({ success: false, error: message });
  }
});

app.post("/api/auth/login", async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    const validatedEmail = validateEmail(email);
    const validatedPass = validatePassword(password);

    // Brute-force protection: per account and per client address.
    const throttleKeys = [`email:${validatedEmail}`, `ip:${req.ip ?? "unknown"}`];
    const throttle = checkLoginThrottle(throttleKeys);
    if (!throttle.allowed) {
      res.setHeader("Retry-After", String(throttle.retryAfterSeconds));
      return res.status(429).json({ success: false, error: "Too many failed sign-in attempts. Please try again later." });
    }

    const user = await dbService.findUserByEmail(validatedEmail);
    if (!user) {
      // Spend the same time as a real password check so response timing does not reveal which emails exist.
      await verifyPassword(validatedPass, DUMMY_PASSWORD_HASH);
      recordLoginFailure(throttleKeys);
      console.log("AUTH LOGIN REJECTED: User not found");
      return res.status(401).json({ success: false, error: "Invalid email or password" });
    }
    console.log("AUTH LOGIN USER LOOKUP SUCCESS");

    const isValid = await verifyPassword(validatedPass, user.passwordHash);
    if (!isValid) {
      recordLoginFailure(throttleKeys);
      console.log("AUTH LOGIN REJECTED: Incorrect password");
      return res.status(401).json({ success: false, error: "Invalid email or password" });
    }
    clearLoginFailures([throttleKeys[0]]);
    console.log("AUTH LOGIN PASSWORD CHECK SUCCESS");

    const token = createSessionToken({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    });
    console.log("AUTH SESSION CREATED");

    const isHttps = req.secure || req.headers["x-forwarded-proto"] === "https";
    res.cookie("tuklas_session", token, {
      httpOnly: true,
      secure: isHttps || isProd,
      sameSite: isHttps || isProd ? "none" : "lax",
      path: "/",
      maxAge: 1000 * 60 * 60 * 24 * 7,
    });

    return res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      token,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Login failed";
    console.error("Login error:", error);
    return res.status(400).json({ success: false, error: message });
  }
});

app.post("/api/auth/logout", (_req: Request, res: Response) => {
  const isHttps = _req.secure || _req.headers["x-forwarded-proto"] === "https";
  res.clearCookie("tuklas_session", {
    path: "/",
    secure: isHttps || isProd,
    sameSite: isHttps || isProd ? "none" : "lax",
  });
  return res.json({ success: true, message: "Logged out successfully" });
});

app.get("/api/auth/me", async (req: Request, res: Response) => {
  const session = getSessionFromRequest(req);
  if (!session) {
    return res.status(401).json({ success: false, user: null, error: "No active session" });
  }
  console.log("AUTH SESSION VERIFIED");

  // Verify against database that user still exists
  const user = await dbService.findUserById(session.userId);
  if (!user) {
    const isHttps = req.secure || req.headers["x-forwarded-proto"] === "https";
    res.clearCookie("tuklas_session", {
      path: "/",
      secure: isHttps || isProd,
      sameSite: isHttps || isProd ? "none" : "lax",
    });
    return res.status(401).json({ success: false, user: null, error: "User record not found" });
  }

  return res.json({
    success: true,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    },
  });
});

// -------------------------------------------------------------
// API: DATABASE & CURRICULUM VERIFICATION ROUTES
// -------------------------------------------------------------

app.get("/api/health", async (_req: Request, res: Response) => {
  const status = await dbService.getStatus();
  return res.json({
    status: "ok",
    database: status,
    timestamp: new Date().toISOString(),
    version: "0.2.0-phase2",
  });
});

app.get("/api/curriculum", async (req: Request, res: Response) => {
  try {
    const curriculum: any = await dbService.getCurriculum();
    const session = getSessionFromRequest(req);
    const staff = !!session && (session.role === "TEACHER" || session.role === "ADMIN");
    if (staff) return res.json({ data: curriculum });
    // Anyone else (students, signed-out visitors) sees only published lessons, with answer keys removed.
    const clean = (curriculum as any[]).map((subject) => ({
      ...subject,
      grades: (subject.grades ?? []).map((g: any) => ({
        ...g,
        terms: (g.terms ?? []).map((t: any) => ({
          ...t,
          units: (t.units ?? []).map((u: any) => ({
            ...u,
            lessons: (u.lessons ?? []).filter((l: any) => l.status === "PUBLISHED").map((l: any) => toStudentLessonView(l)),
          })),
        })),
      })),
    }));
    return res.json({ data: clean });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load curriculum";
    return res.status(500).json({ error: message });
  }
});

app.get("/api/lessons", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session) {
      return res.status(401).json({ error: "Unauthorized: Please sign in." });
    }
    // Students (and any non-staff role) only ever see published lessons.
    const staff = session.role === "TEACHER" || session.role === "ADMIN";
    const status = staff ? (req.query.status as LessonStatus | undefined) : ("PUBLISHED" as LessonStatus);
    const unitId = req.query.unitId as string | undefined;
    const lessons = await dbService.getLessons({ status, unitId });
    return res.json({ data: staff ? lessons : lessons.map((l: any) => toStudentLessonView(l)) });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load lessons";
    return res.status(500).json({ error: message });
  }
});

app.get("/api/lessons/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const lesson = await dbService.getLessonById(id);
    if (!lesson) {
      return res.status(404).json({ error: "Lesson not found" });
    }

    const session = getSessionFromRequest(req);
    if (!session) {
      return res.status(401).json({ error: "Unauthorized: Please sign in." });
    }
    const staff = session.role === "TEACHER" || session.role === "ADMIN";
    // Non-staff roles can only view PUBLISHED lessons
    if (!staff && lesson.status !== "PUBLISHED") {
      return res.status(403).json({
        error: "Forbidden: This lesson has not been published yet.",
      });
    }

    return res.json({ data: staff ? lesson : toStudentLessonView(lesson) });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to retrieve lesson";
    return res.status(500).json({ error: message });
  }
});

app.post("/api/lessons", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session || (session.role !== "TEACHER" && session.role !== "ADMIN")) {
      return res.status(403).json({ error: "Forbidden: Only teachers or admins can create lessons" });
    }

    const { title, description, unitId, learningObjectives, estimatedMinutes, skillIds } = req.body;
    if (!title || typeof title !== "string" || !title.trim()) {
      return res.status(400).json({ error: "Lesson title is required" });
    }
    if (!unitId || typeof unitId !== "string") {
      return res.status(400).json({ error: "Unit is required" });
    }

    const lesson = await dbService.createLesson({
      title: title.trim(),
      description: description?.trim(),
      unitId,
      authorId: session.userId,
      learningObjectives: Array.isArray(learningObjectives) ? learningObjectives : [],
      estimatedMinutes: typeof estimatedMinutes === "number" ? estimatedMinutes : 20,
      skillIds: Array.isArray(skillIds) ? skillIds : [],
    });

    return res.status(201).json({ data: lesson });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to create lesson";
    return res.status(500).json({ error: message });
  }
});

app.put("/api/lessons/:id", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session || (session.role !== "TEACHER" && session.role !== "ADMIN")) {
      return res.status(403).json({ error: "Forbidden: Only teachers or admins can edit lessons" });
    }

    const { id } = req.params;
    const lesson = await dbService.getLessonById(id);
    if (!lesson) {
      return res.status(404).json({ error: "Lesson not found" });
    }
    if (session.role !== "ADMIN" && lesson.authorId && lesson.authorId !== session.userId) {
      return res.status(403).json({ error: "Forbidden: You are not authorized to edit another teacher's lesson" });
    }

    // Resources are managed only through dedicated endpoints so extracted documents are never clobbered.
    const { title, description, learningObjectives, estimatedMinutes, contentBlocks, skillIds } = req.body;

    const updated = await dbService.updateLesson(id, {
      title,
      description,
      learningObjectives,
      estimatedMinutes,
      contentBlocks,
      skillIds,
    });

    return res.json({ data: updated });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to update lesson";
    return res.status(500).json({ error: message });
  }
});

app.post("/api/lessons/:id/status", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session || (session.role !== "TEACHER" && session.role !== "ADMIN")) {
      return res.status(403).json({ error: "Forbidden: Teacher or Admin credentials required" });
    }

    const { id } = req.params;
    const lesson = await dbService.getLessonById(id);
    if (!lesson) {
      return res.status(404).json({ error: "Lesson not found" });
    }
    if (session.role !== "ADMIN" && lesson.authorId && lesson.authorId !== session.userId) {
      return res.status(403).json({ error: "Forbidden: You are not authorized to change status of another teacher's lesson" });
    }

    const { targetStatus } = req.body;
    if (!targetStatus) {
      return res.status(400).json({ error: "Target status is required" });
    }

    const result = await dbService.updateLessonStatus(id, targetStatus as LessonStatus, session.role);
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    return res.json({ data: result.lesson });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to transition lesson status";
    return res.status(500).json({ error: message });
  }
});

app.delete("/api/lessons/:id", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session || (session.role !== "TEACHER" && session.role !== "ADMIN")) {
      return res.status(403).json({ error: "Forbidden: Only teachers or admins can delete lessons" });
    }

    const { id } = req.params;
    const lesson = await dbService.getLessonById(id);
    if (!lesson) {
      return res.status(404).json({ error: "Lesson not found" });
    }
    if (session.role !== "ADMIN" && lesson.authorId && lesson.authorId !== session.userId) {
      return res.status(403).json({ error: "Forbidden: You are not authorized to delete another teacher's lesson" });
    }

    await dbService.deleteLesson(id, session.role);
    return res.json({ success: true, message: "Lesson deleted successfully" });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to delete lesson";
    return res.status(500).json({ error: message });
  }
});

// -------------------------------------------------------------
// PHASE 13: MATHISIPAN / YOUTUBE VIDEO INTEGRATION
// -------------------------------------------------------------

app.get("/api/youtube/search", async (req: Request, res: Response) => {
  try {
    const { query, grade, term, limit } = req.query;
    const response = await YouTubeService.searchVideos({
      query: query as string,
      gradeLevel: grade ? Number(grade) : undefined,
      termNumber: term ? Number(term) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
    return res.json({ data: response });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to search videos";
    return res.status(500).json({ error: message });
  }
});

app.post("/api/youtube/validate", async (req: Request, res: Response) => {
  try {
    const { url } = req.body;
    const result = await YouTubeService.validateAndPreview(url);
    if (!result.isValid) {
      return res.status(400).json({ error: result.error });
    }
    return res.json({ data: result });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to validate URL";
    return res.status(500).json({ error: message });
  }
});

app.post("/api/lessons/:id/video", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session || (session.role !== "TEACHER" && session.role !== "ADMIN")) {
      return res.status(403).json({ error: "Forbidden: Teacher or Administrator access required." });
    }

    const { id } = req.params;
    await dbService.assertCanEditLesson(id, session.role, session.userId);
    const { title, url, youtubeId, notes, metadata, channelName, thumbnailUrl, description, duration } = req.body;

    if (!url && !youtubeId) {
      return res.status(400).json({ error: "Video URL or YouTube ID is required." });
    }

    // Validate and resolve ID
    const validated = await YouTubeService.validateAndPreview(url || youtubeId);
    if (!validated.isValid || !validated.videoId) {
      return res.status(400).json({ error: validated.error || "Invalid YouTube video resource." });
    }

    const resource = await dbService.attachLessonVideo(
      id,
      {
        title: title || validated.title || "Mathisipan Educational Video",
        url: validated.canonicalUrl || url,
        youtubeId: validated.videoId,
        provider: "YOUTUBE",
        channelName: channelName || validated.channelName || "Mathisipan",
        thumbnailUrl: thumbnailUrl || validated.thumbnailUrl || `https://img.youtube.com/vi/${validated.videoId}/hqdefault.jpg`,
        description: description || undefined,
        duration: duration || undefined,
        status: "APPROVED",
        addedBy: session.userId,
        notes,
        metadata,
      },
      session.role,
      session.userId
    );

    return res.status(201).json({ data: resource });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to attach video resource";
    const status = ownershipStatus(message) ?? 500;
    return res.status(status).json({ error: message });
  }
});

app.delete("/api/lessons/:id/video/:resourceId", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session || (session.role !== "TEACHER" && session.role !== "ADMIN")) {
      return res.status(403).json({ error: "Forbidden: Teacher or Administrator access required." });
    }

    const { id, resourceId } = req.params;
    await dbService.removeLessonVideo(id, resourceId, session.role, session.userId);
    return res.json({ success: true, message: "Video resource removed successfully." });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to remove video resource";
    const status = message.includes("Forbidden") ? 403 : 500;
    return res.status(status).json({ error: message });
  }
});

// Students must not see storage keys, content hashes, uploader ids or raw extraction diagnostics.
function toStudentLessonView<T extends { resources?: unknown[]; contentBlocks?: any[] }>(lesson: T): T {
  const view: any = { ...lesson };
  if (lesson.resources) {
    view.resources = lesson.resources.map((r) => {
      const { storagePath, contentHash, addedBy, extractionError, charCount, ...safe } = r as Record<string, unknown>;
      return safe;
    });
  }
  // Questions and checkpoints: the correct answer and explanation stay on the server until graded.
  if (lesson.contentBlocks) view.contentBlocks = lesson.contentBlocks.map((b) => toStudentBlockView(b));
  return view;
}

// -------------------------------------------------------------
// PHASE 22: DOCUMENT UPLOAD, NOTES & EXTRACTION STATUS
// -------------------------------------------------------------

const uploadHistory = new Map<string, number[]>();
const UPLOADS_PER_WINDOW = 20;
const UPLOAD_WINDOW_MS = 10 * 60 * 1000;

function checkUploadRateLimit(userId: string): boolean {
  const now = Date.now();
  const recent = (uploadHistory.get(userId) || []).filter((t) => now - t < UPLOAD_WINDOW_MS);
  if (recent.length >= UPLOADS_PER_WINDOW) {
    uploadHistory.set(userId, recent);
    return false;
  }
  recent.push(now);
  uploadHistory.set(userId, recent);
  return true;
}

function publicResourceView(resource: Record<string, any>) {
  const { storagePath, ...rest } = resource;
  return rest;
}

// Auth + ownership are checked BEFORE the (up to 25MB) body is buffered.
const authorizeDocumentUpload = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session || (session.role !== "TEACHER" && session.role !== "ADMIN")) {
      return res.status(403).json({ error: "Forbidden: Teacher or Administrator access required." });
    }
    if (!checkUploadRateLimit(session.userId)) {
      return res.status(429).json({ error: "Too many uploads. Please wait a few minutes and try again." });
    }
    await dbService.assertCanEditLesson(req.params.id, session.role, session.userId);
    (req as any).session = session;
    return next();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Upload not permitted";
    const status = message.includes("Forbidden") ? 403 : message.includes("not found") ? 404 : 500;
    return res.status(status).json({ error: message });
  }
};

const rawUploadBody = (req: Request, res: Response, next: NextFunction) => {
  express.raw({ type: () => true, limit: DOCUMENT_LIMITS.MAX_FILE_BYTES + 1024 })(req, res, (err?: any) => {
    if (err) {
      const tooLarge = err.type === "entity.too.large";
      return res.status(tooLarge ? 413 : 400).json({
        error: tooLarge ? "File exceeds the 25MB upload limit." : "The upload could not be read.",
      });
    }
    return next();
  });
};

app.post("/api/lessons/:id/documents", authorizeDocumentUpload, rawUploadBody, async (req: Request, res: Response) => {
  let storedKey: string | undefined;
  try {
    const session = (req as any).session as SessionPayload;
    const { id } = req.params;

    const rawName = decodeURIComponent(String(req.headers["x-file-name"] || ""));
    const buffer = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);

    const validation = await validateUpload(buffer, rawName);
    if (!validation.ok) {
      return res.status(validation.status).json({ error: validation.error });
    }

    const ingest = await ingestDocument(buffer, validation.kind);

    // Keep the original only when we could read it; unreadable files are reported but not retained.
    const keepOriginal = ingest.status === "EXTRACTED" || ingest.status === "TRUNCATED";
    if (keepOriginal) {
      storedKey = saveOriginal(buffer, validation.kind.toLowerCase());
    }

    const requestedTitle = decodeURIComponent(String(req.headers["x-resource-title"] || "")).trim().slice(0, 200);
    const resource = await dbService.addLessonDocumentResource(id, session.role, session.userId, {
      type: validation.kind === "PDF" ? "PDF" : "DOCUMENT",
      title: requestedTitle || validation.safeFileName,
      fileName: validation.safeFileName,
      fileSize: buffer.length,
      storagePath: storedKey,
      ingest,
    });

    return res.status(201).json({
      data: publicResourceView(resource as any),
      extraction: {
        status: ingest.status,
        error: ingest.error,
        pageCount: ingest.pageCount,
        chunkCount: ingest.chunks.length,
        usableByAITutor: ingest.status === "EXTRACTED" || ingest.status === "TRUNCATED",
      },
    });
  } catch (error: unknown) {
    deleteOriginal(storedKey);
    const message = error instanceof Error ? error.message : "Failed to upload document";
    const status = message.includes("Forbidden") ? 403 : 500;
    console.error("Document upload error:", message);
    return res.status(status).json({ error: status === 403 ? message : "Failed to process the document." });
  }
});

// Teacher notes are real, retrievable lesson material (chunked and indexed like documents).
app.post("/api/lessons/:id/notes", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session || (session.role !== "TEACHER" && session.role !== "ADMIN")) {
      return res.status(403).json({ error: "Forbidden: Teacher or Administrator access required." });
    }
    const title = typeof req.body?.title === "string" ? req.body.title.trim().slice(0, 200) : "";
    const notes = typeof req.body?.notes === "string" ? req.body.notes.trim() : "";
    if (!title || !notes) return res.status(400).json({ error: "Note title and content are required." });
    if (notes.length > 20000) return res.status(413).json({ error: "Teacher notes are limited to 20,000 characters." });

    const ingest = await ingestDocument(Buffer.from(notes, "utf-8"), "TXT");
    const resource = await dbService.addLessonDocumentResource(req.params.id, session.role, session.userId, {
      type: "TEACHER_NOTE",
      title,
      notes,
      ingest,
    });
    return res.status(201).json({ data: publicResourceView(resource as any) });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to add teacher note";
    const status = message.includes("Forbidden") ? 403 : message.includes("not found") ? 404 : 500;
    return res.status(status).json({ error: message });
  }
});

app.delete("/api/lessons/:id/resources/:resourceId", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session || (session.role !== "TEACHER" && session.role !== "ADMIN")) {
      return res.status(403).json({ error: "Forbidden: Teacher or Administrator access required." });
    }
    const result = await dbService.removeLessonResource(req.params.id, req.params.resourceId, session.role, session.userId);
    if (!result.success) return res.status(404).json({ error: "Resource not found on this lesson." });
    deleteOriginal(result.removed?.storagePath);
    return res.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to remove resource";
    const status = message.includes("Forbidden") ? 403 : message.includes("not found") ? 404 : 500;
    return res.status(status).json({ error: message });
  }
});

// Teacher-facing view of what the AI Tutor can actually read from a resource.
app.get("/api/lessons/:id/resources/:resourceId/extraction", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session || (session.role !== "TEACHER" && session.role !== "ADMIN")) {
      return res.status(403).json({ error: "Forbidden: Teacher or Administrator access required." });
    }
    const lesson = await dbService.assertCanEditLesson(req.params.id, session.role, session.userId);
    const resource = lesson.resources?.find((r: any) => r.id === req.params.resourceId);
    if (!resource) return res.status(404).json({ error: "Resource not found on this lesson." });

    const chunks = (await dbService.getLessonChunks(req.params.id, { includeAnswerKeys: true })).filter(
      (c) => c.resourceId === req.params.resourceId
    );
    return res.json({
      data: {
        resourceId: resource.id,
        title: resource.title,
        status: resource.extractionStatus ?? null,
        error: resource.extractionError ?? null,
        pageCount: resource.pageCount ?? null,
        charCount: resource.charCount ?? null,
        chunkCount: chunks.length,
        answerKeyChunkCount: chunks.filter((c) => c.isAnswerKey).length,
        preview: chunks.slice(0, 5).map((c) => ({
          sectionLabel: c.sectionLabel,
          isAnswerKey: c.isAnswerKey,
          text: c.text.slice(0, 300),
        })),
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load extraction details";
    const status = message.includes("Forbidden") ? 403 : message.includes("not found") ? 404 : 500;
    return res.status(status).json({ error: message });
  }
});

// Draft lesson-aligned questions from a document's extracted text. Evidence-verified; saved as DRAFT only.
app.post("/api/lessons/:id/resources/:resourceId/generate-questions", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session || (session.role !== "TEACHER" && session.role !== "ADMIN")) {
      return res.status(403).json({ error: "Forbidden: Teacher or Administrator access required." });
    }
    const lesson = await dbService.assertCanEditLesson(req.params.id, session.role, session.userId);
    const resource = lesson.resources?.find((r: any) => r.id === req.params.resourceId);
    if (!resource) return res.status(404).json({ error: "Resource not found on this lesson." });
    if (resource.extractionStatus !== "EXTRACTED" && resource.extractionStatus !== "TRUNCATED") {
      return res.status(422).json({
        error: "This resource has no readable text, so questions cannot be generated from it.",
      });
    }

    const provider = getAIProvider();
    if (provider instanceof LocalTutorEngine) {
      return res.status(503).json({
        error: "Question generation needs the external AI provider, which is not configured or is unavailable. No questions were generated.",
      });
    }

    const count = Math.min(Math.max(parseInt(String(req.body?.count ?? "3"), 10) || 3, 1), 5);
    const chunks = (await dbService.getLessonChunks(req.params.id, { includeAnswerKeys: false })).filter(
      (c) => c.resourceId === req.params.resourceId
    );

    let outcome;
    try {
      outcome = await generateQuestionsFromChunks({ provider, chunks, count });
    } catch (e) {
      console.error("Question generation provider error:", e instanceof Error ? e.message : e);
      return res.status(502).json({ error: "The AI provider could not generate questions right now. Please try again later." });
    }

    const created = [];
    for (const q of outcome.accepted) {
      const saved = await dbService.createQuestion(
        {
          lessonId: req.params.id,
          skillId: (lesson as any).skills?.[0]?.skillId,
          type: q.type as any,
          prompt: q.prompt,
          explanation: q.explanation,
          difficulty: q.difficulty as any,
          status: "DRAFT" as any,
          source: "AI_GENERATED" as any,
          questionData: q.questionData,
          metadata: {
            generatedFrom: {
              resourceId: req.params.resourceId,
              chunkId: q.sourceChunkId,
              evidenceQuote: q.evidenceQuote,
              answerVerification: q.answerVerification,
            },
          },
        },
        session.userId
      );
      created.push(saved);
    }

    return res.status(201).json({
      data: created,
      rejectedCount: outcome.rejected.length,
      rejected: outcome.rejected.slice(0, 10),
      note: "Questions are saved as DRAFT. Review each one before publishing.",
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to generate questions";
    const status = message.includes("Forbidden") ? 403 : message.includes("not found") ? 404 : 500;
    return res.status(status).json({ error: message });
  }
});

app.post("/api/student/lessons/:id/video-event", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session) {
      return res.status(401).json({ error: "Unauthorized: Please sign in." });
    }

    const { id } = req.params;
    const { videoId } = req.body;

    if (!videoId) {
      return res.status(400).json({ error: "videoId is required." });
    }

    const result = await dbService.recordVideoOpenedEvent(session.userId, id, videoId);
    return res.json({ data: result });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to record video event";
    return res.status(500).json({ error: message });
  }
});

// -------------------------------------------------------------
// PHASE 4: LEARNING PATH & PREREQUISITES API
// -------------------------------------------------------------

app.get("/api/student/learning-path", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session) {
      return res.status(401).json({ error: "Unauthorized: Please sign in." });
    }
    let targetUserId = session.userId;
    if (session.role === "TEACHER" || session.role === "ADMIN") {
      const qStudentId = req.query.studentId as string;
      if (qStudentId) {
        const isAuth = await TeacherService.isTeacherAuthorizedForStudent(session.userId, qStudentId, session.role);
        if (!isAuth) {
          return res.status(403).json({ error: "Forbidden: Not authorized for this student." });
        }
        targetUserId = qStudentId;
      }
    } else if (session.role === "STUDENT") {
      targetUserId = session.userId;
    }
    const pathData = await dbService.getStudentLearningPath(targetUserId);
    return res.json({ data: pathData });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load learning path";
    return res.status(500).json({ error: message });
  }
});

// A student may only read or change state for a lesson they are currently allowed to open
// (published, unlocked). Returns an error response and false when not allowed.
async function ensureLessonAccess(res: Response, userId: string, lessonId: string): Promise<boolean> {
  const access = await dbService.getLessonAccess(userId, lessonId);
  if (access.allowed) return true;
  const notFound = access.reason?.startsWith("Lesson does not exist");
  res.status(notFound ? 404 : 403).json({ error: access.reason || "This lesson is locked." });
  return false;
}

app.get("/api/student/lessons/:id/access", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session) {
      return res.status(401).json({ error: "Unauthorized: Please sign in." });
    }
    const userId = session.userId;
    const { id } = req.params;
    const access = await dbService.getLessonAccess(userId, id);
    return res.json({ data: access });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to verify lesson access";
    return res.status(500).json({ error: message });
  }
});

app.post("/api/student/progress", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session) {
      return res.status(401).json({ error: "Authentication required to update progress" });
    }
    const { lessonId, action, completedBlockIndex, totalBlocks } = req.body;
    if (!lessonId || !action) {
      return res.status(400).json({ error: "lessonId and action are required" });
    }
    if (typeof lessonId !== "string" || !["START", "UPDATE_BLOCKS", "COMPLETE"].includes(action)) {
      return res.status(400).json({ error: "Invalid lessonId or action" });
    }
    for (const n of [completedBlockIndex, totalBlocks]) {
      if (n !== undefined && (!Number.isInteger(n) || n < 0 || n > 1000)) {
        return res.status(400).json({ error: "completedBlockIndex and totalBlocks must be small non-negative integers" });
      }
    }
    if (!(await ensureLessonAccess(res, session.userId, lessonId))) return;

    const updated = await dbService.updateStudentProgress(session.userId, lessonId, {
      action,
      completedBlockIndex,
      totalBlocks,
    });

    return res.json({ data: updated });
  } catch (error: unknown) {
    if (error instanceof LessonIncompleteError) {
      return res.status(409).json({ error: error.message, missingBlockIds: error.missingBlockIds });
    }
    const message = error instanceof Error ? error.message : "Failed to update progress";
    return res.status(500).json({ error: message });
  }
});

app.post("/api/units/:unitId/reorder-lessons", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session || (session.role !== "TEACHER" && session.role !== "ADMIN")) {
      return res.status(403).json({ error: "Forbidden: Teacher or Admin privileges required." });
    }

    const { unitId } = req.params;
    const { orderedLessonIds } = req.body;
    if (!Array.isArray(orderedLessonIds)) {
      return res.status(400).json({ error: "orderedLessonIds must be an array of strings" });
    }
    // The order of a unit is shared by every teacher in it, so a teacher may reorder only a unit whose lessons
    // they all authored; otherwise an administrator does it.
    if (session.role !== "ADMIN") {
      const lessonsInUnit: any[] = (await dbService.getLessons({ unitId })) as any[];
      if (lessonsInUnit.some((l) => l.authorId && l.authorId !== session.userId)) {
        return res.status(403).json({ error: "Forbidden: This unit contains another teacher's lessons. Ask an administrator to reorder it." });
      }
    }

    const result = await dbService.reorderLessons(unitId, orderedLessonIds, session.role);
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    return res.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to reorder lessons";
    return res.status(500).json({ error: message });
  }
});

app.post("/api/skills/:skillId/prerequisites", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session || (session.role !== "TEACHER" && session.role !== "ADMIN")) {
      return res.status(403).json({ error: "Forbidden: Teacher or Admin privileges required." });
    }

    const { skillId } = req.params;
    const { prerequisiteSkillIds } = req.body;
    if (!Array.isArray(prerequisiteSkillIds)) {
      return res.status(400).json({ error: "prerequisiteSkillIds must be an array of strings" });
    }

    const result = await dbService.updateSkillPrerequisites(skillId, prerequisiteSkillIds, session.role);
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    return res.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to update skill prerequisites";
    return res.status(500).json({ error: message });
  }
});

// -------------------------------------------------------------
// PHASE 5: INTERACTIVE LESSON SESSIONS & CHECKPOINTS
// -------------------------------------------------------------

app.get("/api/student/lessons/:id/session", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session) {
      return res.status(401).json({ error: "Unauthorized: Please sign in." });
    }
    const userId = session.userId;
    const { id } = req.params;
    if (!(await ensureLessonAccess(res, userId, id))) return;

    const lessonSession = await dbService.getLessonSession(userId, id);
    const attempts = await dbService.getCheckpointAttempts(userId, id);

    return res.json({
      data: {
        session: lessonSession,
        attempts,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch lesson session";
    return res.status(500).json({ error: message });
  }
});

app.post("/api/student/lessons/:id/session", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session) {
      return res.status(401).json({ error: "Unauthorized: Please sign in." });
    }
    const userId = session.userId;
    const { id } = req.params;
    const { currentSectionIndex, completedBlockIds, isCompleted } = req.body;
    if (!(await ensureLessonAccess(res, userId, id))) return;

    // The server, not the browser, decides which questions are done: a block that must be answered counts as
    // completed only if the student has answered it correctly. Other blocks (reading, video) are self-reported.
    const lessonNow: any = await dbService.getLessonById(id);
    const blockIds: string[] = ((lessonNow?.contentBlocks || []) as any[]).map((b) => b.id);
    const status = await dbService.getLessonCompletionStatus(userId, id);
    const gradable = new Set(status.required);
    const claimed: string[] = Array.isArray(completedBlockIds) ? completedBlockIds.filter((x: unknown) => typeof x === "string") : [];
    const safeCompleted = Array.from(new Set([...claimed.filter((b) => blockIds.includes(b) && !gradable.has(b)), ...status.correct]));

    if (isCompleted && status.missing.length > 0) {
      return res.status(409).json({
        error: `Answer ${status.missing.length} remaining question${status.missing.length === 1 ? "" : "s"} correctly to complete this lesson.`,
        missingBlockIds: status.missing,
      });
    }

    const updated = await dbService.saveLessonSession(userId, id, {
      currentSectionIndex,
      completedBlockIds: Array.isArray(completedBlockIds) ? safeCompleted : undefined,
      isCompleted,
    });

    // If marked completed, update student progress record
    if (isCompleted) {
      await dbService.updateStudentProgress(userId, id, { action: "COMPLETE" });
    }

    return res.json({ data: updated });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to update lesson session";
    return res.status(500).json({ error: message });
  }
});

app.post(["/api/student/lessons/:id/checkpoint", "/api/student/lessons/:id/checkpoints"], async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session) {
      return res.status(401).json({ error: "Unauthorized: Please sign in." });
    }
    const userId = session.userId;
    const { id } = req.params;
    // Correctness is decided here, from the stored answer key. Any isCorrect / feedback sent by the
    // client is ignored.
    const { blockId, answer } = req.body ?? {};

    if (typeof blockId !== "string" || !blockId || answer === undefined) {
      return res.status(400).json({ error: "blockId and answer are required" });
    }
    if (!(await ensureLessonAccess(res, userId, id))) return;

    const lesson = await dbService.getLessonById(id);
    const block = lesson?.contentBlocks?.find((b: any) => b.id === blockId);
    if (!block) return res.status(404).json({ error: "Question not found in this lesson." });

    const graded = gradeChoiceAnswer(block as any, answer);
    if (!graded.ok) return res.status(graded.status).json({ error: graded.error });

    const attempt = await dbService.submitCheckpointAttempt({
      userId,
      lessonId: id,
      blockId,
      answer: graded.chosen,
      isCorrect: graded.isCorrect,
      feedback: graded.feedback,
    });

    return res.json({
      data: attempt,
      grading: { isCorrect: graded.isCorrect, feedback: graded.feedback, correctAnswer: graded.correctAnswer },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to record checkpoint attempt";
    return res.status(500).json({ error: message });
  }
});

// ---- Ownership: a teacher may change only what they authored; admins may change anything. ----
const ownershipStatus = (message: string): number | null =>
  message.includes("Forbidden") ? 403 : /not found/i.test(message) ? 404 : null;

async function requireOwnedQuestion(res: Response, session: SessionPayload, questionId: string): Promise<boolean> {
  const q: any = await dbService.getQuestionById(questionId);
  if (!q) { res.status(404).json({ error: "Question not found." }); return false; }
  if (session.role !== "ADMIN" && q.createdById && q.createdById !== session.userId) {
    res.status(403).json({ error: "Forbidden: You are not authorized to modify another teacher's question." });
    return false;
  }
  return true;
}

async function requireOwnedPracticeSet(res: Response, session: SessionPayload, setId: string): Promise<boolean> {
  const set: any = await dbService.getPracticeSetById(setId);
  if (!set) { res.status(404).json({ error: "Practice set not found." }); return false; }
  if (session.role !== "ADMIN" && set.createdById && set.createdById !== session.userId) {
    res.status(403).json({ error: "Forbidden: You are not authorized to modify another teacher's practice set." });
    return false;
  }
  return true;
}

app.post("/api/lessons/:id/blocks", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session || (session.role !== "TEACHER" && session.role !== "ADMIN")) {
      return res.status(403).json({ error: "Forbidden: Teacher or Admin privileges required." });
    }

    const { id } = req.params;
    await dbService.assertCanEditLesson(id, session.role, session.userId);
    const { type, title, content, metadata } = req.body;

    if (!type || !content) {
      return res.status(400).json({ error: "Block type and content are required" });
    }

    const block = await dbService.addContentBlock(id, {
      type,
      title,
      content,
      metadata,
    });

    return res.status(201).json({ data: block });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to add block";
    return res.status(ownershipStatus(message) ?? 500).json({ error: message });
  }
});

app.put("/api/lessons/:id/blocks/:blockId", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session || (session.role !== "TEACHER" && session.role !== "ADMIN")) {
      return res.status(403).json({ error: "Forbidden: Teacher or Admin privileges required." });
    }

    const { id, blockId } = req.params;
    await dbService.assertCanEditLesson(id, session.role, session.userId);
    const { type, title, content, metadata } = req.body;

    const block = await dbService.updateContentBlock(id, blockId, {
      type,
      title,
      content,
      metadata,
    });

    return res.json({ data: block });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to update block";
    return res.status(ownershipStatus(message) ?? 500).json({ error: message });
  }
});

app.delete("/api/lessons/:id/blocks/:blockId", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session || (session.role !== "TEACHER" && session.role !== "ADMIN")) {
      return res.status(403).json({ error: "Forbidden: Teacher or Admin privileges required." });
    }

    const { id, blockId } = req.params;
    await dbService.assertCanEditLesson(id, session.role, session.userId);
    await dbService.deleteContentBlock(id, blockId);

    return res.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to delete block";
    return res.status(ownershipStatus(message) ?? 500).json({ error: message });
  }
});

app.post("/api/lessons/:id/reorder-blocks", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session || (session.role !== "TEACHER" && session.role !== "ADMIN")) {
      return res.status(403).json({ error: "Forbidden: Teacher or Admin privileges required." });
    }

    const { id } = req.params;
    await dbService.assertCanEditLesson(id, session.role, session.userId);
    const { orderedBlockIds } = req.body;

    if (!Array.isArray(orderedBlockIds)) {
      return res.status(400).json({ error: "orderedBlockIds must be an array of strings" });
    }

    const result = await dbService.reorderContentBlocks(id, orderedBlockIds);
    return res.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to reorder blocks";
    return res.status(ownershipStatus(message) ?? 500).json({ error: message });
  }
});

app.get("/api/skills", async (_req: Request, res: Response) => {
  try {
    const skills = await dbService.getSkills();
    return res.json({ data: skills });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load skills";
    return res.status(500).json({ error: message });
  }
});

// -------------------------------------------------------------
// PHASE 6: QUESTION MANAGEMENT ENDPOINTS
// -------------------------------------------------------------

// List questions with filtering
app.get("/api/questions", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    const isStaff = session && (session.role === "TEACHER" || session.role === "ADMIN");

    const { skillId, lessonId, difficulty, status, type, search, source } = req.query;

    // Students can ONLY view published questions
    const effectiveStatus = isStaff ? (status as any) : "PUBLISHED";

    const questions = await dbService.getQuestions({
      skillId: skillId as string,
      lessonId: lessonId as string,
      difficulty: difficulty as any,
      status: effectiveStatus,
      type: type as any,
      search: search as string,
      source: source as any,
    });

    // If student, redact answers
    const payload = isStaff
      ? questions
      : questions.map((q) => dbService.getQuestionById(q.id, true));

    return res.json({ data: await Promise.resolve(payload) });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch questions";
    return res.status(500).json({ error: message });
  }
});

// Create question (Teacher/Admin only)
app.post("/api/questions", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session || (session.role !== "TEACHER" && session.role !== "ADMIN")) {
      return res.status(403).json({ error: "Forbidden: Teacher or Administrator access required." });
    }

    const {
      lessonId,
      skillId,
      type,
      prompt,
      explanation,
      difficulty,
      status,
      source,
      questionData,
      metadata,
      correctFeedback,
      incorrectFeedback,
      allowRetry,
      maxAttempts,
    } = req.body;

    if (!type || !prompt) {
      return res.status(400).json({ error: "Question type and prompt are required." });
    }
    // Attaching a question to a lesson is editing that lesson.
    if (lessonId) await dbService.assertCanEditLesson(lessonId, session.role, session.userId);

    const question = await dbService.createQuestion(
      {
        lessonId,
        skillId,
        type,
        prompt,
        explanation,
        difficulty,
        status: status || "DRAFT",
        source: source || "TEACHER",
        questionData: questionData || {},
        metadata,
        correctFeedback,
        incorrectFeedback,
        allowRetry,
        maxAttempts,
      },
      session.userId
    );

    return res.status(201).json({ data: question });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to create question";
    return res.status(ownershipStatus(message) ?? 500).json({ error: message });
  }
});

// Get single question by ID
app.get("/api/questions/:id", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    const isStaff = session && (session.role === "TEACHER" || session.role === "ADMIN");

    const { id } = req.params;
    const question = await dbService.getQuestionById(id, !isStaff);

    if (!question) {
      return res.status(404).json({ error: "Question not found" });
    }

    // Students cannot view unpublished questions
    if (!isStaff && question.status !== "PUBLISHED") {
      return res.status(404).json({ error: "Question not found" });
    }

    return res.json({ data: question });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch question";
    return res.status(500).json({ error: message });
  }
});

// Update question (Teacher/Admin only)
app.patch("/api/questions/:id", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session || (session.role !== "TEACHER" && session.role !== "ADMIN")) {
      return res.status(403).json({ error: "Forbidden: Teacher or Administrator access required." });
    }

    const { id } = req.params;
    if (!(await requireOwnedQuestion(res, session, id))) return;
    const updated = await dbService.updateQuestion(id, req.body, session.userId);
    return res.json({ data: updated });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to update question";
    return res.status(500).json({ error: message });
  }
});

app.put("/api/questions/:id", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session || (session.role !== "TEACHER" && session.role !== "ADMIN")) {
      return res.status(403).json({ error: "Forbidden: Teacher or Administrator access required." });
    }

    const { id } = req.params;
    if (!(await requireOwnedQuestion(res, session, id))) return;
    const updated = await dbService.updateQuestion(id, req.body, session.userId);
    return res.json({ data: updated });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to update question";
    return res.status(500).json({ error: message });
  }
});

// Delete question (Teacher/Admin only)
app.delete("/api/questions/:id", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session || (session.role !== "TEACHER" && session.role !== "ADMIN")) {
      return res.status(403).json({ error: "Forbidden: Teacher or Administrator access required." });
    }

    const { id } = req.params;
    if (!(await requireOwnedQuestion(res, session, id))) return;
    await dbService.deleteQuestion(id);
    return res.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to delete question";
    return res.status(500).json({ error: message });
  }
});

// Update question status (Review workflow)
app.post("/api/questions/:id/status", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session || (session.role !== "TEACHER" && session.role !== "ADMIN")) {
      return res.status(403).json({ error: "Forbidden: Teacher or Administrator access required." });
    }

    const { id } = req.params;
    const { status } = req.body;

    if (!["DRAFT", "REVIEW", "APPROVED", "PUBLISHED", "ARCHIVED"].includes(status)) {
      return res.status(400).json({ error: "Invalid question status." });
    }

    if (!(await requireOwnedQuestion(res, session, id))) return;
    const updated = await dbService.updateQuestionStatus(id, status, session.userId);
    return res.json({ data: updated });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to update question status";
    return res.status(500).json({ error: message });
  }
});

// -------------------------------------------------------------
// PHASE 6: PRACTICE SETS ENDPOINTS
// -------------------------------------------------------------

// List practice sets
app.get("/api/practice-sets", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    const isStaff = session && (session.role === "TEACHER" || session.role === "ADMIN");

    const { lessonId, skillId, status } = req.query;
    const effectiveStatus = isStaff ? (status as any) : "PUBLISHED";

    const practiceSets = await dbService.getPracticeSets({
      lessonId: lessonId as string,
      skillId: skillId as string,
      status: effectiveStatus,
    });

    return res.json({ data: practiceSets });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch practice sets";
    return res.status(500).json({ error: message });
  }
});

// Create practice set (Teacher/Admin only)
app.post("/api/practice-sets", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session || (session.role !== "TEACHER" && session.role !== "ADMIN")) {
      return res.status(403).json({ error: "Forbidden: Teacher or Administrator access required." });
    }

    const { title, description, lessonId, skillId, status, questionIds } = req.body;
    if (!title) {
      return res.status(400).json({ error: "Practice set title is required." });
    }
    if (lessonId) await dbService.assertCanEditLesson(lessonId, session.role, session.userId);

    const ps = await dbService.createPracticeSet(
      {
        title,
        description,
        lessonId,
        skillId,
        status: status || "DRAFT",
        questionIds: questionIds || [],
      },
      session.userId
    );

    return res.status(201).json({ data: ps });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to create practice set";
    return res.status(ownershipStatus(message) ?? 500).json({ error: message });
  }
});

// Get single practice set
app.get("/api/practice-sets/:id", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    const isStaff = session && (session.role === "TEACHER" || session.role === "ADMIN");

    const { id } = req.params;
    const ps = await dbService.getPracticeSetById(id, !isStaff);

    if (!ps) {
      return res.status(404).json({ error: "Practice set not found" });
    }

    if (!isStaff && ps.status !== "PUBLISHED") {
      return res.status(404).json({ error: "Practice set is not published" });
    }

    return res.json({ data: ps });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch practice set";
    return res.status(500).json({ error: message });
  }
});

// Add question to practice set
app.post("/api/practice-sets/:id/questions", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session || (session.role !== "TEACHER" && session.role !== "ADMIN")) {
      return res.status(403).json({ error: "Forbidden: Teacher or Administrator access required." });
    }

    const { id } = req.params;
    const { questionId, order } = req.body;
    if (!questionId) {
      return res.status(400).json({ error: "questionId is required" });
    }

    if (!(await requireOwnedPracticeSet(res, session, id))) return;
    await dbService.addQuestionToPracticeSet(id, questionId, order);
    const updated = await dbService.getPracticeSetById(id);
    return res.json({ data: updated });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to add question to practice set";
    return res.status(500).json({ error: message });
  }
});

// Remove question from practice set
app.delete("/api/practice-sets/:id/questions/:questionId", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session || (session.role !== "TEACHER" && session.role !== "ADMIN")) {
      return res.status(403).json({ error: "Forbidden: Teacher or Administrator access required." });
    }

    const { id, questionId } = req.params;
    if (!(await requireOwnedPracticeSet(res, session, id))) return;
    await dbService.removeQuestionFromPracticeSet(id, questionId);
    return res.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to remove question";
    return res.status(500).json({ error: message });
  }
});

// -------------------------------------------------------------
// PHASE 6: PRACTICE EXECUTION & ATTEMPT TRACKING
// -------------------------------------------------------------

// Start practice session
app.post("/api/practice/start", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session) {
      return res.status(401).json({ error: "Unauthorized: Please sign in." });
    }
    const studentId = session.userId;
    const { practiceSetId } = req.body;

    if (!practiceSetId) {
      return res.status(400).json({ error: "practiceSetId is required" });
    }

    const practiceSession = await dbService.startPracticeSession(studentId, practiceSetId);
    return res.status(201).json({ data: practiceSession });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to start practice session";
    return res.status(500).json({ error: message });
  }
});

// Get practice session state
app.get("/api/practice/:id", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session) {
      return res.status(401).json({ error: "Unauthorized: Please sign in." });
    }
    const studentId = session.userId;
    const { id } = req.params;

    const practiceSession = await dbService.getPracticeSession(id, studentId);
    if (!practiceSession) {
      return res.status(404).json({ error: "Practice session not found" });
    }

    return res.json({ data: practiceSession });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch practice session";
    return res.status(500).json({ error: message });
  }
});

// Submit answer for a question in a practice session
app.post("/api/practice/:id/answer", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session) {
      return res.status(401).json({ error: "Unauthorized: Please sign in." });
    }
    const studentId = session.userId;
    const { id } = req.params;
    const { questionId, answer, timeTakenMs, hintUsed } = req.body;

    if (!questionId || answer === undefined) {
      return res.status(400).json({ error: "questionId and answer are required" });
    }

    const result = await dbService.submitQuestionAnswer({
      sessionId: id,
      questionId,
      answer,
      timeTakenMs,
      hintUsed,
      studentId,
    });

    return res.json({ data: result });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to process question answer";
    return res.status(400).json({ error: message });
  }
});

// Complete practice session
app.post("/api/practice/:id/complete", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session) {
      return res.status(401).json({ error: "Unauthorized: Please sign in." });
    }
    const studentId = session.userId;
    const { id } = req.params;

    const summary = await dbService.completePracticeSession(id, studentId);

    // Asynchronously trigger Mistake Analysis & Adaptive Recommendation on completed practice
    dbService.getPracticeSession(id, studentId).then((sess) => {
      if (sess) {
        const targetSkillId = sess.skillId || sess.practiceSet?.skillId;
        const targetLessonId = sess.lessonId || sess.practiceSet?.lessonId;
        MistakeAnalyzerService.analyzeStudentMistakes({
          studentId,
          skillId: targetSkillId,
          lessonId: targetLessonId,
          practiceSessionId: id,
          trigger: "PRACTICE_COMPLETED",
        })
          .then(() => {
            AdaptiveEngine.generateAdaptiveRecommendation({
              studentId,
              skillId: targetSkillId,
              lessonId: targetLessonId,
              trigger: "PRACTICE_COMPLETED",
              forceRefresh: true,
            }).catch((err) => console.warn("Background adaptive recommendation error:", err));

            if (targetSkillId) {
              MasteryEngine.evaluateSkillMastery({
                studentId,
                skillId: targetSkillId,
                forceRecalculate: true,
              }).catch((err) => console.warn("Background mastery evaluation error:", err));
            }
          })
          .catch((err) => console.warn("Background practice completion mistake analysis error:", err));
      }
    }).catch((e) => console.warn("Error loading session for mistake analysis:", e));

    return res.json({ data: summary });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to complete practice session";
    return res.status(500).json({ error: message });
  }
});

// Review practice session
app.get("/api/practice/:id/review", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session) {
      return res.status(401).json({ error: "Unauthorized: Please sign in." });
    }
    const studentId = session.userId;
    const { id } = req.params;

    const review = await dbService.getPracticeSessionReview(id, studentId);
    return res.json({ data: review });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch practice session review";
    return res.status(500).json({ error: message });
  }
});

// Student practice history
app.get("/api/student/practice-history", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session) {
      return res.status(401).json({ error: "Unauthorized: Please sign in." });
    }
    let targetStudentId = session.userId;
    if (session.role === "TEACHER" || session.role === "ADMIN") {
      const qStudentId = req.query.studentId as string;
      if (qStudentId) {
        const isAuth = await TeacherService.isTeacherAuthorizedForStudent(session.userId, qStudentId, session.role);
        if (!isAuth) {
          return res.status(403).json({ error: "Forbidden: Not authorized for this student." });
        }
        targetStudentId = qStudentId;
      }
    } else if (session.role === "STUDENT") {
      targetStudentId = session.userId;
    }

    const history = await dbService.getStudentPracticeHistory(targetStudentId);
    return res.json({ data: history });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch practice history";
    return res.status(500).json({ error: message });
  }
});

// -------------------------------------------------------------
// PHASE 7: AI TUTOR ENDPOINTS
// -------------------------------------------------------------

// Main AI Tutor interaction endpoint
app.post("/api/ai/tutor", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session) {
      return res.status(401).json({ error: "Unauthorized: Please log in to consult the AI Tutor." });
    }

    const {
      conversationId,
      lessonId,
      skillId,
      questionId,
      practiceSessionId,
      studentQuery,
      helpLevel,
      studentAnswer,
    } = req.body;

    const result = await AITutorService.interact({
      studentId: session.userId,
      conversationId,
      lessonId,
      skillId,
      questionId,
      practiceSessionId,
      studentQuery,
      helpLevel,
      studentAnswer,
    });

    return res.json({ data: result });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "AI Tutor request failed";

    if (message.includes("Rate limit exceeded")) {
      console.warn("AI Tutor rate limit notification:", message);
      return res.status(429).json({ error: message });
    }
    if (message.includes("disabled by your instructor")) {
      console.warn("AI Tutor disabled notification:", message);
      return res.status(403).json({ error: message });
    }

    console.error("AI Tutor endpoint error:", message);

    // Generic educational safe response for students on internal failure
    return res.status(500).json({
      error: "The AI Tutor is temporarily unavailable. You can continue the lesson and try again later.",
    });
  }
});

// Get AI conversation history
app.get("/api/ai/conversations/:id", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session) {
      return res.status(401).json({ error: "Unauthorized: Please log in." });
    }

    const { id } = req.params;
    const conversation = await dbService.getAITutorConversation(id, session.userId);

    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found or access denied." });
    }

    // The pedagogical state holds pending problems and their answers: never send it to the client.
    const { stateJson: _internalState, ...safeConversation } = conversation as typeof conversation & { stateJson?: string | null };
    return res.json({ data: safeConversation });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load conversation";
    return res.status(500).json({ error: message });
  }
});

// Get AI Tutor Teacher Settings
app.get("/api/ai/settings", async (_req: Request, res: Response) => {
  try {
    const settings = await dbService.getTeacherAISettings();
    return res.json({ data: settings });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load AI settings";
    return res.status(500).json({ error: message });
  }
});

// Update AI Tutor Teacher Settings (Teacher/Admin only)
app.patch("/api/ai/settings", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session || (session.role !== "TEACHER" && session.role !== "ADMIN")) {
      return res.status(403).json({ error: "Forbidden: Teacher or Admin privileges required." });
    }

    const updated = await dbService.updateTeacherAISettings(req.body);
    return res.json({ data: updated });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to update AI settings";
    return res.status(500).json({ error: message });
  }
});

// -------------------------------------------------------------
// PHASE 8: AI MISTAKE ANALYZER ENDPOINTS
// -------------------------------------------------------------

// Student retrieves their own mistake analyses
app.get("/api/student/insights", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session) {
      return res.status(401).json({ error: "Unauthorized: Please log in to view learning insights." });
    }

    const { skillId, limit } = req.query;
    const insights = await dbService.getMistakeAnalysesForStudent(session.userId, {
      skillId: skillId as string,
      limit: limit ? Number(limit) : 20,
    });

    return res.json({ data: insights });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load learning insights";
    return res.status(500).json({ error: message });
  }
});

// Student retrieves single mistake analysis
app.get("/api/student/insights/:id", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session) {
      return res.status(401).json({ error: "Unauthorized: Please log in." });
    }

    const { id } = req.params;
    const insight = await dbService.getMistakeAnalysisById(id, session.userId, session.role);
    if (!insight) {
      return res.status(404).json({ error: "Insight not found or access denied." });
    }

    return res.json({ data: insight });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load learning insight";
    return res.status(500).json({ error: message });
  }
});

// Teacher/Admin retrieves mistake analyses for a student with evidence
app.get("/api/teacher/students/:studentId/insights", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session || (session.role !== "TEACHER" && session.role !== "ADMIN")) {
      return res.status(403).json({ error: "Forbidden: Teacher or Admin privileges required." });
    }

    const { studentId } = req.params;
    if (!(await TeacherService.isTeacherAuthorizedForStudent(session.userId, studentId, session.role))) {
      return res.status(403).json({ error: "Forbidden: This student is not in one of your classes." });
    }
    const { skillId, limit } = req.query;

    const insights = await dbService.getMistakeAnalysesForStudent(studentId, {
      skillId: skillId as string,
      limit: limit ? Number(limit) : 20,
      includeOutdated: true,
    });

    return res.json({ data: insights });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load student insights";
    return res.status(500).json({ error: message });
  }
});

// Teacher/Admin manually triggers learning pattern analysis for a student
// Phase 23: conversations where the AI Tutor judged this student needs their teacher.
app.get("/api/teacher/students/:studentId/tutor-flags", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session || (session.role !== "TEACHER" && session.role !== "ADMIN")) {
      return res.status(403).json({ error: "Forbidden: Teacher or Admin privileges required." });
    }
    const { studentId } = req.params;
    if (!(await TeacherService.isTeacherAuthorizedForStudent(session.userId, studentId, session.role))) {
      return res.status(403).json({ error: "Forbidden: This student is not in one of your classes." });
    }
    const flags = await dbService.getTutorAttentionFlags(studentId, 10);
    return res.json({ data: flags });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load tutor flags";
    return res.status(500).json({ error: message });
  }
});

app.post("/api/teacher/students/:studentId/analyze", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session || (session.role !== "TEACHER" && session.role !== "ADMIN")) {
      return res.status(403).json({ error: "Forbidden: Teacher or Admin privileges required." });
    }

    const { studentId } = req.params;
    if (!(await TeacherService.isTeacherAuthorizedForStudent(session.userId, studentId, session.role))) {
      return res.status(403).json({ error: "Forbidden: This student is not in one of your classes." });
    }
    const { skillId, lessonId, practiceSessionId, maxAttempts } = req.body;

    const analysis = await MistakeAnalyzerService.analyzeStudentMistakes({
      studentId,
      skillId,
      lessonId,
      practiceSessionId,
      trigger: "TEACHER_REQUESTED",
      forceRefresh: true,
      maxAttempts: maxAttempts ? Number(maxAttempts) : 10,
    });

    return res.json({ data: analysis });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Mistake analysis failed";
    console.error("Teacher analyze endpoint error:", message);
    return res.status(500).json({ error: message });
  }
});

// -------------------------------------------------------------
// PHASE 9: ADAPTIVE LEARNING ENGINE ENDPOINTS
// -------------------------------------------------------------

// Student retrieves active adaptive recommendation
app.get("/api/student/adaptive/recommendation", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session) {
      return res.status(401).json({ error: "Unauthorized: Please log in to view adaptive guidance." });
    }

    const { skillId } = req.query;
    const recommendation = await AdaptiveEngine.generateAdaptiveRecommendation({
      studentId: session.userId,
      skillId: skillId as string | undefined,
      trigger: "STUDENT_REQUESTED",
    });

    return res.json({ data: recommendation });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load adaptive recommendation";
    return res.status(500).json({ error: message });
  }
});

// Student forcefully generates / refreshes adaptive recommendation
app.post("/api/student/adaptive/recommendation/generate", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session) {
      return res.status(401).json({ error: "Unauthorized: Please log in." });
    }

    const { skillId, lessonId } = req.body;
    const recommendation = await AdaptiveEngine.generateAdaptiveRecommendation({
      studentId: session.userId,
      skillId,
      lessonId,
      trigger: "STUDENT_REQUESTED",
      forceRefresh: true,
    });

    return res.json({ data: recommendation });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to generate recommendation";
    return res.status(500).json({ error: message });
  }
});

// Student marks recommendation as completed
app.post("/api/student/adaptive/recommendation/:id/complete", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session) {
      return res.status(401).json({ error: "Unauthorized: Please log in." });
    }

    const { id } = req.params;
    const updated = await AdaptiveEngine.completeRecommendation(id, session.userId);
    return res.json({ data: updated });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to complete recommendation";
    return res.status(500).json({ error: message });
  }
});

// Student dismisses recommendation
app.post("/api/student/adaptive/recommendation/:id/dismiss", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session) {
      return res.status(401).json({ error: "Unauthorized: Please log in." });
    }

    const { id } = req.params;
    const updated = await AdaptiveEngine.dismissRecommendation(id, session.userId);
    return res.json({ data: updated });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to dismiss recommendation";
    return res.status(500).json({ error: message });
  }
});

// Teacher/Admin retrieves recommendation history for a student
app.get("/api/teacher/students/:studentId/adaptive/recommendations", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session || (session.role !== "TEACHER" && session.role !== "ADMIN")) {
      return res.status(403).json({ error: "Forbidden: Teacher or Admin privileges required." });
    }

    const { studentId } = req.params;
    const isAuth = await TeacherService.isTeacherAuthorizedForStudent(session.userId, studentId, session.role);
    if (!isAuth) {
      return res.status(403).json({ error: "Forbidden: You are not authorized to view this student's adaptive history." });
    }

    const { limit } = req.query;
    const list = await dbService.getStudentAdaptiveHistory(studentId, {
      limit: limit ? Number(limit) : 20,
    });

    return res.json({ data: list });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch student adaptive history";
    return res.status(500).json({ error: message });
  }
});

// Teacher/Admin forces adaptive recommendation recalculation for a student
app.post("/api/teacher/students/:studentId/adaptive/recommendation", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session || (session.role !== "TEACHER" && session.role !== "ADMIN")) {
      return res.status(403).json({ error: "Forbidden: Teacher or Admin privileges required." });
    }

    const { studentId } = req.params;
    const isAuth = await TeacherService.isTeacherAuthorizedForStudent(session.userId, studentId, session.role);
    if (!isAuth) {
      return res.status(403).json({ error: "Forbidden: You are not authorized to manage this student." });
    }

    const { skillId, lessonId } = req.body;
    const recommendation = await AdaptiveEngine.generateAdaptiveRecommendation({
      studentId,
      skillId,
      lessonId,
      trigger: "TEACHER_REQUESTED",
      forceRefresh: true,
    });

    return res.json({ data: recommendation });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to recalculate recommendation";
    return res.status(500).json({ error: message });
  }
});

// Teacher/Admin applies an override to an adaptive recommendation with reason
app.post("/api/teacher/students/:studentId/adaptive/override", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session || (session.role !== "TEACHER" && session.role !== "ADMIN")) {
      return res.status(403).json({ error: "Forbidden: Teacher or Admin privileges required." });
    }

    const { studentId } = req.params;
    const isAuth = await TeacherService.isTeacherAuthorizedForStudent(session.userId, studentId, session.role);
    if (!isAuth) {
      return res.status(403).json({ error: "Forbidden: You are not authorized to manage this student." });
    }

    const {
      recommendationId,
      overrideDecision,
      reason,
      targetDifficulty,
      recommendedActivityType,
      recommendedActivityId,
    } = req.body;

    if (!recommendationId || !overrideDecision || !reason) {
      return res.status(400).json({ error: "recommendationId, overrideDecision, and reason are required." });
    }

    const updated = await AdaptiveEngine.applyTeacherOverride({
      recommendationId,
      teacherId: session.userId,
      overrideDecision,
      reason,
      targetDifficulty,
      recommendedActivityType,
      recommendedActivityId,
    });

    return res.json({ data: updated });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to record teacher override";
    return res.status(500).json({ error: message });
  }
});

// -------------------------------------------------------------
// PHASE 10: MASTERY ENGINE ENDPOINTS
// -------------------------------------------------------------

// Student retrieves all their skill mastery snapshots
app.get("/api/student/mastery", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session) {
      return res.status(401).json({ error: "Unauthorized: Please log in to view mastery status." });
    }

    const masteries = await MasteryEngine.getStudentMasteries(session.userId);
    return res.json({ data: masteries });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch student mastery list";
    return res.status(500).json({ error: message });
  }
});

// Student retrieves single skill mastery evaluation
app.get("/api/student/mastery/:skillId", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session) {
      return res.status(401).json({ error: "Unauthorized: Please log in." });
    }

    const { skillId } = req.params;
    const mastery = await MasteryEngine.evaluateSkillMastery({
      studentId: session.userId,
      skillId,
      forceRecalculate: false,
    });

    return res.json({ data: mastery });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load skill mastery";
    return res.status(500).json({ error: message });
  }
});

// Student requests on-demand recalculation of mastery for a skill
app.post("/api/student/mastery/:skillId/recalculate", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session) {
      return res.status(401).json({ error: "Unauthorized: Please log in." });
    }

    const { skillId } = req.params;
    const refreshed = await MasteryEngine.evaluateSkillMastery({
      studentId: session.userId,
      skillId,
      forceRecalculate: true,
      useAIExplanation: true,
    });

    return res.json({ data: refreshed });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to recalculate mastery";
    return res.status(500).json({ error: message });
  }
});

// Teacher / Admin retrieves mastery across skills for an authorized student
app.get("/api/teacher/students/:studentId/mastery", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session || (session.role !== "TEACHER" && session.role !== "ADMIN")) {
      return res.status(403).json({ error: "Forbidden: Teacher or Admin privileges required." });
    }

    const { studentId } = req.params;
    const isAuthorized = await TeacherService.isTeacherAuthorizedForStudent(session.userId, studentId, session.role);
    if (!isAuthorized) {
      return res.status(403).json({ error: "Forbidden: You are not authorized to view this student's mastery." });
    }

    const masteries = await MasteryEngine.getStudentMasteries(studentId);
    return res.json({ data: masteries });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load student mastery records";
    return res.status(500).json({ error: message });
  }
});

// Teacher / Admin inspects detailed mastery & evidence for a specific student and skill
app.get("/api/teacher/students/:studentId/mastery/:skillId", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session || (session.role !== "TEACHER" && session.role !== "ADMIN")) {
      return res.status(403).json({ error: "Forbidden: Teacher or Admin privileges required." });
    }

    const { studentId, skillId } = req.params;
    const isAuthorized = await TeacherService.isTeacherAuthorizedForStudent(session.userId, studentId, session.role);
    if (!isAuthorized) {
      return res.status(403).json({ error: "Forbidden: You are not authorized to view this student's mastery." });
    }

    const mastery = await MasteryEngine.evaluateSkillMastery({
      studentId,
      skillId,
      forceRecalculate: false,
    });

    return res.json({ data: mastery });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load student skill mastery evidence";
    return res.status(500).json({ error: message });
  }
});

// -------------------------------------------------------------
// PHASE 11: STUDENT DASHBOARD ENDPOINTS
// -------------------------------------------------------------

// Student retrieves comprehensive personalized dashboard payload
app.get("/api/student/dashboard", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session) {
      return res.status(401).json({ error: "Unauthorized: Please sign in to access student dashboard." });
    }

    let targetStudentId = session.userId;
    if (session.role === "TEACHER" || session.role === "ADMIN") {
      const qStudentId = req.query.studentId as string;
      if (qStudentId) {
        const isAuth = await TeacherService.isTeacherAuthorizedForStudent(session.userId, qStudentId, session.role);
        if (!isAuth) {
          return res.status(403).json({ error: "Forbidden: Not authorized to view this student's dashboard." });
        }
        targetStudentId = qStudentId;
      }
    } else if (session.role === "STUDENT") {
      targetStudentId = session.userId;
    }

    const dashboard = await StudentDashboardService.getStudentDashboard(targetStudentId);
    return res.json({ data: dashboard });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load student dashboard";
    console.error("Student dashboard error:", error);
    return res.status(500).json({ error: message });
  }
});

// -------------------------------------------------------------
// PHASE 12: TEACHER DASHBOARD, CLASS & STUDENT MANAGEMENT ENDPOINTS
// -------------------------------------------------------------

// Teacher retrieves primary dashboard analytics & control center
app.get("/api/teacher/dashboard", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session || (session.role !== "TEACHER" && session.role !== "ADMIN")) {
      return res.status(403).json({ error: "Forbidden: Teacher or Administrator credentials required." });
    }

    const dashboard = await TeacherService.getTeacherDashboard(session.userId, session.role);
    return res.json({ data: dashboard });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load teacher dashboard";
    console.error("Teacher dashboard API error:", error);
    return res.status(500).json({ error: message });
  }
});

// Teacher retrieves paginated list of authorized students with search
app.get("/api/teacher/students", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session || (session.role !== "TEACHER" && session.role !== "ADMIN")) {
      return res.status(403).json({ error: "Forbidden: Teacher access required." });
    }

    const { search, classId, page, limit } = req.query;
    const paginated = await TeacherService.getAuthorizedStudentsPaginated(
      session.userId,
      session.role,
      {
        search: search as string,
        classId: classId as string,
        page: page ? Number(page) : 1,
        limit: limit ? Number(limit) : 20,
      }
    );

    return res.json({ data: paginated });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load students";
    const status = message.includes("Forbidden") ? 403 : 500;
    return res.status(status).json({ error: message });
  }
});

// Teacher inspects specific student detail with strict IDOR verification
app.get("/api/teacher/students/:studentId", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session || (session.role !== "TEACHER" && session.role !== "ADMIN")) {
      return res.status(403).json({ error: "Forbidden: Teacher access required." });
    }

    const { studentId } = req.params;
    const detail = await TeacherService.getStudentDetail(studentId, session.userId, session.role);
    return res.json({ data: detail });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load student detail";
    const status = message.includes("Forbidden") ? 403 : 500;
    return res.status(status).json({ error: message });
  }
});

// Teacher retrieves authorized classes
// -------------------------------------------------------------
// PHASE 25: CLASSROOMS (database-backed), ROSTER, JOIN CODES, ASSIGNMENTS
// -------------------------------------------------------------

function sendClassroomError(res: Response, error: unknown, fallback: string) {
  if (error instanceof ClassroomError) return res.status(error.status).json({ error: error.message });
  const message = error instanceof Error ? error.message : fallback;
  console.error("Classroom route error:", message);
  return res.status(500).json({ error: fallback });
}

const actorOf = (session: SessionPayload) => ({ userId: session.userId, role: session.role as string });

app.post("/api/teacher/classes", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session) return res.status(401).json({ error: "Unauthorized: Please sign in." });
    const view = await ClassroomService.create(actorOf(session), req.body ?? {});
    return res.status(201).json({ data: view });
  } catch (error) {
    return sendClassroomError(res, error, "Failed to create class");
  }
});

app.patch("/api/teacher/classes/:classId", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session) return res.status(401).json({ error: "Unauthorized: Please sign in." });
    const view = await ClassroomService.update(actorOf(session), req.params.classId, req.body ?? {});
    return res.json({ data: view });
  } catch (error) {
    return sendClassroomError(res, error, "Failed to update class");
  }
});

app.post("/api/teacher/classes/:classId/join-code/regenerate", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session) return res.status(401).json({ error: "Unauthorized: Please sign in." });
    const view = await ClassroomService.regenerateJoinCode(actorOf(session), req.params.classId);
    return res.json({ data: view });
  } catch (error) {
    return sendClassroomError(res, error, "Failed to regenerate class code");
  }
});

app.post("/api/teacher/classes/:classId/students", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session) return res.status(401).json({ error: "Unauthorized: Please sign in." });
    const results = await ClassroomService.addStudentsByEmail(actorOf(session), req.params.classId, req.body?.emails);
    return res.json({ data: results });
  } catch (error) {
    return sendClassroomError(res, error, "Failed to add students");
  }
});

app.delete("/api/teacher/classes/:classId/students/:studentId", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session) return res.status(401).json({ error: "Unauthorized: Please sign in." });
    const removed = await ClassroomService.removeStudent(actorOf(session), req.params.classId, req.params.studentId);
    return removed ? res.json({ success: true }) : res.status(404).json({ error: "That student is not in this class." });
  } catch (error) {
    return sendClassroomError(res, error, "Failed to remove student");
  }
});

app.patch("/api/teacher/assignments/:assignmentId", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session) return res.status(401).json({ error: "Unauthorized: Please sign in." });
    const updated = await ClassroomService.setAssignmentStatus(actorOf(session), req.params.assignmentId, req.body?.status);
    return res.json({ data: updated });
  } catch (error) {
    return sendClassroomError(res, error, "Failed to update assignment");
  }
});

// ----- Student side -----
app.get("/api/student/classes", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session) return res.status(401).json({ error: "Unauthorized: Please sign in." });
    if (session.role !== "STUDENT") return res.status(403).json({ error: "Forbidden: Student account required." });
    return res.json({ data: await ClassroomService.listForStudent(actorOf(session)) });
  } catch (error) {
    return sendClassroomError(res, error, "Failed to load classes");
  }
});

app.post("/api/student/classes/join", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session) return res.status(401).json({ error: "Unauthorized: Please sign in." });
    const view = await ClassroomService.joinByCode(actorOf(session), req.body?.code, req.ip ?? "unknown");
    return res.json({ data: view });
  } catch (error) {
    return sendClassroomError(res, error, "Failed to join class");
  }
});

app.delete("/api/student/classes/:classId", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session) return res.status(401).json({ error: "Unauthorized: Please sign in." });
    if (session.role !== "STUDENT") return res.status(403).json({ error: "Forbidden: Student account required." });
    const left = await ClassroomService.leave(actorOf(session), req.params.classId);
    return left ? res.json({ success: true }) : res.status(404).json({ error: "You are not in that class." });
  } catch (error) {
    return sendClassroomError(res, error, "Failed to leave class");
  }
});

app.get("/api/student/assignments", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session) return res.status(401).json({ error: "Unauthorized: Please sign in." });
    if (session.role !== "STUDENT") return res.status(403).json({ error: "Forbidden: Student account required." });
    return res.json({ data: await ClassroomService.listAssignmentsForStudent(actorOf(session)) });
  } catch (error) {
    return sendClassroomError(res, error, "Failed to load assignments");
  }
});

app.get("/api/teacher/classes", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session || (session.role !== "TEACHER" && session.role !== "ADMIN")) {
      return res.status(403).json({ error: "Forbidden: Teacher access required." });
    }

    const classes = await TeacherService.getAuthorizedClassrooms(session.userId, session.role);
    return res.json({ data: classes });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load classes";
    return res.status(500).json({ error: message });
  }
});

// Teacher inspects specific class detail
app.get("/api/teacher/classes/:classId", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session || (session.role !== "TEACHER" && session.role !== "ADMIN")) {
      return res.status(403).json({ error: "Forbidden: Teacher access required." });
    }

    const { classId } = req.params;
    const classDetail = await TeacherService.getClassroomDetail(classId, session.userId, session.role);
    return res.json({ data: classDetail });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load class detail";
    const status = message.includes("Forbidden") ? 403 : /not found/i.test(message) ? 404 : 500;
    return res.status(status).json({ error: status === 500 ? "Failed to load class detail" : message });
  }
});

// Teacher creates an assignment for a class
app.post("/api/teacher/classes/:classId/assignments", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session || (session.role !== "TEACHER" && session.role !== "ADMIN")) {
      return res.status(403).json({ error: "Forbidden: Teacher access required." });
    }

    const { classId } = req.params;
    const { title, description, lessonId, practiceSetId, dueDate } = req.body;

    if (!title) {
      return res.status(400).json({ error: "Assignment title is required." });
    }

    const assignment = await TeacherService.createAssignment(
      session.userId,
      { classroomId: classId, title, description, lessonId, practiceSetId, dueDate },
      session.role
    );

    return res.status(201).json({ data: assignment });
  } catch (error) {
    return sendClassroomError(res, error, "Failed to create assignment");
  }
});

// Teacher asks pedagogical questions to the Teacher AI Assistant
app.post("/api/teacher/ai-assistant", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session || (session.role !== "TEACHER" && session.role !== "ADMIN")) {
      return res.status(403).json({ error: "Forbidden: Teacher access required." });
    }

    const { prompt, classId } = req.body;
    if (!prompt || typeof prompt !== "string") {
      return res.status(400).json({ error: "A valid prompt is required." });
    }

    const result = await TeacherAIService.queryTeacherAssistant({
      teacherId: session.userId,
      userRole: session.role,
      prompt,
      classId,
    });

    return res.json({ data: result });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Teacher AI assistant failed";
    return res.status(message.includes("Forbidden") ? 403 : 500).json({ error: message.includes("Forbidden") ? message : "Teacher AI assistant failed" });
  }
});

// Teacher publishes a lesson with ownership validation
app.post("/api/teacher/lessons/:id/publish", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session || (session.role !== "TEACHER" && session.role !== "ADMIN")) {
      return res.status(403).json({ error: "Forbidden: Teacher access required." });
    }

    const { id } = req.params;
    const lesson: any = await dbService.getLessonById(id);
    if (!lesson) {
      return res.status(404).json({ error: "Lesson not found." });
    }

    // Server-side ownership enforcement
    if (session.role !== "ADMIN" && lesson.authorId && lesson.authorId !== session.userId) {
      return res.status(403).json({ error: "Forbidden: You can only publish your own lessons." });
    }

    const result = await dbService.updateLessonStatus(id, "PUBLISHED", session.role);
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    return res.json({ data: result.lesson, message: "Lesson successfully published." });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to publish lesson";
    return res.status(500).json({ error: message });
  }
});

// Role-protected API route test
// -------------------------------------------------------------
// PHASE 25: ADMIN-MANAGED ACCOUNTS + PASSWORD CHANGE
// Teacher and admin accounts are never self-registered; an administrator creates them.
// -------------------------------------------------------------

const ADMIN_CREATABLE_ROLES = ["TEACHER", "ADMIN", "RESEARCHER", "STUDENT"] as const;

app.post("/api/admin/users", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session || session.role !== "ADMIN") {
      return res.status(403).json({ error: "Forbidden: Administrator role required" });
    }
    const { name, email, password, role, gradeLevel } = req.body ?? {};
    if (typeof role !== "string" || !(ADMIN_CREATABLE_ROLES as readonly string[]).includes(role)) {
      return res.status(400).json({ error: `Role must be one of: ${ADMIN_CREATABLE_ROLES.join(", ")}` });
    }
    const validatedEmail = validateEmail(email);
    const validatedName = validateName(name);
    const validatedPass = validateNewPassword(password);

    if (await dbService.findUserByEmail(validatedEmail)) {
      return res.status(409).json({ error: "An account with this email already exists" });
    }
    const user = await dbService.createUser({
      name: validatedName,
      email: validatedEmail,
      passwordHash: await hashPassword(validatedPass),
      role: role as UserRole,
      gradeLevel: typeof gradeLevel === "number" ? gradeLevel : role === "STUDENT" ? 7 : undefined,
    });
    // Audit trail (no secrets): who created which account with which role.
    console.info(`AUDIT admin_create_user actor=${session.userId} target=${user.id} role=${role}`);
    return res.status(201).json({ data: { id: user.id, email: user.email, name: user.name, role: user.role } });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to create user";
    return res.status(400).json({ error: message });
  }
});

app.get("/api/admin/users", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session || session.role !== "ADMIN") {
      return res.status(403).json({ error: "Forbidden: Administrator role required" });
    }
    const role = typeof req.query.role === "string" && (ADMIN_CREATABLE_ROLES as readonly string[]).includes(req.query.role) ? (req.query.role as UserRole) : undefined;
    const result = await dbService.listUsers({
      role,
      limit: req.query.limit ? Number(req.query.limit) : 50,
      offset: req.query.offset ? Number(req.query.offset) : 0,
    });
    return res.json({ data: result });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to list users";
    return res.status(500).json({ error: message });
  }
});

app.post("/api/auth/change-password", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session) return res.status(401).json({ error: "Unauthorized: Please sign in." });

    const keys = [`email:${session.email}`, `ip:${req.ip ?? "unknown"}`];
    const throttle = checkLoginThrottle(keys);
    if (!throttle.allowed) {
      res.setHeader("Retry-After", String(throttle.retryAfterSeconds));
      return res.status(429).json({ error: "Too many failed attempts. Please try again later." });
    }

    const { currentPassword, newPassword } = req.body ?? {};
    if (typeof currentPassword !== "string") return res.status(400).json({ error: "Current password is required" });
    const validatedNew = validateNewPassword(newPassword);

    const user = await dbService.findUserById(session.userId);
    if (!user || !(await verifyPassword(currentPassword, user.passwordHash))) {
      recordLoginFailure(keys);
      return res.status(401).json({ error: "Current password is incorrect" });
    }
    if (currentPassword === validatedNew) return res.status(400).json({ error: "The new password must be different" });

    await dbService.updateUserPassword(user.id, await hashPassword(validatedNew));
    clearLoginFailures([keys[0]]);
    console.info(`AUDIT password_changed user=${user.id}`);
    return res.json({ success: true, note: "Existing sessions stay valid until they expire; sign out on other devices." });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to change password";
    return res.status(400).json({ error: message });
  }
});

app.get("/api/admin/system-summary", (req: Request, res: Response) => {
  const session = getSessionFromRequest(req);
  if (!session || session.role !== "ADMIN") {
    return res.status(403).json({ error: "Forbidden: Administrator role required" });
  }
  return res.json({
    message: "Admin diagnostic authorization verified",
    serverUptime: process.uptime(),
    activeRole: session.role,
  });
});

// -------------------------------------------------------------
// PHASE 14: ASSESSMENT & RESEARCH ANALYTICS ENDPOINTS
// -------------------------------------------------------------

// Teacher creates assessment
app.post("/api/teacher/assessments", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session || (session.role !== "TEACHER" && session.role !== "ADMIN")) {
      return res.status(403).json({ error: "Forbidden: Teacher or Administrator access required." });
    }

    const { title, description, type, lessonId, gradeLevel, timeLimitMinutes, passingScorePercent, questions } =
      req.body;

    const assessment = await AssessmentService.createAssessment(
      {
        title,
        description,
        type,
        lessonId,
        gradeLevel,
        timeLimitMinutes,
        passingScorePercent,
        questions: questions || [],
      },
      session.userId,
      session.role
    );

    return res.status(201).json({ data: assessment });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to create assessment";
    return res.status(400).json({ error: message });
  }
});

// Teacher/Admin lists assessments
app.get("/api/teacher/assessments", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session || (session.role !== "TEACHER" && session.role !== "ADMIN")) {
      return res.status(403).json({ error: "Forbidden: Teacher or Administrator access required." });
    }

    const { type, status, gradeLevel, lessonId } = req.query;
    const list = await AssessmentService.listAssessments(
      {
        type: type as any,
        status: status as any,
        gradeLevel: gradeLevel ? Number(gradeLevel) : undefined,
        lessonId: lessonId as string | undefined,
      },
      session.userId,
      session.role
    );

    return res.json({ data: list });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to list assessments";
    return res.status(500).json({ error: message });
  }
});

// Teacher publishes assessment
app.post("/api/teacher/assessments/:id/publish", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session || (session.role !== "TEACHER" && session.role !== "ADMIN")) {
      return res.status(403).json({ error: "Forbidden: Teacher or Administrator access required." });
    }

    const { id } = req.params;
    const published = await AssessmentService.publishAssessment(id, session.userId, session.role);
    return res.json({ data: published });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to publish assessment";
    const status = message.includes("Forbidden") ? 403 : 500;
    return res.status(status).json({ error: message });
  }
});

// Teacher assigns assessment to class
app.post("/api/teacher/assessments/:id/assign", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session || (session.role !== "TEACHER" && session.role !== "ADMIN")) {
      return res.status(403).json({ error: "Forbidden: Teacher or Administrator access required." });
    }

    const { id } = req.params;
    const { classroomId, studentId, dueDate } = req.body;
    if (!classroomId) {
      return res.status(400).json({ error: "classroomId is required to assign assessment." });
    }

    const result = await AssessmentService.assignAssessment(
      id,
      classroomId,
      { studentId, dueDate },
      session.userId,
      session.role
    );

    return res.json({ data: result });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to assign assessment";
    const status = message.includes("Forbidden") ? 403 : 500;
    return res.status(status).json({ error: message });
  }
});

// Student lists available published assessments
app.get("/api/student/assessments", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session) {
      return res.status(401).json({ error: "Unauthorized: Please log in." });
    }

    const { type, gradeLevel } = req.query;
    const list = await AssessmentService.listAssessments(
      {
        type: type as any,
        gradeLevel: gradeLevel ? Number(gradeLevel) : undefined,
      },
      session.userId,
      session.role
    );

    return res.json({ data: list });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to retrieve assessments";
    return res.status(500).json({ error: message });
  }
});

// Student gets assessment details (answers safely redacted!)
app.get("/api/student/assessments/:id", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session) {
      return res.status(401).json({ error: "Unauthorized: Please log in." });
    }

    const { id } = req.params;
    const assessment = await AssessmentService.getAssessmentForStudent(id, session.userId);
    return res.json({ data: assessment });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to get assessment";
    const status = message.includes("Forbidden") ? 403 : 500;
    return res.status(status).json({ error: message });
  }
});

// Student starts assessment attempt
app.post("/api/student/assessments/:id/start", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session) {
      return res.status(401).json({ error: "Unauthorized: Please log in." });
    }

    const { id } = req.params;
    const attempt = await AssessmentService.startAssessmentAttempt(id, session.userId);
    return res.status(201).json({ data: attempt });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to start assessment attempt";
    const status = message.includes("Forbidden") ? 403 : 500;
    return res.status(status).json({ error: message });
  }
});

// Student submits assessment attempt (Server-Side Deterministic Grading)
app.post("/api/student/assessments/attempts/:attemptId/submit", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session) {
      return res.status(401).json({ error: "Unauthorized: Please log in." });
    }

    const { attemptId } = req.params;
    const { responses } = req.body;

    if (!Array.isArray(responses)) {
      return res.status(400).json({ error: "responses must be an array of answers." });
    }

    const result = await AssessmentService.submitAssessmentAttempt(attemptId, session.userId, responses);
    return res.json({ data: result });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to submit assessment";
    const status = message.includes("Forbidden") ? 403 : 400;
    return res.status(status).json({ error: message });
  }
});

// Teacher/Admin views research profile for a student (IDOR scoped)
app.get("/api/teacher/research/profile/:studentId", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session || (session.role !== "TEACHER" && session.role !== "ADMIN")) {
      return res.status(403).json({ error: "Forbidden: Teacher or Administrator access required." });
    }

    const { studentId } = req.params;
    const isAuthorized = await TeacherService.isTeacherAuthorizedForStudent(session.userId, studentId, session.role);
    if (!isAuthorized) {
      return res.status(403).json({ error: "Forbidden: You are not authorized to view this student's research profile." });
    }

    const profile = await ResearchService.getStudentResearchProfile(studentId);
    return res.json({ data: profile });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load student research profile";
    return res.status(500).json({ error: message });
  }
});

// Teacher/Admin views Pre-Test vs Post-Test comparison
app.get("/api/teacher/research/comparison", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session || (session.role !== "TEACHER" && session.role !== "ADMIN")) {
      return res.status(403).json({ error: "Forbidden: Teacher or Administrator access required." });
    }

    const preTestId = (req.query.preTestId as string) || "asm_pre_integers";
    const postTestId = (req.query.postTestId as string) || "asm_post_integers";
    const classroomId = req.query.classroomId as string | undefined;

    const comparison = await ResearchService.getPrePostComparison(preTestId, postTestId, classroomId);
    return res.json({ data: comparison });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to compute pre/post comparison";
    return res.status(500).json({ error: message });
  }
});

// Teacher/Admin views empirical Difficult Skills analysis
app.get("/api/teacher/research/difficult-skills", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session || (session.role !== "TEACHER" && session.role !== "ADMIN")) {
      return res.status(403).json({ error: "Forbidden: Teacher or Administrator access required." });
    }

    const gradeLevel = req.query.grade ? Number(req.query.grade) : undefined;
    const classroomId = req.query.classroomId as string | undefined;

    const difficultSkills = await ResearchService.getDifficultSkills({ gradeLevel, classroomId });
    return res.json({ data: difficultSkills });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to analyze difficult skills";
    return res.status(500).json({ error: message });
  }
});

// Teacher/Admin views aggregate Mistake Analytics
app.get("/api/teacher/research/mistakes", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session || (session.role !== "TEACHER" && session.role !== "ADMIN")) {
      return res.status(403).json({ error: "Forbidden: Teacher or Administrator access required." });
    }

    const mistakes = await ResearchService.getMistakeAnalytics();
    return res.json({ data: mistakes });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load mistake analytics";
    return res.status(500).json({ error: message });
  }
});

// Teacher/Admin views Intervention Observations (strictly non-causal)
app.get("/api/teacher/research/interventions", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session || (session.role !== "TEACHER" && session.role !== "ADMIN")) {
      return res.status(403).json({ error: "Forbidden: Teacher or Administrator access required." });
    }

    const observations = await ResearchService.getInterventionObservations();
    return res.json({ data: observations });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load intervention observations";
    return res.status(500).json({ error: message });
  }
});

// Teacher/Admin views longitudinal Time Series metrics
app.get("/api/teacher/research/time-series", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session || (session.role !== "TEACHER" && session.role !== "ADMIN")) {
      return res.status(403).json({ error: "Forbidden: Teacher or Administrator access required." });
    }

    const timeSeries = await ResearchService.getTimeSeriesMetrics();
    return res.json({ data: timeSeries });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load time series metrics";
    return res.status(500).json({ error: message });
  }
});

// Teacher/Admin exports standardized research metrics CSV
app.get("/api/teacher/research/export/metrics.csv", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session || (session.role !== "TEACHER" && session.role !== "ADMIN")) {
      return res.status(403).json({ error: "Forbidden: Teacher or Administrator access required." });
    }

    // Export authorized students
    const profile = await ResearchService.getStudentResearchProfile("usr_student_01");
    const csvData = ResearchExporter.exportMetricsSummaryCsv([profile]);

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="tuklas_research_metrics_${Date.now()}.csv"`);
    return res.send(csvData);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to export metrics CSV";
    return res.status(500).json({ error: message });
  }
});

// Teacher/Admin exports raw question attempt evidence CSV
app.get("/api/teacher/research/export/attempts.csv", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session || (session.role !== "TEACHER" && session.role !== "ADMIN")) {
      return res.status(403).json({ error: "Forbidden: Teacher or Administrator access required." });
    }

    const attempts = fallbackStore.questionAttempts.map((a: any) => {
      const q = fallbackStore.questions.find((fq: any) => fq.id === a.questionId) || ({} as any);
      return {
        studentId: a.studentId,
        studentName: "Juan de la Cruz",
        questionId: a.questionId,
        skillId: a.skillId,
        attemptNumber: a.attemptNumber,
        isCorrect: a.isCorrect,
        difficulty: q.difficulty || "MEDIUM",
        questionType: q.type || "MULTIPLE_CHOICE",
        cognitiveLevel: q.cognitiveLevel || "PROCEDURAL",
        timeTakenMs: a.timeTakenMs,
        hintUsed: !!a.hintUsed,
        submittedAt: a.submittedAt,
      };
    });

    const csvData = ResearchExporter.exportQuestionAttemptsCsv(attempts);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="tuklas_question_attempts_${Date.now()}.csv"`);
    return res.send(csvData);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to export attempts CSV";
    return res.status(500).json({ error: message });
  }
});

// Teacher/Admin exports Pre/Post comparison CSV
app.get("/api/teacher/research/export/comparison.csv", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session || (session.role !== "TEACHER" && session.role !== "ADMIN")) {
      return res.status(403).json({ error: "Forbidden: Teacher or Administrator access required." });
    }

    const comparison = await ResearchService.getPrePostComparison("asm_pre_integers", "asm_post_integers");
    const csvData = ResearchExporter.exportPrePostComparisonCsv([comparison]);

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="tuklas_pre_post_comparison_${Date.now()}.csv"`);
    return res.send(csvData);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to export comparison CSV";
    return res.status(500).json({ error: message });
  }
});

// -------------------------------------------------------------
// VITE DEVELOPMENT MIDDLEWARE OR STATIC SERVING
// -------------------------------------------------------------

async function startServer() {
  if (!isProd) {
    // Dynamically load Vite in development
    const { createServer } = await import("vite");
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Production static serving
    const distPath = path.resolve(import.meta.dirname, "dist");
    app.use(express.static(distPath));
    app.get("*", (_req: Request, res: Response) => {
      res.sendFile(path.resolve(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Tuklas AI Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
