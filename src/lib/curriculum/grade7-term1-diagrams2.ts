/**
 * More generated SVG diagrams for the Grade 7 Term 1 daily lessons (Phase 50): every lesson has at least one picture that shows its example.
 * Same rules as grade7-term1-diagrams.ts: inline data URIs, no external files, text XML-escaped (an unescaped "<" breaks the whole picture),
 * and a picture that is not drawn to scale says so.
 */
import { uri, wrap, pts, poly, esc, label } from "./grade7-term1-diagrams";

const RAD = Math.PI / 180;
/** A point at distance r from (cx, cy) in direction deg (math orientation: 0 = right, 90 = up). */
const at = (cx: number, cy: number, r: number, deg: number) => [cx + r * Math.cos(deg * RAD), cy - r * Math.sin(deg * RAD)] as const;
const f1 = (n: number) => n.toFixed(1);
const line = (a: readonly [number, number], b: readonly [number, number], color = "#334155", w = 2.5, dash = "") => `<line x1="${f1(a[0])}" y1="${f1(a[1])}" x2="${f1(b[0])}" y2="${f1(b[1])}" stroke="${color}" stroke-width="${w}"${dash ? ` stroke-dasharray="${dash}"` : ""} stroke-linecap="round"/>`;
/** An arc around (cx, cy) from startDeg to endDeg, drawn counter-clockwise as seen on the page. */
const arc = (cx: number, cy: number, r: number, startDeg: number, endDeg: number, color = "#b91c1c") => {
  const a = at(cx, cy, r, startDeg), b = at(cx, cy, r, endDeg);
  return `<path d="M ${f1(a[0])} ${f1(a[1])} A ${r} ${r} 0 ${Math.abs(endDeg - startDeg) > 180 ? 1 : 0} 0 ${f1(b[0])} ${f1(b[1])}" fill="none" stroke="${color}" stroke-width="2.2"/>`;
};
const polar = (cx: number, cy: number, r: number, deg: number, text: string, color = "#b91c1c", size = 13) => { const [x, y] = at(cx, cy, r, deg); return `<text x="${f1(x)}" y="${f1(y + 4)}" text-anchor="middle" fill="${color}" font-size="${size}" font-weight="bold">${esc(text)}</text>`; };
const rightAngle = (v: readonly [number, number], dx1: number, dy1: number, dx2: number, dy2: number, s = 12) => `<path d="M ${f1(v[0] + dx1 * s)} ${f1(v[1] + dy1 * s)} L ${f1(v[0] + (dx1 + dx2) * s)} ${f1(v[1] + (dy1 + dy2) * s)} L ${f1(v[0] + dx2 * s)} ${f1(v[1] + dy2 * s)}" fill="none" stroke="#b91c1c" stroke-width="2"/>`;
const tick = (a: readonly [number, number], b: readonly [number, number]) => { const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1; const nx = (-dy / L) * 6, ny = (dx / L) * 6; return `<line x1="${f1(mx - nx)}" y1="${f1(my - ny)}" x2="${f1(mx + nx)}" y2="${f1(my + ny)}" stroke="#0f766e" stroke-width="2.5"/>`; };
const money = (n: number) => `₱${Math.round(n).toLocaleString("en-US")}`;
const pctText = (x: number) => `${Number.isInteger(x) ? x : x.toFixed(1)}%`;

// ------------------------------------------------------------------------------------------------------------------ Week 1

/** Week 1, Day 1: a polygon, and three figures that are not polygons (with the reason). */
export function nonPolygonsDiagram(): string {
  const tri = poly([[50, 40], [110, 120], [20, 120]], "#dcfce7", "#15803d");
  const circle = `<circle cx="190" cy="82" r="40" fill="#fee2e2" stroke="#b91c1c" stroke-width="2.5"/>`;
  const open = `<polyline points="285,120 285,40 355,120 325,50" fill="none" stroke="#b91c1c" stroke-width="2.5"/>`;
  const cross = `<polyline points="395,40 465,120 395,120 465,40 395,40" fill="#fee2e2" stroke="#b91c1c" stroke-width="2.5" stroke-linejoin="round"/>`;
  const body = tri + label(65, 148, ["polygon", "closed, straight sides"]) + circle + label(190, 148, ["not a polygon", "curved side"]) + open + label(320, 148, ["not a polygon", "open figure"]) + cross + label(430, 148, ["not a polygon", "sides cross"]);
  return uri(wrap(490, 185, body));
}

