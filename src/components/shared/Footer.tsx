import React from "react";
import { Logo } from "@/components/shared/Logo";
import { Badge } from "@/components/ui/Badge";
import { siteConfig } from "@/config/site";
import { Sparkles, ShieldCheck, BookOpen } from "lucide-react";

export interface FooterProps {
  onNavigate?: (path: string) => void;
}

export function Footer({ onNavigate }: FooterProps) {
  const handleLinkClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    if (href.startsWith("/")) {
      e.preventDefault();
      if (onNavigate) {
        onNavigate(href);
      } else {
        window.location.pathname = href;
      }
    }
  };

  return (
    <footer className="bg-slate-900 text-slate-300 border-t border-slate-800 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 lg:gap-12">
          {/* Brand Info */}
          <div className="md:col-span-1 space-y-4">
            <div className="bg-white/10 p-2 rounded-xl inline-block">
              <Logo size="md" />
            </div>
            <p className="text-sm text-slate-400 leading-relaxed">
              {siteConfig.description}
            </p>
            <div className="flex flex-wrap gap-2 pt-2">
              <Badge variant="outline" className="text-slate-300 border-slate-700 bg-slate-800/50">
                Grade 7 MATATAG
              </Badge>
              <Badge variant="info" className="text-teal-300 border-teal-800/60 bg-teal-950/40">
                Mathematics
              </Badge>
            </div>
          </div>

          {/* Nav Columns */}
          {siteConfig.footerNav.map((section) => (
            <div key={section.title} className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-200">
                {section.title}
              </h4>
              <ul className="space-y-2 text-sm">
                {section.items.map((item) => (
                  <li key={item.title}>
                    <a
                      href={item.href}
                      onClick={(e) => handleLinkClick(e, item.href)}
                      className="text-slate-400 hover:text-white transition-colors duration-150 inline-flex items-center gap-1.5"
                    >
                      {item.title}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Phase Disclaimer & Compliance Banner */}
        <div className="mt-12 pt-8 border-t border-slate-800/80 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              <strong>Phase 1 Foundation:</strong> Core layout and structural scaffolding.
              AI tutoring, database persistence, and teacher analytics will activate in upcoming development phases.
            </span>
          </div>
          <div className="flex items-center sm:justify-end gap-2 text-slate-400">
            <BookOpen className="w-4 h-4 text-teal-400 shrink-0" />
            <span>Aligned with the Department of Education (DepEd) MATATAG Curriculum Standards.</span>
          </div>
        </div>

        {/* Copyright */}
        <div className="mt-6 pt-6 border-t border-slate-800/40 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400 gap-4">
          <p>© {new Date().getFullYear()} Tuklas AI. All educational rights reserved.</p>
          <div className="flex items-center gap-4">
            <span className="inline-flex items-center gap-1 text-slate-400">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Accessible & Student-Centered
            </span>
            <span className="text-slate-400">•</span>
            <span>Version {siteConfig.version}</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
