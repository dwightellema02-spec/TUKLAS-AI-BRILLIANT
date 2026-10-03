# Tuklas AI — Mathisipan / YouTube Video Integration Specification

## 1. Overview & Architecture

The Mathisipan / YouTube Video Integration brings curriculum-aligned multimedia resources into Tuklas AI without compromising pedagogical boundaries, student privacy, or intellectual property rights.

### Core Architecture Principles
- **No Video Re-hosting or Scraping:** Tuklas never downloads, copies, re-hosts, or scrapes YouTube video files, transcripts, or copyrighted assets. Videos remain hosted exclusively on Google's YouTube infrastructure.
- **Privacy-Enhanced Official Embeds:** Embeds use Google's official privacy-enhanced mode (`https://www.youtube-nocookie.com/embed/{VIDEO_ID}?rel=0&modestbranding=1`) with strict `referrerPolicy="strict-origin-when-cross-origin"` and standard sandboxed feature allowances.
- **Unified Resource Hierarchy:** Integrates into the existing `LessonResource` database model (`type: "YOUTUBE"`), preventing redundant schemas while preserving sequence ordering and multi-resource support (PDFs, teacher notes, videos).

---

## 2. Mathisipan Source Handling

Mathisipan is an educational initiative producing video tutorials aligned with the Department of Education (DepEd) MATATAG Mathematics curriculum for junior high school (Grades 7, 8, 9, and 10).

- **Channel Attribution:** Videos are attributed with `channelName: "Mathisipan"`, `channelHandle: "@mathisipan"`, and channel identification.
- **Curated Multi-Grade Directory (`src/config/youtube.ts`):** Pre-vetted MATATAG curriculum directory covering:
  - **Grade 7:** Integers, number lines, operations on signed numbers, additive inverses, absolute values.
  - **Grade 8:** Linear equations in two variables, slope and intercepts, systems of linear equations.
  - **Grade 9:** Quadratic equations, factoring, quadratic formula.
  - **Grade 10:** Arithmetic and geometric sequences and series.
- **DepEd MATATAG Alignment:** Videos are tagged with unit codes, competencies, and recommended duration.

---

## 3. YouTube URL Security & Validation

The parser (`src/lib/youtube/youtube-parser.ts`) enforces strict sanitation before any video ID is stored:

### Allowed URL Structures
1. Desktop watch URLs: `https://www.youtube.com/watch?v={11_CHAR_ID}`
2. Mobile watch URLs: `https://m.youtube.com/watch?v={11_CHAR_ID}`
3. Shortened share URLs: `https://youtu.be/{11_CHAR_ID}`
4. Embed URLs: `https://www.youtube.com/embed/{11_CHAR_ID}`
5. YouTube Shorts: `https://www.youtube.com/shorts/{11_CHAR_ID}`
6. Direct 11-character video IDs: `^[a-zA-Z0-9_-]{11}$`

### Rejected / Blocked Inputs
- **Malicious Pseudo-Protocols:** `javascript:`, `data:`, `vbscript:`, `file:`
- **Third-Party & Unapproved Domains:** e.g., `vimeo.com`, `dailymotion.com`, `tiktok.com`
- **Subdomain Phishing & Spoofing:** e.g., `youtube.com.attacker.com`
- **Malformed IDs:** Strings shorter or longer than 11 characters or containing non-alphanumeric/`-_` characters.

---

## 4. API Configuration, Caching & Quota Safety

The service orchestrator (`src/lib/youtube/youtube-service.ts`) executes a multi-tiered lookup strategy:

```
[Search Request]
      │
      ▼
1. Memory Cache (10-minute TTL per query/grade)
      │ (Cache miss)
      ▼
2. YouTube Data API v3 (Optional, via process.env.YOUTUBE_API_KEY)
      │ (Quota error 403 / API Key absent)
      ▼
3. Mathisipan Curated Catalog (In-memory fallback with verified metadata)
```

- **Server-Side API Key:** `YOUTUBE_API_KEY` is read strictly on the Node.js backend. It is never exposed to browser bundles or client env configurations.
- **Quota Exceeded Handling:** When Google Cloud YouTube API quotas are reached (`QUOTA_EXCEEDED`), the service switches to the curated Mathisipan directory and returns `fallbackUsed: true` with a descriptive message.

---

## 5. Manual URL Fallback

In the Teacher Content Studio (`YouTubeResourceModal.tsx`), teachers have access to a dedicated **"Paste YouTube URL"** tab:
- Enables direct entry of any YouTube video URL even if search is unavailable or the external API is offline.
- Runs client-side validation against `parseYouTubeUrl()` with real-time feedback.
- Performs server-side preview validation via `POST /api/youtube/validate`.
- Previews video thumbnail, title, and channel before the teacher confirms attachment.

---

## 6. Clear Attribution & Safe Player UI

The video player (`src/components/video/YouTubeVideo.tsx`) provides:
- **Attribution Banner:** `"Mathisipan Concept Video"` or `"Curated Educational Video"` with `"Video source: Mathisipan"` notice.
- **Direct Link:** `"Watch on YouTube"` button with `target="_blank"` and `rel="noopener noreferrer"`.
- **MATATAG Alignment Pill:** Displays DepEd MATATAG curriculum alignment.
- **Responsive Player:** 16:9 aspect-ratio container with lazy loading.

---

## 7. AI Tutor Integration Boundary

The Socratic AI Tutor (`src/lib/ai/tutor.ts`) interacts with video-equipped lessons according to clear pedagogical boundaries:
- **No False Claims:** The AI Tutor does not claim to have "watched" or "seen" the video.
- **Contextual Awareness:** The tutor recognizes that a video resource exists for the lesson and can recommend: *"Have you watched the Mathisipan concept video at the top of this lesson? It shows a visual counter demonstration for this exact concept!"*
- **Grounding:** The tutor's guidance is grounded strictly in approved lesson objectives, content blocks, and validated mathematical definitions.

---

## 8. Role-Based Security & Authorization

- **Student Protection:** Students cannot attach, modify, reorder, or delete video resources (`POST /api/lessons/:id/video` and `DELETE /api/lessons/:id/video/:resourceId` return HTTP 403 Forbidden).
- **Teacher Isolation (IDOR Defense):** Teachers can only attach or delete videos on lessons they own (`lesson.authorId === session.userId`). Non-owning teachers receive HTTP 403 Forbidden unless they possess the `ADMIN` role.
- **Publication Gating:** Students can only view lessons with `status === "PUBLISHED"`. Draft, in-review, or archived lessons return HTTP 403 Forbidden.

---

## 9. End-to-End Workflows

### Teacher Workflow
1. Log in with `TEACHER` credentials.
2. Open Teacher Content Studio (`/teacher/lessons/:id/edit`).
3. Under **Attached Resources**, click **"Add YouTube"**.
4. In the modal:
   - Search curated Mathisipan videos by Grade (7-10) and keyword, OR
   - Paste a YouTube URL in the manual tab.
5. Review the preview and click **"Attach Video Resource"**.
6. The resource is persisted to PostgreSQL and `lesson.videoUrl` is updated.
7. Click **"Publish to Students"** to make the lesson active.

### Student Workflow
1. Log in with `STUDENT` credentials.
2. Open published lesson (`/student/lessons/:id`).
3. Embedded Mathisipan video appears at the top of the lesson stage.
4. Clicking the video records a transparent `VIDEO_OPENED` event (no fabricated watch duration).
5. Student works through conceptual text, interactive number lines, and formative checkpoints.
6. Student continues to targeted skill practice, with Socratic AI Tutor assistance as needed.
