// UI icons — the site's own set replacing emoji (owner, 2026-09-29: "emoji → own icon set").
// The owner's standing icon rules (~/Desktop/autome/memory/icon-design-rules.md): the ten warm
// "chess" tones only (five lights, five darks), NO borders, NO thin lines, NO letters or numbers;
// every part a solid shape, lit from the UPPER LEFT in hard-edged steps inside ONE family.
// Drawn on a 96×96 grid; build.mjs writes static/ui/<key>.svg.
import { chip } from "../game-icons/icons.js";

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

// ---- pieces
const speaker = (tones = T3) => lit(rr(12, 35, 18, 26, 3) + poly([[26, 35], [50, 16], [55, 18], [55, 78], [50, 80], [26, 61]]), [12, 16, 55, 80], tones);
const micShape = () => rr(34, 8, 28, 48, 14);
const mic = (big = T3, small = T2) => lit(micShape(), [34, 8, 62, 56], big) + lit(band(48, 38, 21, 28, 0, 180) + rr(44, 64, 8, 14) + rr(30, 77, 36, 9, 4.5), [20, 38, 76, 86], small);
const bust = (tones = T3) => lit(circ(36, 30, 15), [21, 15, 51, 45], tones) + lit(path("M8 86 C8 66 20 54 36 54 C52 54 64 66 64 86 Z"), [8, 54, 64, 86], tones);
function handset() {   // a phone handset: a thick C with a flared ear piece and mouth piece
  const cx = 62, cy = 48;
  const cap = (a) => { const x = cx + 33 * Math.cos(rad(a)), y = cy + 33 * Math.sin(rad(a)); return rrTurn(x - 15, y - 10, 30, 20, 8, a + 90, x, y); };
  return band(cx, cy, 27, 38, 118, 242) + cap(112) + cap(248);
}
// crescent: outer circle minus a shifted inner one (the arcs meet where the circles cross)
function crescent(ox, oy, R, ix, iy, r) {
  const dx = ix - ox, dy = iy - oy, d = Math.hypot(dx, dy), a = (R * R - r * r + d * d) / (2 * d), h = Math.sqrt(R * R - a * a);
  const px = ox + (a * dx) / d, py = oy + (a * dy) / d;
  const p1 = [px + (h * dy) / d, py - (h * dx) / d], p2 = [px - (h * dy) / d, py + (h * dx) / d];
  return path(`M${f(p1[0])} ${f(p1[1])}A${R} ${R} 0 1 0 ${f(p2[0])} ${f(p2[1])}A${r} ${r} 0 0 1 ${f(p1[0])} ${f(p1[1])}Z`);
}

