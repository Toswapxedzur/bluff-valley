// Banners (owner, 2026-09-27): a player's own uploaded picture on their seat plate, in place of (or
// beside) the metal badge. Shared by the server (rendering, validation) and the client (the editor's
// live preview, and every plate that draws one). Pure — no DOM, no Node.
//
// A banner is one uploaded master image plus settings:
//   layout  "plate" — the picture fills the whole plate, behind the name and stack
//           "tab"   — the picture fills a fixed tab at the plate's right end; the plate keeps its metal
//   x, y    where the crop sits inside the picture (0…1 along the free room), z the zoom (1 = the
//           largest crop of the plate's shape that fits)
//   ink     the text colour (one of INKS)
//   wash    how strongly the picture is washed (toward black under light text, white under dark);
//           the server raises it to the minimum that keeps the text readable, never lowers it
// The server bakes crop + wash into one small WebP; a plate only ever draws that image.

// the plate's shape (my own plate: 164 × 46, the others 136 × 38 — the same 3.6 : 1) and the tab's
// (26 × 38 at an opponent's plate; its width follows the plate's height)
export const PLATE_ASPECT = 164 / 46;
export const TAB_ASPECT = 26 / 38;
// rendered at 3× my plate, so it stays sharp on a phone's dense screen
export const PLATE_PX = [492, 138];
export const TAB_PX = [96, 140];
export const LAYOUTS = ["plate", "tab"];
export const MAX_WASH = 0.85;
export const MAX_ZOOM = 4;

/** The text colours a player can pick. */
export const INKS = [
  { key: "cream", name: "Cream", hex: "#fbf8ef" },
  { key: "white", name: "White", hex: "#ffffff" },
  { key: "ivory", name: "Ivory", hex: "#e1d3ad" },
  { key: "gold", name: "Gold", hex: "#f5b60d" },
  { key: "sky", name: "Sky", hex: "#bfe3ff" },
  { key: "rose", name: "Rose", hex: "#ffd3db" },
  { key: "charcoal", name: "Charcoal", hex: "#3e3a31" },
  { key: "ebony", name: "Ebony", hex: "#1c1a15" }
];
export const inkHex = (key) => (INKS.find((i) => i.key === key) || INKS[0]).hex;
export const GOLD = "#f5b60d";

/** Settings from anywhere (a form, the DB) → safe values. */
export function normalize(s = {}) {
  const num = (v, lo, hi, dflt) => { const n = Number(v); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : dflt; };
  return {
    layout: LAYOUTS.includes(s.layout) ? s.layout : "plate",
    x: num(s.x, 0, 1, 0.5),
    y: num(s.y, 0, 1, 0.5),
    z: num(s.z, 1, MAX_ZOOM, 1),
    ink: INKS.some((i) => i.key === s.ink) ? s.ink : "cream",
    wash: num(s.wash, 0, MAX_WASH, 0)
  };
}

/** The crop (in the picture's pixels) for a picture of w × h, a target `aspect`, and settings x/y/z:
 *  the largest box of that shape that fits, shrunk by the zoom, slid to x/y along the free room. */
export function cropBox(w, h, aspect, { x = 0.5, y = 0.5, z = 1 } = {}) {
  let cw = w, ch = w / aspect;
  if (ch > h) { ch = h; cw = h * aspect; }
  cw /= z; ch /= z;
  const width = Math.max(1, Math.round(cw)), height = Math.max(1, Math.round(ch));
  return { left: Math.round((w - width) * x), top: Math.round((h - height) * y), width, height };
}

// ------------------------------------------------------------------ colour + readability
const hexRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
export const lumRgb = (r, g, b) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
export const lumHex = (h) => lumRgb(...hexRgb(h));
export const contrast = (la, lb) => (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
export const mixHex = (a, b, t) => { const A = hexRgb(a), B = hexRgb(b); return "#" + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, "0")).join(""); };
const rgbHex = (r, g, b) => "#" + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");

/** Light text gets a dark wash, dark text a light one. */
export const washRgb = (inkHexStr) => (lumHex(inkHexStr) > 0.35 ? [0, 0, 0] : [255, 255, 255]);

// where the name and stack sit on a plate (fractions of its width / height): right of the avatar
export const TEXT_REGION = { x0: 0.3, x1: 0.96, y0: 0.14, y1: 0.86 };
// readable = the worst tenth of the pixels behind the text still reach 3 : 1, the typical one 4.5 : 1
export const MIN_P10 = 3;
export const MIN_MEDIAN = 4.5;

/** The luminances of the text region of an image (`px` = raw pixels, `ch` channels per pixel, w × h),
 *  sampled every `step` pixels. */
export function regionLums(px, w, h, ch, step = 2) {
  const r = TEXT_REGION, out = [];
  for (let y = Math.floor(h * r.y0); y < Math.ceil(h * r.y1); y += step)
    for (let x = Math.floor(w * r.x0); x < Math.ceil(w * r.x1); x += step) {
      const i = (y * w + x) * ch;
      out.push([px[i], px[i + 1], px[i + 2]]);
    }
  return out;
}

/** How readable `inkHexStr` is over those pixels once washed by `wash`: { p10, median } contrast. */
export function readability(pixels, inkHexStr, wash) {
  const inkL = lumHex(inkHexStr), W = washRgb(inkHexStr);
  const cs = pixels.map(([r, g, b]) => contrast(inkL, lumRgb(r + (W[0] - r) * wash, g + (W[1] - g) * wash, b + (W[2] - b) * wash))).sort((a, b) => a - b);
  if (!cs.length) return { p10: 21, median: 21 };
  return { p10: cs[Math.floor(cs.length * 0.1)], median: cs[Math.floor(cs.length / 2)] };
}
export const readable = (r) => r.p10 >= MIN_P10 && r.median >= MIN_MEDIAN;

/** The least wash (≥ `wanted`, in 0.05 steps) that makes the text readable over these pixels. */
export function minWash(pixels, inkHexStr, wanted = 0) {
  for (let w = Math.round(wanted * 20) / 20; w <= MAX_WASH + 1e-9; w = Math.round((w + 0.05) * 100) / 100)
    if (readable(readability(pixels, inkHexStr, w))) return w;
  return MAX_WASH;
}

/** The softer ink (status line, clock) and the stack's colour, for text over these (washed) pixels. */
export function inksFor(pixels, inkHexStr, wash) {
  const W = washRgb(inkHexStr);
  let r = 0, g = 0, b = 0;
  for (const p of pixels) { r += p[0]; g += p[1]; b += p[2]; }
  const n = Math.max(1, pixels.length);
  const avg = [r / n, g / n, b / n].map((v, i) => v + (W[i] - v) * wash);
  const sub = mixHex(inkHexStr, rgbHex(...avg), 0.22);
  const money = readable(readability(pixels, GOLD, wash)) && washRgb(GOLD)[0] === W[0] ? GOLD : inkHexStr;
  return { ink: inkHexStr, sub, money };
}

/** Does `inkHexStr` read on a metal plate's three steps? (the tab layout keeps the metal behind the text) */
export function inkOnSteps(inkHexStr, stepHexes) {
  const l = lumHex(inkHexStr);
  return stepHexes.every((s) => contrast(l, lumHex(s)) >= MIN_P10) && stepHexes.some((s) => contrast(l, lumHex(s)) >= MIN_MEDIAN);
}

/** A render's file name → its public URL. */
export const bannerUrl = (src) => (src ? `/banner/${src}` : null);
export const isRenderName = (s) => typeof s === "string" && /^[a-f0-9]{32}\.webp$/.test(s);
