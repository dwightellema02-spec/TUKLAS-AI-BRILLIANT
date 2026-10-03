import React from "react";

export interface LogoProps {
  size?: "sm" | "md" | "lg";
  showTagline?: boolean;
}

export function Logo({ size = "md", showTagline = false }: LogoProps) {
  const sizeMap = {
    sm: { icon: "w-7 h-7", text: "text-lg", symbol: "w-4 h-4" },
    md: { icon: "w-9 h-9", text: "text-xl", symbol: "w-5 h-5" },
    lg: { icon: "w-12 h-12", text: "text-2xl", symbol: "w-7 h-7" },
  };

  const current = sizeMap[size];

  return (
    <div className="inline-flex items-center gap-2.5 group select-none">
      {/* Original Tuklas Glyph: Intersecting discovery lens & mathematical sigma/delta facets */}
      <div
        className={`${current.icon} rounded-xl bg-gradient-to-tr from-slate-900 via-blue-900 to-teal-700 flex items-center justify-center text-white shadow-xs group-hover:scale-105 transition-transform duration-200 ring-1 ring-white/20`}
        aria-hidden="true"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`${current.symbol} text-teal-300`}
        >
          {/* Compass / Prism discovery ray */}
          <polygon points="12 2 19 21 12 17 5 21 12 2" fill="currentColor" fillOpacity="0.2" />
          <line x1="12" y1="2" x2="12" y2="17" stroke="#38bdf8" />
          <circle cx="12" cy="10" r="2.5" fill="#f59e0b" stroke="none" />
        </svg>
      </div>

      <div className="flex flex-col">
        <span
          className={`${current.text} font-bold tracking-tight text-slate-900 flex items-center gap-1`}
        >
          Tuklas <span className="text-teal-600 font-extrabold text-sm sm:text-base">AI</span>
        </span>
        {showTagline && (
          <span className="text-[11px] font-medium text-slate-500 tracking-wide uppercase">
            Learn • Practice • Discover
          </span>
        )}
      </div>
    </div>
  );
}
