import { authFetch } from "@/lib/auth/auth-context";

/**
 * Finds a published practice set to open: one for the given skill when there is one, otherwise the first published set.
 * Returns null when the school has none, so the caller can say so instead of opening a page that does not exist.
 * (Replaces hard-coded demo ids that only exist in sandbox data.)
 */
export async function findPracticeSetId(skillId?: string | null): Promise<string | null> {
  try {
    const pick = async (query: string) => {
      const res = await authFetch(`/api/practice-sets?status=PUBLISHED${query}`);
      if (!res.ok) return null;
      const list = ((await res.json()).data || []) as Array<{ id: string }>;
      return list[0]?.id ?? null;
    };
    return (skillId ? await pick(`&skillId=${encodeURIComponent(skillId)}`) : null) ?? (await pick(""));
  } catch {
    return null;
  }
}
