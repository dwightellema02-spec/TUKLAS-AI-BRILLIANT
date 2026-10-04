import React, { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { FileText, X, AlertCircle, StickyNote, CheckCircle2, UploadCloud } from "lucide-react";

const MAX_BYTES = 25 * 1024 * 1024;
const ACCEPTED_EXTENSIONS = [".pdf", ".docx", ".txt"];

export interface UploadedResourceResult {
  resource: Record<string, any>;
  extraction?: {
    status: string;
    error?: string;
    pageCount?: number;
    chunkCount: number;
    usableByAITutor: boolean;
  };
}

export interface DocumentResourceModalProps {
  isOpen: boolean;
  lessonId: string;
  onClose: () => void;
  /** Called after the server has stored the resource (and, for documents, extracted its text). */
  onResourceAdded: (result: UploadedResourceResult) => void;
}

export function DocumentResourceModal({ isOpen, lessonId, onClose, onResourceAdded }: DocumentResourceModalProps) {
  const [activeTab, setActiveTab] = useState<"DOCUMENT" | "TEACHER_NOTE">("DOCUMENT");
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<UploadedResourceResult["extraction"] | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const reset = () => {
    setTitle("");
    setFile(null);
    setNotes("");
    setError(null);
    setResult(null);
    if (fileInput.current) fileInput.current.value = "";
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    setResult(null);
    const picked = e.target.files?.[0] ?? null;
    if (!picked) return setFile(null);
    const lower = picked.name.toLowerCase();
    if (!ACCEPTED_EXTENSIONS.some((ext) => lower.endsWith(ext))) {
      setFile(null);
      return setError("Unsupported file type. Choose a PDF, DOCX or TXT file.");
    }
    if (picked.size > MAX_BYTES) {
      setFile(null);
      return setError(`File is too large (${(picked.size / 1048576).toFixed(1)}MB). The limit is 25MB.`);
    }
    setFile(picked);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResult(null);
    setBusy(true);

    try {
      if (activeTab === "DOCUMENT") {
        if (!file) throw new Error("Choose a file to upload.");
        const res = await fetch(`/api/lessons/${lessonId}/documents`, {
          method: "POST",
          headers: {
            "Content-Type": "application/octet-stream",
            "X-File-Name": encodeURIComponent(file.name),
            "X-Resource-Title": encodeURIComponent(title.trim()),
          },
          body: file,
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error || "Upload failed.");
        onResourceAdded({ resource: json.data, extraction: json.extraction });
        setResult(json.extraction);
        // Close automatically only when the AI Tutor can actually use the file; otherwise show why.
        if (json.extraction?.usableByAITutor) handleClose();
      } else {
        if (!title.trim() || !notes.trim()) throw new Error("Note title and content are required.");
        const res = await fetch(`/api/lessons/${lessonId}/notes`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: title.trim(), notes: notes.trim() }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error || "Could not save the note.");
        onResourceAdded({ resource: json.data });
        handleClose();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  const switchTab = (tab: "DOCUMENT" | "TEACHER_NOTE") => {
    setActiveTab(tab);
    setError(null);
    setResult(null);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in"
    >
      <div className="relative w-full max-w-lg bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              {activeTab === "DOCUMENT" ? <FileText className="w-5 h-5" /> : <StickyNote className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                {activeTab === "DOCUMENT" ? "Upload Learning Document" : "Add Instructional Teacher Note"}
              </h2>
              <p className="text-xs text-slate-500">The AI Tutor can only use text it can actually read</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex border-b border-slate-100 px-6 pt-3 bg-slate-50/50">
          <button
            type="button"
            onClick={() => switchTab("DOCUMENT")}
            className={`pb-2.5 text-xs font-semibold border-b-2 mr-4 transition-colors ${
              activeTab === "DOCUMENT" ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            Document (PDF / DOCX / TXT)
          </button>
          <button
            type="button"
            onClick={() => switchTab("TEACHER_NOTE")}
            className={`pb-2.5 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === "TEACHER_NOTE" ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            Instructional Note
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div role="alert" className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {result && !result.usableByAITutor && (
            <div role="status" className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                The file was added, but the AI Tutor cannot read it. {result.error}
              </span>
            </div>
          )}

          {activeTab === "DOCUMENT" ? (
            <>
              <div>
                <label htmlFor="doc-file" className="block text-xs font-semibold text-slate-700 mb-1">
                  File
                </label>
                <label
                  htmlFor="doc-file"
                  className="flex flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-slate-300 hover:border-blue-400 bg-slate-50 px-4 py-6 cursor-pointer text-center"
                >
                  {file ? (
                    <>
                      <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                      <span className="text-xs font-semibold text-slate-800">{file.name}</span>
                      <span className="text-[11px] text-slate-500">{(file.size / 1048576).toFixed(2)} MB</span>
                    </>
                  ) : (
                    <>
                      <UploadCloud className="w-5 h-5 text-slate-400" />
                      <span className="text-xs text-slate-600">Click to choose a PDF, DOCX or TXT file (max 25MB)</span>
                    </>
                  )}
                </label>
                <input
                  id="doc-file"
                  ref={fileInput}
                  type="file"
                  accept=".pdf,.docx,.txt"
                  onChange={handleFileChange}
                  className="sr-only"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Scanned (image-only) PDFs cannot be read by the AI Tutor. Use a text-based PDF or a DOCX.
                </p>
              </div>

              <div>
                <label htmlFor="doc-title" className="block text-xs font-semibold text-slate-700 mb-1">
                  Display Title (optional)
                </label>
                <input
                  id="doc-title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Defaults to the file name"
                  className="w-full text-xs sm:text-sm px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </>
          ) : (
            <>
              <div>
                <label htmlFor="note-title" className="block text-xs font-semibold text-slate-700 mb-1">
                  Note Title
                </label>
                <input
                  id="note-title"
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Lesson Pacing & Misconception Alert"
                  className="w-full text-xs sm:text-sm px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label htmlFor="note-body" className="block text-xs font-semibold text-slate-700 mb-1">
                  Instructional Content
                </label>
                <textarea
                  id="note-body"
                  rows={4}
                  required
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Explain steps, common traps, or discussion prompts. The AI Tutor can use this text."
                  className="w-full text-xs sm:text-sm p-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </>
          )}

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={handleClose} disabled={busy}>
              {result ? "Done" : "Cancel"}
            </Button>
            <Button type="submit" variant="primary" size="sm" disabled={busy}>
              {busy ? (activeTab === "DOCUMENT" ? "Uploading & reading..." : "Saving...") : "Save Resource"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
