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
import { ClassroomRepo } from "./src/lib/classroom/classroom-repo.ts";
import { ResearchData, type ResearchScope } from "./src/lib/research/research-data.ts";
import { AssessmentService, AssessmentError, ResearchService, ResearchExporter } from "./src/lib/research/index.ts";

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

// ---- Security headers ----
const ALLOW_EMBEDDING = process.env.ALLOW_EMBEDDING === "true";
app.use((req: Request, res: Response, next: NextFunction) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), geolocation=()");
  if (req.path.startsWith("/api/")) res.setHeader("Cache-Control", "no-store"); // API answers can contain personal data
  if (isProd) {
    if (!ALLOW_EMBEDDING) res.setHeader("X-Frame-Options", "DENY");
    // Scripts only from this site (no inline or eval), so an injected <script> cannot run. Styles allow inline because the
    // app sets some element styles; images may come from any https site (teacher-supplied pictures, video thumbnails);
    // videos are embedded from YouTube only. CSP_REPORT_ONLY=true reports violations without blocking.
    const csp = [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "font-src 'self' data:",
      "connect-src 'self'",
      "media-src 'self' https:",
      "frame-src https://www.youtube-nocookie.com https://www.youtube.com",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      ALLOW_EMBEDDING ? "frame-ancestors *" : "frame-ancestors 'none'",
    ].join("; ");
    res.setHeader(process.env.CSP_REPORT_ONLY === "true" ? "Content-Security-Policy-Report-Only" : "Content-Security-Policy", csp);
  }
  if (isProd && (req.secure || req.headers["x-forwarded-proto"] === "https")) {
    res.setHeader("Strict-Transport-Security", "max-age=15552000; includeSubDomains");
  }
  next();
});

// ---- Rate limits (in-memory, per process) ----
const rateBuckets = new Map<string, number[]>();
function rateCheck(key: string, limit: number, windowMs: number): { ok: boolean; retryAfter: number } {
  const now = Date.now();
  const hits = (rateBuckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= limit) {
    rateBuckets.set(key, hits);
    return { ok: false, retryAfter: Math.max(1, Math.ceil((hits[0] + windowMs - now) / 1000)) };
  }
  hits.push(now);
  rateBuckets.set(key, hits);
  if (rateBuckets.size > 20000) for (const [k, v] of rateBuckets) if (!v.length || now - v[v.length - 1] > windowMs) rateBuckets.delete(k);
  return { ok: true, retryAfter: 0 };
}
/** Returns false (after sending 429) when the key is over its limit. */
function allowRate(res: Response, key: string, limit: number, windowMs: number): boolean {
  const r = rateCheck(key, limit, windowMs);
  if (!r.ok) {
    res.setHeader("Retry-After", String(r.retryAfter));
    res.status(429).json({ error: "Too many requests. Please wait a moment and try again." });
  }
  return r.ok;
}
// A coarse per-address ceiling against scraping and floods. Enabled in production (override with API_RATE_LIMIT_PER_MINUTE; 0 turns it off).
const API_LIMIT = Number(process.env.API_RATE_LIMIT_PER_MINUTE ?? (isProd ? 1200 : 0));
app.use("/api", (req: Request, res: Response, next: NextFunction) => {
  if (!API_LIMIT || req.path === "/health") return next();
  if (!allowRate(res, `ip:${req.ip ?? "unknown"}`, API_LIMIT, 60_000)) return;
  return next();
});

