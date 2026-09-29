// UI icons — the site's own set replacing emoji (owner, 2026-09-29: "emoji → own icon set").
// The owner's standing icon rules (~/Desktop/autome/memory/icon-design-rules.md): the ten warm
// "chess" tones only (five lights, five darks), NO borders, NO thin lines, NO letters or numbers;
// every part a solid shape, lit from the UPPER LEFT in hard-edged steps inside ONE family.
// Drawn on a 96×96 grid; build.mjs writes src/lib/ui-icons.js.
// TWO-TONE GLYPH RULE (owner, 2026-09-29 — the glyphs are small and "bicoloral"): every part is
// exactly two tones of ONE family, lit (upper left) and shadow (lower right), split by ONE diagonal
// cut through the part's middle. Inner details are cut-outs (the background shows through), never a
// third colour. Parts stay thick (≥ 10 units ≈ 2 px at 18 px).

export const L5 = ["#FBF8EF", "#F6F0E1", "#F1E9D3", "#E9DEC0", "#E1D3AD"];   // lit → shadow
export const D5 = ["#6E685B", "#565146", "#3E3A31", "#2D2A23", "#1C1A15"];
// Fills are theme tokens: A0…A4 = the icon's own family (the lights on the dark theme, the darks on
// the light theme — so every icon reads on both), B0…B4 = the other family (details, holes).
// Each family runs lit → shadow. On the site they are CSS variables (--ic-a0 …); see themeVars().
const A = [0, 1, 2, 3, 4].map((i) => `var(--ic-a${i})`), B = [0, 1, 2, 3, 4].map((i) => `var(--ic-b${i})`);
export const themeVars = (dark) => [0, 1, 2, 3, 4].map((i) => `--ic-a${i}:${(dark ? L5 : D5)[i]};--ic-b${i}:${(dark ? D5 : L5)[i]}`).join(";");
const f = (n) => Math.round(n * 100) / 100;
const rad = (a) => (a * Math.PI) / 180;
let uid = 0;

/** Clip geometry `shape` (one or more elements, no fill) and fill it in stepped tones along the
 *  light: tones[0] on the upper-left … the last on the lower-right. box = [x0, y0, x1, y1]; k shifts
 *  the cuts (positive = more light). */
export function lit(shape, box, tones, { k = 0, spread = 1 } = {}) {
  const id = `u${++uid}`;
  const [x0, y0, x1, y1] = box, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, r = Math.max(x1 - x0, y1 - y0) / 2, L = 200;
  let s = `<clipPath id="${id}">${shape}</clipPath><g clip-path="url(#${id})"><rect x="-50" y="-50" width="200" height="200" fill="${tones[0]}"/>`;
  const n = tones.length;
  for (let i = 1; i < n; i++) {
    const off = (-1 + (2 * i) / n) * r * spread + k * r;   // cut on the line (x−cx)+(y−cy) = off
    const mx = cx + off / 2, my = cy + off / 2;
    s += `<polygon points="${f(mx + L)},${f(my - L)} ${f(mx + L)},${f(my + L)} ${f(mx - L)},${f(my + L)}" fill="${tones[i]}"/>`;
  }
  return s + "</g>";
}
export const T3 = [A[0], A[2], A[4]], T2 = [A[1], A[4]], TD3 = [B[0], B[2], B[4]], TD2 = [B[1], B[3]];