/** Week 1, Day 1: triangle ABC with its vertices, sides and interior angles named. */
export function labelledTriangleDiagram(): string {
  const A = [50, 150] as const, B = [150, 30] as const, C = [270, 150] as const;
  const body = poly([A, B, C], "#fef9c3", "#a16207") +
    `<text x="38" y="168" fill="#0f172a" font-size="16" font-weight="bold">A</text><text x="148" y="22" text-anchor="middle" fill="#0f172a" font-size="16" font-weight="bold">B</text><text x="276" y="168" fill="#0f172a" font-size="16" font-weight="bold">C</text>` +
    label(80, 84, "side AB", "end") + label(228, 84, "side BC", "start") + label(160, 172, "side AC") +
    arc(50, 150, 26, 0, 50, "#b91c1c") + arc(150, 30, 26, 232, 302, "#b91c1c") + arc(270, 150, 26, 130, 180, "#b91c1c") +
    label(165, 198, "3 sides, 3 vertices (A, B, C), 3 interior angles (at A, B, C)");
  return uri(wrap(330, 215, body));
}

/** Week 1, Day 2: a regular pentagon (tick marks = equal sides, 108° angles) next to an irregular hexagon. */
export function regularIrregularDiagram(): string {
  const P = pts(5, 100, 95, 62);
  let reg = poly(P, "#ccfbf1");
  P.forEach((p, i) => { reg += tick(p, P[(i + 1) % 5]); });
  reg += polar(100, 95, 38, -90, "108°", "#b91c1c", 12) + label(100, 178, ["regular pentagon", "equal sides, equal angles"]);
  const H: Array<readonly [number, number]> = [[250, 50], [330, 40], [385, 95], [360, 150], [295, 160], [245, 110]];
  const irr = poly(H, "#fee2e2", "#b91c1c") + label(300, 192, ["irregular hexagon", "sides and angles are not all equal"]) +
    label(290, 36, "4 cm") + label(372, 62, "3 cm", "start") + label(385, 128, "4.5 cm", "start") + label(332, 168, "5 cm", "start");
  return uri(wrap(450, 215, reg + irr));
}

/** Week 1, Day 3: a regular polygon drawn from a circle; one angle at the center is marked. */
export function centralAngleDiagram(n: number, note: string): string {
  const cx = 130, cy = 105, r = 80, p = pts(n, cx, cy, r, 0);
  const spokes = p.map(([x, y]) => line([cx, cy], [x, y], "#94a3b8", 1.5)).join("");
  const deg = 360 / n;
  const body = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#94a3b8" stroke-width="1.5"/>` + spokes + poly(p, "rgba(20,184,166,0.15)") +
    arc(cx, cy, 26, 0, deg) + polar(cx, cy, 44, deg / 2, `${deg}°`) + `<circle cx="${cx}" cy="${cy}" r="3.5" fill="#0f172a"/>` +
    label(cx, 212, [`${n} points, every ${deg}° around the center`, `360° ÷ ${n} = ${deg}°`, note]);
  return uri(wrap(300, 262, body));
}

/** Week 1, Day 4: a triangle drawn from a 5 cm side and angles of 40° and 60°; the third angle is measured (80°). */
export function drawnTriangleDiagram(): string {
  const A = [40, 160] as const, L = 250, Bpt = [A[0] + L, 160] as const;
  const sinr = (d: number) => Math.sin(d * RAD);
  const AC = (L * sinr(60)) / sinr(80), Cpt = at(A[0], A[1], AC, 40);
  const body = poly([A, Bpt, Cpt], "#e0f2fe", "#0369a1") + arc(A[0], A[1], 34, 0, 40) + polar(A[0], A[1], 52, 20, "40°") + arc(Bpt[0], Bpt[1], 34, 120, 180) + polar(Bpt[0], Bpt[1], 54, 150, "60°") +
    arc(Cpt[0], Cpt[1], 26, 220, 300) + polar(Cpt[0], Cpt[1], 44, 260, "80°") +
    `<text x="${A[0] - 4}" y="178" fill="#0f172a" font-weight="bold">A</text><text x="${Bpt[0] - 2}" y="178" fill="#0f172a" font-weight="bold">B</text><text x="${f1(Cpt[0] + 8)}" y="${f1(Cpt[1] - 4)}" fill="#0f172a" font-weight="bold">C</text>` +
    label(165, 196, ["AB = 5 cm, drawn with a ruler;", "the angles are drawn with a protractor"]);
  return uri(wrap(340, 232, body));
}

