import React from "react";
import { Button } from "@/components/ui/Button";
import { FileQuestion, Home } from "lucide-react";

export interface NotFoundProps {
  onNavigateHome?: () => void;
}

export default function NotFound({ onNavigateHome }: NotFoundProps) {
  return (
    <div className="min-h-[50vh] flex flex-col items-center justify-center p-6 text-center max-w-md mx-auto">
      <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mb-4">
        <FileQuestion className="w-7 h-7" />
      </div>
      <h2 className="text-2xl font-bold text-slate-900 mb-2">Page Not Found</h2>
      <p className="text-sm text-slate-600 mb-6 leading-relaxed">
        The learning module or section you are looking for does not exist or has not been initialized yet.
      </p>
      <Button
        variant="primary"
        onClick={() => {
          if (onNavigateHome) onNavigateHome();
          else window.location.href = "/";
        }}
        className="gap-2"
      >
        <Home className="w-4 h-4" />
        <span>Return to Tuklas AI Home</span>
      </Button>
    </div>
  );
}
