import React, { useState } from "react";
import { ImageIcon } from "lucide-react";
import { MathText } from "@/components/ui/MathText";

export interface ImageBlockProps {
  title?: string;
  content: string; // URL or caption
  metadata?: string; // JSON with alt, caption, url
}

export function ImageBlock({ title, content, metadata }: ImageBlockProps) {
  const [imageError, setImageError] = useState(false);

  let parsedMeta: { url?: string; alt?: string; caption?: string } = {};
  if (metadata) {
    try {
      parsedMeta = JSON.parse(metadata);
    } catch {
      parsedMeta = {};
    }
  }

  const imageUrl = parsedMeta.url || (content.startsWith("http") || content.startsWith("/") ? content : "");
  const altText = parsedMeta.alt || title || "Educational diagram";
  const caption = parsedMeta.caption || (content !== imageUrl ? content : "");

  return (
    <div className="space-y-3">
      {title && (
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
          {title}
        </h2>
      )}

      <div className="rounded-2xl border border-slate-200 overflow-hidden bg-slate-50 p-2 sm:p-4 text-center">
        {imageUrl && !imageError ? (
          <img
            src={imageUrl}
            alt={altText}
            referrerPolicy="no-referrer"
            onError={() => setImageError(true)}
            className="max-h-[420px] w-auto mx-auto rounded-xl object-contain shadow-xs"
          />
        ) : (
          <div className="py-12 px-6 flex flex-col items-center justify-center text-slate-400 bg-white rounded-xl border border-dashed border-slate-200">
            <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 mb-2">
              <ImageIcon className="w-6 h-6" />
            </div>
            <p className="text-sm font-semibold text-slate-700">{title || "Educational Illustration"}</p>
            <p className="text-xs text-slate-400 mt-0.5">{altText}</p>
          </div>
        )}

        {caption && (
          <div className="text-xs text-slate-500 mt-3 max-w-lg mx-auto italic">
            <MathText content={caption} />
          </div>
        )}
      </div>
    </div>
  );
}
