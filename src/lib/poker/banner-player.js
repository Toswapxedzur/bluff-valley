// Plays a PROCLAMATION moment (proclamations.js) — the reviewed banner design from design/moments:
// the page dims, a band in the logo's three tilted steps opens smoothly from its centre line across
// the whole width, the moment plays on it (a bar along its foot drains for a table's pause), and the
// band closes back to a line. Its material says what it is: logo blue for a call, charcoal for a
// knockout, gold for a champion, the new metal for your unlock. DOM + Web Animations.
import { ringSvg, ringBox, plateStyle, METALS, CHESS, mix } from "../cosmetics.js";
import { coinSvg } from "./chips.js";
import { initials, avColor } from "../initials.js";
import { SPRINT_ICON } from "./games.js";
import { PROCLAIM_MS } from "./proclamations.js";
import { play } from "../sfx.js";
import { cueAt, coinTicks } from "./table-audio.js";

const W = 1120;
const EASE = "cubic-bezier(.22,.61,.36,1)", SNAP = "cubic-bezier(.3,1.45,.5,1)", INOUT = "cubic-bezier(.65,0,.35,1)";
const h = (tag, cls = "", html = "") => { const e = document.createElement(tag); if (cls) e.className = cls; if (html) e.innerHTML = html; return e; };
const metal = (k) => METALS.find((m) => m.key === k);
const ramp = (m) => [mix(m.base, m.hi, 0.45), m.base, mix(m.base, m.lo, 0.3)];
const MATERIAL = {
  blue: { steps: ["#d3e8fb", "#a9d2f4", "#7db7e7"], ink: "#0f1f3d", sub: "#27477a" },
  gold: { steps: ramp(metal("gold")), ink: "#4a3300", sub: "#6e4d05" },
  charcoal: { steps: [CHESS.gray, CHESS.charcoal, CHESS.ebony], ink: CHESS.white, sub: CHESS.ivory }
};

/** Play `moment` in `host` (a fixed full-window layer). ctx: { me: { name, ring, badge } | null,
 *  onWear(key) }. Returns { stop, done: Promise }. */
