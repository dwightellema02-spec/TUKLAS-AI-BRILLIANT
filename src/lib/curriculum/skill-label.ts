/** Where a skill belongs ("Term 3 · Rational Numbers"), so long lists of skills can be told apart. */
export function skillContext(s: any): string {
  const u = s?.competency?.unit;
  if (!u) return "";
  return `${u.term?.termNumber ? `Term ${u.term.termNumber} · ` : ""}${u.title}`;
}

/** Skills grouped by unit, in the order the server returns them (term, unit, competency, skill). */
export function groupSkillsByUnit<T extends { competency?: { unit?: { id: string } } }>(skills: T[]): Array<{ key: string; label: string; skills: T[] }> {
  const groups: Array<{ key: string; label: string; skills: T[] }> = [];
  for (const s of skills) {
    const key = s.competency?.unit?.id ?? "other";
    let g = groups.find((x) => x.key === key);
    if (!g) { g = { key, label: skillContext(s) || "Other skills", skills: [] }; groups.push(g); }
    g.skills.push(s);
  }
  return groups;
}