// ---- geometry (clip elements, no fill)
export const rr = (x, y, w, h, r = 0) => `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" rx="${f(r)}"/>`;
export const circ = (cx, cy, r) => `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(r)}"/>`;
export const poly = (pts) => `<polygon points="${pts.map(([x, y]) => `${f(x)},${f(y)}`).join(" ")}"/>`;
export const path = (d) => `<path d="${d}"/>`;
/** An annular sector (a thick arc): radii r0…r1, angles a0→a1 in degrees (0 = right, 90 = down). */
export function band(cx, cy, r0, r1, a0, a1) {
  const p = (r, a) => `${f(cx + r * Math.cos(rad(a)))} ${f(cy + r * Math.sin(rad(a)))}`, big = Math.abs(a1 - a0) > 180 ? 1 : 0;
  return `<path d="M${p(r1, a0)}A${r1} ${r1} 0 ${big} 1 ${p(r1, a1)}L${p(r0, a1)}A${r0} ${r0} 0 ${big} 0 ${p(r0, a0)}Z"/>`;
}
/** A thick straight bar from (x1,y1) to (x2,y2), w wide, with rounded ends. */
export function bar(x1, y1, x2, y2, w) {
  const a = Math.atan2(y2 - y1, x2 - x1), nx = (-Math.sin(a) * w) / 2, ny = (Math.cos(a) * w) / 2;
  return poly([[x1 + nx, y1 + ny], [x2 + nx, y2 + ny], [x2 - nx, y2 - ny], [x1 - nx, y1 - ny]]) + circ(x1, y1, w / 2) + circ(x2, y2, w / 2);
}
const cutBar = (x1, y1, x2, y2, w) => { const a = Math.atan2(y2 - y1, x2 - x1), nx = (-Math.sin(a) * w) / 2, ny = (Math.cos(a) * w) / 2, ex = Math.cos(a) * 20, ey = Math.sin(a) * 20;
  return [[x1 - ex + nx, y1 - ey + ny], [x2 + ex + nx, y2 + ey + ny], [x2 + ex - nx, y2 + ey - ny], [x1 - ex - nx, y1 - ey - ny]].map(([x, y]) => `${f(x)},${f(y)}`).join(" "); };
const star = (cx, cy, R, r) => poly(Array.from({ length: 10 }, (_, i) => { const a = rad(-90 + i * 36), q = i % 2 ? r : R; return [cx + q * Math.cos(a), cy + q * Math.sin(a)]; }));
const turn = ([x, y], deg, cx = 48, cy = 48) => { const c = Math.cos(rad(deg)), q = Math.sin(rad(deg)); return [cx + (x - cx) * c - (y - cy) * q, cy + (x - cx) * q + (y - cy) * c]; };
/** A rounded rectangle turned by deg about (cx, cy), as a polygon (corners sampled). */
function rrTurn(x, y, w, h, r, deg, cx, cy) {
  const pts = [], k = 6;
  for (const [ox, oy, a0] of [[x + w - r, y + r, -90], [x + w - r, y + h - r, 0], [x + r, y + h - r, 90], [x + r, y + r, 180]])
    for (let i = 0; i <= k; i++) { const a = rad(a0 + (90 * i) / k); pts.push(turn([ox + r * Math.cos(a), oy + r * Math.sin(a)], deg, cx, cy)); }
  return poly(pts);
}
const polyTurn = (pts, deg, cx = 48, cy = 48) => poly(pts.map((p) => turn(p, deg, cx, cy)));
const rot = (deg, body) => `<g transform="rotate(${deg} 48 48)">${body}</g>`;

// crescent: an outer circle minus a shifted inner one (the arcs meet where the circles cross)
function crescent(ox, oy, R, ix, iy, r) {
  const dx = ix - ox, dy = iy - oy, d = Math.hypot(dx, dy), a = (R * R - r * r + d * d) / (2 * d), h = Math.sqrt(R * R - a * a);
  const px = ox + (a * dx) / d, py = oy + (a * dy) / d;
  const p1 = [px + (h * dy) / d, py - (h * dx) / d], p2 = [px - (h * dy) / d, py + (h * dx) / d];
  return path(`M${f(p1[0])} ${f(p1[1])}A${R} ${R} 0 1 0 ${f(p2[0])} ${f(p2[1])}A${r} ${r} 0 0 1 ${f(p1[0])} ${f(p1[1])}Z`);
}

// ---- two-tone pieces
const TT = [A[0], A[4]];                       // lit, shadow
const two = (shape, box, o) => lit(shape, box, TT, o);
/** Cut `holes` (clip elements; unfilled = black in a mask) out of `inner` markup. */
function knock(inner, holes) { const id = `m${++uid}`; return `<mask id="${id}"><rect x="-10" y="-10" width="116" height="116" fill="#fff"/>${holes}</mask><g mask="url(#${id})">${inner}</g>`; }
/** A phone handset turned by deg about the centre: a thick arc with a pad at each end, the pads
 *  set outward and lying along the arc. */