/** Week 1, Day 4: a 5 cm by 3 cm rectangle drawn with a protractor; all four angles measure 90°. */
export function drawnRectangleDiagram(): string {
  const x0 = 40, y0 = 30, w = 250, h = 150;
  const tl = [x0, y0] as const, tr = [x0 + w, y0] as const, br = [x0 + w, y0 + h] as const, bl = [x0, y0 + h] as const;
  const body = poly([tl, tr, br, bl], "#ede9fe", "#6d28d9") + rightAngle(tl, 1, 0, 0, 1) + rightAngle(tr, -1, 0, 0, 1) + rightAngle(br, -1, 0, 0, -1) + rightAngle(bl, 1, 0, 0, -1) +
    label(x0 + w / 2, y0 + h + 22, "5 cm") + label(x0 - 8, y0 + h / 2 + 4, "3 cm", "end") + label(x0 + w / 2, y0 + h / 2, "all four angles are 90°");
  return uri(wrap(340, 225, body));
}

// ------------------------------------------------------------------------------------------------------------------ Week 2

/** Week 2, Days 1 and 4: a quadrilateral with its four interior angles written in (not drawn to scale). */
export function quadrilateralAnglesDiagram(angles: [number, number, number, number], convex: boolean): string {
  const V: Array<readonly [number, number]> = convex ? [[60, 40], [270, 55], [250, 165], [40, 150]] : [[160, 30], [260, 170], [160, 120], [60, 170]];
  const lab: Array<readonly [number, number]> = convex ? [[84, 66], [244, 78], [226, 150], [66, 134]] : [[160, 62], [228, 160], [160, 104], [92, 160]];
  const body = poly(V, convex ? "#dbeafe" : "#fee2e2", convex ? "#1d4ed8" : "#b91c1c") + lab.map(([x, y], i) => `<text x="${x}" y="${y}" text-anchor="middle" fill="#0f172a" font-weight="bold" font-size="13">${angles[i]}°</text>`).join("") +
    label(160, 206, [`${angles.join(" + ")} = ${angles.reduce((a, b) => a + b, 0)}°`, `${angles.every((a) => a < 180) ? "every angle is less than 180°: convex" : "one angle is more than 180°: non-convex"} (not to scale)`]);
  return uri(wrap(320, 248, body));
}

/** Week 2, Day 2: a complementary pair (30° + 60° = 90°) and a supplementary pair (70° + 110° = 180°). */
export function angleSumPairsDiagram(): string {
  const v1 = [60, 150] as const, v2 = [325, 150] as const;
  const left = line(v1, [160, 150], "#334155", 3) + line(v1, at(v1[0], v1[1], 100, 30), "#0f766e", 3) + line(v1, at(v1[0], v1[1], 100, 90), "#334155", 3) + rightAngle(v1, 1, 0, 0, -1, 11) +
    arc(v1[0], v1[1], 40, 0, 30, "#1d4ed8") + polar(v1[0], v1[1], 58, 15, "30°", "#1d4ed8") + arc(v1[0], v1[1], 56, 30, 90) + polar(v1[0], v1[1], 74, 62, "60°") + label(110, 182, ["complementary", "30° + 60° = 90°"]);
  const right = line([210, 150], [440, 150], "#334155", 3) + line(v2, at(v2[0], v2[1], 100, 70), "#0f766e", 3) + arc(v2[0], v2[1], 38, 0, 70, "#1d4ed8") + polar(v2[0], v2[1], 56, 30, "70°", "#1d4ed8") + arc(v2[0], v2[1], 54, 70, 180) + polar(v2[0], v2[1], 70, 128, "110°") + label(325, 182, ["supplementary", "70° + 110° = 180°"]);
  return uri(wrap(470, 215, left + right));
}

