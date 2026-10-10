import React, { useSyncExternalStore } from "react";
import { connectionState } from "@/lib/net/resilient-fetch";

/** Shown while requests are being retried because the server is waking up or reconnecting to its database. */
export function ConnectionNotice() {
  const waiting = useSyncExternalStore(connectionState.subscribe, () => connectionState.waiting, () => false);
  if (!waiting) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="connection-notice"
      className="fixed top-0 inset-x-0 z-[90] bg-amber-100 border-b border-amber-300 text-amber-900 text-xs sm:text-sm text-center px-4 py-2"
    >
      The server is waking up or reconnecting. Please wait a moment: we are trying again automatically. Your work is not lost.
    </div>
  );
}