function handset(deg) {
  const [cx, cy] = turn([74, 22], deg), a0 = 95 + deg, a1 = 175 + deg;
  const pad = (a) => { const x = cx + 50 * Math.cos(rad(a)), y = cy + 50 * Math.sin(rad(a)); return rrTurn(x - 15, y - 10, 30, 20, 9, a + 90, x, y); };
  return band(cx, cy, 42, 54, a0, a1) + pad(a0 - 4) + pad(a1 + 4);
}
const speakerShape = rr(12, 34, 20, 28, 3) + poly([[28, 34], [52, 14], [56, 16], [56, 80], [52, 82], [28, 62]]);
const micShapes = () => two(rr(33, 6, 30, 50, 15), [33, 6, 63, 56]) + two(band(48, 38, 23, 33, 0, 180), [15, 38, 81, 71]) + two(rr(43, 68, 10, 12) + rr(28, 77, 40, 11, 5.5), [28, 68, 68, 88]);
const bustShapes = () => two(circ(36, 28, 16), [20, 12, 52, 44]) + two(path("M6 88 C6 66 19 52 36 52 C53 52 66 66 66 88 Z"), [6, 52, 66, 88]);
const tri = (pts) => { const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]); return two(poly(pts), [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]); };
const flame = "M49 4 C56 22 78 34 78 58 C78 76 65 90 48 90 C31 90 18 76 18 58 C18 44 28 34 33 22 C39 31 41 38 45 41 C45 28 43 16 49 4 Z";
const flameIn = (g) => `M48 ${46 - g} C${55 + g} ${56} ${63 + g} ${61} ${63 + g} ${72} C${63 + g} ${81 + g} ${56 + g} ${87 + g} 48 ${87 + g} C${40 - g} ${87 + g} ${33 - g} ${81 + g} ${33 - g} 72 C${33 - g} 61 ${41 - g} 56 48 ${46 - g} Z`;

