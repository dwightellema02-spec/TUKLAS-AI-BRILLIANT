import React from "react";
import { PrivacyNoticeView } from "@/components/privacy/PrivacyNoticeView";

export default function PrivacyPage({ onNavigate }: { onNavigate?: (path: string) => void }) {
  return (
    <div className="py-10 bg-slate-50 min-h-[calc(100vh-140px)]">
      <div className="max-w-2xl mx-auto px-4 space-y-5">
        <button type="button" onClick={() => (onNavigate ? onNavigate("/") : (window.location.pathname = "/"))} className="text-xs text-slate-500 hover:text-slate-900">← Back to Home</button>
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
          <h1 className="text-2xl font-black text-slate-900 mb-4">Privacy notice</h1>
          <PrivacyNoticeView />
        </div>
      </div>
    </div>
  );
}