export function playBanner(host, moment, ctx = {}) {
  const timers = [], anims = [];
  let alive = true, finish;
  const done = new Promise((r) => { finish = r; });
  const at = (ms, fn) => timers.push(setTimeout(() => alive && fn(), ms));
  const A = (el, kf, o) => { const a = el.animate(kf, { fill: "both", easing: EASE, ...o }); anims.push(a); return a; };
  const tween = (start, dur, fn) => at(start, () => { const t0 = performance.now(); const step = () => { if (!alive) return; const t = Math.min(1, (performance.now() - t0) / dur); fn(t); if (t < 1) requestAnimationFrame(step); }; requestAnimationFrame(step); });
  const personal = moment.kind === "newLook";
  const len = PROCLAIM_MS[moment.kind] || 4000;
  const k = Math.min(window.innerWidth / W, window.innerHeight / 700, 1.4);

  let mat = MATERIAL.blue, bandH = 330, kicker = "", game = null;
  if (moment.kind === "sprintGo") { kicker = "River Sprint · the round is live"; bandH = 340; }
  if (moment.kind === "knockout") { mat = MATERIAL.charcoal; kicker = "River Sprint · knockout"; bandH = 320; game = SPRINT_ICON; }
  if (moment.kind === "champion") { mat = MATERIAL.gold; kicker = "River Sprint · final"; bandH = 380; game = SPRINT_ICON; }
  if (personal) { const m = metal(moment.key); mat = { steps: ramp(m), ink: plateStyle(moment.key).ink === "#ffffff" ? "#ffffff" : mix(m.lo, "#000000", 0.55), sub: plateStyle(moment.key).sub }; kicker = "Just for you — nobody waits"; bandH = 400; }

  // ---- the frame
  const veil = h("div", "b-veil" + (personal ? " light" : ""));
  const band = h("div", "b-band");
  Object.assign(band.style, { height: bandH * k + "px", marginTop: (-bandH * k) / 2 + "px", color: mat.ink,
    background: `linear-gradient(110deg, ${mat.steps[0]} 0 34%, ${mat.steps[1]} 34% 67%, ${mat.steps[2]} 67% 100%)` });
  band.style.setProperty("--ink", mat.ink); band.style.setProperty("--sub", mat.sub); band.style.setProperty("--on-ink", mat.steps[2]);
  const inner = h("div", "b-inner");
  Object.assign(inner.style, { width: W + "px", height: bandH + "px", transform: `translate(-50%, -50%) scale(${k})` });
  band.append(inner);
  host.append(veil, band);
  A(veil, [{ opacity: 0 }, { opacity: 1 }], { duration: 260 });
  A(band, [{ clipPath: "inset(50% 0% 50% 0%)" }, { clipPath: "inset(0% 0% 0% 0%)" }], { duration: 520, delay: 80, easing: "cubic-bezier(.16,.84,.3,1)" });
  const T0 = performance.now();
  cueAt("lowThud", T0 + 200, { gain: 0.6 });                                 // the band opening
  const kick = h("div", "b-kicker", `${game ? `<img src="${game}" width="26" height="26" alt="">` : ""}<span>${kicker}</span>`);
  inner.append(kick);
  A(kick, [{ opacity: 0, transform: "translateX(-12px)" }, { opacity: 1, transform: "none" }], { duration: 300, delay: 420 });
  if (!personal && moment.kind !== "champion") {          // the champion's tables have closed: nothing is paused
    const bar = h("div", "b-bar", `<span class="lbl">table paused</span><span class="track"><span class="fill"></span></span>`);
    inner.append(bar);
    A(bar, [{ opacity: 0 }, { opacity: 1 }], { duration: 250, delay: 450 });
    A(bar.querySelector(".fill"), [{ transform: "scaleX(1)" }, { transform: "scaleX(0)" }], { duration: len - 450, delay: 450, easing: "linear" });
  }
  const back = h("div", "b-back"), content = h("div", "b-content");
  inner.append(back, content);
  const close = (when) => at(when, () => {
    A(band, [{ clipPath: "inset(0% 0% 0% 0%)" }, { clipPath: "inset(50% 0% 50% 0%)" }], { duration: 400, easing: "cubic-bezier(.5,0,.75,.2)" });
    A(veil, [{ opacity: 1 }, { opacity: 0 }], { duration: 320, delay: 180 });
    at(460, () => finish());
  });

  // ---- pieces
  const appear = (el, delay, from = "translateY(12px)") => A(el, [{ opacity: 0, transform: from }, { opacity: 1, transform: "none" }], { duration: 340, delay });
  const title = (t) => h("div", "b-title", t), caption = (t) => h("div", "b-caption", t);
  function plate(p, { av = 64, w = 300, hgt = 76, look = null } = {}) {
    const st = plateStyle(look ?? p.badge ?? "default"), ring = look ?? p.ring ?? "default", e = h("div", "b-plate");
    Object.assign(e.style, { width: w + "px", height: hgt + "px", background: st.bg, color: st.ink });
    const over = (ringBox(av) - av) / 2;
    e.innerHTML = `<span class="av" style="width:${av}px;height:${av}px;margin-right:${Math.round(over + av * 0.2)}px"><span class="ring">${ringSvg(av, ring)}</span><span class="face" style="background:${avColor(p.name)};font-size:${Math.round(av * 0.36)}px">${initials(p.name)}</span></span><span class="txt"><b class="name" style="font-size:${Math.round(hgt * 0.3)}px">${p.name}</b></span>`;
    return e;
  }
  const setRing = (pl, look, remain) => { const av = pl.querySelector(".av"); av.querySelector(".ring").innerHTML = ringSvg(parseFloat(av.style.width), look, remain); };
  function rain(n, delay) {
    const vals = [2500, 10000, 500, 50000, 100];
    for (let i = 0; i < n; i++) {
      const size = 26 + ((i * 11) % 20), c = h("div", "b-coin", coinSvg(vals[i % vals.length], size)), x = 80 + ((i * 97) % 960), spin = ((i * 41) % 90) - 45;
      back.append(c);
      A(c, [{ transform: `translate(${x}px, -60px)` }, { transform: `translate(${x + spin}px, ${bandH + 40}px) rotate(${spin * 3}deg)` }], { duration: 1800, delay: delay + ((i * 131) % 900), easing: "cubic-bezier(.4,0,.8,.6)" });
    }
  }

  // ---- the moments
  if (moment.kind === "sprintGo") {
    const icon = h("div", "b-icon", `<img src="${SPRINT_ICON}" width="190" height="190" alt="">`), mid = h("div", "b-mid"), count = h("div", "b-count");
    mid.append(title("River Sprint"), caption(`${moment.players} players · fast-fold · every fold, a new table`));
    content.append(icon, mid, count);
    A(icon, [{ opacity: 0, transform: "translateY(-80px)" }, { opacity: 1, transform: "none" }], { duration: 480, delay: 430, easing: SNAP });
    A(icon, [{ transform: "rotate(0)" }, { transform: "rotate(-8deg)" }, { transform: "rotate(5deg)" }, { transform: "rotate(0)" }], { duration: 360, delay: 1000, fill: "none" });
    mid.querySelectorAll("div").forEach((e, i) => appear(e, 700 + i * 180));
    // 3 · 2 · 1 tick like the turn clock; the fanfare is the "Go"
    [0, 1, 2].forEach((i) => play("tick", { delay: 1300 + i * 620 }));
    play("fanfare", { delay: 1300 + 3 * 620 });
    ["3", "2", "1", "Go"].forEach((n, i) => at(1300 + i * 620, () => {
      const e = h("span", n === "Go" ? "go" : "", n);
      count.replaceChildren(e);
      A(e, [{ opacity: 0, transform: "scale(1.8)" }, { opacity: 1, transform: "scale(1)", offset: 0.35 }, { opacity: 1, transform: "scale(.94)", offset: 0.8 }, { opacity: n === "Go" ? 1 : 0, transform: "scale(.9)" }], { duration: 600 });
    }));
    close(len - 450);
  } else if (moment.kind === "knockout") {
    const pl = plate(moment), mid = h("div", "b-mid");
    mid.append(title("Knocked out"), caption(`${moment.name} finishes #${moment.place} of ${moment.of}`));
    content.append(pl, mid);
    appear(pl, 450, "scale(.92)");
    mid.querySelectorAll("div").forEach((e, i) => appear(e, 1100 + i * 220));
    tween(800, 1200, (t) => setRing(pl, moment.ring || "default", 1 - t));
    for (let i = 0; i < 6; i++) play("tick", { delay: 800 + i * 200, volume: 0.5 });   // the gems running out: the clock's tick
    at(2150, () => A(pl, [{ transform: "none", opacity: 1, filter: "grayscale(0)" }, { transform: "translateY(26px)", opacity: 0.35, filter: "grayscale(1)" }], { duration: 520, easing: "cubic-bezier(.5,0,.75,0)" }));
    cueAt("lowThud", T0 + 2150 + 480);                                       // the plate dropping away
    close(len - 450);
  } else if (moment.kind === "champion") {
    const pl = plate(moment, { av: 84, w: 330, hgt: 96 }), mid = h("div", "b-mid");
    setRing(pl, moment.ring || "default", 0);
    mid.append(title("Champion"), caption(`${moment.name} · 1st of ${moment.of}`));
    content.append(pl, mid);
    A(pl, [{ opacity: 0, transform: "translateY(70px)" }, { opacity: 1, transform: "none" }], { duration: 560, delay: 430, easing: SNAP });
    tween(950, 1200, (t) => setRing(pl, moment.ring || "default", t));
    at(2150, () => A(pl.querySelector(".av"), [{ transform: "scale(1)" }, { transform: "scale(1.12)" }, { transform: "scale(1)" }], { duration: 380, fill: "none", easing: SNAP }));
    mid.querySelectorAll("div").forEach((e, i) => appear(e, 1300 + i * 240));
    at(2100, () => rain(40, 0));
    play("fanfare", { delay: 450 });
    const t0 = performance.now();
    for (let i = 0; i < 8; i++) cueAt("coins", t0 + 2300 + i * 130, { count: 3, gain: 0.45 });   // the coins raining down
    close(len - 450);
  } else if (personal) {
    // a ring of the new metal appears above your avatar, comes down over the old one; then the plate takes the metal
    const me = ctx.me || { name: "You", ring: "default", badge: "default" }, m = metal(moment.key), AV = 84;
    content.classList.add("low");
    const pl = plate(me, { av: AV, w: 330, hgt: 96 }), mid = h("div", "b-mid wide");
    const btns = h("div", "b-btns", `<button class="wear">Wear it</button><button class="later">Later</button>`);
    mid.append(title(`${m.name} unlocked`), caption(`You reached ${moment.at.toLocaleString("en-US")} peak wealth — the ${m.name.toLowerCase()} ring and plate are yours`), btns);
    content.append(pl, mid);
    appear(pl, 420, "scale(.94)");
    const ring = h("div", "b-newring", ringSvg(AV, moment.key)), box = ringBox(AV), RISE = 150;
    inner.append(ring);
    at(0, () => {
      const ir = inner.getBoundingClientRect(), ar = pl.querySelector(".av").getBoundingClientRect(), s = ir.width / W;
      Object.assign(ring.style, { left: (ar.left + ar.width / 2 - ir.left) / s - box / 2 + "px", top: (ar.top + ar.height / 2 - ir.top) / s - box / 2 + "px" });
    });
    A(ring, [{ opacity: 0, transform: `translateY(${-RISE + 24}px) scale(.6) rotate(-40deg)` }, { opacity: 1, transform: `translateY(${-RISE}px) scale(1) rotate(0deg)` }], { duration: 620, delay: 700, easing: SNAP });
    at(2050, () => A(ring, [{ transform: `translateY(${-RISE}px) scale(1)` }, { transform: "translateY(0) scale(1.08)", offset: 0.8 }, { transform: "translateY(0) scale(1)" }], { duration: 560, easing: "cubic-bezier(.55,0,.35,1)" }));
    cueAt("ringSet", T0 + 2500);                                             // the new ring landing on your avatar
    at(2610, () => { setRing(pl, moment.key, 1); ring.remove(); A(pl.querySelector(".av"), [{ transform: "scale(1)" }, { transform: "scale(1.1)" }, { transform: "scale(1)" }], { duration: 340, fill: "none", easing: SNAP }); });
    at(2800, () => {
      const st = plateStyle(moment.key), ov = h("span", "b-old");
      ov.style.background = pl.style.background;
      pl.prepend(ov); pl.style.background = st.bg; pl.style.color = st.ink;
      A(ov, [{ clipPath: "circle(150% at 100% 100%)" }, { clipPath: "circle(0% at 100% 100%)" }], { duration: 640, easing: INOUT }).finished.then(() => ov.remove()).catch(() => {});
    });
    mid.querySelectorAll(".b-title, .b-caption").forEach((e, i) => appear(e, 1100 + i * 220));
    appear(btns, 3200);
    btns.querySelector(".wear").addEventListener("click", () => { ctx.onWear?.(moment.key); close(0); });
    btns.querySelector(".later").addEventListener("click", () => close(0));
    close(len);
  }

  return { stop: () => { alive = false; timers.forEach(clearTimeout); anims.forEach((a) => a.cancel()); veil.remove(); band.remove(); finish(); }, done };
}