/** Week 2, Day 3: lines PQ and RT cross at O; the four angles are 48°, 132°, 48° and 132°. */
export function crossingLabelledDiagram(): string {
  const O = [180, 100] as const;
  const P = at(O[0], O[1], 130, 180), Q = at(O[0], O[1], 130, 0), R = at(O[0], O[1], 95, 132), T = at(O[0], O[1], 95, -48);
  const txt = (p: readonly [number, number], t: string, dx: number, dy: number) => `<text x="${f1(p[0] + dx)}" y="${f1(p[1] + dy)}" fill="#0f172a" font-weight="bold" font-size="15">${t}</text>`;
  const body = line(P, Q, "#0f766e", 3) + line(R, T, "#1d4ed8", 3) + txt(P, "P", -16, 5) + txt(Q, "Q", 8, 5) + txt(R, "R", -6, -8) + txt(T, "T", 6, 16) +
    `<circle cx="${O[0]}" cy="${O[1]}" r="3.5" fill="#0f172a"/>` + txt(O, "O", 6, -8) +
    polar(O[0], O[1], 36, 156, "48°") + polar(O[0], O[1], 40, 66, "132°") + polar(O[0], O[1], 36, -24, "48°") + polar(O[0], O[1], 40, 246, "132°") +
    label(180, 206, ["∠POR and ∠QOT are vertical angles (equal)", "∠POR and ∠ROQ are a linear pair (48° + 132° = 180°)"]);
  return uri(wrap(360, 250, body));
}

// ------------------------------------------------------------------------------------------------------------------ Week 3

/** Week 3, Day 1: a pentagon with each side extended once; the exterior angle at each vertex sits next to its interior angle. */
export function exteriorAnglesPolygonDiagram(): string {
  const cx = 160, cy = 110, P = pts(5, cx, cy, 62);
  let body = poly(P, "#fef9c3", "#a16207");
  P.forEach((v, i) => {
    const prev = P[(i + 4) % 5], dx = v[0] - prev[0], dy = v[1] - prev[1], L = Math.hypot(dx, dy), e = [v[0] + (dx / L) * 38, v[1] + (dy / L) * 38] as const;
    body += line(v, e, "#b45309", 2, "5 4");
    const mid = [(P[(i + 1) % 5][0] + v[0]) / 2, (P[(i + 1) % 5][1] + v[1]) / 2] as const; void mid;
    body += `<text x="${f1(v[0] + (v[0] - cx) * 0.52 + (dx / L) * 6)}" y="${f1(v[1] + (v[1] - cy) * 0.52 + (dy / L) * 6 + 4)}" fill="#b91c1c" font-weight="bold" font-size="12">e${i + 1}</text>`;
    body += `<text x="${f1(v[0] - (v[0] - cx) * 0.36)}" y="${f1(v[1] - (v[1] - cy) * 0.36 + 4)}" text-anchor="middle" fill="#1d4ed8" font-weight="bold" font-size="12">i${i + 1}</text>`;
  });
  body += label(160, 224, ["i = interior angle (inside), e = exterior angle (outside)", "each e is paired with the i at the same vertex"]);
  return uri(wrap(330, 262, body));
}

/** Week 3, Day 2: a triangle with angles 38°, 60° and 82°; the exterior angle at the 82° vertex is 98°. */
export function triangleExteriorDiagram(): string {
  const sinr = (d: number) => Math.sin(d * RAD);
  const P = [40, 240] as const, L = 240, Q = [P[0] + L, 240] as const;
  const PR = (L * sinr(60)) / sinr(82), R = at(P[0], P[1], PR, 38);
  const ext = at(R[0], R[1], 64, 38);
  const body = poly([P, Q, R], "#fef9c3", "#a16207") + line(R, ext, "#b45309", 2.5, "5 4") +
    arc(P[0], P[1], 36, 0, 38, "#1d4ed8") + polar(P[0], P[1], 56, 19, "38°", "#1d4ed8") + arc(Q[0], Q[1], 36, 120, 180, "#1d4ed8") + polar(Q[0], Q[1], 56, 150, "60°", "#1d4ed8") +
    arc(R[0], R[1], 28, 218, 300, "#1d4ed8") + polar(R[0], R[1], 48, 259, "82°", "#1d4ed8") +
    arc(R[0], R[1], 34, -60, 38, "#b91c1c") + polar(R[0], R[1], 62, -11, "98°") + label(R[0] + 30, R[1] - 10, "exterior", "start") +
    label(160, 276, "82° + 98° = 180°: interior + exterior on a straight line");
  return uri(wrap(340, 296, body));
}

