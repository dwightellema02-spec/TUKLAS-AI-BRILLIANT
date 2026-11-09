/** Small generated SVG diagrams (as data URIs) used by lesson image blocks. No external files. */
export const uri = (svg: string) => `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
export const wrap = (w: number, h: number, body: string) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" font-family="Arial, sans-serif" font-size="13"><rect width="${w}" height="${h}" fill="#ffffff"/>${body}</svg>`;
export const pts = (n: number, cx: number, cy: number, r: number, start = -90) => Array.from({ length: n }, (_, i) => { const a = ((start + (360 / n) * i) * Math.PI) / 180; return [cx + r * Math.cos(a), cy + r * Math.sin(a)] as const; });
export const poly = (p: ReadonlyArray<readonly [number, number]>, fill: string, stroke = "#0f766e") => `<polygon points="${p.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ")}" fill="${fill}" stroke="${stroke}" stroke-width="2.5" stroke-linejoin="round"/>`;
export const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
/** One text line (several lines are stacked 17px apart). Text is XML-escaped: an unescaped "<" makes the whole SVG invalid and the picture breaks. */
export const label = (x: number, y: number, t: string | string[], anchor = "middle") =>
  (Array.isArray(t) ? t : [t]).map((line, i) => `<text x="${x}" y="${y + i * 17}" text-anchor="${anchor}" fill="#334155">${esc(line)}</text>`).join("");

/** Regular polygons with 3, 4, 5, 6, 8 and 10 sides, labelled by name. */
export function regularPolygonsDiagram(): string {
  const items: Array<[number, string]> = [[3, "triangle"], [4, "square"], [5, "pentagon"], [6, "hexagon"], [8, "octagon"], [10, "decagon"]];
  // two rows of three so the labels stay readable when the picture is shrunk to a phone screen
  let body = "";
  items.forEach(([n, name], i) => {
    const cx = 80 + (i % 3) * 130, cy = 70 + Math.floor(i / 3) * 140;
    body += poly(pts(n, cx, cy, 48, n === 4 ? -45 : -90), "#ccfbf1") + `<text x="${cx}" y="${cy + 78}" text-anchor="middle" fill="#334155" font-size="17">${name} (${n})</text>`;
  });
  return uri(wrap(420, 315, body));
}

/** A convex pentagon next to a non-convex (arrowhead) quadrilateral with its reflex angle marked. */
export function convexConcaveDiagram(): string {
  const convex = poly(pts(5, 120, 85, 60), "#dbeafe", "#1d4ed8");
  const concave = poly([[300, 30], [400, 140], [345, 100], [290, 140]], "#fee2e2", "#b91c1c");
  const body = convex + label(120, 165, ["convex: every interior", "angle is less than 180°"]) + concave + label(345, 165, ["non-convex: one angle", "is more than 180°"]) + `<path d="M 330 98 A 18 18 0 1 0 360 98" fill="none" stroke="#b91c1c" stroke-width="2" stroke-dasharray="3 3"/>`;
  return uri(wrap(470, 205, body));
}

/** Two intersecting lines with the four angles labelled 1-4 (vertical pairs and linear pairs). */
export function intersectingLinesDiagram(): string {
  const body = `<line x1="40" y1="150" x2="320" y2="30" stroke="#0f766e" stroke-width="3"/><line x1="60" y1="40" x2="300" y2="160" stroke="#1d4ed8" stroke-width="3"/>` +
    label(180, 70, "1") + label(235, 100, "2") + label(180, 128, "3") + label(125, 100, "4") + label(180, 188, ["∠1 = ∠3 and ∠2 = ∠4 (vertical angles)", "∠1 + ∠2 = 180° (linear pair)"]);
  return uri(wrap(360, 225, body));
}

/** A triangle with the exterior angle at one vertex shown, next to its adjacent interior angle. */
export function interiorExteriorDiagram(): string {
  const body = poly([[60, 150], [220, 150], [150, 50]], "#fef9c3", "#a16207") + `<line x1="220" y1="150" x2="300" y2="150" stroke="#a16207" stroke-width="2.5" stroke-dasharray="5 4"/>` +
    label(200, 138, "interior", "end") + label(268, 135, "exterior") + label(180, 185, "interior + exterior = 180° (a straight line)");
  return uri(wrap(360, 200, body));
}

/** A regular pentagon built from a circle: the five points are 72° apart. */
export function constructionDiagram(): string {
  const p = pts(5, 130, 100, 75);
  const spokes = p.map(([x, y]) => `<line x1="130" y1="100" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="#94a3b8" stroke-width="1.5"/>`).join("");
  const body = `<circle cx="130" cy="100" r="75" fill="none" stroke="#94a3b8" stroke-width="1.5"/>` + spokes + poly(p, "rgba(20,184,166,0.15)") + label(150, 92, "72°", "start") + label(130, 200, "5 equal angles at the center: 360° ÷ 5 = 72°");
  return uri(wrap(300, 215, body));
}
