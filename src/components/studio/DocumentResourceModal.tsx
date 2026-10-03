import React, { useState } from "react";
import { Button } from "@/components/ui/Button";
import { validateDocumentMetadata } from "@/lib/storage";
import { FileText, X, AlertCircle, UploadCloud, StickyNote, CheckCircle2 } from "lucide-react";

export interface DocumentResourceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddResource: (resource: {
    type: "PDF" | "DOCUMENT" | "TEACHER_NOTE";
    title: string;
    notes?: string;
    fileName?: string;
    fileSize?: number;
    storagePath?: string;
  }) => void;
}

export function DocumentResourceModal({
  isOpen,
  onClose,
  onAddResource,
}: DocumentResourceModalProps) {
  const [activeTab, setActiveTab] = useState<"DOCUMENT" | "TEACHER_NOTE">("DOCUMENT");
  const [title, setTitle] = useState("");
  const [fileName, setFileName] = useState("");
  const [fileSize, setFileSize] = useState(1500000); // 1.5 MB default demo size
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (activeTab === "DOCUMENT") {
      const val = validateDocumentMetadata({
        name: fileName.trim(),
        type: "application/pdf",
        size: fileSize,
      });

      if (!val.isValid) {
        setError(val.error || "Invalid document format.");
        return;
      }

      onAddResource({
        type: fileName.toLowerCase().endsWith(".pdf") ? "PDF" : "DOCUMENT",
        title: title.trim() || fileName.trim(),
        fileName: fileName.trim(),
        fileSize,
        storagePath: `/storage/curriculum/documents/${fileName.trim()}`,
        notes: notes.trim() || undefined,
      });
    } else {
      if (!title.trim() || !notes.trim()) {
        setError("Note title and content are required.");
        return;
      }
      onAddResource({
        type: "TEACHER_NOTE",
        title: title.trim(),
        notes: notes.trim(),
      });
    }

    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in"
    >
      <div className="relative w-full max-w-lg bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              {activeTab === "DOCUMENT" ? <FileText className="w-5 h-5" /> : <StickyNote className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                {activeTab === "DOCUMENT" ? "Add Learning Document / PDF" : "Add Instructional Teacher Note"}
              </h2>
              <p className="text-xs text-slate-500">Curriculum learning resources repository</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Toggle */}
        <div className="flex border-b border-slate-100 px-6 pt-3 bg-slate-50/50">
          <button
            type="button"
            onClick={() => {
              setActiveTab("DOCUMENT");
              setError(null);
            }}
            className={`pb-2.5 text-xs font-semibold border-b-2 mr-4 transition-colors ${
              activeTab === "DOCUMENT"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            Educational Document (PDF / DOCX)
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab("TEACHER_NOTE");
              setError(null);
            }}
            className={`pb-2.5 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === "TEACHER_NOTE"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            Instructional Note
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {activeTab === "DOCUMENT" ? (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Document Title (Displayed in Lesson)
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. DepEd Learner's Module: Integers and Sign Conventions"
                  className="w-full text-xs sm:text-sm px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  File Name & Extension
                </label>
                <input
                  type="text"
                  required
                  value={fileName}
                  onChange={(e) => setFileName(e.target.value)}
                  placeholder="e.g. Grade7-Math-Module1.pdf"
                  className="w-full text-xs sm:text-sm px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Supports .pdf, .docx, .pptx files (Decoupled from PostgreSQL to object storage).
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Teacher Notes / Reading Guidance (Optional)
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Focus on pages 12-16 for the number line activities."
                  className="w-full text-xs sm:text-sm p-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Note Title
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Lesson Pacing & Misconception Alert"
                  className="w-full text-xs sm:text-sm px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Instructional Content
                </label>
                <textarea
                  rows={4}
                  required
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Explain pedagogical steps, common traps students fall into, or classroom discussion prompts..."
                  className="w-full text-xs sm:text-sm p-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </>
          )}

          {/* Footer CTAs */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm">
              Save Resource
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
