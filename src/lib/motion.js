// Shared motion constants + helpers for the whole app, so every transition
// reads from one place and one flag (prefers-reduced-motion) disables them all.
import { cubicOut } from "svelte/easing";

// Durations (ms) — mirror the CSS --dur tokens in app.css.
export const DUR = { fast: 140, base: 220, slow: 380 };
export const ease = cubicOut;

// True when the viewer asked for reduced motion — call at runtime before
// starting a JS-driven animation (view transitions, count-up tweens).
export function reducedMotion() {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// Duration helper: collapses to 0 under reduced motion so directives no-op.
export function d(ms) {
  return reducedMotion() ? 0 : ms;
}

// Standard enter/exit tuning for list items (fly) — kept consistent app-wide.
export const listIn = { y: 8, duration: DUR.base };
export const listOut = { duration: DUR.fast };

// The animation NORMS (owner, 2026-09-27: every animation shares one set — a fix to one applies to
// all). Mirrors design/moments NORM; coin-motion.js keeps its own coin timings in COIN.
export const NORM = {
  flip: 280,       // a card turning over
  coinDur: 560,    // one coin's flight
  coinGap: 45,     // between coins of one stream
  ringDraw: 600,   // a ring drawing on / off, gem by gem
  dim: 400,        // the fold / lost dim easing in
  glow: 900        // the your-turn glow's one lap
};

/** Run fn(k) for k 0 → 1 over `ms` on animation frames (eased); returns a cancel function. */
export function tween(ms, fn, easing = (k) => k) {
  if (typeof window === "undefined" || reducedMotion() || ms <= 0) { fn(1); return () => {}; }
  const t0 = performance.now();
  let raf = 0, alive = true;
  const step = (t) => {
    if (!alive) return;
    const k = Math.min(1, (t - t0) / ms);
    fn(easing(k));
    if (k < 1) raf = requestAnimationFrame(step);
  };
  raf = requestAnimationFrame(step);
  return () => { alive = false; cancelAnimationFrame(raf); };
}
