import React from "react";
import { Button } from "@/components/ui/Button";
import { AlertCircle, RotateCcw, Home } from "lucide-react";

export interface ErrorProps {
  error?: Error;
  reset?: () => void;
  onNavigateHome?: () => void;
}

export default function ErrorPage({ error, reset, onNavigateHome }: ErrorProps) {
  return (
    <div
      role="alert"
      className="min-h-[50vh] flex flex-col items-center justify-center p-6 text-center max-w-md mx-auto"
    >
      <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center mb-4">
        <AlertCircle className="w-6 h-6" />
      </div>
      <h2 className="text-xl font-bold text-slate-900 mb-2">Something went wrong</h2>
      <p className="text-sm text-slate-600 mb-6 leading-relaxed">
        {error?.message || "An unexpected error occurred while loading this view. Please try again."}
      </p>
      <div className="flex items-center gap-3">
        {reset && (
          <Button variant="primary" size="sm" onClick={() => reset()} className="gap-2">
            <RotateCcw className="w-4 h-4" />
            <span>Try Again</span>
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            if (onNavigateHome) onNavigateHome();
            else window.location.href = "/";
          }}
          className="gap-2"
        >
          <Home className="w-4 h-4" />
          <span>Go Home</span>
        </Button>
      </div>
    </div>
  );
}