/** Week 3, Day 3: a regular polygon cut into triangles from one vertex: n sides give n - 2 triangles. */
export function triangulationDiagram(n: number): string {
  const cx = 140, cy = 100, P = pts(n, cx, cy, 78, -90);
  const colors = ["#fde68a", "#bfdbfe", "#bbf7d0", "#fecaca", "#e9d5ff", "#fed7aa"];
  let body = "";
  for (let k = 1; k < n - 1; k++) body += `<polygon points="${[P[0], P[k], P[k + 1]].map(([x, y]) => `${f1(x)},${f1(y)}`).join(" ")}" fill="${colors[(k - 1) % colors.length]}" stroke="#0f766e" stroke-width="2" stroke-linejoin="round"/>`;
  body += label(140, 205, [`${n} sides cut into ${n - 2} triangles from one vertex`, `${n - 2} × 180° = ${(n - 2) * 180}°`]);
  return uri(wrap(280, 245, body));
}

/** Week 3, Days 4 and 5: a regular polygon with one interior angle and its exterior angle marked. */
export function regularAnglesDiagram(n: number): string {
  const cx = 130, cy = 132, r = 70, P = pts(n, cx, cy, r, -90);
  const interior = ((n - 2) * 180) / n, exterior = 360 / n;
  const v = P[0], prev = P[n - 1], next = P[1];
  const dx = v[0] - prev[0], dy = v[1] - prev[1], L = Math.hypot(dx, dy), ext = [v[0] + (dx / L) * 58, v[1] + (dy / L) * 58] as const;
  const dirNext = (Math.atan2(-(next[1] - v[1]), next[0] - v[0]) * 180) / Math.PI;
  const body = poly(P, "#ccfbf1") + line(v, ext, "#b45309", 2.5, "5 4") +
    arc(v[0], v[1], 24, dirNext, dirNext + exterior, "#b91c1c") + polar(v[0], v[1], 44, dirNext + exterior / 2, `${exterior}°`) +
    `<text x="${f1(v[0] + (cx - v[0]) * 0.42)}" y="${f1(v[1] + (cy - v[1]) * 0.42 + 4)}" text-anchor="middle" fill="#1d4ed8" font-weight="bold" font-size="13">${interior}°</text>` +
    label(150, 232, [`regular ${n}-gon: each interior angle = ${interior}°`, `each exterior angle = 360° ÷ ${n} = ${exterior}°`, `${interior}° + ${exterior}° = 180°`]);
  return uri(wrap(300, 292, body));
}

// ------------------------------------------------------------------------------------------------------------------ Weeks 4 and 5 (percent and money)

/** Weeks 4: two bars, the original value and the new value, with the change coloured and the percentage written. */
export function changeBarsDiagram(original: number, next: number, unit: string, noun: string): string {
  const up = next > original, max = Math.max(original, next), W = 280, scale = W / max;
  const change = Math.abs(next - original), pct = (change / original) * 100;
  const fmt = (n: number) => (unit === "₱" ? money(n) : `${n.toLocaleString("en-US")}`);
  const body = label(10, 28, `original ${noun}`, "start") + `<rect x="10" y="36" width="${f1(original * scale)}" height="30" rx="4" fill="#93c5fd" stroke="#1d4ed8" stroke-width="2"/>` + label(10 + (original * scale) / 2, 56, fmt(original)) +
    label(10, 100, `new ${noun}`, "start") + `<rect x="10" y="108" width="${f1(Math.min(original, next) * scale)}" height="30" rx="4" fill="#93c5fd" stroke="#1d4ed8" stroke-width="2"/>` +
    `<rect x="${f1(10 + Math.min(original, next) * scale)}" y="108" width="${f1(change * scale)}" height="30" rx="4" fill="${up ? "#86efac" : "#fca5a5"}" stroke="${up ? "#15803d" : "#b91c1c"}" stroke-width="2"${up ? "" : ' stroke-dasharray="5 3"'}/>` +
    label(10 + (next * scale) / 2, 128, fmt(next)) +
    label(10, 172, [`${up ? "increase" : "decrease"} = ${fmt(change)}`, `${fmt(change)} ÷ ${fmt(original)} × 100% = ${pctText(pct)} ${up ? "increase" : "decrease"}`], "start") +
    label(10, 214, ["green = added, red dashed = taken away.", "Compare the change with the ORIGINAL value."], "start");
  return uri(wrap(310, 250, body));
}

