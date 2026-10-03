import React from "react";
import { Logo } from "@/components/shared/Logo";

export default function Loading() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="min-h-[50vh] flex flex-col items-center justify-center p-6 text-center"
    >
      <div className="relative mb-4">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-slate-200 border-t-blue-600" />
      </div>
      <Logo size="sm" />
      <p className="mt-3 text-sm text-slate-500 font-medium">
        Loading Tuklas AI learning space...
      </p>
    </div>
  );
}
