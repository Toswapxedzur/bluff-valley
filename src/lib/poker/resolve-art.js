// The bet games' resolve art, in the chess palette with the icons' upper-left light: Roulette's
// wheel, Sic Bo's dice, the Slots' symbols (placeholders until the slot art is designed). Shared by
// the table's spins (Resolve.svelte) and the jackpot moment (moment-player.js).
export const C = { ebony: "#1C1A15", charcoal: "#3E3A31", gray: "#6E685B", white: "#FBF8EF", cream: "#F1E9D3", ivory: "#E1D3AD" };

// ---- roulette: the European wheel
export const WHEEL = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
export const RED = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
export const pocketFill = (n) => (n === 0 ? "#2f7d57" : RED.has(n) ? "#b43a3a" : C.ebony);
export const STEP = 360 / 37;
export function wheelSvg() {
  const R = 150, rad = (deg) => ((deg - 90) * Math.PI) / 180, p = (a, r) => `${(R + r * Math.cos(a)).toFixed(1)},${(R + r * Math.sin(a)).toFixed(1)}`;
  const wedges = WHEEL.map((n, i) => { const a0 = rad(i * STEP - STEP / 2), a1 = rad(i * STEP + STEP / 2); return `<polygon points="${p(a0, 144)} ${p(a1, 144)} ${p(a1, 96)} ${p(a0, 96)}" fill="${pocketFill(n)}"/>`; }).join("");
  return `<svg viewBox="0 0 300 300" width="100%" height="100%"><circle cx="150" cy="150" r="149" fill="${C.charcoal}"/>${wedges}<circle cx="150" cy="150" r="96" fill="${C.gray}"/><circle cx="150" cy="150" r="62" fill="${C.charcoal}"/><path d="M150 1a149 149 0 0 0 -105 254L150 150z" fill="#fff" opacity=".07"/><circle cx="150" cy="150" r="20" fill="${C.ivory}"/><path d="M150 130a20 20 0 0 0 -14 34L150 150z" fill="${C.white}"/></svg>`;
}
// ---- sic bo: dice with stepped light from the upper left
export const PIPS = { 1: [[50, 50]], 2: [[28, 28], [72, 72]], 3: [[26, 26], [50, 50], [74, 74]], 4: [[28, 28], [72, 28], [28, 72], [72, 72]], 5: [[26, 26], [74, 26], [50, 50], [26, 74], [74, 74]], 6: [[28, 24], [72, 24], [28, 50], [72, 50], [28, 76], [72, 76]] };
export const dieSvg = (n) => `<svg viewBox="0 0 100 100" width="100%" height="100%"><rect x="2" y="2" width="96" height="96" rx="22" fill="${C.ivory}"/><path d="M24 2h52a22 22 0 0 1 22 22v0L2 98V24A22 22 0 0 1 24 2z" fill="${C.cream}"/><path d="M24 2h40L2 64V24A22 22 0 0 1 24 2z" fill="${C.white}"/>${PIPS[n].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="9.5" fill="${C.ebony}"/>`).join("")}</svg>`;
// ---- slots: plain chunky shapes (placeholders until the slot art is designed)
export const SYM = {
  diamond: `<polygon points="40,8 70,34 40,72" fill="#1f8f7c"/><polygon points="40,8 10,34 40,72" fill="#5fd9c2"/><polygon points="40,8 70,34 10,34" fill="#96f4e2" opacity=".55"/>`,
  bell: `<path d="M40 10c-14 0-22 12-22 26v14l-8 10h60l-8-10V36c0-14-8-26-22-26z" fill="${C.charcoal}"/><path d="M40 10c-14 0-22 12-22 26v14l-8 10h30z" fill="${C.gray}"/><circle cx="40" cy="66" r="7" fill="${C.ebony}"/>`,
  cherry: `<path d="M34 16l20-6 4 8-18 6 2 20h-8z" fill="${C.charcoal}"/><circle cx="28" cy="54" r="14" fill="${C.ebony}"/><circle cx="54" cy="52" r="14" fill="${C.charcoal}"/><circle cx="24" cy="50" r="5" fill="${C.gray}"/>`,
  bar: `<rect x="8" y="26" width="64" height="28" rx="8" fill="${C.charcoal}"/><path d="M16 26h56L8 54V34a8 8 0 0 1 8-8z" fill="${C.gray}"/>`,
  lemon: `<ellipse cx="40" cy="42" rx="28" ry="20" fill="${C.ivory}"/><path d="M12 42a28 20 0 0 1 56 0z" fill="${C.white}"/>`,
  seven: `<path d="M12 60l6-34 14 14 8-22 8 22 14-14 6 34z" fill="#c78f06"/><path d="M12 60l6-34 14 14 8-22v42z" fill="#f5b60d"/><rect x="12" y="60" width="56" height="8" rx="3" fill="#8f6503"/>`
};
export const symSvg = (k) => `<svg viewBox="0 0 80 80" width="100%" height="100%">${SYM[k] || ""}</svg>`;
export const FILL = ["cherry", "lemon", "bell", "bar", "cherry", "seven", "lemon", "bell", "diamond", "bar"];

