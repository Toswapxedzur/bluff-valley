// Table Moments — the full-screen animations for significant events (owner, 2026-09-27: "two types
// of animation: one covering the whole screen on significant events where everybody pauses, and
// the normal ones"). Design demo only; bundled with esbuild into demo.bundle.js (see build.sh). It
// draws with the game's real art: our card faces/back (composer.js), the metal coins (chips.js),
// the rhombus rings and stepped plates (cosmetics.js).
//
// One shared frame for every moment: the table dims under a veil (it stays visible, nothing on it
// moves), a BAND — the logo's three tilted steps, in the moment's material — wipes in from the left,
// the moment plays on it, a thick bar along its foot drains for the length of the pause, and the
// band wipes out to the right.
import { renderBoard, renderBack } from "../../src/lib/poker/composer.js";
import { coinSvg } from "../../src/lib/poker/chips.js";
import { ringSvg, ringBox, plateStyle, METALS, CHESS, mix } from "../../src/lib/cosmetics.js";
import { initials, avColor } from "../../src/lib/initials.js";

const W = 1120, H = 700;                       // the screen we design on (scaled to fit)
const SLANT = 186 / 512;                       // the logo's strip slant (dx per dy)
const $ = (s, r = document) => r.querySelector(s);
const h = (tag, cls = "", html = "") => { const e = document.createElement(tag); if (cls) e.className = cls; if (html) e.innerHTML = html; return e; };
const fixPaths = (s) => s.replaceAll('"/deck-parts/', '"deck-parts/');
const cardHtml = (c, w) => fixPaths(renderBoard(c, w));
const backHtml = (w) => fixPaths(renderBack(w));
const fmt = (n) => Math.round(n).toLocaleString("en-US");

// ------------------------------------------------------------------ materials (the band's steps)
const metal = (k) => METALS.find((m) => m.key === k);
const ramp = (m) => [mix(m.base, m.hi, 0.45), m.base, mix(m.base, m.lo, 0.3)];
const MATERIALS = {
  blue:     { steps: ["#d3e8fb", "#a9d2f4", "#7db7e7"], ink: "#0f1f3d", sub: "#27477a" },   // the logo's
  gold:     { steps: ramp(metal("gold")), ink: "#4a3300", sub: "#6e4d05" },
  silver:   { steps: ramp(metal("silver")), ink: "#1f2533", sub: "#3f4758" },
  charcoal: { steps: [CHESS.gray, CHESS.charcoal, CHESS.ebony], ink: CHESS.white, sub: CHESS.ivory }
};

