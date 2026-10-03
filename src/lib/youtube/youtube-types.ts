/**
 * Tuklas AI - YouTube Video Integration Types
 * Phase 13: Mathisipan / YouTube Integration
 */

export interface YouTubeValidationResult {
  isValid: boolean;
  videoId?: string;
  embedUrl?: string;
  canonicalUrl?: string;
  thumbnailUrl?: string;
  title?: string;
  channelName?: string;
  error?: string;
}

export interface YouTubeSearchResult {
  id: string;
  videoId: string;
  title: string;
  description: string;
  channelName: string;
  channelId?: string;
  channelHandle?: string;
  thumbnailUrl: string;
  embedUrl: string;
  canonicalUrl: string;
  duration?: string;
  gradeLevel?: number;
  termNumber?: number;
  source: "MATHISIPAN_CURATED" | "YOUTUBE_DATA_API";
  isMathisipan: boolean;
}

export interface YouTubeSearchQuery {
  query?: string;
  gradeLevel?: number;
  termNumber?: number;
  skillId?: string;
  limit?: number;
}

export interface YouTubeSearchResponse {
  items: YouTubeSearchResult[];
  total: number;
  provider: string;
  quotaExceeded: boolean;
  fallbackUsed: boolean;
  message?: string;
}

export interface LessonVideoResourceDTO {
  id: string;
  lessonId: string;
  type: "YOUTUBE";
  provider: "YOUTUBE";
  videoId: string;
  url: string;
  title: string;
  channelName: string;
  thumbnailUrl: string;
  description?: string;
  duration?: string;
  status: "ATTACHED" | "REVIEWED" | "PUBLISHED";
  notes?: string;
  addedById?: string;
  createdAt: string;
  updatedAt: string;
}

export interface IYouTubeProvider {
  search(query: YouTubeSearchQuery): Promise<YouTubeSearchResult[]>;
  getVideo(videoId: string): Promise<YouTubeSearchResult | null>;
}
