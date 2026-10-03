/**
 * Tuklas AI - Secure YouTube URL Parser & Validator
 * Phase 13: Secure URL parsing, ID extraction, and embed URL normalization.
 */

import { YOUTUBE_CONFIG } from "@/config/youtube";
import type { YouTubeValidationResult } from "./youtube-types";

// Standard YouTube 11-character video ID regex
const YOUTUBE_ID_REGEX = /^[a-zA-Z0-9_-]{11}$/;

// Disallowed dangerous protocols
const DANGEROUS_PROTOCOLS = /^(javascript|data|vbscript|file):/i;

// Allowed YouTube hostnames
const ALLOWED_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "youtu.be",
  "www.youtu.be",
  "youtube-nocookie.com",
  "www.youtube-nocookie.com",
]);

/**
 * Validates, parses, and normalizes a candidate YouTube video input.
 * Accepts direct 11-char ID or standard YouTube URLs (watch, share, embed, shorts).
 */
export function parseYouTubeUrl(input: string): YouTubeValidationResult {
  if (!input || typeof input !== "string") {
    return { isValid: false, error: "Please provide a valid YouTube URL." };
  }

  const trimmed = input.trim();

  // 1. Guard against malicious pseudo-protocols
  if (DANGEROUS_PROTOCOLS.test(trimmed)) {
    return {
      isValid: false,
      error: "Security violation: Invalid or potentially dangerous protocol detected.",
    };
  }

  // 2. Direct 11-char video ID support
  if (YOUTUBE_ID_REGEX.test(trimmed)) {
    return buildValidationSuccess(trimmed);
  }

  // 3. Structured URL parsing
  let parsedUrl: URL;
  try {
    // Prefix protocol if omitted by user (e.g., "youtube.com/watch?v=...")
    const urlWithProtocol = trimmed.startsWith("http://") || trimmed.startsWith("https://")
      ? trimmed
      : `https://${trimmed}`;
    parsedUrl = new URL(urlWithProtocol);
  } catch {
    return {
      isValid: false,
      error: "The provided string is not a valid URL format.",
    };
  }

  // 4. Verify hostname belongs strictly to YouTube domains
  const hostname = parsedUrl.hostname.toLowerCase();
  if (!ALLOWED_HOSTS.has(hostname)) {
    return {
      isValid: false,
      error: `Unsupported video provider domain (${parsedUrl.hostname}). Only official YouTube URLs are accepted.`,
    };
  }

  let extractedVideoId: string | null = null;

  // 5. Extract video ID based on YouTube URL structure
  if (hostname === "youtu.be" || hostname === "www.youtu.be") {
    // Format: https://youtu.be/{videoId}
    const pathSegment = parsedUrl.pathname.replace(/^\//, "").split("/")[0];
    if (pathSegment && YOUTUBE_ID_REGEX.test(pathSegment)) {
      extractedVideoId = pathSegment;
    }
  } else {
    // Formats: youtube.com/watch?v={videoId}, /embed/{videoId}, /shorts/{videoId}, /v/{videoId}
    if (parsedUrl.searchParams.has("v")) {
      const v = parsedUrl.searchParams.get("v");
      if (v && YOUTUBE_ID_REGEX.test(v)) {
        extractedVideoId = v;
      }
    } else if (parsedUrl.pathname.startsWith("/embed/")) {
      const id = parsedUrl.pathname.split("/embed/")[1]?.split("/")[0]?.split("?")[0];
      if (id && YOUTUBE_ID_REGEX.test(id)) {
        extractedVideoId = id;
      }
    } else if (parsedUrl.pathname.startsWith("/shorts/")) {
      const id = parsedUrl.pathname.split("/shorts/")[1]?.split("/")[0]?.split("?")[0];
      if (id && YOUTUBE_ID_REGEX.test(id)) {
        extractedVideoId = id;
      }
    } else if (parsedUrl.pathname.startsWith("/v/")) {
      const id = parsedUrl.pathname.split("/v/")[1]?.split("/")[0]?.split("?")[0];
      if (id && YOUTUBE_ID_REGEX.test(id)) {
        extractedVideoId = id;
      }
    }
  }

  if (!extractedVideoId) {
    return {
      isValid: false,
      error: "Could not extract a valid 11-character YouTube video ID. Expected format: https://www.youtube.com/watch?v=...",
    };
  }

  return buildValidationSuccess(extractedVideoId);
}

function buildValidationSuccess(videoId: string): YouTubeValidationResult {
  const cfg = YOUTUBE_CONFIG.mathisipan;
  return {
    isValid: true,
    videoId,
    canonicalUrl: `${cfg.youtubeBaseUrl}/watch?v=${videoId}`,
    embedUrl: `${cfg.embedBaseUrl}/${videoId}`,
    thumbnailUrl: `${cfg.thumbnailBaseUrl}/${videoId}/hqdefault.jpg`,
    channelName: cfg.channelName,
  };
}
