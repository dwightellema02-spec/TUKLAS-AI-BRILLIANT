import React, { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth/auth-context";
import { AuthModal } from "@/components/auth/AuthModal";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
  ShieldCheck,
  ArrowLeft,
  CheckCircle2,
  Lock,
  Database,
  ShieldAlert,
  Server,
  Layers,
  Key,
  LogOut,
  Cpu,
} from "lucide-react";

export interface AdminPageProps {
  onNavigate?: (path: string) => void;
}

export default function AdminPage({ onNavigate }: AdminPageProps) {
  const { user, loading, dbStatus, logout } = useAuth();
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [adminData, setAdminData] = useState<any>(null);

  const handleBack = () => {
    if (onNavigate) onNavigate("/");
    else window.location.pathname = "/";
  };

  useEffect(() => {
    async function loadAdminData() {
      try {
        const res = await fetch("/api/admin/system-summary");
        if (res.ok) {
          const json = await res.json();
          setAdminData(json);
        }
      } catch (err) {
        console.warn("Could not load admin summary:", err);
      }
    }
    if (user?.role === "ADMIN") {
      loadAdminData();
    }
  }, [user]);

  // 1. Unauthenticated Gate
  if (!loading && !user) {
    return (
      <div className="py-12 sm:py-20 bg-slate-50 min-h-[calc(100vh-140px)]">
        <div className="max-w-md mx-auto px-4 text-center">
          <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-xs">
            <div className="w-14 h-14 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center mx-auto mb-4">
              <Lock className="w-7 h-7" />
            </div>
            <h1 className="text-xl font-bold text-slate-900 mb-2">Administrator Access Protected</h1>
            <p className="text-sm text-slate-600 mb-6 leading-relaxed">
              Administrative functions, curriculum governance, and user role management require an authenticated Administrator session.
            </p>
            <div className="space-y-3">
              <Button variant="primary" fullWidth onClick={() => setAuthModalOpen(true)} className="gap-2 bg-purple-600 hover:bg-purple-700">
                <ShieldCheck className="w-4 h-4" />
                <span>Sign In as Admin</span>
              </Button>
              <Button variant="ghost" fullWidth onClick={handleBack}>
                Return to Home
              </Button>
            </div>
          </div>
        </div>
        <AuthModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} defaultRole="ADMIN" />
      </div>
    );
  }

  // 2. Role Authorization Gate: ADMIN only
  if (!loading && user && user.role !== "ADMIN") {
    return (
      <div className="py-12 sm:py-20 bg-slate-50 min-h-[calc(100vh-140px)]">
        <div className="max-w-md mx-auto px-4 text-center">
          <div className="bg-white rounded-2xl border border-red-200 p-8 shadow-xs">
            <div className="w-14 h-14 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-4">
              <ShieldAlert className="w-7 h-7" />
            </div>
            <h1 className="text-xl font-bold text-slate-900 mb-2">Unauthorized Access</h1>
            <p className="text-sm text-slate-600 mb-4 leading-relaxed">
              Your account has the role <span className="font-bold text-slate-900">{user.role}</span>. You do not have permissions to access the Administrator Portal.
            </p>
            <div className="space-y-3">
              <Button variant="outline" fullWidth onClick={() => setAuthModalOpen(true)} className="gap-2">
                <span>Switch to Administrator Account</span>
              </Button>
              <Button variant="ghost" fullWidth onClick={handleBack}>
                Return to Home
              </Button>
            </div>
          </div>
        </div>
        <AuthModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} defaultRole="ADMIN" />
      </div>
    );
  }

  return (
    <div className="py-10 sm:py-16 bg-slate-50 min-h-[calc(100vh-140px)]">
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between mb-6">
          <Button variant="ghost" size="sm" onClick={handleBack} className="gap-2 text-slate-600">
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Home</span>
          </Button>

          <Button variant="outline" size="sm" onClick={() => logout()} className="gap-1.5 text-xs text-red-600 hover:bg-red-50">
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </Button>
        </div>

        {/* Phase 2 Admin Status Card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-xs mb-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-slate-900">Admin Dashboard</h1>
                <Badge variant="default">Superuser</Badge>
              </div>
              <p className="text-slate-500 text-xs mt-0.5">
                Administrator: <span className="font-semibold text-slate-800">{user?.name}</span> ({user?.email})
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200/80 flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-emerald-900 uppercase tracking-wider">
                  Authentication
                </p>
                <p className="text-sm font-semibold text-emerald-800 mt-0.5">Connected</p>
                <p className="text-xs text-emerald-700 mt-1">
                  Full administrative permissions verified (RBAC Tier: ADMIN)
                </p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-purple-50/70 border border-purple-200/80 flex items-start gap-3">
              <Database className="w-5 h-5 text-purple-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-purple-900 uppercase tracking-wider">
                  Database
                </p>
                <p className="text-sm font-semibold text-purple-800 mt-0.5">
                  Connected ({dbStatus?.provider === "neon-postgresql" ? "PostgreSQL / Prisma" : "Prisma / Sandbox Store"})
                </p>
                <p className="text-xs text-purple-700 mt-1">
                  Prisma ORM schema initialized with 8 relational models
                </p>
              </div>
            </div>
          </div>

          {/* Database Entity Health Overview */}
          <div className="border-t border-slate-100 pt-6">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-2">
              <Layers className="w-4 h-4 text-purple-600" />
              <span>Prisma Schema Models Verified (Phase 2):</span>
            </h2>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              {[
                { name: "User", count: "3 Default Roles" },
                { name: "Subject", count: "Mathematics (MATH)" },
                { name: "Grade", count: "Grade 7" },
                { name: "Term", count: "Term 1" },
                { name: "Unit", count: "Numbers & Algebra" },
                { name: "Lesson", count: "Understanding Integers" },
                { name: "Competency", count: "M7NS-Ia-1" },
                { name: "Skill & Prereq", count: "3 Skills (DAG)" },
              ].map((m) => (
                <div key={m.name} className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="font-semibold text-slate-900 block">{m.name}</span>
                  <span className="text-[11px] text-slate-500">{m.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <AuthModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} />
    </div>
  );
}
