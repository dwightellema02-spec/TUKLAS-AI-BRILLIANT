import React, { useEffect, useState } from "react";

interface Notice { version: string; schoolName: string; sections: Array<{ id: string; title: string; paragraphs: string[] }> }

/** The privacy notice, exactly as the server describes it (it changes with the school's settings). */
export function PrivacyNoticeView({ compact = false }: { compact?: boolean }) {
  const [notice, setNotice] = useState<Notice | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    fetch("/api/privacy-notice").then((r) => (r.ok ? r.json() : Promise.reject())).then((j) => setNotice(j.data)).catch(() => setError(true));
  }, []);
  if (error) return <p role="alert" className="text-sm text-red-700">The privacy notice could not be loaded. Please try again, or ask your teacher.</p>;
  if (!notice) return <p className="text-sm text-slate-500">Loading the privacy notice...</p>;
  return (
    <div data-testid="privacy-notice" className={compact ? "space-y-3 text-sm" : "space-y-5 text-sm sm:text-base"}>
      {notice.sections.map((s) => (
        <section key={s.id}>
          <h2 className={compact ? "font-bold text-slate-900" : "text-lg font-bold text-slate-900"}>{s.title}</h2>
          {s.paragraphs.map((p, i) => <p key={i} className="text-slate-700 leading-relaxed mt-1">{p}</p>)}
        </section>
      ))}
      <p className="text-xs text-slate-500">Notice version {notice.version}.</p>
    </div>
  );
}