// Internal details (database errors, file paths, stack traces) must not reach the browser: replace them, keep the log.
const INTERNAL_ERROR = /prisma|invalid `|unique constraint|foreign key|econn|enotfound|etimedout|sqlstate|\bat [\w.<>]+ \(|\/home\/|node_modules|postgres(ql)?:\/\//i;
app.use((req: Request, res: Response, next: NextFunction) => {
  const original = res.json.bind(res);
  res.json = ((body: any) => {
    if (res.statusCode >= 500 && body && typeof body.error === "string" && INTERNAL_ERROR.test(body.error)) {
      console.error(`INTERNAL ERROR ${req.method} ${req.path}: ${body.error.slice(0, 500)}`);
      body = { ...body, error: "Something went wrong on our side. Please try again later." };
    }
    return original(body);
  }) as typeof res.json;
  next();
});

// ---- CSRF defence for cookie-authenticated requests ----
// Layer 1: the session cookie is SameSite=Lax (see cookieOptions). Layer 2 (this): state-changing /api requests that
// a browser marks as cross-site, or whose Origin is not this site (or ALLOWED_ORIGINS), are refused. Requests that
// carry an Authorization header are exempt: a forged cross-site form or fetch cannot set that header.
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "").split(",").map((o) => o.trim()).filter(Boolean);
app.use("/api", (req: Request, res: Response, next: NextFunction) => {
  if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") return next();
  if (req.headers.authorization?.startsWith("Bearer ")) return next();
  const origin = req.headers.origin as string | undefined;
  const fetchSite = req.headers["sec-fetch-site"] as string | undefined;
  const host = String((process.env.TRUST_PROXY === "true" && req.headers["x-forwarded-host"]) || req.headers.host || "");
  let allowed = true;
  if (origin !== undefined) {
    try { allowed = new URL(origin).host === host || ALLOWED_ORIGINS.includes(origin); } catch { allowed = false; }
  } else if (fetchSite === "cross-site") {
    allowed = false;
  }
  if (!allowed) {
    console.warn(`CSRF BLOCKED ${req.method} ${req.path} origin=${origin ?? "-"} site=${fetchSite ?? "-"}`);
    return res.status(403).json({ error: "Cross-site request blocked." });
  }
  return next();
});

// Helper to extract session from Cookie or Bearer header
// ---- Sessions ----
// The signed token only proves who issued it. On EVERY API request the account is looked up and the token is honoured
// only if the account still exists, is enabled, and the token's session version is current. The role/name/email used
// by the routes are the account's CURRENT ones, so a role change or a revocation takes effect immediately.
const SESSION_KEY = "__tuklasSession";

function readSessionToken(req: Request): string | undefined {
  const cookieHeader = req.headers.cookie;
  if (cookieHeader) {
    const cookies = Object.fromEntries(
      cookieHeader.split(";").map((c) => {
        const [k, ...v] = c.trim().split("=");
        try { return [k, decodeURIComponent(v.join("="))]; } catch { return [k, ""]; }
      })
    );
    if (cookies["tuklas_session"]) return cookies["tuklas_session"];
  }
  if (req.headers.authorization?.startsWith("Bearer ")) return req.headers.authorization.split("Bearer ")[1];
  return undefined;
}

app.use(async (req: Request, _res: Response, next: NextFunction) => {
  (req as any)[SESSION_KEY] = null;
  try {
    const token = readSessionToken(req);
    const payload = token ? verifySessionToken(token) : null;
    if (payload) {
      const state = await dbService.getAuthState(payload.userId);
      if (state && !state.disabled && state.sessionVersion === (payload.sv ?? 0)) {
        (req as any)[SESSION_KEY] = { ...payload, role: state.role, email: state.email, name: state.name } as SessionPayload;
      }
    }
  } catch (e) {
    if (hasValidDatabaseUrl) console.error("Session check failed (treated as signed out):", e instanceof Error ? e.message : e);
  }
  next();
});

function getSessionFromRequest(req: Request): SessionPayload | null {
  return ((req as any)[SESSION_KEY] as SessionPayload | null) ?? null;
}

// Cookie policy: HttpOnly always; Secure on https/production; SameSite=Lax unless COOKIE_SAMESITE says otherwise
// (set it to "none" only if the app must work inside a cross-site iframe; the Origin check below still applies).
function cookieOptions(req: Request) {
  const isHttps = req.secure || req.headers["x-forwarded-proto"] === "https";
  const configured = (process.env.COOKIE_SAMESITE || "lax").toLowerCase();
  const sameSite = (["lax", "strict", "none"].includes(configured) ? configured : "lax") as "lax" | "strict" | "none";
  return { httpOnly: true, secure: isHttps || isProd || sameSite === "none", sameSite, path: "/" };
}

function issueSession(req: Request, res: Response, user: { id: string; email: string; name: string; role: any; sessionVersion?: number }): string {
  const token = createSessionToken({ id: user.id, email: user.email, name: user.name, role: user.role, sessionVersion: user.sessionVersion ?? 0 });
  res.cookie("tuklas_session", token, { ...cookieOptions(req), maxAge: 1000 * 60 * 60 * 24 * 7 });
  return token;
}

function clearSessionCookie(req: Request, res: Response) {
  res.clearCookie("tuklas_session", cookieOptions(req));
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

    const token = issueSession(req, res, user as any);
    console.log("AUTH SESSION CREATED");


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
    if ((user as any).disabledAt) {
      // Same answer as a wrong password: do not reveal which accounts exist or are disabled.
      recordLoginFailure(throttleKeys);
      await dbService.recordAudit({ actorId: user.id, action: "auth.login.blocked_disabled", targetType: "user", targetId: user.id, ip: req.ip });
      return res.status(401).json({ success: false, error: "Invalid email or password" });
    }
    clearLoginFailures([throttleKeys[0]]);
    console.log("AUTH LOGIN PASSWORD CHECK SUCCESS");

    const token = issueSession(req, res, user as any);
    console.log("AUTH SESSION CREATED");


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

app.post("/api/auth/logout", (req: Request, res: Response) => {
  clearSessionCookie(req, res);
  return res.json({ success: true, message: "Logged out successfully" });
});

// Revokes every session of the signed-in user (all devices, including a stolen token); the user signs in again.
app.post("/api/auth/logout-all", async (req: Request, res: Response) => {
  const session = getSessionFromRequest(req);
  if (!session) return res.status(401).json({ error: "Unauthorized: Please sign in." });
  await dbService.revokeSessions(session.userId);
  await dbService.recordAudit({ actorId: session.userId, action: "auth.sessions.revoke_all", targetType: "user", targetId: session.userId, ip: req.ip });
  clearSessionCookie(req, res);
  return res.json({ success: true, message: "Signed out everywhere. Sign in again to continue." });
});

app.get("/api/auth/me", async (req: Request, res: Response) => {
  const session = getSessionFromRequest(req);
  if (!session) {
    clearSessionCookie(req, res);
    return res.status(401).json({ success: false, user: null, error: "No active session" });
  }
  // The session middleware already checked the account (exists, enabled, current session version).
  return res.json({ success: true, user: { id: session.userId, email: session.email, name: session.name, role: session.role } });
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
    const session = getSessionFromRequest(req);
    if (!session) {
      return res.status(401).json({ error: "Unauthorized: Please sign in." });
    }
    const { id } = req.params;
    const lesson = await dbService.getLessonById(id);
    if (!lesson) {
      return res.status(404).json({ error: "Lesson not found" });
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

    await dbService.recordAudit({ actorId: session.userId, action: "lesson.status", targetType: "lesson", targetId: id, detail: { to: targetStatus }, ip: req.ip });
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
    const staff = requireStaff(req, res);
    if (!staff) return;
    if (!allowRate(res, `yt:${staff.userId}`, 30, 60_000)) return;
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
    const staff = requireStaff(req, res);
    if (!staff) return;
    if (!allowRate(res, `yt:${staff.userId}`, 30, 60_000)) return;
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
    // Each call can cost money with an external model.
    if (!allowRate(res, `genq:${session.userId}`, 6, 10 * 60_000)) return;
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

    await dbService.recordAudit({ actorId: session.userId, action: "block.create", targetType: "block", targetId: (block as any)?.id, detail: { lessonId: id, type } , ip: req.ip });
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

    // Answer keys live in block metadata: record that they changed (never the content itself).
    await dbService.recordAudit({ actorId: session.userId, action: "block.update", targetType: "block", targetId: blockId, detail: { lessonId: id, fields: Object.keys({ type, title, content, metadata }).filter((k) => ({ type, title, content, metadata } as any)[k] !== undefined) }, ip: req.ip });
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
    await dbService.recordAudit({ actorId: session.userId, action: "block.delete", targetType: "block", targetId: blockId, detail: { lessonId: id }, ip: req.ip });

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

app.get("/api/skills", async (req: Request, res: Response) => {
  try {
    if (!getSessionFromRequest(req)) return res.status(401).json({ error: "Unauthorized: Please sign in." });
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
    if (!session) return res.status(401).json({ error: "Unauthorized: Please sign in." });
    const isStaff = session && (session.role === "TEACHER" || session.role === "ADMIN");

    const { skillId, lessonId, difficulty, status, type, search, source, noSkill } = req.query;

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
      noSkill: isStaff && noSkill === "true",
    });

    // If student, redact answers
    const payload = isStaff
      ? questions
      : await Promise.all(questions.map((q) => dbService.getQuestionById(q.id, true)));

    return res.json({ data: payload });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch questions";
    return res.status(500).json({ error: message });
  }
});

/**
 * A question's skill decides whether its answers count towards mastery, difficult-skill analysis and recommendations.
 * An unknown skill id is refused (it would otherwise fail later as a database error); a question attached to a lesson but
 * given no skill inherits the lesson's first skill; a question with no skill at all is allowed but flagged in the question bank.
 */
async function resolveQuestionSkill(skillId: unknown, lessonId: unknown): Promise<{ skillId: string | null; inherited: boolean }> {
  if (skillId !== undefined && skillId !== null && skillId !== "") {
    if (typeof skillId !== "string") throw Object.assign(new Error("skillId must be text."), { status: 400 });
    if (!(await dbService.getSkillById(skillId))) throw Object.assign(new Error("That skill does not exist."), { status: 400 });
    return { skillId, inherited: false };
  }
  if (typeof lessonId === "string" && lessonId) {
    const lesson: any = await dbService.getLessonById(lessonId);
    const inherited = lesson?.skills?.[0]?.skillId ?? lesson?.skills?.[0]?.skill?.id ?? lesson?.skillIds?.[0] ?? null;
    if (inherited) return { skillId: inherited, inherited: true };
  }
  return { skillId: null, inherited: false };
}
const skillErrorStatus = (e: unknown) => (e && typeof e === "object" && (e as any).status === 400 ? 400 : null);

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

    const skill = await resolveQuestionSkill(skillId, lessonId);
    const question = await dbService.createQuestion(
      {
        lessonId,
        skillId: skill.skillId ?? undefined,
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
    return res.status(skillErrorStatus(error) ?? ownershipStatus(message) ?? 500).json({ error: message });
  }
});

// Get single question by ID
app.get("/api/questions/:id", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session) return res.status(401).json({ error: "Unauthorized: Please sign in." });
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
    // a skill that is being set must exist; clearing it (null) is allowed; leaving it out changes nothing
    if (req.body && Object.prototype.hasOwnProperty.call(req.body, "skillId") && req.body.skillId) await resolveQuestionSkill(req.body.skillId, undefined);
    const updated = await dbService.updateQuestion(id, req.body, session.userId);
    return res.json({ data: updated });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to update question";
    return res.status(skillErrorStatus(error) ?? 500).json({ error: message });
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
    // a skill that is being set must exist; clearing it (null) is allowed; leaving it out changes nothing
    if (req.body && Object.prototype.hasOwnProperty.call(req.body, "skillId") && req.body.skillId) await resolveQuestionSkill(req.body.skillId, undefined);
    const updated = await dbService.updateQuestion(id, req.body, session.userId);
    return res.json({ data: updated });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to update question";
    return res.status(skillErrorStatus(error) ?? 500).json({ error: message });
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
    if (!session) return res.status(401).json({ error: "Unauthorized: Please sign in." });
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
    if (!session) return res.status(401).json({ error: "Unauthorized: Please sign in." });
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
    // expected, student-facing conditions are not server faults
    const status = /not found/i.test(message) ? 404 : /not published|contains no questions/i.test(message) ? 409 : 500;
    return res.status(status).json({ error: status === 500 ? "Failed to start practice session" : message });
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
      inputChannel,
      helpLevel,
      studentAnswer,
    } = req.body;

    if (studentQuery !== undefined && studentQuery !== null && typeof studentQuery !== "string") {
      return res.status(400).json({ error: "studentQuery must be text." });
    }
    if (inputChannel !== undefined && inputChannel !== "voice" && inputChannel !== "text") {
      return res.status(400).json({ error: "inputChannel must be \"voice\" or \"text\"." });
    }
    // A spoken turn is one short utterance: a long transcript means the microphone ran on or the engine looped.
    if (inputChannel === "voice" && typeof studentQuery === "string" && studentQuery.length > 500) {
      return res.status(400).json({ error: "That recording was too long. Please say it again in a shorter sentence, or type it." });
    }

    const result = await AITutorService.interact({
      studentId: session.userId,
      conversationId,
      lessonId,
      skillId,
      questionId,
      practiceSessionId,
      studentQuery: studentQuery ?? undefined,
      inputChannel,
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
app.get("/api/ai/settings", async (req: Request, res: Response) => {
  try {
    if (!getSessionFromRequest(req)) return res.status(401).json({ error: "Unauthorized: Please sign in." });
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
    // A teacher may open an insight only for a student in one of their own active classes (administrators: any).
    if (session.role === "TEACHER" && (insight as any).studentId !== session.userId) {
      const ok = await TeacherService.isTeacherAuthorizedForStudent(session.userId, (insight as any).studentId, session.role);
      if (!ok) return res.status(404).json({ error: "Insight not found or access denied." });
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
    if (/No skills are available/.test(message)) return res.json({ data: null });
    return res.status(/not found/i.test(message) ? 404 : 500).json({ error: message });
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
    if (/No skills are available/.test(message)) return res.json({ data: null });
    return res.status(/not found/i.test(message) ? 404 : 500).json({ error: message });
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

    const classId = typeof req.query.classId === "string" && req.query.classId ? req.query.classId : undefined;
    const dashboard = await TeacherService.getTeacherDashboard(session.userId, session.role, { classId });
    return res.json({ data: dashboard });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load teacher dashboard";
    console.error("Teacher dashboard API error:", error);
    return res.status(message.includes("Forbidden") ? 403 : 500).json({ error: message });
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
    await dbService.recordAudit({ actorId: session.userId, action: "admin.user.create", targetType: "user", targetId: user.id, detail: { role }, ip: req.ip });
    return res.status(201).json({ data: { id: user.id, email: user.email, name: user.name, role: user.role } });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to create user";
    return res.status(400).json({ error: message });
  }
});

// ---- Account controls (administrators only) ----
const requireAdmin = (req: Request, res: Response): SessionPayload | null => {
  const session = getSessionFromRequest(req);
  if (!session || session.role !== "ADMIN") {
    res.status(403).json({ error: "Forbidden: Administrator role required" });
    return null;
  }
  return session;
};

async function adminTarget(req: Request, res: Response, session: SessionPayload, opts: { allowSelf?: boolean } = {}) {
  const target = await dbService.getAuthState(req.params.userId);
  if (!target) { res.status(404).json({ error: "User not found" }); return null; }
  if (!opts.allowSelf && target.id === session.userId) {
    res.status(409).json({ error: "You cannot do this to your own account. Ask another administrator." });
    return null;
  }
  return target;
}

app.post("/api/admin/users/:userId/disable", async (req: Request, res: Response) => {
  try {
    const session = requireAdmin(req, res); if (!session) return;
    const target = await adminTarget(req, res, session); if (!target) return;
    if (target.role === "ADMIN" && !target.disabled && (await dbService.countActiveAdmins()) <= 1) {
      return res.status(409).json({ error: "This is the last active administrator and cannot be disabled." });
    }
    await dbService.setUserDisabled(target.id, true);
    await dbService.recordAudit({ actorId: session.userId, action: "admin.user.disable", targetType: "user", targetId: target.id, ip: req.ip });
    return res.json({ success: true });
  } catch (error) { return res.status(500).json({ error: error instanceof Error ? error.message : "Failed" }); }
});

app.post("/api/admin/users/:userId/enable", async (req: Request, res: Response) => {
  try {
    const session = requireAdmin(req, res); if (!session) return;
    const target = await adminTarget(req, res, session, { allowSelf: true }); if (!target) return;
    await dbService.setUserDisabled(target.id, false); // old sessions stay revoked
    await dbService.recordAudit({ actorId: session.userId, action: "admin.user.enable", targetType: "user", targetId: target.id, ip: req.ip });
    return res.json({ success: true });
  } catch (error) { return res.status(500).json({ error: error instanceof Error ? error.message : "Failed" }); }
});

app.post("/api/admin/users/:userId/revoke-sessions", async (req: Request, res: Response) => {
  try {
    const session = requireAdmin(req, res); if (!session) return;
    const target = await adminTarget(req, res, session, { allowSelf: true }); if (!target) return;
    await dbService.revokeSessions(target.id);
    await dbService.recordAudit({ actorId: session.userId, action: "admin.user.revoke_sessions", targetType: "user", targetId: target.id, ip: req.ip });
    return res.json({ success: true });
  } catch (error) { return res.status(500).json({ error: error instanceof Error ? error.message : "Failed" }); }
});

app.post("/api/admin/users/:userId/role", async (req: Request, res: Response) => {
  try {
    const session = requireAdmin(req, res); if (!session) return;
    const role = req.body?.role;
    if (typeof role !== "string" || !["STUDENT", "TEACHER", "ADMIN"].includes(role)) return res.status(400).json({ error: "Role must be STUDENT, TEACHER or ADMIN" });
    const target = await adminTarget(req, res, session); if (!target) return;
    if (target.role === "ADMIN" && role !== "ADMIN" && !target.disabled && (await dbService.countActiveAdmins()) <= 1) {
      return res.status(409).json({ error: "This is the last active administrator and cannot be demoted." });
    }
    await dbService.setUserRole(target.id, role as UserRole); // also revokes the user's sessions
    await dbService.recordAudit({ actorId: session.userId, action: "admin.user.role", targetType: "user", targetId: target.id, detail: { from: target.role, to: role }, ip: req.ip });
    return res.json({ success: true });
  } catch (error) { return res.status(500).json({ error: error instanceof Error ? error.message : "Failed" }); }
});

app.post("/api/admin/users/:userId/reset-password", async (req: Request, res: Response) => {
  try {
    const session = requireAdmin(req, res); if (!session) return;
    const target = await adminTarget(req, res, session); if (!target) return;
    let temp: string;
    try { temp = validateNewPassword(req.body?.temporaryPassword); } catch (e) { return res.status(400).json({ error: e instanceof Error ? e.message : "Invalid password" }); }
    await dbService.updateUserPassword(target.id, await hashPassword(temp)); // revokes all their sessions
    await dbService.recordAudit({ actorId: session.userId, action: "admin.user.reset_password", targetType: "user", targetId: target.id, ip: req.ip });
    return res.json({ success: true, note: "Give the temporary password to the user privately and ask them to change it after signing in." });
  } catch (error) { return res.status(500).json({ error: error instanceof Error ? error.message : "Failed" }); }
});

app.get("/api/admin/audit", async (req: Request, res: Response) => {
  try {
    const session = requireAdmin(req, res); if (!session) return;
    const result = await dbService.listAudit({
      limit: req.query.limit ? Number(req.query.limit) : 50,
      offset: req.query.offset ? Number(req.query.offset) : 0,
      action: typeof req.query.action === "string" ? req.query.action : undefined,
    });
    return res.json({ data: result });
  } catch (error) { return res.status(500).json({ error: error instanceof Error ? error.message : "Failed" }); }
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

    await dbService.updateUserPassword(user.id, await hashPassword(validatedNew)); // also revokes every older session
    clearLoginFailures([keys[0]]);
    await dbService.recordAudit({ actorId: user.id, action: "auth.password.change", targetType: "user", targetId: user.id, ip: req.ip });
    // Keep THIS device signed in with a fresh token; every other device must sign in again.
    const fresh = await dbService.getAuthState(user.id);
    const token = issueSession(req, res, { id: user.id, email: user.email, name: user.name, role: user.role, sessionVersion: fresh?.sessionVersion ?? 0 });
    return res.json({ success: true, token, note: "Password changed. All your other devices have been signed out." });
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

function sendAssessmentError(res: Response, error: unknown, fallback: string) {
  if (error instanceof AssessmentError) return res.status(error.status).json({ error: error.message });
  if (error instanceof ClassroomError) return res.status(error.status).json({ error: error.message });
  console.error(fallback, error instanceof Error ? error.message : error);
  return res.status(500).json({ error: fallback });
}
const requireStudent = (req: Request, res: Response): SessionPayload | null => {
  const session = getSessionFromRequest(req);
  if (!session) { res.status(401).json({ error: "Unauthorized: Please log in." }); return null; }
  if (session.role !== "STUDENT") { res.status(403).json({ error: "Forbidden: Only students take assessments." }); return null; }
  return session;
};

// Teacher creates assessment
app.post("/api/teacher/assessments", async (req: Request, res: Response) => {
  try {
    const session = requireStaff(req, res);
    if (!session) return;
    const { title, description, type, lessonId, gradeLevel, timeLimitMinutes, passingScorePercent, questions } = req.body ?? {};
    const assessment = await AssessmentService.createAssessment({ title, description, type, lessonId, gradeLevel, timeLimitMinutes, passingScorePercent, questions }, session.userId, session.role);
    return res.status(201).json({ data: assessment });
  } catch (error: unknown) {
    return sendAssessmentError(res, error, "Failed to create assessment");
  }
});

// Teacher/Admin lists their assessments
app.get("/api/teacher/assessments", async (req: Request, res: Response) => {
  try {
    const session = requireStaff(req, res);
    if (!session) return;
    const { type, status, gradeLevel, lessonId } = req.query;
    const list = await AssessmentService.listAssessments(
      { type: type as any, status: status as any, gradeLevel: gradeLevel ? Number(gradeLevel) : undefined, lessonId: lessonId as string | undefined },
      session.userId, session.role
    );
    return res.json({ data: list });
  } catch (error: unknown) {
    return sendAssessmentError(res, error, "Failed to list assessments");
  }
});

// Teacher publishes assessment
app.post("/api/teacher/assessments/:id/publish", async (req: Request, res: Response) => {
  try {
    const session = requireStaff(req, res);
    if (!session) return;
    return res.json({ data: await AssessmentService.publishAssessment(req.params.id, session.userId, session.role) });
  } catch (error: unknown) {
    return sendAssessmentError(res, error, "Failed to publish assessment");
  }
});

// Teacher archives assessment (students lose access; results stay)
app.post("/api/teacher/assessments/:id/archive", async (req: Request, res: Response) => {
  try {
    const session = requireStaff(req, res);
    if (!session) return;
    return res.json({ data: await AssessmentService.archiveAssessment(req.params.id, session.userId, session.role) });
  } catch (error: unknown) {
    return sendAssessmentError(res, error, "Failed to archive assessment");
  }
});

// Teacher assigns assessment to one of their classes
app.post("/api/teacher/assessments/:id/assign", async (req: Request, res: Response) => {
  try {
    const session = requireStaff(req, res);
    if (!session) return;
    const { classroomId, studentId, dueDate } = req.body ?? {};
    const result = await AssessmentService.assignAssessment(req.params.id, classroomId, { studentId, dueDate }, session.userId, session.role);
    return res.json({ data: result });
  } catch (error: unknown) {
    return sendAssessmentError(res, error, "Failed to assign assessment");
  }
});

// Teacher/Admin: how an assessment went (their own assessments only)
app.get("/api/teacher/assessments/:id/results", async (req: Request, res: Response) => {
  try {
    const session = requireStaff(req, res);
    if (!session) return;
    return res.json({ data: await AssessmentService.getResults(req.params.id, session.userId, session.role) });
  } catch (error: unknown) {
    return sendAssessmentError(res, error, "Failed to load results");
  }
});

// Student lists the assessments assigned to them
app.get("/api/student/assessments", async (req: Request, res: Response) => {
  try {
    const session = requireStudent(req, res);
    if (!session) return;
    return res.json({ data: await AssessmentService.listForStudent(session.userId) });
  } catch (error: unknown) {
    return sendAssessmentError(res, error, "Failed to retrieve assessments");
  }
});

// Student reads the result of their own graded attempt (declared before /:id so "attempts" is not an id)
app.get("/api/student/assessments/attempts/:attemptId", async (req: Request, res: Response) => {
  try {
    const session = requireStudent(req, res);
    if (!session) return;
    return res.json({ data: await AssessmentService.getAttemptResult(req.params.attemptId, session.userId) });
  } catch (error: unknown) {
    return sendAssessmentError(res, error, "Failed to load the result");
  }
});

// Student gets an assigned assessment (answer keys are never included)
app.get("/api/student/assessments/:id", async (req: Request, res: Response) => {
  try {
    const session = requireStudent(req, res);
    if (!session) return;
    return res.json({ data: await AssessmentService.getAssessmentForStudent(req.params.id, session.userId) });
  } catch (error: unknown) {
    return sendAssessmentError(res, error, "Failed to get assessment");
  }
});

// Student starts (or resumes) an attempt
app.post("/api/student/assessments/:id/start", async (req: Request, res: Response) => {
  try {
    const session = requireStudent(req, res);
    if (!session) return;
    const attempt = await AssessmentService.startAssessmentAttempt(req.params.id, session.userId);
    return res.status(attempt.resumed ? 200 : 201).json({ data: attempt });
  } catch (error: unknown) {
    return sendAssessmentError(res, error, "Failed to start assessment attempt");
  }
});

// Student submits an attempt (server-side deterministic grading, once)
app.post("/api/student/assessments/attempts/:attemptId/submit", async (req: Request, res: Response) => {
  try {
    const session = requireStudent(req, res);
    if (!session) return;
    const { responses } = req.body ?? {};
    if (!Array.isArray(responses)) return res.status(400).json({ error: "responses must be an array of answers." });
    return res.json({ data: await AssessmentService.submitAssessmentAttempt(req.params.attemptId, session.userId, responses) });
  } catch (error: unknown) {
    return sendAssessmentError(res, error, "Failed to submit assessment");
  }
});

// Teacher/Admin views research profile for a student (IDOR scoped)
// ---- Research scope: a teacher sees research data only for students in their own active classes. ----
async function researchScopeFor(session: SessionPayload, classroomId?: string): Promise<ResearchScope> {
  if (classroomId) {
    const cls = await ClassroomService.getManageable(actorOf(session), classroomId); // 403/404 for classes that are not theirs
    return { studentIds: (await ClassroomRepo.listEnrollments([cls.id])).map((e) => e.studentId) };
  }
  if (session.role === "ADMIN") return { studentIds: null };
  const classes = await ClassroomRepo.listForTeacher(session.userId);
  const enrollments = await ClassroomRepo.listEnrollments(classes.map((c) => c.id));
  return { studentIds: Array.from(new Set(enrollments.map((e) => e.studentId))) };
}

const requireStaff = (req: Request, res: Response): SessionPayload | null => {
  const session = getSessionFromRequest(req);
  if (!session || (session.role !== "TEACHER" && session.role !== "ADMIN")) {
    res.status(403).json({ error: "Forbidden: Teacher or Administrator access required." });
    return null;
  }
  return session;
};

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
    return researchError(res, error, "Failed to load student research profile");
  }
});

// Resolves which pre/post assessments to compare: the ones asked for, else (database mode) the latest PRE_TEST / POST_TEST.
async function resolveComparisonTests(req: Request): Promise<{ pre: string; post: string }> {
  let pre = typeof req.query.preTestId === "string" ? req.query.preTestId : "";
  let post = typeof req.query.postTestId === "string" ? req.query.postTestId : "";
  if (hasValidDatabaseUrl) {
    const { prisma } = await import("./src/lib/db.ts");
    if (!pre) pre = (await prisma.assessment.findFirst({ where: { type: "PRE_TEST" }, orderBy: { createdAt: "desc" }, select: { id: true } }))?.id ?? "";
    if (!post) post = (await prisma.assessment.findFirst({ where: { type: "POST_TEST" }, orderBy: { createdAt: "desc" }, select: { id: true } }))?.id ?? "";
  } else {
    pre = pre || "asm_pre_integers";
    post = post || "asm_post_integers";
  }
  return { pre, post };
}

const researchError = (res: Response, error: unknown, fallback: string) => {
  if (error instanceof ClassroomError) return res.status(error.status).json({ error: error.message });
  const message = error instanceof Error ? error.message : fallback;
  return res.status(/not found/i.test(message) ? 404 : 500).json({ error: message });
};

// Teacher/Admin views Pre-Test vs Post-Test comparison (their own students only)
app.get("/api/teacher/research/comparison", async (req: Request, res: Response) => {
  try {
    const session = requireStaff(req, res);
    if (!session) return;
    const classroomId = typeof req.query.classroomId === "string" ? req.query.classroomId : undefined;
    const scope = await researchScopeFor(session, classroomId);
    const classroom = classroomId ? await ClassroomService.getManageable(actorOf(session), classroomId) : undefined;
    const { pre, post } = await resolveComparisonTests(req);
    const comparison = await ResearchService.getPrePostComparison(scope, pre, post, classroom ? { id: classroom.id, name: classroom.name } : undefined);
    return res.json({ data: comparison });
  } catch (error: unknown) {
    return researchError(res, error, "Failed to compute pre/post comparison");
  }
});

app.get("/api/teacher/research/difficult-skills", async (req: Request, res: Response) => {
  try {
    const session = requireStaff(req, res);
    if (!session) return;
    const gradeLevel = req.query.grade ? Number(req.query.grade) : undefined;
    const scope = await researchScopeFor(session, typeof req.query.classroomId === "string" ? req.query.classroomId : undefined);
    return res.json({ data: await ResearchService.getDifficultSkills(scope, { gradeLevel }) });
  } catch (error: unknown) {
    return researchError(res, error, "Failed to analyze difficult skills");
  }
});

app.get("/api/teacher/research/mistakes", async (req: Request, res: Response) => {
  try {
    const session = requireStaff(req, res);
    if (!session) return;
    const scope = await researchScopeFor(session, typeof req.query.classroomId === "string" ? req.query.classroomId : undefined);
    return res.json({ data: await ResearchService.getMistakeAnalytics(scope) });
  } catch (error: unknown) {
    return researchError(res, error, "Failed to load mistake analytics");
  }
});

// Intervention observations (strictly non-causal)
app.get("/api/teacher/research/interventions", async (req: Request, res: Response) => {
  try {
    const session = requireStaff(req, res);
    if (!session) return;
    const scope = await researchScopeFor(session, typeof req.query.classroomId === "string" ? req.query.classroomId : undefined);
    return res.json({ data: await ResearchService.getInterventionObservations(scope) });
  } catch (error: unknown) {
    return researchError(res, error, "Failed to load intervention observations");
  }
});

app.get("/api/teacher/research/time-series", async (req: Request, res: Response) => {
  try {
    const session = requireStaff(req, res);
    if (!session) return;
    const scope = await researchScopeFor(session, typeof req.query.classroomId === "string" ? req.query.classroomId : undefined);
    return res.json({ data: await ResearchService.getTimeSeriesMetrics(scope) });
  } catch (error: unknown) {
    return researchError(res, error, "Failed to load time series metrics");
  }
});

const MAX_EXPORT_STUDENTS = 300;
const sendCsv = (res: Response, name: string, csv: string) => {
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${name}_${Date.now()}.csv"`);
  return res.send(csv);
};

