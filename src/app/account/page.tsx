import React, { useState } from "react";
import { useAuth, authFetch } from "@/lib/auth/auth-context";
import { Button } from "@/components/ui/Button";
import { AuthModal } from "@/components/auth/AuthModal";

export interface AccountPageProps {
  onNavigate?: (path: string) => void;
}

export default function AccountPage({ onNavigate }: AccountPageProps) {
  const { user, loading, logout } = useAuth();
  const [authOpen, setAuthOpen] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [allMsg, setAllMsg] = useState<string | null>(null);

  if (!loading && !user) {
    return (
      <div className="py-16 bg-slate-50 min-h-[calc(100vh-140px)]">
        <div className="max-w-md mx-auto px-4 text-center space-y-4">
          <h1 className="text-xl font-bold text-slate-900">Sign in to manage your account</h1>
          <Button variant="primary" onClick={() => setAuthOpen(true)}>Sign in</Button>
        </div>
        <AuthModal isOpen={authOpen} onClose={() => setAuthOpen(false)} />
      </div>
    );
  }

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    if (next !== confirm) {
      setMsg({ ok: false, text: "The new passwords do not match." });
      return;
    }
    setBusy(true);
    try {
      const res = await authFetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Could not change the password");
      setMsg({ ok: true, text: json.note || "Password changed." });
      setCurrent(""); setNext(""); setConfirm("");
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : "Could not change the password" });
    } finally {
      setBusy(false);
    }
  };

  const signOutEverywhere = async () => {
    if (!window.confirm("Sign out on every device, including this one?")) return;
    const res = await authFetch("/api/auth/logout-all", { method: "POST" });
    if (res.ok) {
      setAllMsg("Signed out everywhere.");
      await logout();
    } else {
      setAllMsg("Could not sign out everywhere. Please try again.");
    }
  };

  return (
    <div className="py-10 bg-slate-50 min-h-[calc(100vh-140px)]">
      <div className="max-w-lg mx-auto px-4 space-y-6">
        <button type="button" onClick={() => (onNavigate ? onNavigate("/") : (window.location.pathname = "/"))} className="text-xs text-slate-500 hover:text-slate-900">← Back to Home</button>
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
          <h1 className="text-xl font-black text-slate-900">My account</h1>
          <p className="text-xs text-slate-500 mt-1">{user?.name} · {user?.email} · {user?.role}</p>
        </div>

        <form onSubmit={changePassword} data-testid="change-password-form" className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-3">
          <h2 className="text-sm font-bold text-slate-900">Change password</h2>
          <input type="password" autoComplete="current-password" required aria-label="Current password" placeholder="Current password" value={current} onChange={(e) => setCurrent(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm" />
          <input type="password" autoComplete="new-password" required aria-label="New password" placeholder="New password (8+ characters, a letter and a digit)" value={next} onChange={(e) => setNext(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm" />
          <input type="password" autoComplete="new-password" required aria-label="Confirm new password" placeholder="Confirm new password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm" />
          <Button type="submit" variant="primary" size="sm" disabled={busy}>{busy ? "Saving..." : "Change password"}</Button>
          {msg && <p role="status" className={`text-xs ${msg.ok ? "text-emerald-700" : "text-red-600"}`}>{msg.text} {msg.ok && "Your other devices were signed out."}</p>}
        </form>

        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-2">
          <h2 className="text-sm font-bold text-slate-900">Sign out everywhere</h2>
          <p className="text-xs text-slate-500">Use this if you lost a device or think someone else has your session.</p>
          <Button variant="outline" size="sm" onClick={signOutEverywhere}>Sign out on all devices</Button>
          {allMsg && <p role="status" className="text-xs text-slate-600">{allMsg}</p>}
        </div>
      </div>
    </div>
  );
}
