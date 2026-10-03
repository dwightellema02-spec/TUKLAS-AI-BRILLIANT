import React, { useState } from "react";
import { Logo } from "@/components/shared/Logo";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { siteConfig } from "@/config/site";
import { useAuth } from "@/lib/auth/auth-context";
import { AuthModal } from "@/components/auth/AuthModal";
import {
  Menu,
  X,
  ArrowRight,
  GraduationCap,
  Users,
  Shield,
  LogOut,
  LogIn,
  Database,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";

export interface NavbarProps {
  currentPath?: string;
  onNavigate?: (path: string) => void;
}

export function Navbar({ currentPath = "/", onNavigate }: NavbarProps) {
  const { user, logout, dbStatus } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);

  const handleLinkClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault();
    setMobileMenuOpen(false);
    if (onNavigate) {
      onNavigate(href);
    } else {
      window.location.pathname = href;
    }
  };

  const getRoleIcon = () => {
    switch (user?.role) {
      case "STUDENT":
        return <GraduationCap className="w-3.5 h-3.5 text-blue-600" />;
      case "TEACHER":
        return <Users className="w-3.5 h-3.5 text-teal-600" />;
      case "ADMIN":
        return <Shield className="w-3.5 h-3.5 text-purple-600" />;
      default:
        return null;
    }
  };

  return (
    <>
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200/80 transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 sm:h-20">
            {/* Brand Logo & DB Badge */}
            <div className="flex items-center gap-3">
              <a
                href="/"
                onClick={(e) => handleLinkClick(e, "/")}
                className="flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-lg p-1"
                aria-label="Tuklas AI Homepage"
              >
                <Logo size="md" />
              </a>

              {/* Database Connection Indicator */}
              <div
                title={dbStatus?.details || "Checking database..."}
                className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border bg-slate-50 border-slate-200 text-slate-600 cursor-help"
              >
                <Database className="w-3 h-3 text-slate-500" />
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>
                  {dbStatus?.provider === "neon-postgresql" ? "Neon PostgreSQL" : "Sandbox DB"}
                </span>
              </div>
            </div>

            {/* Desktop Navigation */}
            <nav
              className="hidden md:flex items-center gap-1 lg:gap-2"
              aria-label="Main Navigation"
            >
              {siteConfig.mainNav.map((item) => {
                const isActive = currentPath === item.href;
                return (
                  <a
                    key={item.title}
                    href={item.href}
                    onClick={(e) => handleLinkClick(e, item.href)}
                    className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors duration-150 ${
                      isActive
                        ? "text-blue-600 bg-blue-50/80 font-semibold"
                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                    }`}
                    aria-current={isActive ? "page" : undefined}
                  >
                    <span className="flex items-center gap-1.5">
                      {item.title}
                      {item.badge && (
                        <span className="text-[10px] px-1.5 py-0.2 bg-slate-200 text-slate-700 rounded-full font-semibold">
                          {item.badge}
                        </span>
                      )}
                    </span>
                  </a>
                );
              })}
            </nav>

            {/* User Profile / Auth Actions */}
            <div className="hidden sm:flex items-center gap-3">
              {user ? (
                <div className="flex items-center gap-2.5 bg-slate-50 border border-slate-200/80 rounded-xl px-3 py-1.5">
                  <div className="flex items-center gap-1.5">
                    {getRoleIcon()}
                    <span className="text-xs font-semibold text-slate-800 max-w-[120px] truncate">
                      {user.name}
                    </span>
                  </div>
                  <Badge variant="secondary" className="text-[10px] py-0">
                    {user.role}
                  </Badge>
                  <button
                    onClick={() => logout()}
                    title="Sign Out"
                    className="text-slate-400 hover:text-red-600 p-1 rounded-md transition-colors"
                    aria-label="Sign out"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setAuthModalOpen(true)}
                    className="gap-1.5 text-slate-700"
                  >
                    <LogIn className="w-4 h-4" />
                    <span>Sign In</span>
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => (onNavigate ? onNavigate("/student") : (window.location.pathname = "/student"))}
                    className="gap-1.5"
                  >
                    <span>Start Learning</span>
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </>
              )}
            </div>

            {/* Mobile Menu Button */}
            <div className="flex md:hidden items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
                aria-expanded={mobileMenuOpen}
              >
                {mobileMenuOpen ? <X className="w-5 h-5 text-slate-700" /> : <Menu className="w-5 h-5 text-slate-700" />}
              </Button>
            </div>
          </div>
        </div>

        {/* Mobile Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden border-b border-slate-200 bg-white px-4 pt-2 pb-6 space-y-3 shadow-lg animate-in slide-in-from-top-2">
            {user ? (
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-900">{user.name}</p>
                  <p className="text-[11px] text-slate-500">{user.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-[10px]">
                    {user.role}
                  </Badge>
                  <Button variant="outline" size="sm" onClick={() => logout()}>
                    <LogOut className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                variant="outline"
                fullWidth
                onClick={() => {
                  setMobileMenuOpen(false);
                  setAuthModalOpen(true);
                }}
                className="gap-2"
              >
                <LogIn className="w-4 h-4" />
                <span>Sign In / Switch Account</span>
              </Button>
            )}

            <nav className="flex flex-col space-y-1" aria-label="Mobile Navigation">
              {siteConfig.mainNav.map((item) => (
                <a
                  key={item.title}
                  href={item.href}
                  onClick={(e) => handleLinkClick(e, item.href)}
                  className="px-3 py-2 text-sm font-medium rounded-lg text-slate-700 hover:text-blue-600 hover:bg-slate-50 flex items-center justify-between"
                >
                  <span>{item.title}</span>
                  {item.badge && (
                    <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full">
                      {item.badge}
                    </span>
                  )}
                </a>
              ))}
            </nav>
          </div>
        )}
      </header>

      <AuthModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} />
    </>
  );
}