/** Weeks 4 and 5: the original amount is 100%; the part taken off and the part that is left are shown as percents. */
export function percentBarDiagram(offPct: number, wholeText: string, leftText: string, offText: string): string {
  const W = 280, x0 = 15, offW = (W * offPct) / 100;
  const body = `<rect x="${x0}" y="40" width="${W}" height="38" fill="#fff" stroke="#334155" stroke-width="2"/>` +
    `<rect x="${x0}" y="40" width="${f1(W - offW)}" height="38" fill="#bbf7d0" stroke="#15803d" stroke-width="2"/>` + `<rect x="${f1(x0 + W - offW)}" y="40" width="${f1(offW)}" height="38" fill="#fecaca" stroke="#b91c1c" stroke-width="2" stroke-dasharray="5 3"/>` +
    label(x0 + (W - offW) / 2, 64, `${100 - offPct}%`) + label(x0 + W - offW / 2, 64, `${offPct}%`) +
    label(x0 + W / 2, 28, wholeText) + label(x0 + (W - offW) / 2, 104, leftText) + label(x0 + W, 124, offText, "end");
  return uri(wrap(310, 150, body));
}

/** Week 5, Day 1: a price tag with the original price crossed out, the percent off and the sale price. */
export function priceTagDiagram(original: number, offPct: number): string {
  const off = (original * offPct) / 100, sale = original - off;
  const body = `<polygon points="30,20 250,20 290,70 250,120 30,120" fill="#fef9c3" stroke="#a16207" stroke-width="2.5" stroke-linejoin="round"/><circle cx="52" cy="70" r="7" fill="#fff" stroke="#a16207" stroke-width="2"/>` +
    `<text x="90" y="52" fill="#64748b" font-size="15">${esc(money(original))}</text><line x1="86" y1="47" x2="150" y2="47" stroke="#b91c1c" stroke-width="2"/>` +
    `<text x="170" y="56" fill="#b91c1c" font-size="20" font-weight="bold">${offPct}% OFF</text><text x="90" y="98" fill="#15803d" font-size="22" font-weight="bold">${esc(money(sale))}</text>` +
    label(160, 148, [`discount = ${money(original)} × ${offPct / 100} = ${money(off)}`, `sale price = ${money(original)} − ${money(off)} = ${money(sale)}`]);
  return uri(wrap(320, 192, body));
}

/** Week 5, Day 2: a price plus its sales tax gives what is paid; sales times the commission rate gives the commission. */
export function taxCommissionDiagram(): string {
  const price = 1500, rate = 12, tax = (price * rate) / 100, sales = 250000, cRate = 3, comm = (sales * cRate) / 100;
  const body = label(10, 22, "Sales tax (VAT) is added to the price", "start") +
    `<rect x="10" y="32" width="220" height="28" fill="#bfdbfe" stroke="#1d4ed8" stroke-width="2"/><rect x="230" y="32" width="${f1(220 * rate / 100)}" height="28" fill="#fecaca" stroke="#b91c1c" stroke-width="2"/>` +
    label(120, 51, money(price)) + label(262, 51, money(tax), "start") +
    label(10, 84, [`tax = ${money(price)} × ${rate / 100} = ${money(tax)}`, `paid in all = ${money(price)} + ${money(tax)} = ${money(price + tax)}`], "start") +
    label(10, 148, "Commission is a percent of the sales", "start") +
    `<rect x="10" y="158" width="440" height="28" fill="#e9d5ff" stroke="#6d28d9" stroke-width="2"/><rect x="10" y="158" width="${f1(440 * cRate / 100)}" height="28" fill="#86efac" stroke="#15803d" stroke-width="2"/>` +
    label(230, 177, `total sales ${money(sales)}`) + label(10, 210, [`commission = ${money(sales)} × ${cRate / 100} = ${money(comm)}`, "(the green part is the commission; the picture is not drawn to scale)"], "start");
  return uri(wrap(470, 250, body));
}

