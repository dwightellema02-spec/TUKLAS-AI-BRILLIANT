/**
 * Tuklas AI - YouTube Search Providers
 * Phase 13: Mathisipan / YouTube Educational Video Integration
 */

import {
  YOUTUBE_CONFIG,
  MATHISIPAN_CURATED_VIDEOS,
  MathisipanCuratedVideo,
} from "@/config/youtube";
import type {
  IYouTubeProvider,
  YouTubeSearchQuery,
  YouTubeSearchResult,
} from "./youtube-types";

/**
 * 1. Curated Mathisipan Provider
 * Uses verified, vetted Mathisipan DepEd MATATAG curriculum videos.
 * Offline resilient, zero quota burn, instant sub-5ms responses.
 */
export class MathisipanCuratedProvider implements IYouTubeProvider {
  async search(query: YouTubeSearchQuery): Promise<YouTubeSearchResult[]> {
    const rawQuery = (query.query || "").toLowerCase().trim();
    const targetGrade = query.gradeLevel;
    const targetTerm = query.termNumber;
    const limit = query.limit || YOUTUBE_CONFIG.search.maxResults;

    const filtered = MATHISIPAN_CURATED_VIDEOS.filter((v: MathisipanCuratedVideo) => {
      // Grade filter
      if (targetGrade && v.gradeLevel !== targetGrade) return false;
      // Term filter
      if (targetTerm && v.termNumber !== targetTerm) return false;

      // Query keywords
      if (!rawQuery) return true;

      const titleMatch = v.title.toLowerCase().includes(rawQuery);
      const descMatch = v.description.toLowerCase().includes(rawQuery);
      const tagMatch = v.tags.some((t) => t.toLowerCase().includes(rawQuery));

      return titleMatch || descMatch || tagMatch;
    });

    return filtered.slice(0, limit).map((v) => this.mapCuratedToResult(v));
  }

  async getVideo(videoId: string): Promise<YouTubeSearchResult | null> {
    const found = MATHISIPAN_CURATED_VIDEOS.find((v) => v.videoId === videoId);
    if (!found) return null;
    return this.mapCuratedToResult(found);
  }

  private mapCuratedToResult(v: MathisipanCuratedVideo): YouTubeSearchResult {
    const cfg = YOUTUBE_CONFIG.mathisipan;
    return {
      id: v.id,
      videoId: v.videoId,
      title: v.title,
      description: v.description,
      channelName: v.channelName,
      channelId: v.channelId,
      channelHandle: v.channelHandle,
      thumbnailUrl: `${cfg.thumbnailBaseUrl}/${v.videoId}/hqdefault.jpg`,
      embedUrl: `${cfg.embedBaseUrl}/${v.videoId}`,
      canonicalUrl: `${cfg.youtubeBaseUrl}/watch?v=${v.videoId}`,
      duration: v.duration,
      gradeLevel: v.gradeLevel,
      termNumber: v.termNumber,
      source: "MATHISIPAN_CURATED",
      isMathisipan: true,
    };
  }
}

/**
 * 2. External YouTube Data API Provider
 * Optional integration using official YouTube Data API v3 when YOUTUBE_API_KEY is configured.
 * Strictly searches for Mathisipan channel or curriculum queries.
 */
export class YouTubeDataApiProvider implements IYouTubeProvider {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async search(query: YouTubeSearchQuery): Promise<YouTubeSearchResult[]> {
    if (!this.apiKey) return [];

    const searchQuery = `${query.query || "Mathisipan"} Mathisipan Mathematics`;
    const maxResults = Math.min(query.limit || 8, 12);
    const endpoint = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&q=${encodeURIComponent(
      searchQuery
    )}&maxResults=${maxResults}&key=${this.apiKey}`;

    const res = await fetch(endpoint, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(6000),
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      const reason = errJson?.error?.errors?.[0]?.reason || res.statusText;
      if (res.status === 403 && reason.includes("quota")) {
        throw new Error("QUOTA_EXCEEDED");
      }
      throw new Error(`YouTube API Error: ${reason}`);
    }

    const data = await res.json();
    const items = data.items || [];
    const cfg = YOUTUBE_CONFIG.mathisipan;

    return items
      .filter((item: any) => item.id?.videoId)
      .map((item: any) => {
        const vid = item.id.videoId;
        const channelTitle = item.snippet?.channelTitle || "Mathisipan";
        const isMathisipan = channelTitle.toLowerCase().includes("mathisipan");

        return {
          id: `yt_api_${vid}`,
          videoId: vid,
          title: item.snippet?.title || "Mathematics Video",
          description: item.snippet?.description || "",
          channelName: channelTitle,
          channelId: item.snippet?.channelId,
          thumbnailUrl:
            item.snippet?.thumbnails?.high?.url ||
            `${cfg.thumbnailBaseUrl}/${vid}/hqdefault.jpg`,
          embedUrl: `${cfg.embedBaseUrl}/${vid}`,
          canonicalUrl: `${cfg.youtubeBaseUrl}/watch?v=${vid}`,
          source: "YOUTUBE_DATA_API" as const,
          isMathisipan,
        };
      });
  }

  async getVideo(videoId: string): Promise<YouTubeSearchResult | null> {
    if (!this.apiKey) return null;

    const endpoint = `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&id=${videoId}&key=${this.apiKey}`;
    const res = await fetch(endpoint, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return null;

    const data = await res.json();
    const item = data.items?.[0];
    if (!item) return null;

    const cfg = YOUTUBE_CONFIG.mathisipan;
    const channelTitle = item.snippet?.channelTitle || "Mathisipan";

    return {
      id: `yt_api_${videoId}`,
      videoId,
      title: item.snippet?.title || "Mathematics Video",
      description: item.snippet?.description || "",
      channelName: channelTitle,
      channelId: item.snippet?.channelId,
      thumbnailUrl: `${cfg.thumbnailBaseUrl}/${videoId}/hqdefault.jpg`,
      embedUrl: `${cfg.embedBaseUrl}/${videoId}`,
      canonicalUrl: `${cfg.youtubeBaseUrl}/watch?v=${videoId}`,
      source: "YOUTUBE_DATA_API",
      isMathisipan: channelTitle.toLowerCase().includes("mathisipan"),
    };
  }
}
