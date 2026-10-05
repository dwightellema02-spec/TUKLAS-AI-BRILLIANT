import React, { useState, useEffect } from "react";
import { useAuth, authFetch } from "@/lib/auth/auth-context";
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

  const [accounts, setAccounts] = useState<Array<{ id: string; name: string; email: string; role: string; disabled?: boolean }>>([]);
  const [audit, setAudit] = useState<Array<{ id: string; action: string; actorId: string | null; targetId: string | null; createdAt: string }>>([]);
  const [acctForm, setAcctForm] = useState({ name: "", email: "", password: "", role: "TEACHER" });
  const [acctMsg, setAcctMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const loadAccounts = async () => {
    try {
      const lists = await Promise.all(
        ["TEACHER", "ADMIN"].map(async (role) => {
          const res = await authFetch(`/api/admin/users?role=${role}`);
          if (!res.ok) return [];
          const json = await res.json();
          return Array.isArray(json.data?.users) ? json.data.users : [];
        })
      );
      setAccounts(lists.flat());
    } catch {
      /* list stays empty */
    }
  };

  const loadAudit = async () => {
    try {
      const res = await authFetch("/api/admin/audit?limit=15");
      if (res.ok) setAudit(((await res.json()).data?.entries as any[]) || []);
    } catch {
      /* leave empty */
    }
  };

  const accountAction = async (id: string, action: "disable" | "enable" | "revoke-sessions" | "reset-password", body?: object) => {
    setAcctMsg(null);
    const res = await authFetch(`/api/admin/users/${id}/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {}),
    });
    const json = await res.json().catch(() => ({}));
    setAcctMsg({ ok: res.ok, text: res.ok ? json.note || "Done." : json.error || "That action failed" });
    loadAccounts();
    loadAudit();
  };

  const createAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setAcctMsg(null);
    const res = await authFetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(acctForm),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setAcctMsg({ ok: false, text: json.error || "Could not create the account" });
      return;
    }
    setAcctMsg({ ok: true, text: `Created ${acctForm.role.toLowerCase()} account for ${acctForm.email}. Share the password with them privately.` });
    setAcctForm({ name: "", email: "", password: "", role: acctForm.role });
    loadAccounts();
    loadAudit();
  };

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
      loadAccounts();
      loadAudit();
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

        <div data-testid="admin-accounts" className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs mb-8">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-3">Staff accounts</h2>
          <form onSubmit={createAccount} className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs mb-3">
            <input required placeholder="Full name" aria-label="Full name" value={acctForm.name} onChange={(e) => setAcctForm({ ...acctForm, name: e.target.value })} className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2" />
            <input required type="email" placeholder="Email" aria-label="Email" value={acctForm.email} onChange={(e) => setAcctForm({ ...acctForm, email: e.target.value })} className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2" />
            <input required type="password" autoComplete="new-password" placeholder="Temporary password (8+, letter and digit)" aria-label="Temporary password" value={acctForm.password} onChange={(e) => setAcctForm({ ...acctForm, password: e.target.value })} className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2" />
            <select aria-label="Role" value={acctForm.role} onChange={(e) => setAcctForm({ ...acctForm, role: e.target.value })} className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
              <option value="TEACHER">Teacher</option>
              <option value="ADMIN">Admin</option>
            </select>
            <Button type="submit" variant="primary" size="sm" className="sm:col-span-2 bg-purple-600 hover:bg-purple-700">Create account</Button>
          </form>
          {acctMsg && <p role="status" className={`text-xs mb-3 ${acctMsg.ok ? "text-emerald-700" : "text-red-600"}`}>{acctMsg.text}</p>}
          <ul className="text-xs divide-y divide-slate-100">
            {accounts.map((a) => (
              <li key={a.id} data-testid={`account-${a.email}`} className="py-2 flex flex-wrap items-center justify-between gap-2">
                <span className={a.disabled ? "text-slate-400 line-through" : ""}><b>{a.name}</b> · {a.email}</span>
                <span className="flex items-center gap-2">
                  <Badge variant="default">{a.role}{a.disabled ? " · disabled" : ""}</Badge>
                  {a.id !== user?.id && (
                    <>
                      <button type="button" onClick={() => accountAction(a.id, a.disabled ? "enable" : "disable")} className="text-[11px] text-slate-600 hover:text-purple-700 underline">{a.disabled ? "Enable" : "Disable"}</button>
                      <button type="button" onClick={() => accountAction(a.id, "revoke-sessions")} className="text-[11px] text-slate-600 hover:text-purple-700 underline">Sign out devices</button>
                      <button type="button" onClick={() => { const pw = window.prompt(`Temporary password for ${a.email} (8+ characters, a letter and a digit)`); if (pw) accountAction(a.id, "reset-password", { temporaryPassword: pw }); }} className="text-[11px] text-slate-600 hover:text-purple-700 underline">Reset password</button>
                    </>
                  )}
                </span>
              </li>
            ))}
          </ul>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mt-5 mb-2">Recent security activity</h3>
          <ul data-testid="audit-list" className="text-[11px] text-slate-600 space-y-1">
            {audit.length === 0 && <li>Nothing recorded yet.</li>}
            {audit.map((e) => (
              <li key={e.id}><span className="font-mono">{e.action}</span> · {new Date(e.createdAt).toLocaleString()}</li>
            ))}
          </ul>
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
                  Accounts and classes are stored in this database when one is configured
                </p>
              </div>
            </div>
          </div>

        </div>
      </div>
      <AuthModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} />
    </div>
  );
}
