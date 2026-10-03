import React from "react";
import { MathText } from "@/components/ui/MathText";
import { YouTubeVideo } from "@/components/video/YouTubeVideo";

export interface VideoBlockProps {
  title?: string;
  content: string; // Notes or description
  metadata?: string; // JSON with youtubeId, url, channelName
}

export function VideoBlock({ title, content, metadata }: VideoBlockProps) {
  let youtubeId = "";
  let channelName = "Mathisipan";
  let url = "";

  if (metadata) {
    try {
      const parsed = JSON.parse(metadata);
      youtubeId = parsed.youtubeId || "";
      channelName = parsed.channelName || "Mathisipan";
      url = parsed.url || "";
    } catch {}
  }

  // Fallback: check if content or metadata has id
  if (!youtubeId && (content.includes("youtube.com") || content.includes("youtu.be"))) {
    const match = content.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
    if (match) youtubeId = match[1];
  }

  return (
    <div className="space-y-4">
      {youtubeId ? (
        <YouTubeVideo
          videoId={youtubeId}
          url={url}
          title={title || "Mathisipan Concept Video"}
          channelName={channelName}
          description={content && !content.includes("http") ? content : undefined}
        />
      ) : (
        <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-300 text-xs text-slate-500">
          No video attached yet.
        </div>
      )}

      {content && !content.includes("http") && !youtubeId && (
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm text-slate-600">
          <MathText content={content} />
        </div>
      )}
    </div>
  );
}
