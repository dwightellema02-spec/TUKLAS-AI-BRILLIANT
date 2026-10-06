import { TEMPLATE_MARK } from "@/lib/lesson/template-mark";
import React, { useState } from "react";
import { BlockType } from "@prisma/client";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import {
  ArrowUp,
  ArrowDown,
  Trash2,
  Plus,
  Type,
  HelpCircle,
  Lightbulb,
  CheckCircle2,
  Sparkles,
  BookOpen,
  Compass,
  ImageIcon,
  Youtube,
  Target,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

export interface ContentBlock {
  id?: string;
  type: BlockType;
  sequenceOrder: number;
  title?: string;
  content: string;
  metadata?: string;
}

export interface ContentBlockEditorProps {
  blocks: ContentBlock[];
  onChange: (blocks: ContentBlock[]) => void;
}

export const ALL_BLOCK_TYPES: {
  type: BlockType;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  desc: string;
}[] = [
  { type: "TEXT", label: "Text", icon: Type, desc: "Instructional explanations, definitions, and LaTeX formulas." },
  { type: "IMAGE", label: "Image", icon: ImageIcon, desc: "Educational diagram, geometry visual, or concept graphic." },
  { type: "VIDEO", label: "Video", icon: Youtube, desc: "Curated Mathisipan or YouTube video with privacy embed." },
  { type: "EXAMPLE", label: "Example", icon: BookOpen, desc: "Worked problem with steps and progressive answer reveal." },
  { type: "QUESTION", label: "Question", icon: HelpCircle, desc: "Active problem-solving item with hint, options, and feedback." },
  { type: "INTERACTIVE", label: "Interactive", icon: Compass, desc: "Interactive conceptual widget (e.g. Number Line Explorer)." },
  { type: "HINT", label: "Hint", icon: Lightbulb, desc: "Collapsible scaffolded thinking tip or mnemonic reminder." },
  { type: "CHECKPOINT", label: "Checkpoint", icon: CheckCircle2, desc: "Formative checkpoint pausing progress for verification." },
  { type: "PRACTICE", label: "Practice", icon: Target, desc: "Targeted skill practice launchpad with standard linkage." },
  { type: "SUMMARY", label: "Summary", icon: Sparkles, desc: "Recap of essential rules, takeaways, and principles." },
];

export function ContentBlockEditor({ blocks, onChange }: ContentBlockEditorProps) {
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(0);

  const handleAddBlock = (type: BlockType) => {
    let defaultTitle = "";
    let defaultContent = "";
    let defaultMeta: any = {};

    // Templates are neutral on purpose: they used to be integer examples (with a valid answer key), which would have been published
    // into any lesson the teacher forgot to edit. Every template carries TEMPLATE_MARK, and a lesson with it left in cannot be published.
    switch (type) {
      case "TEXT":
        defaultTitle = "Concept Explanation";
        defaultContent = `${TEMPLATE_MARK} Explain the concept here. You can use math like $a + b$.`;
        break;
      case "IMAGE":
        defaultTitle = "Concept Illustration";
        defaultContent = `${TEMPLATE_MARK} Describe the picture for the student.`;
        defaultMeta = { url: "", alt: "Illustration", caption: "" };
        break;
      case "VIDEO":
        defaultTitle = "Video";
        defaultContent = `${TEMPLATE_MARK} Say why the student should watch this video.`;
        break;
      case "EXAMPLE":
        defaultTitle = "Worked Example";
        defaultContent = `Problem: ${TEMPLATE_MARK}\n\nSteps:\n1. ${TEMPLATE_MARK}\n\nAnswer: ${TEMPLATE_MARK}`;
        defaultMeta = { problem: TEMPLATE_MARK, steps: [TEMPLATE_MARK], answer: TEMPLATE_MARK };
        break;
      case "CHECKPOINT":
        defaultTitle = "Quick Check";
        defaultContent = TEMPLATE_MARK;
        defaultMeta = { question: TEMPLATE_MARK, options: ["", ""], correctAnswer: "", explanation: "" };
        break;
      case "QUESTION":
        defaultTitle = "Check Your Understanding";
        defaultContent = TEMPLATE_MARK;
        defaultMeta = { question: TEMPLATE_MARK, options: ["", ""], correctAnswer: "", explanation: "", hint: "" };
        break;
      case "INTERACTIVE":
        defaultTitle = "Number Line Explorer";
        defaultContent = `${TEMPLATE_MARK} Say what the student should explore on the number line.`;
        break;
      case "HINT":
        defaultTitle = "Helpful Tip";
        defaultContent = `${TEMPLATE_MARK} Give the student a helpful tip.`;
        break;
      case "PRACTICE":
        defaultTitle = "Targeted Practice";
        defaultContent = `${TEMPLATE_MARK} Tell the student what the practice covers.`;
        defaultMeta = { skillName: "", questionCount: 5, difficulty: "Mixed" };
        break;
      case "SUMMARY":
        defaultTitle = "What You Learned";
        defaultContent = `${TEMPLATE_MARK}\n• Key point 1\n• Key point 2`;
        break;
    }

    const newBlock: ContentBlock = {
      type,
      sequenceOrder: blocks.length + 1,
      title: defaultTitle,
      content: defaultContent,
      metadata: Object.keys(defaultMeta).length > 0 ? JSON.stringify(defaultMeta) : undefined,
    };

    const updated = [...blocks, newBlock];
    onChange(updated);
    setShowAddMenu(false);
    setExpandedIndex(updated.length - 1);
  };

  const handleUpdate = (index: number, updates: Partial<ContentBlock>) => {
    const updated = [...blocks];
    updated[index] = { ...updated[index], ...updates };
    onChange(updated);
  };

  const handleUpdateMeta = (index: number, key: string, value: any) => {
    const updated = [...blocks];
    let currentMeta: Record<string, any> = {};
    if (updated[index].metadata) {
      try {
        currentMeta = JSON.parse(updated[index].metadata!);
      } catch {}
    }
    currentMeta[key] = value;
    updated[index].metadata = JSON.stringify(currentMeta);
    onChange(updated);
  };

  const handleMove = (index: number, direction: "up" | "down") => {
    if (
      (direction === "up" && index === 0) ||
      (direction === "down" && index === blocks.length - 1)
    ) {
      return;
    }

    const targetIndex = direction === "up" ? index - 1 : index + 1;
    const updated = [...blocks];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;

    const reordered = updated.map((b, i) => ({ ...b, sequenceOrder: i + 1 }));
    onChange(reordered);
    setExpandedIndex(targetIndex);
  };

  const handleDelete = (index: number) => {
    const filtered = blocks.filter((_, i) => i !== index);
    const reordered = filtered.map((b, i) => ({ ...b, sequenceOrder: i + 1 }));
    onChange(reordered);
    setExpandedIndex(null);
  };

  return (
    <div className="space-y-4">
      {blocks.length === 0 ? (
        <div className="p-8 rounded-2xl border-2 border-dashed border-slate-200 text-center bg-slate-50/50">
          <BookOpen className="w-10 h-10 text-slate-400 mx-auto mb-2" />
          <p className="text-sm font-semibold text-slate-700">No Content Blocks Added</p>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
            Break the lesson down into digestible sections: text explanations, worked examples, interactive widgets, checkpoints, and summaries.
          </p>
          <Button variant="primary" size="sm" onClick={() => setShowAddMenu(true)} className="gap-1.5">
            <Plus className="w-4 h-4" />
            <span>Add First Section</span>
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {blocks.map((block, index) => {
            const meta = ALL_BLOCK_TYPES.find((b) => b.type === block.type) || ALL_BLOCK_TYPES[0];
            const Icon = meta.icon;
            const isExpanded = expandedIndex === index;

            let parsedMeta: any = {};
            if (block.metadata) {
              try {
                parsedMeta = JSON.parse(block.metadata);
              } catch {}
            }

            return (
              <div
                key={block.id || `blk_${index}`}
                className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden transition-all duration-150"
              >
                {/* Header row */}
                <div className="p-3 bg-slate-50/70 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-6 h-6 rounded-md bg-slate-200 text-slate-700 text-xs font-bold flex items-center justify-center shrink-0">
                      {index + 1}
                    </span>
                    <Badge variant="secondary" className="gap-1 text-[10px] shrink-0">
                      <Icon className="w-3 h-3 text-slate-500" />
                      <span>{meta.label}</span>
                    </Badge>
                    <span className="text-xs font-semibold text-slate-900 truncate">
                      {block.title || `Untitled Section ${index + 1}`}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      disabled={index === 0}
                      onClick={() => handleMove(index, "up")}
                      className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30 rounded-md"
                      title="Move Up"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={index === blocks.length - 1}
                      onClick={() => handleMove(index, "down")}
                      className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30 rounded-md"
                      title="Move Down"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setExpandedIndex(isExpanded ? null : index)}
                      className="p-1 text-slate-400 hover:text-slate-700 rounded-md"
                      title={isExpanded ? "Collapse" : "Expand"}
                    >
                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(index)}
                      className="p-1 text-red-400 hover:text-red-700 rounded-md"
                      title="Delete Section"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Form fields when expanded */}
                {isExpanded && (
                  <div className="p-4 space-y-4 bg-white">
                    {/* Section Type & Title */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="text-[11px] font-bold text-slate-600 block mb-1">
                          Section Type
                        </label>
                        <select
                          value={block.type}
                          onChange={(e) => handleUpdate(index, { type: e.target.value as BlockType })}
                          className="w-full text-xs p-2 rounded-lg border border-slate-200 bg-white font-medium"
                        >
                          {ALL_BLOCK_TYPES.map((t) => (
                            <option key={t.type} value={t.type}>
                              {t.label} ({t.type})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="sm:col-span-2">
                        <label className="text-[11px] font-bold text-slate-600 block mb-1">
                          Section Title
                        </label>
                        <input
                          type="text"
                          value={block.title || ""}
                          onChange={(e) => handleUpdate(index, { title: e.target.value })}
                          placeholder="e.g. 1. Introduction to the topic"
                          className="w-full text-xs p-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                    </div>

                    {/* Type-Specific Editors */}
                    {block.type === "IMAGE" && (
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                          Image Properties
                        </span>
                        <div>
                          <label className="text-[11px] font-medium text-slate-700 block mb-1">Image URL</label>
                          <input
                            type="text"
                            value={parsedMeta.url || ""}
                            onChange={(e) => handleUpdateMeta(index, "url", e.target.value)}
                            placeholder="https://... or /storage/..."
                            className="w-full text-xs p-2 rounded-lg border border-slate-200 bg-white"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-medium text-slate-700 block mb-1">Accessible Alt Text (Required)</label>
                          <input
                            type="text"
                            value={parsedMeta.alt || ""}
                            onChange={(e) => handleUpdateMeta(index, "alt", e.target.value)}
                            placeholder="Descriptive text for accessibility"
                            className="w-full text-xs p-2 rounded-lg border border-slate-200 bg-white"
                          />
                        </div>
                      </div>
                    )}

                    {block.type === "VIDEO" && (
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                          Video Configuration
                        </span>
                        <div>
                          <label className="text-[11px] font-medium text-slate-700 block mb-1">YouTube URL or Video ID</label>
                          <input
                            type="text"
                            value={parsedMeta.youtubeId || parsedMeta.url || ""}
                            onChange={(e) => {
                              const val = e.target.value;
                              const match = val.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
                              const id = match ? match[1] : val;
                              handleUpdateMeta(index, "youtubeId", id);
                              handleUpdateMeta(index, "url", val);
                            }}
                            placeholder="e.g. https://www.youtube.com/watch?v=oxkHZZpP2oQ"
                            className="w-full text-xs p-2 rounded-lg border border-slate-200 bg-white"
                          />
                        </div>
                      </div>
                    )}

                    {(block.type === "CHECKPOINT" || block.type === "QUESTION") && (
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                          Interactive Assessment Configuration
                        </span>
                        <div>
                          <label className="text-[11px] font-medium text-slate-700 block mb-1">Question Prompt</label>
                          <input
                            type="text"
                            value={parsedMeta.question || block.content || ""}
                            onChange={(e) => {
                              handleUpdateMeta(index, "question", e.target.value);
                              handleUpdate(index, { content: e.target.value });
                            }}
                            placeholder="Enter the prompt here"
                            className="w-full text-xs p-2 rounded-lg border border-slate-200 bg-white"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-medium text-slate-700 block mb-1">
                            Answer Options (comma-separated or one per line)
                          </label>
                          <input
                            type="text"
                            value={Array.isArray(parsedMeta.options) ? parsedMeta.options.join(", ") : ""}
                            onChange={(e) => {
                              const opts = e.target.value.split(",").map((s) => s.trim()).filter(Boolean);
                              handleUpdateMeta(index, "options", opts);
                            }}
                            placeholder="e.g. 12, 15, 18"
                            className="w-full text-xs p-2 rounded-lg border border-slate-200 bg-white"
                          />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div>
                            <label className="text-[11px] font-medium text-slate-700 block mb-1">Correct Answer</label>
                            <input
                              type="text"
                              value={parsedMeta.correctAnswer || ""}
                              onChange={(e) => handleUpdateMeta(index, "correctAnswer", e.target.value)}
                              placeholder="e.g. 15"
                              className="w-full text-xs p-2 rounded-lg border border-slate-200 bg-white"
                            />
                          </div>
                          <div>
                            <label className="text-[11px] font-medium text-slate-700 block mb-1">Explanation</label>
                            <input
                              type="text"
                              value={parsedMeta.explanation || ""}
                              onChange={(e) => handleUpdateMeta(index, "explanation", e.target.value)}
                              placeholder="Why this answer is mathematically correct"
                              className="w-full text-xs p-2 rounded-lg border border-slate-200 bg-white"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Primary Content Editor */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[11px] font-bold text-slate-600">
                          {block.type === "EXAMPLE"
                            ? "Problem & Steps Walkthrough (Markdown / LaTeX)"
                            : block.type === "SUMMARY"
                            ? "Summary Bullet Points"
                            : "Content Body / Markdown"}
                        </label>
                        <span className="text-[10px] text-slate-400">Supports KaTeX: $a + b$</span>
                      </div>
                      <textarea
                        rows={4}
                        value={block.content}
                        onChange={(e) => handleUpdate(index, { content: e.target.value })}
                        placeholder="Enter instructional text, worked example steps, or math formulas..."
                        className="w-full text-xs p-2.5 rounded-lg border border-slate-200 font-mono leading-relaxed focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add Section Launcher */}
      {!showAddMenu ? (
        <Button
          variant="outline"
          fullWidth
          onClick={() => setShowAddMenu(true)}
          className="border-dashed py-3 text-xs gap-1.5 text-slate-600 hover:text-blue-600 hover:border-blue-300"
        >
          <Plus className="w-4 h-4" />
          <span>Add Lesson Section</span>
        </Button>
      ) : (
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Select Section Type to Add
            </span>
            <button
              type="button"
              onClick={() => setShowAddMenu(false)}
              className="text-slate-400 hover:text-slate-700 text-xs font-semibold"
            >
              Cancel
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {ALL_BLOCK_TYPES.map((b) => {
              const Icon = b.icon;
              return (
                <button
                  key={b.type}
                  type="button"
                  onClick={() => handleAddBlock(b.type)}
                  className="p-3 rounded-xl border border-slate-200 hover:border-blue-400 hover:bg-blue-50/40 text-left transition-all group flex flex-col gap-1.5"
                >
                  <div className="w-7 h-7 rounded-lg bg-slate-100 group-hover:bg-blue-600 group-hover:text-white flex items-center justify-center text-slate-600 transition-colors">
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-900 block group-hover:text-blue-700">
                      {b.label}
                    </span>
                    <span className="text-[10px] text-slate-400 line-clamp-1">
                      {b.desc}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
