/**
 * Tuklas AI - Unified YouTube & Mathisipan Service
 * Phase 13: Search Orchestration, In-Memory Caching, and Quota Fallback
 */

import { YOUTUBE_CONFIG } from "@/config/youtube";
import {
  MathisipanCuratedProvider,
  YouTubeDataApiProvider,
} from "./youtube-provider";
import { parseYouTubeUrl } from "./youtube-parser";
import type {
  YouTubeSearchQuery,
  YouTubeSearchResponse,
  YouTubeSearchResult,
  YouTubeValidationResult,
} from "./youtube-types";

interface CacheEntry {
  timestamp: number;
  data: YouTubeSearchResult[];
}

export class YouTubeService {
  private static cache = new Map<string, CacheEntry>();
  private static curatedProvider = new MathisipanCuratedProvider();

  /**
   * Primary search entry point.
   * Tries in-memory cache -> External API (if key configured) -> Curated Mathisipan Catalog.
   */
  static async searchVideos(query: YouTubeSearchQuery): Promise<YouTubeSearchResponse> {
    const cacheKey = JSON.stringify({
      q: (query.query || "").toLowerCase().trim(),
      g: query.gradeLevel || null,
      t: query.termNumber || null,
      l: query.limit || 8,
    });

    // 1. Check Memory Cache
    const cached = this.cache.get(cacheKey);
    const now = Date.now();
    if (cached && now - cached.timestamp < YOUTUBE_CONFIG.search.cacheTtlMs) {
      return {
        items: cached.data,
        total: cached.data.length,
        provider: "CACHE",
        quotaExceeded: false,
        fallbackUsed: false,
      };
    }

    let results: YouTubeSearchResult[] = [];
    let providerName = "MATHISIPAN_CURATED";
    let quotaExceeded = false;
    let fallbackUsed = false;
    let message: string | undefined;

    // 2. Try External API if configured
    const apiKey = typeof process !== "undefined" ? process.env.YOUTUBE_API_KEY : undefined;

    if (apiKey) {
      try {
        const apiProvider = new YouTubeDataApiProvider(apiKey);
        const apiResults = await apiProvider.search(query);
        if (apiResults.length > 0) {
          results = apiResults;
          providerName = "YOUTUBE_DATA_API";
        }
      } catch (err: any) {
        if (err.message === "QUOTA_EXCEEDED") {
          quotaExceeded = true;
          fallbackUsed = true;
          message = "YouTube search API quota exceeded. Switched to verified Mathisipan curated catalog.";
          console.warn("YouTube API Quota exceeded, activating Mathisipan curated catalog fallback.");
        } else {
          console.warn("YouTube Data API call failed, falling back to curated catalog:", err.message);
        }
      }
    }

    // 3. Fallback to Curated Mathisipan Catalog if no API results
    if (results.length === 0) {
      results = await this.curatedProvider.search(query);
      providerName = "MATHISIPAN_CURATED";
      if (!fallbackUsed && apiKey) {
        fallbackUsed = true;
      }
    }

    // 4. Save to Cache
    this.cache.set(cacheKey, { timestamp: now, data: results });

    return {
      items: results,
      total: results.length,
      provider: providerName,
      quotaExceeded,
      fallbackUsed,
      message,
    };
  }

  /**
   * Validate and get preview metadata for a video URL or ID
   */
  static async validateAndPreview(input: string): Promise<YouTubeValidationResult> {
    const parsed = parseYouTubeUrl(input);
    if (!parsed.isValid || !parsed.videoId) {
      return parsed;
    }

    // Look up in curated list first
    const curated = await this.curatedProvider.getVideo(parsed.videoId);
    if (curated) {
      return {
        ...parsed,
        title: curated.title,
        channelName: curated.channelName,
      };
    }

    // If external API key is present, look up metadata
    const apiKey = typeof process !== "undefined" ? process.env.YOUTUBE_API_KEY : undefined;
    if (apiKey) {
      try {
        const apiProvider = new YouTubeDataApiProvider(apiKey);
        const meta = await apiProvider.getVideo(parsed.videoId);
        if (meta) {
          return {
            ...parsed,
            title: meta.title,
            channelName: meta.channelName,
          };
        }
      } catch {}
    }

    return {
      ...parsed,
      title: parsed.title || `Mathisipan / YouTube Video (${parsed.videoId})`,
      channelName: parsed.channelName || YOUTUBE_CONFIG.mathisipan.channelName,
    };
  }
}
