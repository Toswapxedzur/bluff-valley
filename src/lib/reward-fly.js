// Rewards flying into the wallet (the daily bonus, a quest, an achievement's chips): coins burst from
// where the reward was claimed and arc into the top bar's chip pill, shrinking into it as they land
// (the shared norms: page coins at the wallet's size, 45 ms apart, 560 ms flights). The pill keeps
// its old number until the coins arrive, then counts up ("reward-fly" event → +layout.svelte).
import { coinSvg } from "$lib/poker/chips.js";
import { NORM, reducedMotion } from "$lib/motion.js";
import { coinTicks } from "$lib/poker/table-audio.js";
import { play } from "$lib/sfx.js";

const PAGE_COIN = 22;

/** Fly `amount` worth of coins from `fromEl` into the wallet pill. Returns the ms until the last lands. */
export function flyCoinsToWallet(fromEl, amount) {
  const pill = typeof document !== "undefined" ? document.querySelector(".chips-pill") : null;
  if (!pill || !fromEl || !(amount > 0)) return 0;
  const n = amount >= 5000 ? 10 : amount >= 1000 ? 8 : 6;
  const firstLand = NORM.coinDur, lastLand = (n - 1) * NORM.coinGap + NORM.coinDur;
  window.dispatchEvent(new CustomEvent("reward-fly", { detail: { amount, ms: reducedMotion() ? 0 : firstLand } }));
  if (reducedMotion()) return 0;
  const a = fromEl.getBoundingClientRect(), b = pill.getBoundingClientRect();
  const from = { x: a.left + a.width / 2, y: a.top + a.height / 2 }, to = { x: b.left + 18, y: b.top + b.height / 2 };
  const layer = document.createElement("div");
  Object.assign(layer.style, { position: "fixed", inset: "0", pointerEvents: "none", zIndex: "9999" });
  document.body.appendChild(layer);
  const values = [100, 500, 2500, 10000];
  const lift = Math.max(20, Math.min(60, Math.hypot(to.x - from.x, to.y - from.y) * 0.22));
  for (let i = 0; i < n; i++) {
    const c = document.createElement("div");
    c.innerHTML = coinSvg(values[i % values.length], PAGE_COIN);
    Object.assign(c.style, { position: "absolute", left: "0", top: "0", lineHeight: "0" });
    layer.appendChild(c);
    const sx = from.x + ((i * 37) % 60) - 30, kf = [];
    for (let k = 0; k <= 12; k++) {
      const t = k / 12, x = sx + (to.x - sx) * t, y = from.y + (to.y - from.y) * t - lift * 4 * t * (1 - t);
      const s = Math.max(0, (t - 0.72) / 0.28);                  // the last stretch: shrink into the wallet
      kf.push({ transform: `translate(${x - PAGE_COIN / 2}px, ${y - PAGE_COIN / 2}px) scale(${1 - 0.78 * s})`, opacity: 1 - 0.9 * s, offset: t });
    }
    c.animate(kf, { duration: NORM.coinDur, delay: i * NORM.coinGap, easing: "cubic-bezier(.45,.05,.55,.95)", fill: "both" });
  }
  coinTicks(performance.now() + NORM.coinDur, n, NORM.coinGap);
  play("coins", { delay: lastLand });
  setTimeout(() => {
    layer.remove();
    pill.animate([{ transform: "scale(1)" }, { transform: "scale(1.1)" }, { transform: "scale(1)" }], { duration: 300, easing: "cubic-bezier(.3,1.45,.5,1)" });
  }, lastLand);
  return lastLand;
}