/** Week 5, Day 3: the principal stays the same and the same interest is added each year (I = P × r × t). */
export function interestTimelineDiagram(principal: number, ratePct: number, years: number): string {
  const yearly = (principal * ratePct) / 100, w = 70;
  let body = `<rect x="10" y="30" width="${w}" height="70" fill="#bfdbfe" stroke="#1d4ed8" stroke-width="2"/>` + label(10 + w / 2, 70, ["principal", money(principal)]) + label(10 + w / 2, 22, "start");
  for (let i = 1; i <= years; i++) body += `<rect x="${10 + w + (i - 1) * 62}" y="${100 - 28}" width="58" height="28" fill="#86efac" stroke="#15803d" stroke-width="2"/>` + label(10 + w + (i - 1) * 62 + 29, 92, money(yearly)) + label(10 + w + (i - 1) * 62 + 29, 22, `year ${i}`);
  body += label(10, 134, [`interest each year = ${money(principal)} × ${ratePct / 100} = ${money(yearly)}`, `after ${years} years: I = ${money(principal)} × ${ratePct / 100} × ${years} = ${money(yearly * years)}`], "start");
  return uri(wrap(Math.max(340, 10 + w + years * 62 + 10), 172, body));
}

/** Week 5, Day 4: one day's allowance split into planned expenses and savings. */
export function budgetBarDiagram(): string {
  const parts: Array<[string, number, string, string]> = [["food", 60, "#fed7aa", "#c2410c"], ["fare", 40, "#bfdbfe", "#1d4ed8"], ["school", 30, "#e9d5ff", "#6d28d9"], ["savings", 70, "#bbf7d0", "#15803d"]];
  const W = 400, total = 200; let x = 10, body = label(10, 22, "Allowance for one day: ₱200", "start");
  parts.forEach(([name, amt, fill, stroke]) => { const w = (W * amt) / total; body += `<rect x="${f1(x)}" y="32" width="${f1(w)}" height="40" fill="${fill}" stroke="${stroke}" stroke-width="2"/>` + label(x + w / 2, 56, money(amt)) + label(x + w / 2, 92, name); x += w; });
  body += label(10, 128, ["savings = income − (food + fare + school)", "savings = ₱200 − (₱60 + ₱40 + ₱30) = ₱70"], "start");
  return uri(wrap(420, 168, body));
}

// ------------------------------------------------------------------------------------------------------------------ Week 6

/** Week 6, Day 1: a ratio compares the same kind of thing; a rate compares different kinds of thing. */
export function ratioVsRateDiagram(): string {
  let body = label(115, 20, "ratio: same unit (people)");
  for (let i = 0; i < 3; i++) body += `<circle cx="${40 + i * 26}" cy="50" r="9" fill="#93c5fd" stroke="#1d4ed8" stroke-width="2"/>`;
  for (let i = 0; i < 5; i++) body += `<circle cx="${30 + i * 26}" cy="84" r="9" fill="#fdba74" stroke="#c2410c" stroke-width="2"/>`;
  body += label(115, 122, ["3 boys to 5 girls", "ratio 3 : 5"]) + label(360, 20, "rate: different units");
  for (let i = 0; i < 3; i++) body += `<rect x="${290 + i * 40}" y="34" width="32" height="26" rx="4" fill="#fef9c3" stroke="#a16207" stroke-width="2"/>` + label(306 + i * 40, 52, "kg");
  body += label(360, 84, "₱45") + label(360, 122, ["₱45 for 3 kg", "₱45 ÷ 3 kg = ₱15 per kg (unit rate)"]);
  return uri(wrap(480, 160, body));
}

/** Weeks 6: a double number line, the two quantities side by side at proportional positions (the unit rate is the value at 1). */
export function doubleNumberLineDiagram(topName: string, top: number[], bottomName: string, bottom: number[], caption: string[]): string {
  const x0 = 96, W = 310, maxB = Math.max(...bottom);
  let body = label(10, 46, topName, "start") + label(10, 126, bottomName, "start") + line([x0, 56], [x0 + W, 56], "#1d4ed8", 3) + line([x0, 112], [x0 + W, 112], "#c2410c", 3);
  bottom.forEach((b, i) => { const x = x0 + (W * b) / maxB; body += line([x, 50], [x, 62], "#1d4ed8", 2) + line([x, 106], [x, 118], "#c2410c", 2) + line([x, 62], [x, 106], "#94a3b8", 1.2, "3 3") + label(x, 42, top[i].toLocaleString("en-US")) + label(x, 136, String(b)); });
  body += label(x0 + W / 2, 168, caption);
  return uri(wrap(x0 + W + 40, 168 + caption.length * 17 + 8, body));
}
