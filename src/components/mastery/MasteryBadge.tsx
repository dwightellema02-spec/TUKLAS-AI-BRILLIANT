/**
 * Tuklas AI - Mastery Badge Component
 * Accessible visual representation of the 5 controlled mastery levels
 */

import React from "react";
import {
  Award,
  Sparkles,
  TrendingUp,
  BookOpen,
  CircleDashed,
  CheckCircle2,
} from "lucide-react";
import type { MasteryLevel } from "@/lib/mastery/mastery-types";

interface MasteryBadgeProps {
  level: MasteryLevel;
  size?: "sm" | "md" | "lg";
  showIcon?: boolean;
  className?: string;
}

export function MasteryBadge({
  level,
  size = "md",
  showIcon = true,
  className = "",
}: MasteryBadgeProps) {
  const getBadgeConfig = (lvl: MasteryLevel) => {
    switch (lvl) {
      case "MASTERED":
        return {
          label: "Mastered",
          icon: Award,
          bgClass: "bg-emerald-50 text-emerald-800 border-emerald-300 shadow-xs",
          iconClass: "text-emerald-600",
          dotColor: "bg-emerald-500",
        };
      case "PROFICIENT":
        return {
          label: "Proficient",
          icon: CheckCircle2,
          bgClass: "bg-teal-50 text-teal-800 border-teal-300",
          iconClass: "text-teal-600",
          dotColor: "bg-teal-500",
        };
      case "DEVELOPING":
        return {
          label: "Developing",
          icon: TrendingUp,
          bgClass: "bg-blue-50 text-blue-800 border-blue-300",
          iconClass: "text-blue-600",
          dotColor: "bg-blue-500",
        };
      case "LEARNING":
        return {
          label: "Learning",
          icon: BookOpen,
          bgClass: "bg-amber-50 text-amber-800 border-amber-300",
          iconClass: "text-amber-600",
          dotColor: "bg-amber-500",
        };
      case "NOT_STARTED":
      default:
        return {
          label: "Not Started",
          icon: CircleDashed,
          bgClass: "bg-slate-100 text-slate-600 border-slate-200",
          iconClass: "text-slate-400",
          dotColor: "bg-slate-400",
        };
    }
  };

  const config = getBadgeConfig(level);
  const Icon = config.icon;

  const sizeClasses = {
    sm: "px-2 py-0.5 text-[10px] gap-1",
    md: "px-2.5 py-1 text-xs gap-1.5",
    lg: "px-3 py-1.5 text-sm gap-2 font-bold",
  };

  const iconSizes = {
    sm: "w-3 h-3",
    md: "w-3.5 h-3.5",
    lg: "w-4 h-4",
  };

  return (
    <span
      className={`inline-flex items-center font-semibold rounded-full border transition-colors ${sizeClasses[size]} ${config.bgClass} ${className}`}
      role="status"
      aria-label={`Mastery status: ${config.label}`}
    >
      {showIcon && <Icon className={`${iconSizes[size]} ${config.iconClass}`} aria-hidden="true" />}
      <span>{config.label}</span>
    </span>
  );
}
