import React from "react";
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  BarChart3,
  Sparkles,
  LogOut,
  ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/lib/auth/auth-context";

export interface TeacherNavProps {
  currentTab: "dashboard" | "students" | "classes" | "lessons" | "practice" | "ai" | "research" | "assessments";
  onNavigate: (path: string) => void;
  onAskAI?: () => void;
}

export function TeacherNav({ currentTab, onNavigate, onAskAI }: TeacherNavProps) {
  const { user, logout } = useAuth();

  const navItems = [
    { id: "dashboard", label: "Dashboard", href: "/teacher", icon: LayoutDashboard },
    { id: "students", label: "Students", href: "/teacher/students", icon: Users },
    { id: "classes", label: "Classes", href: "/teacher/classes", icon: GraduationCap },
    { id: "lessons", label: "Lessons", href: "/teacher/lessons", icon: BookOpen },
    { id: "practice", label: "Practice Sets", href: "/teacher/practice-sets", icon: CheckCircle2 },
    { id: "assessments", label: "Assessments", href: "/teacher/assessments", icon: ClipboardCheck },
    { id: "research", label: "Research Analytics", href: "/teacher/research", icon: BarChart3 },
  ];

  return (
    <div className="bg-white border-b border-slate-200/90 sticky top-16 z-30 shadow-2xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          {/* Navigation Links */}
          <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto no-scrollbar py-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onNavigate(item.href)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                    isActive
                      ? "bg-teal-600 text-white shadow-2xs"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>

          {/* Right Actions: AI Assistant & Sign Out */}
          <div className="flex items-center gap-2 shrink-0">
            {onAskAI && (
              <Button
                variant="outline"
                size="sm"
                onClick={onAskAI}
                className="gap-1.5 text-xs text-indigo-700 bg-indigo-50 border-indigo-200 hover:bg-indigo-100 h-8"
              >
                <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                <span className="hidden sm:inline">AI Teaching Assistant</span>
                <span className="sm:hidden">AI</span>
              </Button>
            )}

            <Button
              variant="ghost"
              size="sm"
              onClick={() => logout()}
              className="text-xs text-slate-500 hover:text-red-600 h-8 px-2"
              title="Sign Out"
            >
              <LogOut className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