// ------------------------------------------------------------------ timing (speed, cancel, replay)
let speed = 1, gen = 0, timers = [], anims = [];
const EASE = "cubic-bezier(.22,.61,.36,1)", SNAP = "cubic-bezier(.3,1.45,.5,1)", INOUT = "cubic-bezier(.65,0,.35,1)";
function at(ms, fn) { timers.push(setTimeout(fn, ms / speed)); }
function A(el, kf, o) {
  const a = el.animate(kf, { fill: "both", easing: EASE, ...o, duration: o.duration / speed, delay: (o.delay || 0) / speed });
  anims.push(a); return a;
}
function tween(start, dur, fn, ease = (t) => 1 - Math.pow(1 - t, 3)) {
  const g = gen;
  at(start, () => {
    const t0 = performance.now();
    const step = () => {
      if (g !== gen) return;
      const t = Math.min(1, (performance.now() - t0) / (dur / speed));
      fn(ease(t));
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}
function reset() {
  gen += 1;
  timers.forEach(clearTimeout); timers = [];
  anims.forEach((a) => a.cancel()); anims = [];
  $("#overlay").replaceChildren();
}

// ------------------------------------------------------------------ the players
const P = {
  you:  { name: "You", look: "silver", stack: 24_300 },
  milo: { name: "Milo", look: "gold", stack: 18_900 },
  ivy:  { name: "Ivy", look: "default", stack: 9_450 },
  nora: { name: "Nora", look: "rose", stack: 31_200 },
  theo: { name: "Theo", look: "sapphire", stack: 42_300 },
  ada:  { name: "Ada", look: "emerald", stack: 0 }
};

/** A seat plate like SeatBadge's: the stepped metal plate, the ring floating round the avatar. */
function plate(p, { av = 28, w = 152, hgt = 38, look = p.look, stack = p.stack, line = null } = {}) {
  const st = plateStyle(look);
  const el = h("div", "plate");
  Object.assign(el.style, { width: w + "px", height: hgt + "px", background: st.bg, color: st.ink });
  const over = (ringBox(av) - av) / 2;
  el.innerHTML = `<span class="av" style="width:${av}px;height:${av}px;margin-right:${Math.round(over + av * 0.2)}px">`
    + `<span class="ring">${ringSvg(av, look)}</span>`
    + `<span class="face" style="background:${avColor(p.name)};font-size:${Math.round(av * 0.36)}px">${initials(p.name)}</span></span>`
    + `<span class="txt"><b class="name" style="font-size:${Math.round(hgt * 0.34)}px">${p.name}</b>`
    + `<span class="stack" style="color:${st.money};font-size:${Math.round(hgt * 0.3)}px">${line ?? fmt(stack)}</span></span>`;
  return el;
}
const bigPlate = (p, o = {}) => plate(p, { av: 64, w: 300, hgt: 76, ...o });
function setRing(plateEl, look, remain) {
  const av = plateEl.querySelector(".av"), px = parseFloat(av.style.width);
  av.querySelector(".ring").innerHTML = ringSvg(px, look, remain);
}

// ------------------------------------------------------------------ the table underneath
const SEAT_AT = [90, 150, 210, 270, 330, 30];
const ORDER = [P.you, P.milo, P.ivy, P.nora, P.theo, P.ada];
function table(game, { between = false } = {}) {
  const t = $("#table");
  t.replaceChildren();
  const hud = h("div", "hud", `<span class="back">‹</span><img src="games/${game}.svg" width="34" height="34" alt=""><span class="hud-t"><b>Riverside ${game === "river-sprint" ? "Sprint" : "Table 3"}</b><span>${GAME_NAME[game]} · 100/200</span></span>`);
  t.append(hud);
  ORDER.forEach((p, i) => {
    const a = (SEAT_AT[i] * Math.PI) / 180, mine = i === 0;
    const x = 560 + 400 * Math.cos(a), y = 330 + 215 * Math.sin(a);
    const pl = plate(p, mine ? { av: 34, w: 184, hgt: 46 } : {});
    pl.classList.add("seat");
    pl.style.left = x + "px"; pl.style.top = y + "px";
    t.append(pl);
    if ((game === "holdem" || game === "river-sprint") && !between) {
      const hand = h("div", "seat-hand", mine ? cardHtml("Jh", 58) + cardHtml("Jc", 58) : backHtml(38) + backHtml(38));
      hand.style.left = x + "px"; hand.style.top = y + (mine ? 30 : 26) + "px";
      t.append(hand);
    }
  });
  if (between) {
    t.append(h("div", "potpill", `<span>POT</span><b>0</b>`));
  } else if (game === "holdem" || game === "river-sprint") {
    const board = h("div", "board", ["Kd", "7c", "2h", "5s"].map((c) => cardHtml(c, 62)).join(""));
    t.append(board, h("div", "potpill", `<span>POT</span><b>18,640</b>`));
  } else {
    t.append(h("div", "tablenote", GAME_NAME[game]));
  }
}
const GAME_NAME = { holdem: "No-Limit Hold'em", "three-card": "Three Card Poker", slots: "Slots", roulette: "Roulette", "sic-bo": "Sic Bo", "big-two": "Big Two", "river-sprint": "River Sprint", blackjack: "Blackjack" };

// ------------------------------------------------------------------ the shared frame
/** Veil + band. Returns the band's content box. len = the pause (ms) the bar drains over. */
/** A moment's frame. Owner's rule (2026-09-27): a BANNER only for proclamations — cosmetics,
 *  personal news, tournament calls (Sprint go, knockout, champion). Normal gameplay moments
 *  (a shuffle, an all-in showdown, a big pot…) just blur the table and play over it.
 *  len = the pause (ms): the band's drain bar runs over it, and the frame closes at its end. */
function frame({ banner = false, material = "blue", bandH = 330, game, kicker, len, personal = false }) {
  const ov = $("#overlay");
  const veil = h("div", "veil" + (banner ? "" : " blur") + (personal ? " light" : ""));
  ov.append(veil);
  A(veil, [{ opacity: 0 }, { opacity: 1 }], { duration: 300 });

  let band, y = 0;
  if (banner) {
    const m = MATERIALS[material] || material;
    y = (H - bandH) / 2;
    band = h("div", "band");
    Object.assign(band.style, {
      top: y + "px", height: bandH + "px", color: m.ink,
      background: `linear-gradient(110deg, ${m.steps[0]} 0 34%, ${m.steps[1]} 34% 67%, ${m.steps[2]} 67% 100%)`
    });
    band.style.setProperty("--ink", m.ink); band.style.setProperty("--sub", m.sub); band.style.setProperty("--on-ink", m.steps[2]);
    // opens smoothly from its centre line to full height (owner: no half-height jump)
    A(band, [{ clipPath: "inset(50% 0% 50% 0%)" }, { clipPath: "inset(0% 0% 0% 0%)" }], { duration: 520, delay: 80, easing: "cubic-bezier(.16,.84,.3,1)" });
    const kick = h("div", "kicker", `${game ? `<img src="games/${game}.svg" width="26" height="26" alt="">` : ""}<span>${kicker}</span>`);
    band.append(kick);
    A(kick, [{ opacity: 0, transform: "translateX(-12px)" }, { opacity: 1, transform: "none" }], { duration: 300, delay: 420 });
    if (!personal) {
      const bar = h("div", "pausebar", `<span class="lbl">table paused</span><span class="track"><span class="fill"></span></span>`);
      band.append(bar);
      A(bar, [{ opacity: 0 }, { opacity: 1 }], { duration: 250, delay: 450 });
      A(bar.querySelector(".fill"), [{ transform: "scaleX(1)" }, { transform: "scaleX(0)" }], { duration: len - 450, delay: 450, easing: "linear" });
    }
  } else {
    band = h("div", "stage");
    band.style.setProperty("--ink", "#eef2ff"); band.style.setProperty("--sub", "#9db0d6");
  }
  ov.append(band);
  // three layers: celebration coins BEHIND the content (never over the cards / numbers), the content,
  // then coin flights — which still pass UNDER the plates (z-index 3), so won coins sink into a badge
  const back = h("div", "fxback"), content = h("div", "content"), fly = h("div", "fly");
  band.append(back, content, fly);
  cur = { back, fly, dy: y };

  const out = (when) => {
    at(when, () => {
      if (banner) A(band, [{ clipPath: "inset(0% 0% 0% 0%)" }, { clipPath: "inset(50% 0% 50% 0%)" }], { duration: 400, easing: "cubic-bezier(.5,0,.75,.2)" });
      else A(band, [{ opacity: 1 }, { opacity: 0 }], { duration: 300 });
      A(veil, [{ opacity: 1 }, { opacity: 0 }], { duration: 320, delay: 180 });
    });
  };
  if (len) out(len - 450);
  return { band, content, out };
}
let cur = null;

// ------------------------------------------------------------------ bits of motion
const appear = (el, delay, from = "translateY(14px)", duration = 340) =>
  A(el, [{ opacity: 0, transform: from }, { opacity: 1, transform: "none" }], { duration, delay });
const stamp = (el, delay, duration = 380) =>
  A(el, [{ opacity: 0, transform: "scale(1.5)" }, { opacity: 1, transform: "scale(1)" }], { duration, delay, easing: SNAP });
function shake(el, delay, amp = 5) {
  A(el, [{ transform: "none" }, { transform: `translate(${amp}px, ${-amp / 2}px)` }, { transform: `translate(${-amp}px, ${amp / 3}px)` },
    { transform: `translate(${amp / 2}px, 0)` }, { transform: "none" }], { duration: 260, delay, fill: "none" });
}
/** Turn a card element face up: squash to the edge, swap the art, open again. */
function flip(el, card, delay, dur = 320) {
  const w = parseFloat(el.dataset.w);
  A(el, [{ transform: "scaleX(1)" }, { transform: "scaleX(0.02)" }], { duration: dur / 2, delay, easing: "ease-in", fill: "none" });
  at(delay + dur / 2, () => {
    el.innerHTML = cardHtml(card, w);
    A(el, [{ transform: "scaleX(0.02)" }, { transform: "scaleX(1)" }], { duration: dur / 2, easing: "ease-out", fill: "none" });
  });
}
function cardEl(card, w, faceDown = false) {
  const e = h("div", "cardel", faceDown ? backHtml(w) : cardHtml(card, w));
  e.dataset.w = w;
  return e;
}
/** Where an element's centre is, in screen coordinates. */
function centre(el) {
  const s = $("#screen").getBoundingClientRect(), r = el.getBoundingClientRect(), k = s.width / W;
  return { x: (r.left + r.width / 2 - s.left) / k, y: (r.top + r.height / 2 - s.top) / k };
}
function coin(value, size, layer) { const c = h("div", "coin", coinSvg(value, size)); layer.append(c); return c; }
function backLayer() { return { el: cur.back, dy: cur.dy }; }
/** A coin arcing from a to b (screen coordinates). */
function arc(value, size, a, b, delay, dur = 640, lift = 90) {
  const c = coin(value, size, cur.fly), kf = [], dy = cur.dy;
  for (let i = 0; i <= 12; i++) {
    const t = i / 12, x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t - lift * 4 * t * (1 - t) - dy;
    kf.push({ transform: `translate(${x - size / 2}px, ${y - size / 2}px)`, offset: t });
  }
  A(c, kf, { duration: dur, delay, easing: "cubic-bezier(.45,.05,.55,.95)" });
}
/** Coins thrown up from a point, falling off the bottom of the screen. */
function fountain(from, n, delay, spread = 1) {
  const vals = [100, 500, 2500, 10000, 50000, 25], L = backLayer();
  from = { x: from.x, y: from.y - L.dy };
  for (let i = 0; i < n; i++) {
    const size = 30 + ((i * 7) % 18), c = coin(vals[i % vals.length], size, L.el), kf = [];
    const vx = (((i * 53) % 100) / 100 - 0.5) * 900 * spread, vy = -(520 + ((i * 37) % 100) * 4.2), g = 1500;
    for (let k = 0; k <= 14; k++) {
      const t = (k / 14) * 1.5;
      kf.push({ transform: `translate(${from.x + vx * t - size / 2}px, ${from.y + vy * t + (g * t * t) / 2 - size / 2}px) rotate(${vx * t * 0.4}deg)`, offset: k / 14 });
    }
    A(c, kf, { duration: 1500, delay: delay + i * 28, easing: "linear" });
  }
}
/** Coins falling across the band from above. */
function rain(n, delay, dur = 1500) {
  const vals = [2500, 10000, 500, 50000, 100], L = backLayer();
  for (let i = 0; i < n; i++) {
    const size = 26 + ((i * 11) % 20), c = coin(vals[i % vals.length], size, L.el);
    const x = 80 + ((i * 97) % 960), spin = ((i * 41) % 90) - 45;
    A(c, [{ transform: `translate(${x}px, -60px) rotate(0deg)` }, { transform: `translate(${x + spin}px, ${L.el.clientHeight + 40}px) rotate(${spin * 3}deg)` }],
      { duration: dur, delay: delay + ((i * 131) % 900), easing: "cubic-bezier(.4,0,.8,.6)" });
  }
}
function counter(el, from, to, start, dur, prefix = "", suffix = "") {
  at(start, () => { el.textContent = prefix + fmt(from) + suffix; });
  tween(start, dur, (t) => { el.textContent = prefix + fmt(from + (to - from) * t) + suffix; });
}
/** A wide lit sheen sweeping across `el` from the upper left (the icons' light). */
function sheen(el, delay, dur = 720) {
  const s = h("div", "sheen");
  el.append(s);
  A(s, [{ transform: "translateX(-140%) skewX(-20deg)", opacity: 0 }, { opacity: 1, offset: 0.2 }, { opacity: 1, offset: 0.8 }, { transform: "translateX(460%) skewX(-20deg)", opacity: 0 }], { duration: dur, delay, easing: INOUT });
}
const title = (text, cls = "") => h("div", "title " + cls, text);
const caption = (text) => h("div", "caption", text);

// ================================================================== M1 — all-in showdown
function allIn() {
  table("holdem");
  const LEN = 8600;
  const { content, band } = frame({ material: "blue", bandH: 400, game: "holdem", kicker: "Hold'em · all-in showdown", len: LEN });
  content.classList.add("m1");
  const head = title("All in", "small");
  const row = h("div", "m1-row");
  const side = (p, cards, pct) => {
    const col = h("div", "m1-side");
    const pl = plate(p, { av: 40, w: 196, hgt: 50 });
    const hand = h("div", "m1-hand");
    const els = cards.map((c) => cardEl(c, 76, true));
    hand.append(...els);
    const pc = h("div", "pct", pct + "%");
    col.append(pl, hand, pc);
    return { col, pl, els, pc, cards };
  };
  const L = side(P.milo, ["Ah", "Kh"], 46), R = side(P.nora, ["Qs", "Qd"], 54);
  const board = h("div", "m1-board");
  const slots = [0, 1, 2, 3, 4].map(() => { const s = h("div", "slot"); board.append(s); return s; });
  row.append(L.col, board, R.col);
  const cap = caption("");
  content.append(head, row, cap);

  stamp(head, 450);
  appear(L.col, 560, "translateX(-40px)"); appear(R.col, 560, "translateX(40px)");
  flip(L.els[0], "Ah", 1000); flip(L.els[1], "Kh", 1080); flip(R.els[0], "Qs", 1180); flip(R.els[1], "Qd", 1260);
  [L.pc, R.pc].forEach((e) => appear(e, 1450, "scale(.7)"));
  let shown = [46, 54];
  const pct = (a, b, start) => { counter(L.pc, shown[0], a, start, 420, "", "%"); counter(R.pc, shown[1], b, start, 420, "", "%"); shown = [a, b]; };
  const deal = (i, card, drop, turn, dur = 320) => {
    const c = cardEl(card, 76, true);
    slots[i].append(c);
    A(c, [{ opacity: 0, transform: "translateY(-70px) rotate(-6deg)" }, { opacity: 1, transform: "none" }], { duration: 300, delay: drop });
    flip(c, card, turn, dur);
    return c;
  };
  const board5 = [deal(0, "Kd", 1900, 2350), deal(1, "7c", 1980, 2440), deal(2, "2h", 2060, 2530)];
  pct(91, 9, 2950);
  board5.push(deal(3, "5s", 3600, 4100));
  pct(95, 5, 4500);
  // the river: a slow squeeze, then the suck-out
  const river = deal(4, "Qc", 5200, 5750, 1100);
  board5.push(river);
  A(river, [{ transform: "none" }, { transform: "translateY(-6px)" }, { transform: "none" }], { duration: 500, delay: 5250 + 300, fill: "none" });
  at(6300, () => shake(band, 0, 6));
  pct(0, 100, 6350);
  at(6600, () => {
    A(L.col, [{ opacity: 1, filter: "grayscale(0)" }, { opacity: 0.4, filter: "grayscale(.6)" }], { duration: 400 });
    [board5[0], board5[1], board5[4], R.els[0], R.els[1]].forEach((c, k) =>
      A(c, [{ transform: "none" }, { transform: "translateY(-12px)" }], { duration: 300, delay: k * 40, easing: SNAP }));
    [board5[2], board5[3]].forEach((c) => A(c, [{ opacity: 1 }, { opacity: 0.45 }], { duration: 300 }));
    R.pl.classList.add("glow");
    cap.textContent = "Nora hits a queen on the river — three queens";
    appear(cap, 0);
  });
}

// ================================================================== M2 — monster pot
function monsterPot() {
  table("holdem");
  const LEN = 4300, POT = 18_640;
  const { content } = frame({ material: "blue", bandH: 340, game: "holdem", kicker: "Hold'em · monster pot", len: LEN });
  content.classList.add("m2");
  const pl = bigPlate(P.theo);
  const mid = h("div", "m2-mid");
  const num = h("div", "bignum money", "0");
  mid.append(num, caption("93 big blinds · the biggest pot at this table today"));
  const pile = h("div", "m2-pile");
  const COLS = [[10000, 1], [2500, 3], [500, 2], [100, 4], [25, 5]];
  const coins = [];
  COLS.forEach(([v, n]) => {
    const col = h("div", "col");
    for (let k = 0; k < n + 3; k++) { const c = h("div", "pc", coinSvg(v, 46)); c.style.bottom = k * 7 + "px"; c.dataset.v = v; col.append(c); coins.push(c); }
    pile.append(col);
  });
  content.append(pl, mid, pile);
  appear(pl, 520, "translateX(-40px)");
  appear(mid, 700, "scale(.9)");
  coins.forEach((c, k) => A(c, [{ opacity: 0, transform: "translateY(-30px)" }, { opacity: 1, transform: "none" }], { duration: 200, delay: 450 + k * 14 }));
  const N = coins.length;
  at(1150, () => {
    const to = centre(pl.querySelector(".av"));
    // top coins first, one column after another; each flies as itself and sinks under the plate
    const order = [...pile.children].flatMap((col) => [...col.children].reverse());
    order.forEach((c, k) => {
      const from = centre(c);
      at(k * 36, () => { c.style.visibility = "hidden"; });
      arc(+c.dataset.v, 46, from, to, k * 36, 620, 110);
    });
  });
  counter(num, 0, POT, 1150, N * 36 + 500);
  counter(pl.querySelector(".stack"), P.theo.stack, P.theo.stack + POT, 1600, N * 36 + 300);
  at(1150 + N * 36 + 650, () => {
    pl.classList.add("glow");
    A(pl, [{ transform: "scale(1)" }, { transform: "scale(1.05)" }, { transform: "scale(1)" }], { duration: 420, fill: "none" });
  });
}

// ================================================================== M3 — rare hand
const RARE = {
  quads:  { cards: ["9s", "9h", "9d", "9c", "Kh"], name: "Four of a Kind", material: "blue", who: P.ivy, game: "holdem", odds: "about 1 in 595 hands" },
  sflush: { cards: ["5h", "6h", "7h", "8h", "9h"], name: "Straight Flush", material: "silver", who: P.milo, game: "holdem", odds: "about 1 in 3,590 hands" },
  royal:  { cards: ["Ts", "Js", "Qs", "Ks", "As"], name: "Royal Flush", material: "gold", who: P.you, game: "holdem", odds: "about 1 in 30,940 hands" },
  three:  { cards: ["7d", "8d", "9d"], name: "Straight Flush", material: "blue", who: P.nora, game: "three-card", odds: "Three Card Poker · about 1 in 460 hands" }
};
function rareHand(kind = "quads") {
  const r = RARE[kind];
  table(r.game);
  const LEN = kind === "royal" ? 5200 : 4400;
  const { content, band } = frame({ material: r.material, bandH: 420, game: r.game, kicker: `${GAME_NAME[r.game]} · rare hand`, len: LEN });
  content.classList.add("m3");
  const pl = plate(r.who, { av: 30, w: 168, hgt: 42 });
  const row = h("div", "m3-row");
  const els = r.cards.map((c) => { const e = cardEl(c, 90); row.append(e); return e; });
  const t = title(r.name, "tier-" + r.material), cap = caption(`${r.who.name} · ${r.odds}`);
  content.append(pl, row, t, cap);
  appear(pl, 460);
  els.forEach((e, i) => A(e, [{ opacity: 0, transform: "translateY(-36px) scale(1.35)" }, { opacity: 1, transform: "none" }], { duration: 280, delay: 620 + i * 150, easing: SNAP }));
  const landed = 620 + (els.length - 1) * 150 + 280;
  at(landed, () => shake(band, 0, kind === "royal" ? 7 : 4));
  sheen(row, landed + 150);
  appear(t, landed + 260, "translateY(16px)", 420);
  appear(cap, landed + 520);
  if (kind === "royal") at(landed + 300, () => rain(34, 0, 1700));
}

// ================================================================== M4 — jackpot
const JACK = {
  slots:    { mult: 100, bet: 200, game: "slots", cap: "Three diamonds" },
  roulette: { mult: 35, bet: 200, game: "roulette", cap: "Straight up on 17" },
  "sic-bo": { mult: 30, bet: 200, game: "sic-bo", cap: "Any triple — three fives" }
};
function jackpot(kind = "slots") {
  const j = JACK[kind];
  table(j.game);
  const LEN = 5600;
  const { content, band } = frame({ material: "gold", bandH: 400, game: j.game, kicker: `${GAME_NAME[j.game]} · jackpot`, len: LEN });
  content.classList.add("m4");
  const stage = h("div", "m4-stage");
  const right = h("div", "m4-right");
  const mult = h("div", "mult", "×" + j.mult);
  const pay = h("div", "bignum money", "0");
  right.append(mult, pay, caption(`${P.theo.name} · ${j.cap} · bet ${fmt(j.bet)}`));
  content.append(stage, right);
  const land = kind === "slots" ? slotsReels(stage) : kind === "roulette" ? wheel(stage) : dice(stage);
  stamp(mult, land + 120, 460);
  at(land + 120, () => shake(band, 0, 6));
  appear(pay, land + 320, "scale(.8)");
  counter(pay, 0, j.bet * j.mult, land + 320, 1300, "+");
  at(land + 350, () => fountain(centre(stage), 36, 0));
}

// slot symbols: plain chunky shapes in the chess palette (placeholders — slot art isn't designed yet)
const SYM = {
  gem:    `<svg viewBox="0 0 80 80"><polygon points="40,8 70,34 40,72" fill="#1f8f7c"/><polygon points="40,8 10,34 40,72" fill="#5fd9c2"/><polygon points="40,8 70,34 10,34" fill="#96f4e2" opacity=".55"/></svg>`,
  bell:   `<svg viewBox="0 0 80 80"><path d="M40 10c-14 0-22 12-22 26v14l-8 10h60l-8-10V36c0-14-8-26-22-26z" fill="#3E3A31"/><path d="M40 10c-14 0-22 12-22 26v14l-8 10h30z" fill="#6E685B"/><circle cx="40" cy="66" r="7" fill="#1C1A15"/></svg>`,
  cherry: `<svg viewBox="0 0 80 80"><path d="M34 16l20-6 4 8-18 6 2 20h-8z" fill="#3E3A31"/><circle cx="28" cy="54" r="14" fill="#1C1A15"/><circle cx="54" cy="52" r="14" fill="#3E3A31"/><circle cx="24" cy="50" r="5" fill="#6E685B"/></svg>`,
  bar:    `<svg viewBox="0 0 80 80"><rect x="8" y="26" width="64" height="28" rx="8" fill="#3E3A31"/><path d="M16 26h56v0L8 54V34a8 8 0 0 1 8-8z" fill="#6E685B"/></svg>`,
  lemon:  `<svg viewBox="0 0 80 80"><ellipse cx="40" cy="42" rx="28" ry="20" fill="#E1D3AD"/><path d="M12 42a28 20 0 0 1 56 0z" fill="#FBF8EF"/></svg>`
};
function slotsReels(stage) {
  stage.classList.add("reels");
  const strips = [["bell", "cherry", "bar", "lemon", "bell", "cherry", "bar", "lemon", "cherry", "gem"],
    ["cherry", "bar", "lemon", "bell", "bar", "cherry", "lemon", "bell", "bar", "cherry", "gem"],
    ["lemon", "bell", "cherry", "bar", "lemon", "bell", "cherry", "bar", "lemon", "bell", "bar", "gem"]];
  const CELL = 128;
  strips.forEach((s, i) => {
    const win = h("div", "reel"), strip = h("div", "strip", s.map((k) => `<div class="sym">${SYM[k]}</div>`).join(""));
    win.append(strip); stage.append(win);
    appear(win, 450 + i * 60, "translateY(20px)");
    A(strip, [{ transform: "translateY(0)" }, { transform: `translateY(${-(s.length - 1) * CELL}px)` }],
      { duration: 1500 + i * 450, delay: 650, easing: "cubic-bezier(.15,.55,.25,1.04)" });
    at(650 + 1500 + i * 450, () => A(win, [{ transform: "translateY(0)" }, { transform: "translateY(5px)" }, { transform: "none" }], { duration: 180, fill: "none" }));
  });
  const done = 650 + 1500 + 2 * 450;
  at(done + 60, () => stage.querySelectorAll(".reel").forEach((r) => r.classList.add("hit")));
  return done;
}
const WHEEL = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
const RED = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
const pocketFill = (n) => (n === 0 ? "#2f7d57" : RED.has(n) ? "#b43a3a" : CHESS.ebony);
function wheel(stage) {
  stage.classList.add("wheel-stage");
  const R = 150, step = 360 / 37, rad = (d) => ((d - 90) * Math.PI) / 180;
  let wedges = "";
  WHEEL.forEach((n, i) => {
    const a0 = rad(i * step - step / 2), a1 = rad(i * step + step / 2);
    const p = (a, r) => `${(R + r * Math.cos(a)).toFixed(1)},${(R + r * Math.sin(a)).toFixed(1)}`;
    wedges += `<polygon points="${p(a0, 144)} ${p(a1, 144)} ${p(a1, 96)} ${p(a0, 96)}" fill="${pocketFill(n)}"/>`;
  });
  const svg = `<svg viewBox="0 0 300 300" width="300" height="300">
    <circle cx="150" cy="150" r="149" fill="${CHESS.charcoal}"/>${wedges}
    <circle cx="150" cy="150" r="96" fill="${CHESS.gray}"/><circle cx="150" cy="150" r="62" fill="${CHESS.charcoal}"/>
    <path d="M150 1a149 149 0 0 0 -105 254L150 150z" fill="#fff" opacity=".07"/>
    <circle cx="150" cy="150" r="20" fill="${CHESS.ivory}"/><path d="M150 130a20 20 0 0 0 -14 34L150 150z" fill="${CHESS.white}"/></svg>`;
  const wh = h("div", "wheel", svg), arm = h("div", "ballarm"), ball = h("div", "ball");
  arm.append(ball);
  const box = h("div", "wheelbox"); box.append(wh, arm); stage.append(box);
  const pocket = h("div", "pocket", "17");
  pocket.style.background = pocketFill(17);
  stage.append(pocket);
  appear(box, 450, "scale(.85)");
  const i17 = WHEEL.indexOf(17), end = 360 * 3 - i17 * step;
  A(wh, [{ transform: "rotate(0deg)" }, { transform: `rotate(${end}deg)` }], { duration: 2800, delay: 500, easing: "cubic-bezier(.12,.6,.25,1)" });
  A(arm, [{ transform: "rotate(40deg)" }, { transform: `rotate(${-360 * 4}deg)` }], { duration: 2800, delay: 500, easing: "cubic-bezier(.12,.6,.25,1)" });
  A(ball, [{ transform: "translate(-50%, -140px)", offset: 0 }, { transform: "translate(-50%, -140px)", offset: 0.7 },
    { transform: "translate(-50%, -112px)", offset: 0.82 }, { transform: "translate(-50%, -124px)", offset: 0.9 }, { transform: "translate(-50%, -118px)", offset: 1 }],
    { duration: 2800, delay: 500, easing: "linear" });
  stamp(pocket, 3350, 420);
  return 3350;
}
const PIPS = { 1: [[50, 50]], 2: [[28, 28], [72, 72]], 3: [[26, 26], [50, 50], [74, 74]], 4: [[28, 28], [72, 28], [28, 72], [72, 72]], 5: [[26, 26], [74, 26], [50, 50], [26, 74], [74, 74]], 6: [[28, 24], [72, 24], [28, 50], [72, 50], [28, 76], [72, 76]] };
const dieSvg = (n) => `<svg viewBox="0 0 100 100"><rect x="2" y="2" width="96" height="96" rx="22" fill="${CHESS.ivory}"/><path d="M24 2h52a22 22 0 0 1 22 22v0L2 98V24A22 22 0 0 1 24 2z" fill="${CHESS.cream}"/><path d="M24 2h40L2 64V24A22 22 0 0 1 24 2z" fill="${CHESS.white}"/>${PIPS[n].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="9.5" fill="${CHESS.ebony}"/>`).join("")}</svg>`;
function dice(stage) {
  stage.classList.add("dice-stage");
  const LAND = 2300;
  [0, 1, 2].forEach((i) => {
    const d = h("div", "die", dieSvg(1 + i));
    stage.append(d);
    const x0 = -380 - i * 60, rot = 540 + i * 200;
    A(d, [{ transform: `translate(${x0}px, -120px) rotate(${-rot}deg)`, opacity: 0, offset: 0 },
      { transform: `translate(${x0 * 0.45}px, 30px) rotate(${-rot * 0.45}deg)`, opacity: 1, offset: 0.45 },
      { transform: `translate(${x0 * 0.15}px, -40px) rotate(${-rot * 0.15}deg)`, offset: 0.72 },
      { transform: "translate(0, 0) rotate(0deg)", offset: 1 }],
      { duration: 1500, delay: 600 + i * 110, easing: "cubic-bezier(.2,.6,.35,1)" });
    let k = 0;
    const g = gen;
    const roll = () => { if (g !== gen) return; d.innerHTML = dieSvg(1 + ((k++ * 5 + i * 2) % 6)); };
    for (let t = 650; t < 600 + i * 110 + 1400; t += 90) at(t, roll);
    at(600 + i * 110 + 1500, () => { d.innerHTML = dieSvg(5); });
  });
  at(LAND, () => stage.querySelectorAll(".die").forEach((d) => d.classList.add("hit")));
  return LAND;
}

// ================================================================== M5 — Big Two, a player goes out
function bigTwo() {
  table("big-two");
  const LEN = 4400, POT = 3_600;
  const { content, band } = frame({ material: "blue", bandH: 360, game: "big-two", kicker: "Big Two · round won", len: LEN });
  content.classList.add("m5");
  const left = h("div", "m5-left");
  const pl = bigPlate(P.theo, { w: 240 });
  left.append(pl, title("Out!"), caption("Theo plays the last five cards"));
  const combo = h("div", "m5-combo");
  const cards = ["8s", "8h", "8d", "Kc", "Kh"].map((c) => { const e = cardEl(c, 80); combo.append(e); return e; });
  const opp = h("div", "m5-opp");
  const rows = [[P.milo, 4], [P.ivy, 7], [P.you, 2]].map(([p, n]) => {
    const r = h("div", "opp");
    r.append(plate(p, { line: `${n} card${n > 1 ? "s" : ""} left · pays` }), h("div", "fanmini", Array.from({ length: Math.min(n, 5) }, () => backHtml(24)).join("")));
    opp.append(r);
    return r;
  });
  content.append(left, combo, opp);
  appear(pl, 460, "translateX(-40px)");
  left.querySelectorAll(".title, .caption").forEach((e, k) => appear(e, 1350 + k * 200, "translateY(12px)"));
  cards.forEach((e, i) => A(e, [{ opacity: 0, transform: `translateY(260px) rotate(${(i - 2) * 9}deg)` }, { opacity: 1, transform: "none" }], { duration: 420, delay: 620 + i * 70, easing: EASE }));
  at(620 + 4 * 70 + 420, () => shake(band, 0, 5));
  rows.forEach((r, k) => appear(r, 560 + k * 90, "translateX(30px)"));
  at(2000, () => {
    const to = centre(pl.querySelector(".av"));
    rows.forEach((r, k) => {
      const from = centre(r.querySelector(".plate"));
      for (let c = 0; c < 5; c++) arc([500, 100, 2500][k], 34, from, to, k * 180 + c * 40, 600, 70);
    });
  });
  counter(pl.querySelector(".stack"), P.theo.stack, P.theo.stack + POT, 2400, 900);
  at(3400, () => pl.classList.add("glow"));
}

// ================================================================== M6 — tournament / River Sprint
function sprintLive() {
  table("river-sprint");
  const LEN = 4200;
  const { content } = frame({ material: "blue", bandH: 340, game: null, kicker: "River Sprint · round 1 of 2", len: LEN, banner: true });
  content.classList.add("m6a");
  const icon = h("div", "m6-icon", `<img src="games/river-sprint.svg" width="190" height="190" alt="">`);
  const mid = h("div", "m6-mid");
  mid.append(title("River Sprint"), caption("24 players · fast-fold · every fold, a new table"));
  const count = h("div", "count");
  content.append(icon, mid, count);
  A(icon, [{ opacity: 0, transform: "translateY(-80px)" }, { opacity: 1, transform: "none" }], { duration: 480, delay: 430, easing: SNAP });
  A(icon, [{ transform: "rotate(0)" }, { transform: "rotate(-8deg)" }, { transform: "rotate(5deg)" }, { transform: "rotate(0)" }], { duration: 360, delay: 1000, fill: "none" });
  mid.querySelectorAll("div").forEach((e, k) => appear(e, 700 + k * 180, "translateY(12px)"));
  ["3", "2", "1", "Go"].forEach((n, k) => at(1300 + k * 620, () => {
    const e = h("span", n === "Go" ? "go" : "", n);
    count.replaceChildren(e);
    A(e, [{ opacity: 0, transform: "scale(1.8)" }, { opacity: 1, transform: "scale(1)", offset: 0.35 }, { opacity: 1, transform: "scale(.94)", offset: 0.8 }, { opacity: n === "Go" ? 1 : 0, transform: "scale(.9)" }], { duration: 600 });
  }));
}
function knockout() {
  table("river-sprint");
  const LEN = 3900;
  const { content } = frame({ material: "charcoal", bandH: 320, game: "river-sprint", kicker: "River Sprint · knockout", len: LEN, banner: true });
  content.classList.add("m6b");
  const pl = bigPlate({ ...P.ada, stack: 0 }, { line: "0" });
  const mid = h("div", "m6-mid");
  mid.append(title("Knocked out"), caption("Ada finishes 5th of 6 — busted by Theo"));
  content.append(pl, mid);
  appear(pl, 450, "scale(.92)");
  mid.querySelectorAll("div").forEach((e, k) => appear(e, 1100 + k * 220, "translateY(12px)"));
  tween(800, 1300, (t) => setRing(pl, "emerald", 1 - t), (t) => t);
  at(2150, () => A(pl, [{ transform: "none", opacity: 1, filter: "grayscale(0)" }, { transform: "translateY(26px)", opacity: 0.35, filter: "grayscale(1)" }], { duration: 520, easing: "cubic-bezier(.5,0,.75,0)" }));
}
function crowned() {
  table("river-sprint");
  const LEN = 5000;
  const { content } = frame({ material: "gold", bandH: 380, game: "river-sprint", kicker: "River Sprint · final", len: LEN, banner: true });
  content.classList.add("m6c");
  const pl = bigPlate(P.you, { av: 84, w: 330, hgt: 96 });
  setRing(pl, "silver", 0);
  const mid = h("div", "m6-mid");
  mid.append(title("Champion"), caption("1st of 24 · +1,200 prize"));
  content.append(pl, mid);
  A(pl, [{ opacity: 0, transform: "translateY(70px)" }, { opacity: 1, transform: "none" }], { duration: 560, delay: 430, easing: SNAP });
  tween(950, 1100, (t) => setRing(pl, "silver", t), (t) => t);
  at(2080, () => A(pl.querySelector(".av"), [{ transform: "scale(1)" }, { transform: "scale(1.12)" }, { transform: "scale(1)" }], { duration: 380, fill: "none", easing: SNAP }));
  mid.querySelectorAll("div").forEach((e, k) => appear(e, 1300 + k * 240, "translateY(12px)"));
  at(2100, () => rain(40, 0, 1800));
}

// ================================================================== E4 — a new look unlocked (personal)
function newLook(key = "silver") {
  table("holdem");
  const m = metal(key);
  const mat = { steps: ramp(m), ink: plateStyle(key).ink === "#ffffff" ? "#ffffff" : mix(m.lo, "#000000", 0.55), sub: plateStyle(key).sub };
  const { content, out } = frame({ material: mat, bandH: 400, game: null, kicker: "Just for you — nobody waits", len: 0, personal: true, banner: true });
  content.classList.add("e4");
  const AV = 84;
  const pl = bigPlate(P.you, { av: AV, w: 330, hgt: 96, look: "default" });
  const mid = h("div", "m6-mid e4-mid");
  const btns = h("div", "btns", `<button class="wear">Wear it</button><button class="later">Later</button>`);
  mid.append(title(`${m.name} unlocked`), caption(`You reached ${fmt(m.at)} peak wealth — the ${m.name.toLowerCase()} ring and plate are yours`), btns);
  content.append(pl, mid);
  appear(pl, 420, "scale(.94)");
  setRing(pl, "default", 1);
  // the new ring, floating above the avatar
  const ring = h("div", "newring", ringSvg(AV, key));
  cur.fly.parentNode.append(ring);   // above the plates (the flight layer sits under them)
  const RISE = 150, box = ringBox(AV);
  at(0, () => {
    const c = centre(pl.querySelector(".av"));
    Object.assign(ring.style, { left: c.x - box / 2 + "px", top: c.y - cur.dy - box / 2 + "px" });
  });
  A(ring, [{ opacity: 0, transform: `translateY(${-RISE + 24}px) scale(.6) rotate(-40deg)` }, { opacity: 1, transform: `translateY(${-RISE}px) scale(1) rotate(0deg)` }],
    { duration: 620, delay: 700, easing: SNAP });
  at(1320, () => {
    A(ring, [{ transform: `translateY(${-RISE}px)` }, { transform: `translateY(${-RISE - 8}px)` }, { transform: `translateY(${-RISE}px)` }], { duration: 700, easing: "ease-in-out" });
  });
  at(2050, () => {
    // down onto the old ring, a touch big, then settles exactly over it
    A(ring, [{ transform: `translateY(${-RISE}px) scale(1)` }, { transform: "translateY(0) scale(1.08)", offset: 0.8 }, { transform: "translateY(0) scale(1)" }],
      { duration: 560, easing: "cubic-bezier(.55,0,.35,1)" });
  });
  at(2610, () => {
    setRing(pl, key, 1);
    ring.remove();
    A(pl.querySelector(".av"), [{ transform: "scale(1)" }, { transform: "scale(1.1)" }, { transform: "scale(1)" }], { duration: 340, fill: "none", easing: SNAP });
  });
  at(2900, () => {
    const st = plateStyle(key);
    pl.style.background = st.bg; pl.style.color = st.ink;
    pl.querySelector(".stack").style.color = st.money;
    sheen(pl, 0, 650);
  });
  mid.querySelectorAll(".title, .caption").forEach((e, k) => appear(e, 1100 + k * 220, "translateY(12px)"));
  appear(btns, 3200, "translateY(10px)");
  btns.addEventListener("click", () => out(0));
  out(9000);
}

// ================================================================== the shuffle (blur only)
function shuffle() {
  table("holdem", { between: true });
  const LEN = 3700, N = 14, CW = 84;
  const { content } = frame({ len: LEN });
  content.classList.add("mshuf");
  const deck = h("div", "deck");
  const cards = Array.from({ length: N }, (_, i) => {
    const c = h("div", "dc", backHtml(CW));
    c.style.zIndex = i;
    c.style.transform = `translateY(${-i * 0.8}px)`;
    deck.append(c);
    return c;
  });
  content.append(deck, caption("Shuffling"));
  appear(deck, 200, "scale(.92)");
  appear(content.querySelector(".caption"), 400);
  const half = (i) => (i < N / 2 ? -1 : 1);
  // cut into two halves
  at(700, () => cards.forEach((c, i) => A(c, [{ transform: `translateY(${-i * 0.8}px)` },
    { transform: `translate(${half(i) * 78}px, ${-(i % (N / 2)) * 0.8 + 6}px) rotate(${half(i) * 7}deg)` }], { duration: 360, easing: INOUT })));
  // riffle: the halves fall back in alternately, bottom cards first
  const order = [];
  for (let k = 0; k < N / 2; k++) order.push(k, k + N / 2);
  at(1150, () => order.forEach((i, n) => at(n * 52, () => {
    const c = cards[i];
    c.style.zIndex = 100 + n;
    A(c, [{ transform: `translate(${half(i) * 78}px, ${-(i % (N / 2)) * 0.8 + 6}px) rotate(${half(i) * 7}deg)` },
      { transform: `translate(${half(i) * 6}px, ${-n * 0.8}px) rotate(${half(i) * 1.5}deg)` }], { duration: 170, easing: "ease-in" });
  })));
  // square up
  at(1150 + N * 52 + 250, () => order.forEach((i, n) => A(cards[i], [{ transform: `translate(${half(i) * 6}px, ${-n * 0.8}px) rotate(${half(i) * 1.5}deg)` },
    { transform: `translate(0, ${-n * 0.8}px)` }], { duration: 220, easing: SNAP })));
  at(1150 + N * 52 + 250, () => shake(deck, 0, 2));
}

// ================================================================== the page
const MOMENTS = [
  // gameplay — the table blurs, no banner
  { id: "shuffle", group: "play", label: "Shuffle", run: shuffle, spec: ["Hold'em: the shuffle before each hand (today's 10.5 s deal pause).", "The shuffle's own length.", "The whole table — nobody can act yet anyway.", "Stand-in cards: in the game the real 3D deck shuffles in the middle while everything behind it blurs."] },
  { id: "allin", group: "play", label: "All-in showdown", run: allIn, spec: ["Hold'em, when everyone left in the hand is all-in and cards are still to come.", "≈ 8.5 s — the longest moment; it replaces the normal run-out.", "The whole table. Nobody can act during it anyway.", "Win chances update after each street; the river is turned slowly. Afterwards the pot flies to the winner as usual."] },
  { id: "pot", group: "play", label: "Monster pot", run: monsterPot, spec: ["Hold'em: a pot of 50+ big blinds, or the table's biggest pot today.", "≈ 4.3 s", "The whole table, between hands.", "Each coin leaves the pile as itself, flies to the winner and sinks UNDER the plate while both numbers count up."] },
  { id: "rare", group: "play", label: "Rare hand", run: rareHand, variants: [["quads", "Four of a kind"], ["sflush", "Straight flush"], ["royal", "Royal flush"], ["three", "Three Card"]], spec: ["Hold'em: four of a kind or better at showdown. Three Card Poker: straight flush or three of a kind.", "≈ 4.4 s (royal flush 5.2 s)", "The whole table.", "Rarity shows in the title's metal — white, silver, gold. Suited blackjack is left out: no special payout, and a plain blackjack comes once in ~21 hands."] },
  { id: "jackpot", group: "play", label: "Jackpot", run: jackpot, variants: [["slots", "Slots"], ["roulette", "Roulette"], ["sic-bo", "Sic Bo"]], spec: ["A single payout of 25× the bet or more: Slots three sevens or diamonds (50× / 100×), a straight-up Roulette number (35×), a Sic Bo triple (30×).", "≈ 5.6 s — the spin itself plays in the moment.", "The whole table.", "Slot symbols here are placeholders (plain shapes); the real slot art is still to design."] },
  { id: "bigtwo", group: "play", label: "Big Two — out!", run: bigTwo, spec: ["Big Two, when a player plays their last cards.", "≈ 4.4 s", "The whole table.", "The losers' leftover cards are shown with what they pay; the pot flies to the winner."] },
  // proclamations — the banner
  { id: "live", group: "banner", label: "Sprint — go", run: sprintLive, spec: ["A River Sprint round (or a Sit-n-Go) going live.", "≈ 4.2 s, ending on the first deal.", "Every table in the round.", "3 · 2 · 1 · Go."] },
  { id: "ko", group: "banner", label: "Knockout", run: knockout, spec: ["A tournament / Sprint player losing their last chips.", "≈ 3.9 s", "The table they were at.", "Their ring's gems run out like the turn clock, then the plate drops away."] },
  { id: "champ", group: "banner", label: "Champion", run: crowned, spec: ["A tournament / Sprint winner is decided.", "≈ 5 s", "The final table (and a toast for everyone else in the event).", "The ring lights up gem by gem, then coins rain."] },
  { id: "look", group: "banner", label: "New look (personal)", run: newLook, variants: [["silver", "Silver"], ["gold", "Gold"], ["ruby", "Ruby"], ["riverstone", "Riverstone"]], spec: ["Your peak wealth crosses a metal (Copper 12.5K … Riverstone 25M).", "Until you tap a button (auto-closes after 9 s).", "Nobody — it's only yours. At a table it waits for the hand to end and shows as a small toast instead; this full version plays off the table.", "A ring of the new metal appears above your avatar, comes down over your old ring and replaces it; then your plate takes the metal."] }
];

let current = MOMENTS[0], variant = {};
function play() {
  reset();
  const v = current.variants ? (variant[current.id] ?? current.variants[0][0]) : undefined;
  current.run(v);
}
function renderControls() {
  const bar = $("#moments");
  const btn = (m) => { const b = h("button", "mbtn" + (m === current ? " on" : ""), m.label); b.onclick = () => { current = m; renderControls(); play(); }; return b; };
  bar.replaceChildren(
    h("span", "grp", "Gameplay · blur"), ...MOMENTS.filter((m) => m.group === "play").map(btn),
    h("span", "grp", "Proclamations · banner"), ...MOMENTS.filter((m) => m.group === "banner").map(btn));
  const vb = $("#variants");
  vb.replaceChildren();
  if (current.variants) {
    const cur = variant[current.id] ?? current.variants[0][0];
    vb.append(...current.variants.map(([k, label]) => {
      const b = h("button", "vbtn" + (k === cur ? " on" : ""), label);
      b.onclick = () => { variant[current.id] = k; renderControls(); play(); };
      return b;
    }));
  }
  const [when, len, who, notes] = current.spec;
  $("#spec").innerHTML = `<h2>${current.label}</h2><dl><dt>When</dt><dd>${when}</dd><dt>Length</dt><dd>${len}</dd><dt>Who pauses</dt><dd>${who}</dd><dt>Notes</dt><dd>${notes}</dd></dl>`;
}
function fit() {
  const wrap = $("#screenwrap"), k = wrap.clientWidth / W;
  $("#screen").style.transform = `scale(${k})`;
  wrap.style.height = H * k + "px";
}
window.addEventListener("resize", fit);
$("#replay").onclick = play;
$("#speed").onclick = (e) => { speed = speed === 1 ? 0.4 : 1; e.currentTarget.textContent = speed === 1 ? "Speed 1×" : "Slow 0.4×"; play(); };
renderControls(); fit(); play();
