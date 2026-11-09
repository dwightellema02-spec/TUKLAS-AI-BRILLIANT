import React, { useEffect, useState } from "react";
import { ShieldAlert } from "lucide-react";

export interface MathAuthorization {
  loaded: boolean;
  canAuthorMathematics: boolean;
  message: string | null;
}

/** Phase 51: whether the signed-in person is a Mathematics teacher verified by an administrator. The server decides; this only explains. */
export function useMathAuthorization(): MathAuthorization {
  const [state, setState] = useState<MathAuthorization>({ loaded: false, canAuthorMathematics: false, message: null });
  useEffect(() => {
    let alive = true;
    fetch("/api/me/subject-authorization")
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (alive && json?.data) setState({ loaded: true, canAuthorMathematics: !!json.data.canAuthorMathematics, message: json.data.message ?? null });
        else if (alive) setState((s) => ({ ...s, loaded: true }));
      })
      .catch(() => alive && setState((s) => ({ ...s, loaded: true })));
    return () => { alive = false; };
  }, []);
  return state;
}

export function MathAuthorizationNotice({ auth }: { auth: MathAuthorization }) {
  if (!auth.loaded || auth.canAuthorMathematics) return null;
  return (
    <div role="status" data-testid="math-auth-notice" className="mb-6 flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
      <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
      <div>
        <p className="font-bold">Mathematics authorization required</p>
        <p className="mt-1">
          Only Mathematics teachers verified by an administrator can create, import, edit, publish or add videos to Mathematics lessons (Grades 7 to 10).
          You can still read lessons and the question bank. Ask an administrator to verify your Mathematics assignment.
        </p>
      </div>
    </div>
  );
}
