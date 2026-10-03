import React, { useState } from "react";
import { useAuth } from "@/lib/auth/auth-context";
import { UserRole } from "@/types";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { X, Lock, Mail, User, Shield, GraduationCap, Users } from "lucide-react";

export interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultRole?: UserRole;
  onSuccess?: () => void;
}

export function AuthModal({
  isOpen,
  onClose,
  defaultRole = "STUDENT",
  onSuccess,
}: AuthModalProps) {
  const { login, register, quickLoginAs } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [role, setRole] = useState<UserRole>(defaultRole);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      let loggedInRole: UserRole = "STUDENT";
      if (isRegister) {
        const res = await register(name, email, password, "STUDENT");
        if (!res.success) {
          setError(res.error || "Registration failed");
          return;
        }
        loggedInRole = res.user?.role || "STUDENT";
      } else {
        const res = await login(email, password);
        if (!res.success) {
          setError(res.error || "Login failed");
          return;
        }
        loggedInRole = res.user?.role || "STUDENT";
      }

      onClose();
      if (onSuccess) {
        onSuccess();
      } else if (typeof window !== "undefined") {
        const targetPath =
          loggedInRole === "TEACHER"
            ? "/teacher"
            : loggedInRole === "ADMIN"
            ? "/admin"
            : "/student";

        if (window.location.pathname === targetPath) {
          window.location.reload();
        } else {
          window.location.pathname = targetPath;
        }
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleQuick = async (targetRole: UserRole) => {
    setError(null);
    setSubmitting(true);
    try {
      await quickLoginAs(targetRole);
      onClose();
      if (onSuccess) {
        onSuccess();
      } else if (typeof window !== "undefined") {
        const targetPath =
          targetRole === "TEACHER"
            ? "/teacher"
            : targetRole === "ADMIN"
            ? "/admin"
            : "/student";

        if (window.location.pathname === targetPath) {
          window.location.reload();
        } else {
          window.location.pathname = targetPath;
        }
      }
    } catch {
      setError("Quick sign-in failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              {isRegister ? "Create Tuklas AI Account" : "Sign In to Tuklas AI"}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Secure role-based authentication (Phase 2 Foundation)
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 font-medium">
              {error}
            </div>
          )}

          {/* Quick Demo Switcher - Development Only */}
          {(import.meta.env.DEV || import.meta.env.MODE !== "production") && (
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80">
              <span className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
                ⚡ Development Test Accounts (Instant Sign-in):
              </span>
              <div className="grid grid-cols-3 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuick("STUDENT")}
                  disabled={submitting}
                  className="text-xs py-1.5 gap-1"
                >
                  <GraduationCap className="w-3.5 h-3.5 text-blue-600" />
                  <span>Student</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuick("TEACHER")}
                  disabled={submitting}
                  className="text-xs py-1.5 gap-1"
                >
                  <Users className="w-3.5 h-3.5 text-teal-600" />
                  <span>Teacher</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuick("ADMIN")}
                  disabled={submitting}
                  className="text-xs py-1.5 gap-1"
                >
                  <Shield className="w-3.5 h-3.5 text-slate-700" />
                  <span>Admin</span>
                </Button>
              </div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-3.5">
            {isRegister && (
              <>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Full Name</label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Maria Cruz"
                      className="w-full text-sm pl-9 pr-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-blue-50/70 border border-blue-100 text-xs text-blue-800">
                  <GraduationCap className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>Creating Student Account (MATATAG Mathematics)</span>
                </div>
              </>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Email Address</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@school.edu.ph"
                  className="w-full text-sm pl-9 pr-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full text-sm pl-9 pr-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <Button variant="primary" fullWidth type="submit" disabled={submitting} className="mt-2">
              {submitting ? "Processing..." : isRegister ? "Create Account" : "Sign In"}
            </Button>
          </form>

          {/* Toggle Register / Login */}
          <div className="text-center pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => {
                setIsRegister(!isRegister);
                setError(null);
              }}
              className="text-xs text-blue-600 hover:underline font-medium"
            >
              {isRegister
                ? "Already have an account? Sign in here"
                : "Need a new account? Register here"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
