import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import {
  Youtube,
  Search,
  Link,
  CheckCircle2,
  AlertCircle,
  X,
  ExternalLink,
  Sparkles,
  Clock,
  ShieldCheck,
  RefreshCw,
} from "lucide-react";
import { parseYouTubeUrl } from "@/lib/youtube/youtube-parser";
import { YOUTUBE_CONFIG, MATHISIPAN_CURATED_VIDEOS } from "@/config/youtube";
import type { YouTubeSearchResult, YouTubeValidationResult } from "@/lib/youtube/youtube-types";

export interface YouTubeResourceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddResource: (resource: {
    type: "YOUTUBE";
    title: string;
    url: string;
    youtubeId: string;
    channelName?: string;
    thumbnailUrl?: string;
    description?: string;
    duration?: string;
    notes?: string;
    metadata?: string;
  }) => void;
  lessonTitle?: string;
  defaultGrade?: number;
}

export function YouTubeResourceModal({
  isOpen,
  onClose,
  onAddResource,
  lessonTitle = "",
  defaultGrade = 7,
}: YouTubeResourceModalProps) {
  const [activeTab, setActiveTab] = useState<"search" | "url">("search");

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGrade, setSelectedGrade] = useState<number>(defaultGrade);
  const [searchResults, setSearchResults] = useState<YouTubeSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchMessage, setSearchMessage] = useState<string | null>(null);

  // Manual URL state
  const [manualUrl, setManualUrl] = useState("");
  const [manualValidation, setManualValidation] = useState<YouTubeValidationResult | null>(null);

  // Selected for preview & attach
  const [selectedVideo, setSelectedVideo] = useState<{
    videoId: string;
    title: string;
    url: string;
    channelName: string;
    thumbnailUrl: string;
    notes?: string;
  } | null>(null);

  // Initialize search with curated videos matching grade or query
  useEffect(() => {
    if (isOpen) {
      handleSearch(searchQuery || lessonTitle || "integers");
    }
  }, [isOpen, selectedGrade]);

  if (!isOpen) return null;

  const handleSearch = async (term: string) => {
    setIsSearching(true);
    setSearchMessage(null);
    try {
      const res = await fetch(
        `/api/youtube/search?query=${encodeURIComponent(term)}&grade=${selectedGrade}`
      );
      if (res.ok) {
        const json = await res.json();
        setSearchResults(json.data?.items || []);
        if (json.data?.message) {
          setSearchMessage(json.data.message);
        }
      } else {
        // Fallback to local curated list
        const fallback = MATHISIPAN_CURATED_VIDEOS.filter(
          (v) => v.gradeLevel === selectedGrade || v.title.toLowerCase().includes(term.toLowerCase())
        ).map((v) => ({
          id: v.id,
          videoId: v.videoId,
          title: v.title,
          description: v.description,
          channelName: v.channelName,
          thumbnailUrl: `${YOUTUBE_CONFIG.mathisipan.thumbnailBaseUrl}/${v.videoId}/hqdefault.jpg`,
          embedUrl: `${YOUTUBE_CONFIG.mathisipan.embedBaseUrl}/${v.videoId}`,
          canonicalUrl: `${YOUTUBE_CONFIG.mathisipan.youtubeBaseUrl}/watch?v=${v.videoId}`,
          duration: v.duration,
          source: "MATHISIPAN_CURATED" as const,
          isMathisipan: true,
        }));
        setSearchResults(fallback);
      }
    } catch {
      setSearchMessage("YouTube search is temporarily unavailable. You can paste a valid YouTube URL manually.");
    } finally {
      setIsSearching(false);
    }
  };

  const handleManualValidate = () => {
    const result = parseYouTubeUrl(manualUrl);
    setManualValidation(result);
    if (result.isValid && result.videoId) {
      setSelectedVideo({
        videoId: result.videoId,
        title: result.title || `Mathisipan / YouTube Video (${result.videoId})`,
        url: result.canonicalUrl || manualUrl,
        channelName: result.channelName || "Mathisipan",
        thumbnailUrl: result.thumbnailUrl || "",
        notes: "Attached via manual YouTube URL",
      });
    }
  };

  const handleSelectSearchResult = (item: YouTubeSearchResult) => {
    setSelectedVideo({
      videoId: item.videoId,
      title: item.title,
      url: item.canonicalUrl,
      channelName: item.channelName,
      thumbnailUrl: item.thumbnailUrl,
      notes: item.description,
    });
  };

  const handleConfirmAttach = () => {
    if (!selectedVideo) return;

    onAddResource({
      type: "YOUTUBE",
      title: selectedVideo.title,
      url: selectedVideo.url,
      youtubeId: selectedVideo.videoId,
      channelName: selectedVideo.channelName,
      thumbnailUrl: selectedVideo.thumbnailUrl,
      description: selectedVideo.notes,
      notes: selectedVideo.notes,
      metadata: JSON.stringify({
        provider: "YOUTUBE",
        channelName: selectedVideo.channelName,
        thumbnailUrl: selectedVideo.thumbnailUrl,
        attachedAt: new Date().toISOString(),
      }),
    });

    // Reset and close
    setSelectedVideo(null);
    setManualUrl("");
    setManualValidation(null);
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in"
    >
      <div className="relative w-full max-w-2xl bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center shrink-0 shadow-2xs">
              <Youtube className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900">
                Attach Mathisipan / YouTube Video
              </h2>
              <p className="text-xs text-slate-500">
                Official YouTube video embedding aligned with MATATAG curriculum
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1 px-5 pt-3 border-b border-slate-100 shrink-0 bg-slate-50/50">
          <button
            type="button"
            onClick={() => setActiveTab("search")}
            className={`flex items-center gap-1.5 px-4 py-2.5 border-b-2 text-xs font-semibold transition-colors ${
              activeTab === "search"
                ? "border-red-600 text-red-600 bg-white rounded-t-xl"
                : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            <span>Search Mathisipan Videos</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("url")}
            className={`flex items-center gap-1.5 px-4 py-2.5 border-b-2 text-xs font-semibold transition-colors ${
              activeTab === "url"
                ? "border-red-600 text-red-600 bg-white rounded-t-xl"
                : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            <Link className="w-3.5 h-3.5" />
            <span>Paste YouTube URL (Manual Fallback)</span>
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-5">
          {searchMessage && (
            <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
              <span>{searchMessage}</span>
            </div>
          )}

          {activeTab === "search" ? (
            /* TAB 1: SEARCH MATHISIPAN VIDEOS */
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search Mathisipan topics (e.g. Integers, Order of Operations, Absolute Value)..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSearch(searchQuery)}
                    className="w-full pl-10 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-red-500"
                  />
                </div>
                <select
                  value={selectedGrade}
                  onChange={(e) => setSelectedGrade(Number(e.target.value))}
                  className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700"
                >
                  <option value={7}>Grade 7</option>
                  <option value={8}>Grade 8</option>
                  <option value={9}>Grade 9</option>
                  <option value={10}>Grade 10</option>
                </select>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => handleSearch(searchQuery)}
                  disabled={isSearching}
                  className="text-xs px-4 bg-red-600 hover:bg-red-700"
                >
                  {isSearching ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : "Search"}
                </Button>
              </div>

              {/* Quick Topic Chips */}
              <div className="flex items-center gap-1.5 flex-wrap text-[11px]">
                <span className="text-slate-400 font-medium">Quick Topics:</span>
                {["Integers", "Adding Integers", "Subtracting Integers", "Comparing Integers", "Absolute Value"].map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => {
                      setSearchQuery(chip);
                      handleSearch(chip);
                    }}
                    className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors font-medium"
                  >
                    {chip}
                  </button>
                ))}
              </div>

              {/* Results List */}
              <div className="space-y-2.5 pt-2">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                  Curated Mathisipan Results ({searchResults.length})
                </span>

                {searchResults.length === 0 ? (
                  <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-slate-500 text-xs">
                    No videos found matching your query. Try a different search term or paste a YouTube URL.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {searchResults.map((item) => {
                      const isSelected = selectedVideo?.videoId === item.videoId;
                      return (
                        <div
                          key={item.videoId}
                          onClick={() => handleSelectSearchResult(item)}
                          className={`p-3 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between gap-2.5 ${
                            isSelected
                              ? "border-red-500 bg-red-50/40 ring-2 ring-red-500/20 shadow-xs"
                              : "border-slate-200 hover:border-slate-300 bg-white"
                          }`}
                        >
                          <div className="space-y-2">
                            <div className="relative aspect-video rounded-xl overflow-hidden bg-slate-900 border border-slate-100">
                              <img
                                src={item.thumbnailUrl}
                                alt={item.title}
                                loading="lazy"
                                className="w-full h-full object-cover"
                              />
                              {item.duration && (
                                <span className="absolute bottom-1.5 right-1.5 bg-slate-900/80 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded-md flex items-center gap-1">
                                  <Clock className="w-2.5 h-2.5" />
                                  <span>{item.duration}</span>
                                </span>
                              )}
                              <span className="absolute top-1.5 left-1.5 bg-red-600/90 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md uppercase tracking-wider">
                                Mathisipan
                              </span>
                            </div>

                            <div>
                              <h4 className="text-xs font-bold text-slate-900 line-clamp-2">
                                {item.title}
                              </h4>
                              <p className="text-[11px] text-slate-500 line-clamp-2 mt-0.5">
                                {item.description}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[11px]">
                            <span className="text-slate-500 font-medium">{item.channelName}</span>
                            <span
                              className={`font-semibold ${
                                isSelected ? "text-red-600 font-bold" : "text-blue-600 hover:underline"
                              }`}
                            >
                              {isSelected ? "Selected ✓" : "Select Video"}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* TAB 2: MANUAL URL FALLBACK */
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  YouTube Video URL or Video ID
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="https://www.youtube.com/watch?v=... or https://youtu.be/..."
                    value={manualUrl}
                    onChange={(e) => setManualUrl(e.target.value)}
                    className="flex-1 px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-red-500 font-mono"
                  />
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleManualValidate}
                    className="text-xs px-4 bg-slate-900 hover:bg-slate-800"
                  >
                    Validate URL
                  </Button>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Supports standard watch links, share links (youtu.be), embeds, and shorts.
                </p>
              </div>

              {manualValidation && (
                <div
                  className={`p-3.5 rounded-2xl border text-xs ${
                    manualValidation.isValid
                      ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                      : "bg-red-50 border-red-200 text-red-700"
                  }`}
                >
                  <div className="flex items-center gap-2 font-bold">
                    {manualValidation.isValid ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>Valid YouTube Video ID: {manualValidation.videoId}</span>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="w-4 h-4 text-red-600" />
                        <span>{manualValidation.error}</span>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Live Preview Panel (Before Attachment) */}
          {selectedVideo && (
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                <span className="flex items-center gap-1.5 text-emerald-700">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Ready to Attach (Preview)</span>
                </span>
                <span className="text-[11px] font-mono text-slate-400">ID: {selectedVideo.videoId}</span>
              </div>

              <div className="aspect-video w-full rounded-xl overflow-hidden bg-slate-950 border border-slate-300 shadow-inner">
                <iframe
                  src={`${YOUTUBE_CONFIG.mathisipan.embedBaseUrl}/${selectedVideo.videoId}?rel=0`}
                  title={selectedVideo.title}
                  loading="lazy"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  className="w-full h-full border-0"
                />
              </div>

              <div className="flex items-center justify-between text-xs text-slate-600">
                <div className="space-y-0.5">
                  <h4 className="font-bold text-slate-900">{selectedVideo.title}</h4>
                  <span className="text-[11px] text-slate-500">
                    Source: {selectedVideo.channelName} • Hosted on YouTube
                  </span>
                </div>
                <a
                  href={selectedVideo.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline flex items-center gap-1 text-[11px] shrink-0"
                >
                  <span>Verify on YouTube</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-slate-100 flex items-center justify-between gap-3 bg-slate-50/50 shrink-0">
          <Button variant="outline" size="sm" onClick={onClose} className="text-xs">
            Cancel
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={handleConfirmAttach}
            disabled={!selectedVideo}
            className="text-xs px-5 bg-red-600 hover:bg-red-700 gap-1.5 font-bold"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Confirm & Attach Video Resource</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
