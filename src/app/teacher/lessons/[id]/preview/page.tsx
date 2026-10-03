import React, { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth/auth-context";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import {
  ArrowLeft,
  Eye,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  List,
  Layers,
  Edit,
} from "lucide-react";
import { ContentBlockRenderer, LessonContentBlockData } from "@/components/lesson/ContentBlockRenderer";
import { YouTubeVideo } from "@/components/video/YouTubeVideo";

export interface TeacherLessonPreviewPageProps {
  lessonId: string;
  onNavigate?: (path: string) => void;
}

export default function TeacherLessonPreviewPage({
  lessonId,
  onNavigate,
}: TeacherLessonPreviewPageProps) {
  const { user } = useAuth();
  const [lesson, setLesson] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeSectionIndex, setActiveSectionIndex] = useState(0);
  const [viewMode, setViewMode] = useState<"step" | "scroll">("step");
  const [showOutline, setShowOutline] = useState(false);

  const handleNav = (path: string) => {
    if (onNavigate) onNavigate(path);
    else window.location.pathname = path;
  };

  useEffect(() => {
    async function fetchLesson() {
      setLoading(true);
      try {
        const res = await fetch(`/api/lessons/${lessonId}`);
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "Failed to load lesson for preview.");
        } else {
          setLesson(data.data);
        }
      } catch {
        setError("Network error loading preview.");
      } finally {
        setLoading(false);
      }
    }
    fetchLesson();
  }, [lessonId]);

  if (loading) {
    return (
      <div className="py-20 text-center text-xs text-slate-400">
        Loading lesson preview...
      </div>
    );
  }

  if (error || !lesson) {
    return (
      <div className="py-16 max-w-md mx-auto px-4 text-center">
        <h1 className="text-xl font-bold text-slate-900 mb-2">Lesson Not Found</h1>
        <p className="text-xs text-slate-500 mb-6">{error}</p>
        <Button variant="primary" onClick={() => handleNav(`/teacher/lessons/${lessonId}/edit`)}>
          Back to Editor
        </Button>
      </div>
    );
  }

  const blocks: LessonContentBlockData[] = lesson.contentBlocks || [];
  const currentBlock = blocks[activeSectionIndex];
  const totalBlocks = blocks.length;

  return (
    <div className="min-h-[calc(100vh-140px)] bg-slate-50 flex flex-col">
      {/* Teacher Preview Notification Bar */}
      <div className="bg-amber-500 text-slate-950 px-4 py-2 text-xs font-semibold flex items-center justify-between shadow-2xs">
        <div className="max-w-5xl mx-auto w-full flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4 shrink-0" />
            <span>
              Teacher Preview Mode: Student progress and checkpoint attempts are not recorded.
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleNav(`/teacher/lessons/${lessonId}/edit`)}
            className="text-xs py-0.5 px-2.5 h-7 bg-white/90 text-slate-900 border-amber-600 hover:bg-white"
          >
            <Edit className="w-3 h-3 mr-1" />
            <span>Return to Editor</span>
          </Button>
        </div>
      </div>

      {/* Sticky Navigation Subheader */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 py-3 shadow-2xs">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => handleNav(`/teacher/lessons/${lessonId}/edit`)}
              className="p-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors shrink-0"
              title="Return to Studio Editor"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="min-w-0">
              <span className="text-[10px] font-bold uppercase tracking-wider text-teal-700 block truncate">
                Previewing Lesson
              </span>
              <h1 className="text-sm sm:text-base font-bold text-slate-900 truncate">
                {lesson.title}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="hidden sm:flex items-center p-1 bg-slate-100 rounded-lg text-xs">
              <button
                type="button"
                onClick={() => setViewMode("step")}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                  viewMode === "step" ? "bg-white text-slate-900 shadow-2xs font-semibold" : "text-slate-500 hover:text-slate-900"
                }`}
              >
                Step-by-Step
              </button>
              <button
                type="button"
                onClick={() => setViewMode("scroll")}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                  viewMode === "scroll" ? "bg-white text-slate-900 shadow-2xs font-semibold" : "text-slate-500 hover:text-slate-900"
                }`}
              >
                Full Scroll
              </button>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowOutline(!showOutline)}
              className="text-xs gap-1.5"
            >
              <List className="w-3.5 h-3.5" />
              <span>Sections ({totalBlocks})</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Preview Stage */}
      <div className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 flex flex-col md:flex-row gap-8">
        <main className="flex-1 min-w-0">
          {/* Attached Mathisipan Video Preview */}
          {(() => {
            const attachedVideo = lesson?.resources?.find((r: any) => r.type === "YOUTUBE") || (lesson?.videoUrl ? { youtubeId: lesson.videoUrl, title: lesson.title, url: lesson.videoUrl } : null);
            if (!attachedVideo) return null;
            return (
              <div className="mb-6">
                <YouTubeVideo
                  videoId={attachedVideo.youtubeId}
                  url={attachedVideo.url}
                  title={attachedVideo.title || `${lesson.title} - Mathisipan Concept Video`}
                  description={attachedVideo.notes}
                />
              </div>
            );
          })()}

          {viewMode === "step" ? (
            <div className="space-y-6">
              {currentBlock ? (
                <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-10 shadow-xs space-y-6">
                  <div className="flex items-center justify-between pb-4 border-b border-slate-100 text-xs text-slate-400">
                    <span className="font-semibold uppercase tracking-wider text-[11px] text-teal-800">
                      Section {activeSectionIndex + 1} of {totalBlocks} • {currentBlock.type}
                    </span>
                    <Badge variant="outline" className="text-[10px]">
                      Student Preview
                    </Badge>
                  </div>

                  <div className="pt-2">
                    <ContentBlockRenderer
                      block={currentBlock}
                      readOnly={false}
                    />
                  </div>
                </div>
              ) : (
                <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 text-xs text-slate-400">
                  No sections in this lesson yet. Add sections in the Teacher Content Studio.
                </div>
              )}

              {/* Prev / Next Bottom Controls */}
              <div className="flex items-center justify-between gap-3 pt-2">
                <Button
                  variant="outline"
                  disabled={activeSectionIndex === 0}
                  onClick={() => setActiveSectionIndex(activeSectionIndex - 1)}
                  className="gap-2 min-h-[44px] px-5"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Previous</span>
                </Button>

                <Button
                  variant="primary"
                  disabled={activeSectionIndex === totalBlocks - 1}
                  onClick={() => setActiveSectionIndex(activeSectionIndex + 1)}
                  className="gap-2 min-h-[44px] px-6"
                >
                  <span>Next Section</span>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-8">
              {blocks.map((block, idx) => (
                <div
                  key={block.id || idx}
                  className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-10 shadow-xs space-y-4"
                >
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100 text-xs text-slate-400">
                    <span className="font-semibold uppercase tracking-wider text-[11px] text-teal-800">
                      Section {idx + 1} • {block.type}
                    </span>
                  </div>
                  <ContentBlockRenderer block={block} readOnly={false} />
                </div>
              ))}
            </div>
          )}
        </main>

        {/* Outline Sidebar */}
        <aside
          className={`md:w-72 shrink-0 ${
            showOutline
              ? "fixed inset-y-0 right-0 z-40 w-80 bg-white p-6 shadow-2xl overflow-y-auto block"
              : "hidden md:block"
          }`}
        >
          <div className="sticky top-20 bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-blue-600" />
                <span>Lesson Sections</span>
              </h2>
              {showOutline && (
                <button
                  type="button"
                  onClick={() => setShowOutline(false)}
                  className="md:hidden text-slate-400 hover:text-slate-700 text-lg font-bold"
                >
                  ×
                </button>
              )}
            </div>

            <div className="space-y-1.5 max-h-[60vh] overflow-y-auto pr-1">
              {blocks.map((block, idx) => (
                <button
                  key={block.id || idx}
                  type="button"
                  onClick={() => {
                    setActiveSectionIndex(idx);
                    setShowOutline(false);
                  }}
                  className={`w-full text-left p-2.5 rounded-xl border text-xs transition-all flex items-center justify-between gap-2 ${
                    activeSectionIndex === idx
                      ? "bg-blue-50/80 border-blue-400 font-bold text-blue-950 shadow-2xs"
                      : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <span className="w-5 h-5 rounded-md bg-slate-200 text-slate-700 font-bold text-[10px] flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>
                    <span className="truncate">{block.title || `${block.type} section`}</span>
                  </div>
                  <span className="text-[10px] text-slate-400 uppercase">{block.type}</span>
                </button>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