// Standardised research metrics CSV: one profile per student in scope
app.get("/api/teacher/research/export/metrics.csv", async (req: Request, res: Response) => {
  try {
    const session = requireStaff(req, res);
    if (!session) return;
    const scope = await researchScopeFor(session, typeof req.query.classroomId === "string" ? req.query.classroomId : undefined);
    const ids = scope.studentIds ?? (await dbService.listUsers({ limit: 200 })).users.filter((u: any) => u.role === "STUDENT").map((u: any) => u.id);
    const profiles = [];
    for (const id of ids.slice(0, MAX_EXPORT_STUDENTS)) profiles.push(await ResearchService.getStudentResearchProfile(id));
    return sendCsv(res, "tuklas_research_metrics", ResearchExporter.exportMetricsSummaryCsv(profiles));
  } catch (error: unknown) {
    return researchError(res, error, "Failed to export metrics CSV");
  }
});

// Raw question attempt evidence CSV (students in scope only)
app.get("/api/teacher/research/export/attempts.csv", async (req: Request, res: Response) => {
  try {
    const session = requireStaff(req, res);
    if (!session) return;
    const scope = await researchScopeFor(session, typeof req.query.classroomId === "string" ? req.query.classroomId : undefined);
    const rows = await ResearchData.attempts(scope);
    const names = await ResearchData.students(Array.from(new Set(rows.map((r) => r.studentId))));
    const csv = ResearchExporter.exportQuestionAttemptsCsv(
      rows.map((a) => ({
        studentId: a.studentId,
        studentName: names.get(a.studentId)?.name ?? "",
        questionId: a.questionId,
        skillId: a.skillId,
        lessonId: a.lessonId,
        attemptNumber: a.attemptNumber,
        isCorrect: a.isCorrect,
        difficulty: a.difficulty,
        questionType: a.questionType,
        cognitiveLevel: a.cognitiveLevel,
        timeTakenMs: a.timeTakenMs ?? undefined,
        hintUsed: a.hintUsed,
        submittedAt: a.submittedAt,
      })) as any
    );
    return sendCsv(res, "tuklas_question_attempts", csv);
  } catch (error: unknown) {
    return researchError(res, error, "Failed to export attempts CSV");
  }
});

app.get("/api/teacher/research/export/comparison.csv", async (req: Request, res: Response) => {
  try {
    const session = requireStaff(req, res);
    if (!session) return;
    const classroomId = typeof req.query.classroomId === "string" ? req.query.classroomId : undefined;
    const scope = await researchScopeFor(session, classroomId);
    const classroom = classroomId ? await ClassroomService.getManageable(actorOf(session), classroomId) : undefined;
    const { pre, post } = await resolveComparisonTests(req);
    const comparison = await ResearchService.getPrePostComparison(scope, pre, post, classroom ? { id: classroom.id, name: classroom.name } : undefined);
    return sendCsv(res, "tuklas_pre_post_comparison", ResearchExporter.exportPrePostComparisonCsv([comparison]));
  } catch (error: unknown) {
    return researchError(res, error, "Failed to export comparison CSV");
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