// [key, name, what it replaces, body]
export const ICONS = [
  ["sound-on", "Sound on", "🔊 table / replay", () =>
    two(speakerShape, [12, 14, 56, 82]) + two(band(55, 48, 12, 23, -46, 46), [55, 31, 78, 65]) + two(band(55, 48, 29, 40, -48, 48), [58, 18, 95, 78])],
  ["sound-off", "Sound off", "🔇", () =>
    two(speakerShape, [12, 14, 56, 82]) + two(bar(64, 36, 86, 60, 11) + bar(86, 36, 64, 60, 11), [58, 30, 92, 66])],
  ["bell", "Notifications", "🔔 top bar", () =>
    two(circ(48, 12, 7) + path("M20 68 C26 60 27 50 27 42 C27 27 36 18 48 18 C60 18 69 27 69 42 C69 50 70 60 76 68 Z") + rr(14, 64, 68, 12, 6), [14, 5, 82, 76]) +
    two(circ(48, 84, 9), [39, 75, 57, 93])],
  ["gear", "Settings", "⚙ group settings", () => {
    let teeth = "";
    for (let i = 0; i < 8; i++) teeth += rrTurn(39, 4, 18, 22, 3, i * 45, 48, 48);
    return knock(two(teeth + circ(48, 48, 29), [4, 4, 92, 92]), circ(48, 48, 12));
  }],
  ["moon", "Dark theme", "☾", () => two(crescent(44, 50, 38, 66, 32, 31), [6, 12, 82, 88])],
  ["sun", "Light theme", "☀", () => {
    let rays = "";
    for (let i = 0; i < 8; i++) rays += polyTurn([[39, 23], [57, 23], [48, 3]], i * 45);
    return two(rays, [3, 3, 93, 93]) + two(circ(48, 48, 19), [29, 29, 67, 67]);
  }],
  ["system", "System theme", "🖥", () =>
    knock(two(rr(6, 10, 84, 58, 9), [6, 10, 90, 68]), rr(17, 21, 62, 36, 3)) + two(rr(39, 70, 18, 10) + rr(22, 78, 52, 11, 5.5), [22, 70, 74, 89])],
  ["mic", "Voice", "🎤 join voice / mute", () => micShapes()],
  ["mic-off", "Voice off", "🎙 muted", () =>
    knock(micShapes(), `<polygon points="${cutBar(12, 8, 84, 88, 26)}"/>`) + two(bar(14, 10, 82, 86, 11), [8, 4, 88, 92])],
  ["phone", "Call", "📞", () => two(handset(0), [8, 10, 86, 88])],
  ["hang-up", "Hang up", "📵", () => two(handset(135), [4, 20, 92, 76])],
  ["chat", "Message", "💬", () =>
    knock(two(rr(6, 10, 84, 60, 22) + poly([[18, 60], [12, 90], [48, 66]]), [6, 10, 90, 90]), circ(28, 40, 7.5) + circ(48, 40, 7.5) + circ(68, 40, 7.5))],
  ["picture", "Photo", "🖼 📷", () =>
    knock(two(rr(6, 12, 84, 72, 10), [6, 12, 90, 84]), rr(16, 22, 64, 52, 4)) +
    two(poly([[16, 74], [38, 42], [52, 58], [61, 48], [80, 70], [80, 74]]), [16, 42, 80, 74]) + two(circ(65, 35, 8), [57, 27, 73, 43])],
  ["file", "File", "📎", () =>
    knock(two(poly([[16, 4], [54, 4], [54, 30], [80, 30], [80, 92], [16, 92]]), [16, 4, 80, 92]), rr(28, 46, 40, 9, 4.5) + rr(28, 62, 40, 9, 4.5) + rr(28, 78, 26, 9, 4.5)) +
    two(poly([[62, 4], [80, 22], [62, 22]]), [62, 4, 80, 22])],
  ["first", "To start / previous game", "⏮", () => two(rr(8, 18, 13, 60, 3), [8, 18, 21, 78]) + tri([[54, 18], [54, 78], [22, 48]]) + tri([[88, 18], [88, 78], [56, 48]])],
  ["back", "Step back", "◀", () => tri([[76, 14], [76, 82], [20, 48]])],
  ["play", "Play", "▶", () => tri([[24, 12], [24, 84], [82, 48]])],
  ["pause", "Pause", "⏸", () => two(rr(20, 14, 21, 68, 5), [20, 14, 41, 82]) + two(rr(55, 14, 21, 68, 5), [55, 14, 76, 82])],
  ["step", "Step forward", "▶|", () => tri([[14, 16], [14, 80], [62, 48]]) + two(rr(69, 16, 13, 64, 3), [69, 16, 82, 80])],
  ["last", "To end / next game", "⏭", () => tri([[8, 18], [8, 78], [40, 48]]) + tri([[42, 18], [42, 78], [74, 48]]) + two(rr(75, 18, 13, 60, 3), [75, 18, 88, 78])],
  ["trophy", "Winner", "🏆 results", () =>
    two(band(22, 30, 9, 20, 90, 270) + band(74, 30, 9, 20, 270, 450), [2, 10, 94, 50]) +
    two(path("M20 8 H76 V30 C76 49 63 60 48 60 C33 60 20 49 20 30 Z"), [20, 8, 76, 60]) +
    two(rr(41, 58, 14, 12) + poly([[28, 70], [68, 70], [74, 90], [22, 90]]), [22, 58, 74, 90])],
  ["medal", "Achievement", "🏅", () =>
    two(poly([[18, 2], [40, 2], [56, 34], [44, 42]]) + poly([[78, 2], [56, 2], [40, 34], [52, 42]]), [18, 2, 78, 42]) +
    knock(two(circ(48, 66, 26), [22, 40, 74, 92]), star(48, 67, 14, 6))],
  ["lock", "Locked", "🔒", () =>
    two(band(48, 42, 15, 27, 180, 360) + rr(21, 41, 12, 9) + rr(63, 41, 12, 9), [21, 15, 75, 50]) +
    knock(two(rr(12, 46, 72, 46, 10), [12, 46, 84, 92]), circ(48, 63, 8) + poly([[43, 65], [53, 65], [57, 82], [39, 82]]))],
  ["streak", "Day streak", "🔥", () =>
    knock(two(path(flame), [18, 4, 78, 90]), path(flameIn(6))) + two(path(flameIn(0)), [33, 46, 63, 87])],
  ["friend-add", "Friend request", "👋", () => bustShapes() + two(bar(76, 26, 76, 56, 11) + bar(61, 41, 91, 41, 11), [55, 20, 97, 62])],
  ["friend-ok", "Friend accepted", "✅", () => bustShapes() + two(bar(60, 42, 70, 53, 11) + bar(70, 53, 88, 31, 11), [54, 25, 94, 59])],
  ["transfer", "Chips sent", "💸", () => {
    let notches = "";
    for (let i = 0; i < 4; i++) notches += rrTurn(29, 22, 10, 12, 2, i * 90 + 45, 34, 50);
    return knock(two(circ(34, 50, 26), [8, 24, 60, 76]), notches + circ(34, 50, 11)) +
      two(poly([[62, 40], [72, 40], [72, 26], [94, 50], [72, 74], [72, 60], [62, 60]]), [62, 26, 94, 74]);
  }],
];

export const svg = (body, size = 96) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" width="${size}" height="${size}">${body}</svg>`;
