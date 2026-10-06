import React, { useState } from "react";
import { useAuth } from "@/lib/auth/auth-context";
import { PrivacyNoticeView } from "./PrivacyNoticeView";

/**
 * Shown over everything, for a signed-in person who has not accepted the current privacy notice, when the server enforces acceptance
 * (production). The server refuses every other request until it is accepted, so this is not just a courtesy.
 */
export function PrivacyGate() {
  const { user, privacy, acceptPrivacy, logout } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!user || !privacy?.required || !privacy.needsAcceptance) return null;
  const accept = async () => {
    setBusy(true); setError(null);
    const ok = await acceptPrivacy();
    if (!ok) setError("That did not work. Please try again.");
    setBusy(false);
  };
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="privacy-gate-title" data-testid="privacy-gate" className="fixed inset-0 z-[100] bg-slate-900/70 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-2xl max-h-[92vh] flex flex-col rounded-t-3xl sm:rounded-3xl shadow-xl">
        <div className="p-5 border-b border-slate-100">
          <h2 id="privacy-gate-title" className="text-lg font-black text-slate-900">Before you start: how your information is used</h2>
          <p className="text-xs text-slate-500 mt-1">Please read this and accept it to continue.</p>
        </div>
        <div className="p-5 overflow-y-auto"><PrivacyNoticeView compact /></div>
        <div className="p-5 border-t border-slate-100 flex flex-col sm:flex-row gap-2 sm:justify-end">
          {error && <p role="alert" className="text-xs text-red-700 sm:mr-auto self-center">{error}</p>}
          <button type="button" onClick={logout} className="px-4 py-2 rounded-xl border border-slate-200 text-sm text-slate-600">Sign out</button>
          <button type="button" onClick={accept} disabled={busy} className="px-4 py-2 rounded-xl bg-teal-600 text-white text-sm font-semibold disabled:opacity-50">{busy ? "Saving..." : "I have read this and accept"}</button>
        </div>
      </div>
    </div>
  );
}
