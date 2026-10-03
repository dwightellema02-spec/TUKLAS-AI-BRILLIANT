import React, { ReactNode } from "react";
import { Navbar } from "@/components/shared/Navbar";
import { Footer } from "@/components/shared/Footer";

export interface RootLayoutProps {
  children: ReactNode;
  currentPath?: string;
  onNavigate?: (path: string) => void;
}

export default function RootLayout({
  children,
  currentPath = "/",
  onNavigate,
}: RootLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 selection:bg-teal-100 selection:text-teal-900">
      <Navbar currentPath={currentPath} onNavigate={onNavigate} />
      <main className="flex-1" id="main-content">
        {children}
      </main>
      <Footer onNavigate={onNavigate} />
    </div>
  );
}
