import React from "react";
import { Sparkles, MessageSquare, Lightbulb, ArrowRight, HelpCircle, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { QuickHelpTopicDTO } from "@/lib/dashboard/student-dashboard-types";

export interface NeedHelpSectionProps {
  topics: QuickHelpTopicDTO[];
  onSelectTopic: (topic: QuickHelpTopicDTO) => void;
  onOpenGeneralChat: () => void;
}

export function NeedHelpSection({
  topics,
  onSelectTopic,
  onOpenGeneralChat,
}: NeedHelpSectionProps) {
  return (
    <div className="bg-gradient-to-br from-indigo-900 via-slate-900 to-blue-950 text-white rounded-3xl p-6 sm:p-8 shadow-md relative overflow-hidden mb-8">
      {/* Decorative ambient gradients */}
      <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-64 h-64 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-teal-300 bg-teal-950/60 px-2.5 py-0.5 rounded-full border border-teal-800/60">
              <Sparkles className="w-3.5 h-3.5 text-teal-300" />
              Tuklas AI Learning Companion
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Need Help with Mathematics?
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 max-w-xl leading-relaxed">
              Stuck on integers or want a step-by-step hint? Ask Tuklas AI for friendly explanations, visual diagrams, or real-life examples.
            </p>
          </div>

          <Button
            variant="primary"
            size="md"
            onClick={onOpenGeneralChat}
            className="gap-2 bg-gradient-to-r from-teal-500 to-blue-500 hover:from-teal-400 hover:to-blue-400 text-slate-950 font-black shadow-md shrink-0"
          >
            <MessageSquare className="w-4 h-4" />
            <span>Ask Tuklas AI</span>
          </Button>
        </div>

        {/* Quick Question Chips */}
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-200 block mb-2.5">
            Quick Inquiries (1-Click Explanations):
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {topics.map((item) => (
              <button
                key={item.id}
                onClick={() => onSelectTopic(item)}
                className="text-left p-3.5 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/10 transition-all text-xs text-slate-200 hover:text-white flex items-center justify-between gap-2 group backdrop-blur-xs"
              >
                <div className="flex items-center gap-2.5">
                  <Lightbulb className="w-4 h-4 text-amber-300 shrink-0 group-hover:scale-110 transition-transform" />
                  <span className="font-medium line-clamp-1">{item.topic}</span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-white transition-colors shrink-0" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