// [key, name, where it replaces what, body]
export const ICONS = [
  ["sound-on", "Sound on", "🔊 table / replay / settings", () =>
    speaker() + lit(band(56, 48, 12, 20, -48, 48) + band(56, 48, 27, 35, -52, 52), [56, 14, 91, 82], T2)],
  ["sound-off", "Sound off", "🔇", () =>
    speaker() + lit(bar(66, 36, 86, 60, 9) + bar(86, 36, 66, 60, 9), [60, 30, 92, 66], T2)],
  ["bell", "Notifications", "🔔 top bar", () =>
    lit(circ(48, 14, 6), [42, 8, 54, 20], T2) +
    lit(path("M23 66 C28 58 29 50 29 42 C29 29 37 20 48 20 C59 20 67 29 67 42 C67 50 68 58 73 66 Z") + rr(17, 63, 62, 10, 5), [17, 20, 79, 73], T3) +
    lit(circ(48, 80, 8), [40, 72, 56, 88], T2)],
  ["gear", "Settings", "⚙ group settings", () => {
    let teeth = "";
    for (let i = 0; i < 8; i++) teeth += rrTurn(40, 7, 16, 20, 3, i * 45, 48, 48);
    return lit(teeth + circ(48, 48, 28), [8, 8, 88, 88], T3) + lit(circ(48, 48, 11), [37, 37, 59, 59], [B[4], B[2]]);
  }],
  ["moon", "Dark theme", "☾", () => lit(crescent(46, 50, 34, 66, 36, 28), [12, 16, 80, 84], T3)],
  ["sun", "Light theme", "☀", () => {
    let rays = "";
    for (let i = 0; i < 8; i++) rays += polyTurn([[41, 22], [55, 22], [48, 6]], i * 45);
    return lit(rays, [6, 6, 90, 90], T2) + lit(circ(48, 48, 20), [28, 28, 68, 68], T3);
  }],
  ["system", "System theme", "🖥", () =>
    lit(rr(8, 14, 80, 54, 8) + rr(41, 66, 14, 10) + rr(26, 75, 44, 9, 4.5), [8, 14, 88, 84], T3) + lit(rr(16, 22, 64, 38, 3), [16, 22, 80, 60], TD2)],
  ["mic", "Voice", "🎤 🎙 join voice / mute", () => mic()],
  ["mic-off", "Voice off", "🎙 muted", () => { const id = `m${++uid}`;
    return `<mask id="${id}"><rect x="0" y="0" width="96" height="96" fill="#fff"/><polygon points="${cutBar(18, 14, 78, 82, 22)}" fill="#000"/></mask><g mask="url(#${id})">${mic()}</g>` + lit(bar(18, 14, 78, 82, 10), [14, 10, 82, 86], T3); }],
  ["phone", "Call", "📞", () => rot(-12, lit(handset(), [16, 8, 70, 88], T3))],
  ["hang-up", "Hang up", "📵", () => rot(90, lit(handset(), [16, 8, 70, 88], T3))],
  ["chat", "Message", "💬", () =>
    lit(rr(8, 12, 80, 56, 18) + poly([[22, 58], [16, 86], [46, 64]]), [8, 12, 88, 86], T3) +
    lit(circ(30, 40, 6) + circ(48, 40, 6) + circ(66, 40, 6), [24, 34, 72, 46], TD2)],
  ["picture", "Photo", "🖼 📷 send / preview", () =>
    lit(rr(8, 14, 80, 68, 9), [8, 14, 88, 82], T3) + lit(rr(16, 22, 64, 52, 3), [16, 22, 80, 74], TD2) +
    lit(poly([[16, 74], [38, 44], [52, 60], [61, 50], [80, 72], [80, 74]]), [16, 44, 80, 74], T2) + lit(circ(64, 36, 7), [57, 29, 71, 43], T2)],
  ["file", "File", "📎 preview", () =>
    lit(poly([[20, 8], [56, 8], [76, 28], [76, 88], [20, 88]]), [20, 8, 76, 88], T3) + lit(poly([[56, 8], [56, 28], [76, 28]]), [56, 8, 76, 28], [A[3], A[4]]) +
    lit(rr(30, 42, 36, 7, 3.5) + rr(30, 56, 36, 7, 3.5) + rr(30, 70, 24, 7, 3.5), [30, 42, 66, 77], TD2)],
  ["first", "To start / previous game", "⏮", () => lit(rr(12, 22, 11, 52, 3) + poly([[52, 22], [52, 74], [22, 48]]) + poly([[84, 22], [84, 74], [54, 48]]), [12, 22, 84, 74], T3)],
  ["back", "Step back", "◀", () => lit(poly([[70, 18], [70, 78], [24, 48]]), [24, 18, 70, 78], T3)],
  ["play", "Play", "▶", () => lit(poly([[28, 16], [28, 80], [78, 48]]), [28, 16, 78, 80], T3)],
  ["pause", "Pause", "⏸", () => lit(rr(24, 18, 17, 60, 4) + rr(55, 18, 17, 60, 4), [24, 18, 72, 78], T3)],
  ["step", "Step forward", "▶|", () => lit(poly([[20, 20], [20, 76], [60, 48]]) + rr(66, 22, 11, 52, 3), [20, 20, 77, 76], T3)],
  ["last", "To end / next game", "⏭", () => lit(poly([[12, 22], [12, 74], [42, 48]]) + poly([[44, 22], [44, 74], [74, 48]]) + rr(73, 22, 11, 52, 3), [12, 22, 84, 74], T3)],
  ["trophy", "Winner", "🏆 results", () =>
    lit(band(24, 32, 7, 14, 90, 270) + band(72, 32, 7, 14, 270, 450), [10, 18, 86, 46], T2) +
    lit(path("M25 12 H71 V30 C71 46 61 57 48 57 C35 57 25 46 25 30 Z"), [25, 12, 71, 57], T3) +
    lit(rr(42, 55, 12, 13) + poly([[29, 68], [67, 68], [72, 84], [24, 84]]), [24, 55, 72, 84], T3)],
  ["medal", "Achievement", "🏅", () =>
    lit(poly([[24, 6], [40, 6], [54, 38], [40, 44]]) + poly([[72, 6], [56, 6], [42, 38], [56, 44]]), [24, 6, 72, 44], TD3) +
    lit(circ(48, 62, 24), [24, 38, 72, 86], T3) + lit(star(48, 62, 13, 5.6), [35, 49, 61, 75], [A[3], A[4]])],
  ["lock", "Locked", "🔒", () =>
    lit(band(48, 42, 13, 22, 180, 360) + rr(26, 41, 9, 8) + rr(61, 41, 9, 8), [26, 20, 70, 49], T2) +
    lit(rr(18, 46, 60, 42, 9), [18, 46, 78, 88], T3) + lit(circ(48, 62, 7) + poly([[44, 64], [52, 64], [55, 78], [41, 78]]), [41, 55, 55, 78], TD2)],
  ["streak", "Day streak", "🔥", () =>
    lit(path("M49 6 C55 23 74 33 74 56 C74 73 62 88 48 88 C34 88 22 73 22 56 C22 43 31 34 35 23 C40 32 42 39 46 42 C46 29 44 17 49 6 Z"), [22, 6, 74, 88], [A[2], A[3], A[4]]) +
    lit(path("M48 46 C54 56 62 61 62 71 C62 80 56 86 48 86 C40 86 34 80 34 71 C34 61 42 56 48 46 Z"), [34, 46, 62, 86], [A[0], A[1]])],
  ["friend-add", "Friend request", "👋", () => bust() + lit(rr(72, 26, 9, 32, 3) + rr(60, 37, 33, 9, 3), [60, 26, 93, 58], T2)],
  ["friend-ok", "Friend accepted", "✅", () => bust() + lit(poly([[58, 44], [65, 37], [72, 44], [86, 28], [93, 35], [72, 58]]), [58, 28, 93, 58], T2)],
  ["transfer", "Chips sent", "💸", () =>
    `<g transform="translate(-10 18) scale(0.95)">${chip(40, 44, 20, 7.4, 8.4, false)}${chip(40, 32, 20, 7.4, 8.4)}</g>` +
    lit(poly([[58, 40], [72, 40], [72, 28], [92, 48], [72, 68], [72, 56], [58, 56]]), [58, 28, 92, 68], T3)],
];

export const svg = (body, size = 96) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" width="${size}" height="${size}">${body}</svg>`;
