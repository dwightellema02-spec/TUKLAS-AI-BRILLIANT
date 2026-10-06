import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { UserRole } from "@/types";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export interface PrivacyStatus {
  /** Server enforces acceptance (production): until accepted nothing else works. */
  required: boolean;
  needsAcceptance: boolean;
  version: string;
  guardianConsent: boolean | null;
}

export interface DbStatus {
  connected: boolean;
  provider: string;
  details: string;
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  dbStatus: DbStatus | null;
  privacy: PrivacyStatus | null;
  acceptPrivacy: () => Promise<boolean>;
  login: (email: string, password: string) => Promise<{ success: boolean; user?: AuthUser; error?: string }>;
  register: (
    name: string,
    email: string,
    password: string,
    role?: UserRole,
    acceptPrivacy?: boolean
  ) => Promise<{ success: boolean; user?: AuthUser; error?: string }>;
  logout: () => Promise<void>;
  quickLoginAs: (role: UserRole) => Promise<void>;
  refreshDbStatus: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export async function authFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const modifiedInit: RequestInit = { ...init };
  if (!modifiedInit.credentials) {
    modifiedInit.credentials = "include";
  }
  if (typeof window !== "undefined") {
    // The session lives in an HttpOnly cookie. A token is deliberately NOT kept in localStorage, where any injected
    // script could read it. (Remove a leftover from older versions.)
    try { localStorage.removeItem("tuklas_session_token"); } catch { /* storage unavailable */ }
  }
  return fetch(input, modifiedInit);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [dbStatus, setDbStatus] = useState<DbStatus | null>(null);
  const [privacy, setPrivacy] = useState<PrivacyStatus | null>(null);

  const fetchCurrentUser = async () => {
    try {
      const res = await authFetch("/api/auth/me");

      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        setPrivacy(data.privacy ?? null);
      } else {
        if (typeof window !== "undefined") {
          localStorage.removeItem("tuklas_session_token");
        }
        setUser(null);
        setPrivacy(null);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const fetchDbStatus = async () => {
    try {
      const res = await fetch("/api/health");
      if (res.ok) {
        const data = await res.json();
        // the health check says only "connected or not" (it no longer returns the database's own error text)
        setDbStatus({ ...data.database, details: data.database?.connected ? "Connected" : "Not connected" });
      }
    } catch (e) {
      console.warn("Could not retrieve DB health:", e);
    }
  };

  useEffect(() => {
    fetchCurrentUser();
    fetchDbStatus();
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const res = await authFetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || "Login failed" };
      }

      setUser(data.user);
      await fetchCurrentUser();
      return { success: true, user: data.user };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Network error during login";
      return { success: false, error: message };
    }
  };

  const register = async (
    name: string,
    email: string,
    password: string,
    role?: UserRole,
    acceptPrivacy?: boolean
  ) => {
    try {
      const res = await authFetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, role: role || "STUDENT", acceptPrivacy: acceptPrivacy === true }),
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || "Registration failed" };
      }

      setUser(data.user);
      await fetchCurrentUser();
      return { success: true, user: data.user };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Network error during registration";
      return { success: false, error: message };
    }
  };

  const acceptPrivacy = async () => {
    const res = await authFetch("/api/auth/accept-privacy", { method: "POST" });
    if (!res.ok) return false;
    await fetchCurrentUser();
    return true;
  };

  const logout = async () => {
    try {
      if (typeof window !== "undefined") {
        localStorage.removeItem("tuklas_session_token");
      }
      await authFetch("/api/auth/logout", {
        method: "POST",
      });
    } finally {
      setUser(null);
      setPrivacy(null);
    }
  };

  const quickLoginAs = async (role: UserRole) => {
    const credentials = {
      STUDENT: { email: "student@tuklas.ai", password: "Tuklas2026!" },
      TEACHER: { email: "teacher@tuklas.ai", password: "Tuklas2026!" },
      ADMIN: { email: "admin@tuklas.ai", password: "Tuklas2026!" },
      RESEARCHER: { email: "student@tuklas.ai", password: "Tuklas2026!" },
    };

    const cred = credentials[role];
    await login(cred.email, cred.password);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        dbStatus,
        privacy,
        acceptPrivacy,
        login,
        register,
        logout,
        quickLoginAs,
        refreshDbStatus: fetchDbStatus,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
