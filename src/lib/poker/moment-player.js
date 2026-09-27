// Plays a full-screen moment (moments.js decides which) — the reviewed design from design/moments,
// on the real table's data. DOM + Web Animations, drawn into a fixed 1120 × 700 screen that
// MomentLayer scales to the window, over a veil that blurs the whole page.
//
// Shared norms (design/moments NORM): card flip 280, coin flights 560 ms 45 ms apart, close-up coins
// 40 px, winner = the game's green outline, loser = the fold dim; piles leave coin by coin from the
// top down; coins sink into a badge by shrinking at its centre. The layer stack inside the screen:
// celebration coins (back) < content < flights (fly).
import { renderBoard, renderBack } from "./composer.js";
import { coinSvg } from "./chips.js";
import { ringSvg, ringBox, plateStyle } from "../cosmetics.js";
import { initials, avColor } from "../initials.js";
import { WHEEL, STEP, pocketFill, wheelSvg, dieSvg, symSvg, FILL } from "./resolve-art.js";
import { cueAt, coinTicks } from "./table-audio.js";
import { play } from "../sfx.js";

export const W = 1120, H = 700;
const NORM = { flip: 280, coinDur: 560, coinGap: 45, momentCoin: 40 };
const EASE = "cubic-bezier(.22,.61,.36,1)", SNAP = "cubic-bezier(.3,1.45,.5,1)", INOUT = "cubic-bezier(.65,0,.35,1)";
const h = (tag, cls = "", html = "") => { const e = document.createElement(tag); if (cls) e.className = cls; if (html) e.innerHTML = html; return e; };
const fmt = (n) => Math.round(n).toLocaleString("en-US");

/** Play `moment` inside `root` (the scaled 1120 × 700 screen); the veil goes in `ctx.veilHost` (the
 *  whole page). ctx.seat(no) → { name, ring, badge, stack } | null. Returns a stop function. */
export function playMoment(root, moment, ctx) {
  const timers = [], anims = [], T0 = performance.now();
  let alive = true;
  // sounds on the moment's own clock: table sounds land their hit on the frame (cueAt), the rest start then
  const snd = (name, ms, opts = {}) => cueAt(name, T0 + ms, opts);
  const sfx = (name, ms, opts = {}) => play(name, { ...opts, delay: ms });
  const at = (ms, fn) => timers.push(setTimeout(() => alive && fn(), ms));
  const A = (el, kf, o) => { const a = el.animate(kf, { fill: "both", easing: EASE, ...o }); anims.push(a); return a; };
  const tween = (start, dur, fn, ease = (t) => 1 - Math.pow(1 - t, 3)) => at(start, () => {
    const t0 = performance.now();
    const step = () => { if (!alive) return; const t = Math.min(1, (performance.now() - t0) / dur); fn(ease(t)); if (t < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  });

  // ---- the frame: blur (gameplay) — the whole page under a veil, the moment over it
  const veil = h("div", "m-veil blur");
  const stage = h("div", "m-stage");
  const back = h("div", "m-back"), content = h("div", "m-content"), fly = h("div", "m-fly");
  stage.append(back, content, fly);
  (ctx.veilHost || root).prepend(veil);                 // BEHIND the moment: it blurs the page, not the moment
  root.append(stage);
  A(veil, [{ opacity: 0 }, { opacity: 1 }], { duration: 300 });
  at(moment.ms - 450, () => { A(stage, [{ opacity: 1 }, { opacity: 0 }], { duration: 300 }); A(veil, [{ opacity: 1 }, { opacity: 0 }], { duration: 320, delay: 180 }); });

  // ---- pieces
  const appear = (el, delay, from = "translateY(14px)", duration = 340) => A(el, [{ opacity: 0, transform: from }, { opacity: 1, transform: "none" }], { duration, delay });
  const stamp = (el, delay, duration = 380) => A(el, [{ opacity: 0, transform: "scale(1.5)" }, { opacity: 1, transform: "scale(1)" }], { duration, delay, easing: SNAP });
  const shake = (el, delay, amp = 5) => A(el, [{ transform: "none" }, { transform: `translate(${amp}px, ${-amp / 2}px)` }, { transform: `translate(${-amp}px, ${amp / 3}px)` }, { transform: `translate(${amp / 2}px, 0)` }, { transform: "none" }], { duration: 260, delay, fill: "none" });
  const markWinner = (el) => el.classList.add("won");
  const title = (text, cls = "") => h("div", "m-title " + cls, text);
  const caption = (text) => h("div", "m-caption", text);
  const cardEl = (c, w) => { const e = h("div", "m-card", renderBoard(c, w)); e.dataset.w = w; return e; };
  const coin = (v, size, layer) => { const c = h("div", "m-coin", coinSvg(v, size)); layer.append(c); return c; };
  function centre(el) {
    const s = root.getBoundingClientRect(), r = el.getBoundingClientRect(), k = s.width / W;
    return { x: (r.left + r.width / 2 - s.left) / k, y: (r.top + r.height / 2 - s.top) / k };
  }
  function counter(el, from, to, start, dur, prefix = "") {
    at(start, () => { el.textContent = prefix + fmt(from); });
    tween(start, dur, (t) => { el.textContent = prefix + fmt(from + (to - from) * t); });
  }
  /** A seat plate like the table's: the stepped badge metal, the ring floating round the avatar. */
  function plate(p, { av = 64, w = 300, hgt = 76, stack = p.stack } = {}) {
    const st = plateStyle(p.badge || "default"), ring = p.ring || "default";
    const e = h("div", "m-plate");
    Object.assign(e.style, { width: w + "px", height: hgt + "px", background: st.bg, color: st.ink });
    const over = (ringBox(av) - av) / 2;
    e.innerHTML = `<span class="av" style="width:${av}px;height:${av}px;margin-right:${Math.round(over + av * 0.2)}px"><span class="ring">${ringSvg(av, ring)}</span>`
      + `<span class="face" style="background:${avColor(p.name)};font-size:${Math.round(av * 0.36)}px">${initials(p.name)}</span></span>`
      + `<span class="txt"><b class="name" style="font-size:${Math.round(hgt * 0.3)}px">${p.name}</b><span class="stack" style="color:${st.money};font-size:${Math.round(hgt * 0.26)}px">${fmt(stack)}</span></span>`;
    return e;
  }
  /** One coin arcing from a to b (screen coords); it sinks into a badge by shrinking at the end. */
  function arc(value, size, a, b, delay, dur = NORM.coinDur) {
    const c = coin(value, size, fly), kf = [], lift = Math.max(20, Math.min(60, Math.hypot(b.x - a.x, b.y - a.y) * 0.22));
    for (let i = 0; i <= 12; i++) {
      const t = i / 12, x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t - lift * 4 * t * (1 - t), s = Math.max(0, (t - 0.72) / 0.28);
      kf.push({ transform: `translate(${x - size / 2}px, ${y - size / 2}px) scale(${1 - 0.78 * s})`, opacity: 1 - 0.9 * s, offset: t });
    }
    A(c, kf, { duration: dur, delay, easing: "cubic-bezier(.45,.05,.55,.95)" });
  }
  /** A pile of coins leaving coin by coin from the top down into `b`. */
  function pileTo(pile, b, delay) {
    at(delay, () => {
      const coins = [...pile.querySelectorAll(".m-coin-rest")].map((c) => ({ c, y: c.getBoundingClientRect().top }));
      coins.sort((p, q) => p.y - q.y);
      coins.forEach(({ c }, k) => { const a = centre(c); at(k * NORM.coinGap, () => { c.style.visibility = "hidden"; }); arc(+c.dataset.v, NORM.momentCoin, a, b, k * NORM.coinGap); });
    });
  }
  function rain(n, delay, dur = 1600) {
    const vals = [2500, 10000, 500, 50000, 100];
    for (let i = 0; i < n; i++) {
      const size = 26 + ((i * 11) % 20), c = coin(vals[i % vals.length], size, back), x = 80 + ((i * 97) % 960), spin = ((i * 41) % 90) - 45;
      A(c, [{ transform: `translate(${x}px, -60px)` }, { transform: `translate(${x + spin}px, ${H + 40}px) rotate(${spin * 3}deg)` }], { duration: dur, delay: delay + ((i * 131) % 900), easing: "cubic-bezier(.4,0,.8,.6)" });
    }
  }
  function fountain(from, n, delay) {
    const vals = [100, 500, 2500, 10000, 50000, 25];
    for (let i = 0; i < n; i++) {
      const size = 30 + ((i * 7) % 18), c = coin(vals[i % vals.length], size, back), kf = [];
      const vx = (((i * 53) % 100) / 100 - 0.5) * 900, vy = -(520 + ((i * 37) % 100) * 4.2), g = 1500;
      for (let k = 0; k <= 14; k++) { const t = (k / 14) * 1.5; kf.push({ transform: `translate(${from.x + vx * t - size / 2}px, ${from.y + vy * t + (g * t * t) / 2 - size / 2}px) rotate(${vx * t * 0.4}deg)`, offset: k / 14 }); }
      A(c, kf, { duration: 1500, delay: delay + i * 28, easing: "linear" });
    }
  }
  function sheen(el, delay) { const s = h("div", "m-sheen"); el.append(s); A(s, [{ transform: "translateX(-140%) skewX(-20deg)", opacity: 0 }, { opacity: 1, offset: 0.2 }, { opacity: 1, offset: 0.8 }, { transform: "translateX(460%) skewX(-20deg)", opacity: 0 }], { duration: 720, delay, easing: INOUT }); }
  const who = (seat) => ctx.seat(seat) || { name: "Player", ring: "default", badge: "default", stack: 0 };

  // ---- the moments
  if (moment.kind === "allIn") {
    content.classList.add("m-colc");
    const CW = 76, head = title("All in", "small"), row = h("div", "m-allrow");
    const sides = moment.players.map((pl) => {
      const q = who(pl.seat), col = h("div", "m-side"), hand = h("div", "m-hand");
      const els = pl.cards.map(() => { const e = h("div", "m-card", renderBack(CW)); e.dataset.w = CW; hand.append(e); return e; });
      const pc = h("div", "m-pct", "");
      const pp = plate(q, { av: 40, w: 196, hgt: 50 });
      col.append(pp, hand, pc);
      return { ...pl, col, pp, els, pc };
    });
    const board = h("div", "m-board"), slots = [0, 1, 2, 3, 4].map(() => { const s = h("div", "m-slot"); board.append(s); return s; });
    const half = Math.ceil(sides.length / 2);
    sides.slice(0, half).forEach((x) => row.append(x.col)); row.append(board); sides.slice(half).forEach((x) => row.append(x.col));
    const cap = caption("");
    content.append(head, row, cap);
    stamp(head, 450);
    sides.forEach((x, i) => appear(x.col, 560, i < half ? "translateX(-40px)" : "translateX(40px)"));
    const flip = (el, face, delay, dur = NORM.flip) => {
      A(el, [{ transform: "scaleX(1)" }, { transform: "scaleX(0.02)" }], { duration: dur / 2, delay, easing: "ease-in", fill: "none" });
      at(delay + dur / 2, () => { el.innerHTML = renderBoard(face, +el.dataset.w); A(el, [{ transform: "scaleX(0.02)" }, { transform: "scaleX(1)" }], { duration: dur / 2, easing: "ease-out", fill: "none" }); });
    };
    sides.forEach((x, i) => x.els.forEach((e, j) => flip(e, x.cards[j], 1000 + (i * 2 + j) * 80)));
    snd("flip", 1000);
    // the board as it stood when everyone was all-in, then each street
    const boardEls = [];
    for (let i = 0; i < moment.from; i++) { const e = h("div", "m-card", renderBoard(moment.board[i], CW)); e.dataset.w = CW; slots[i].append(e); boardEls[i] = e; }
    const showPct = (stage, when) => at(when, () => sides.forEach((x) => {
      const v = stage.pct[x.seat] ?? 0, from = +(x.pc.dataset.v ?? v);
      x.pc.dataset.v = v;
      tween(0, 420, (t) => { x.pc.textContent = Math.round(from + (v - from) * t) + "%"; });
    }));
    const st = moment.stages;
    showPct(st[0], 1450);
    sides.forEach((x) => appear(x.pc, 1450, "scale(.7)"));
    const deal = (i, delay, turnAt, dur = NORM.flip) => {
      const e = h("div", "m-card", renderBack(CW)); e.dataset.w = CW; slots[i].append(e); boardEls[i] = e;
      A(e, [{ opacity: 0, transform: "translateY(-70px) rotate(-6deg)" }, { opacity: 1, transform: "none" }], { duration: 300, delay });
      snd("cardLand", delay + 300);
      snd("flip", turnAt);
      flip(e, moment.board[i], turnAt, dur);
    };
    let t = 1900, k = 1;
    if (moment.from === 0) { [0, 1, 2].forEach((i) => deal(i, t + i * 80, t + 450 + i * 90)); showPct(st[k++], t + 1050); t += 1600; }
    if (moment.from <= 3) { deal(3, t, t + 500); showPct(st[k++], t + 900); t += 1600; }
    // the river: a slow squeeze
    deal(4, t, t + 550, 1100);
    A(slots[4], [{ transform: "none" }, { transform: "translateY(-6px)" }, { transform: "none" }], { duration: 500, delay: t + 350, fill: "none" });
    at(t + 1100, () => shake(stage, 0, 6));
    showPct(st[st.length - 1], t + 1150);
    at(t + 1400, () => {
      const winBest = new Set(sides.filter((x) => x.won).flatMap((x) => x.best || []));
      for (const x of sides) {
        if (x.won) markWinner(x.pp); else A(x.col, [{ opacity: 1, filter: "grayscale(0)" }, { opacity: 0.42, filter: "grayscale(.4)" }], { duration: 400 });
        x.els.forEach((e, j) => { if (x.won && winBest.has(x.cards[j])) A(e, [{ transform: "none" }, { transform: "translateY(-12px)" }], { duration: 300, easing: SNAP }); });
      }
      boardEls.forEach((e, i) => { if (!e) return; if (winBest.has(moment.board[i])) A(e, [{ transform: "none" }, { transform: "translateY(-12px)" }], { duration: 300, delay: i * 40, easing: SNAP }); else A(e, [{ opacity: 1 }, { opacity: 0.42 }], { duration: 300 }); });
      const w = sides.filter((x) => x.won);
      cap.textContent = w.length > 1 ? `Split pot — ${w.map((x) => who(x.seat).name).join(" & ")}` : w.length ? `${who(w[0].seat).name} wins${w[0].handName ? " with " + w[0].handName.toLowerCase() : ""}` : "";
      appear(cap, 0);
    });
  } else if (moment.kind === "monsterPot") {
    content.classList.add("m-row");
    const p = who(moment.seat), pl = plate({ ...p, stack: Math.max(0, p.stack - moment.won) });
    const mid = h("div", "m-col"), num = h("div", "m-bignum money", "0");
    mid.append(num, caption(`${fmt(moment.bb)} big blinds`));
    const pile = h("div", "m-pile");
    const cols = [];
    let rest = moment.amount;
    for (const d of [5000000, 1000000, 250000, 50000, 10000, 2500, 500, 100, 25, 5, 1]) { const n = Math.min(12, Math.floor(rest / d)); if (n > 0) { cols.push([d, n]); rest -= n * d; } if (cols.length >= 6) break; }
    let N = 0;
    for (const [d, n] of cols) {
      const col = h("div", "m-pcol");
      for (let k = 0; k < n + 2; k++) { const c = h("div", "m-coin-rest", coinSvg(d, NORM.momentCoin)); c.style.bottom = k * 6 + "px"; c.dataset.v = d; col.append(c); N++; }
      pile.append(col);
    }
    content.append(pl, mid, pile);
    appear(pl, 520, "translateX(-40px)"); appear(mid, 700, "scale(.9)");
    pile.querySelectorAll(".m-coin-rest").forEach((c, k) => A(c, [{ opacity: 0, transform: "translateY(-30px)" }, { opacity: 1, transform: "none" }], { duration: 200, delay: 450 + k * 14 }));
    at(1150, () => pileTo(pile, centre(pl.querySelector(".av")), 0));
    coinTicks(T0 + 1150 + NORM.coinDur, N, NORM.coinGap);
    counter(num, 0, moment.amount, 1150, N * NORM.coinGap + 200);
    counter(pl.querySelector(".stack"), Math.max(0, p.stack - moment.won), p.stack, 1150 + NORM.coinDur, Math.max(160, (N - 1) * NORM.coinGap));
    at(1150 + NORM.coinDur + N * NORM.coinGap, () => { markWinner(pl); A(pl, [{ transform: "scale(1)" }, { transform: "scale(1.05)" }, { transform: "scale(1)" }], { duration: 420, fill: "none" }); });
  } else if (moment.kind === "rare") {
    content.classList.add("m-colc");
    const p = who(moment.seat), pl = plate(p, { av: 30, w: 168, hgt: 42 });
    const row = h("div", "m-cards");
    const els = moment.cards.map((c) => { const e = cardEl(c, 90); row.append(e); return e; });
    const tier = moment.royal ? "gold" : moment.name === "Straight Flush" ? "silver" : "";
    const t = title(moment.name, tier), odds = { "Four of a Kind": "about 1 in 595 hands", "Straight Flush": moment.game === "three-card" ? "about 1 in 460 hands" : "about 1 in 3,590 hands", "Royal Flush": "about 1 in 30,940 hands", "Three of a Kind": "about 1 in 425 hands" }[moment.name] || "";
    content.append(pl, row, t, caption(`${p.name}${odds ? " · " + odds : ""}`));
    appear(pl, 460);
    els.forEach((e, i) => A(e, [{ opacity: 0, transform: "translateY(-36px) scale(1.35)" }, { opacity: 1, transform: "none" }], { duration: 280, delay: 620 + i * 150, easing: SNAP }));
    els.forEach((e, i) => snd("cardPlay", 620 + i * 150 + 280, { gain: 1.2 }));
    const landed = 620 + (els.length - 1) * 150 + 280;
    at(landed, () => shake(stage, 0, moment.royal ? 7 : 4));
    sheen(row, landed + 150);
    appear(t, landed + 260, "translateY(16px)", 420);
    appear(content.lastChild, landed + 520);
    if (moment.royal) { at(landed + 300, () => rain(34, 0, 1700)); for (let i = 0; i < 8; i++) snd("coins", landed + 500 + i * 130, { count: 3, gain: 0.45 }); }
  } else if (moment.kind === "jackpot") {
    content.classList.add("m-row");
    const box = h("div", "m-spin"), right = h("div", "m-col m-left");
    const mult = h("div", "m-mult", "×" + moment.mult), pay = h("div", "m-bignum money", "0");
    const p = who(moment.seat);
    right.append(mult, pay, caption(`${p.name} · bet ${fmt(moment.bet)}`));
    content.append(box, right);
    let land = 0;
    if (moment.game === "roulette") {
      const iN = WHEEL.indexOf(moment.outcome.pocket), end = 360 * 3 - iN * STEP;
      box.innerHTML = `<div class="m-wheelbox"><div class="m-wheel">${wheelSvg()}</div><div class="m-arm"><div class="m-ball"></div></div></div><div class="m-pocket" style="background:${pocketFill(moment.outcome.pocket)}">${moment.outcome.pocket}</div>`;
      const wh = box.querySelector(".m-wheel"), arm = box.querySelector(".m-arm"), ball = box.querySelector(".m-ball"), pocket = box.querySelector(".m-pocket");
      appear(box.firstChild, 450, "scale(.85)");
      A(wh, [{ transform: "rotate(0deg)" }, { transform: `rotate(${end}deg)` }], { duration: 2600, delay: 500, easing: "cubic-bezier(.12,.6,.25,1)" });
      A(arm, [{ transform: "rotate(40deg)" }, { transform: `rotate(${-360 * 4}deg)` }], { duration: 2600, delay: 500, easing: "cubic-bezier(.12,.6,.25,1)" });
      A(ball, [{ transform: "translate(-50%, -140px)", offset: 0 }, { transform: "translate(-50%, -140px)", offset: 0.7 }, { transform: "translate(-50%, -112px)", offset: 0.82 }, { transform: "translate(-50%, -124px)", offset: 0.9 }, { transform: "translate(-50%, -118px)", offset: 1 }], { duration: 2600, delay: 500, easing: "linear" });
      land = 3150; stamp(pocket, land, 420);
      sfx("shake", 500); sfx("dice", 3100);          // as the table's roulette (until its own ball sounds are picked)
    } else if (moment.game === "sic-bo") {
      moment.outcome.dice.forEach((n, i) => {
        const d = h("div", "m-die", dieSvg(1 + i)); box.append(d);
        const x0 = -380 - i * 60, rot = 540 + i * 200;
        A(d, [{ transform: `translate(${x0}px, -120px) rotate(${-rot}deg)`, opacity: 0, offset: 0 }, { transform: `translate(${x0 * 0.45}px, 30px) rotate(${-rot * 0.45}deg)`, opacity: 1, offset: 0.45 }, { transform: `translate(${x0 * 0.15}px, -40px) rotate(${-rot * 0.15}deg)`, offset: 0.72 }, { transform: "none", offset: 1 }], { duration: 1500, delay: 600 + i * 110, easing: "cubic-bezier(.2,.6,.35,1)" });
        let k = 0;
        for (let t = 650; t < 600 + i * 110 + 1400; t += 90) at(t, () => { d.innerHTML = dieSvg(1 + ((k++ * 5 + i * 2) % 6)); });
        at(600 + i * 110 + 1500, () => { d.innerHTML = dieSvg(n); d.classList.add("hit"); });
      });
      land = 2350;
      sfx("shake", 600); sfx("dice", 600 + 2 * 110 + 1500 - 80);
    } else {
      const CELL = 128;
      moment.outcome.reels.forEach((r, i) => {
        const syms = [...FILL.slice(i, i + 9), r];
        const win = h("div", "m-reel"), strip = h("div", "m-strip", syms.map((k) => `<div class="m-sym">${symSvg(k)}</div>`).join(""));
        win.append(strip); box.append(win);
        appear(win, 450 + i * 60, "translateY(20px)");
        A(strip, [{ transform: "translateY(0)" }, { transform: `translateY(${-(syms.length - 1) * CELL}px)` }], { duration: 1500 + i * 450, delay: 650, easing: "cubic-bezier(.15,.55,.25,1.04)" });
      });
      land = 650 + 1500 + 2 * 450;
      [0, 1, 2].forEach((i) => sfx("reel", 650 + 1500 + i * 450));
      at(land + 60, () => box.querySelectorAll(".m-reel").forEach((r) => r.classList.add("hit")));
    }
    stamp(mult, land + 120, 460);
    at(land + 120, () => shake(stage, 0, 6));
    appear(pay, land + 320, "scale(.8)");
    counter(pay, 0, moment.payout, land + 320, 1300, "+");
    at(land + 350, () => fountain(centre(box), 36, 0));
  } else if (moment.kind === "bigTwo") {
    content.classList.add("m-row");
    const p = who(moment.seat), left = h("div", "m-col m-left"), pl = plate({ ...p, stack: Math.max(0, p.stack - moment.pot) }, { w: 240 });
    left.append(pl, title("Out!"), caption(`${p.name} plays the last cards`));
    const combo = h("div", "m-cards");
    const cards = moment.pile.map((c) => { const e = cardEl(c, 80); combo.append(e); return e; });
    const opp = h("div", "m-opp");
    const rows = moment.others.map((o) => {
      const q = who(o.seat), r = h("div", "m-opprow");
      r.append(plate(q, { av: 28, w: 214, hgt: 38 }), h("div", "m-fanmini", Array.from({ length: Math.min(o.cards, 5) }, () => renderBack(24)).join("")));
      r.querySelector(".stack").textContent = `${o.cards} card${o.cards === 1 ? "" : "s"} left · pays ${fmt(o.pays)}`;
      opp.append(r);
      return r;
    });
    content.append(left, combo, opp);
    appear(pl, 460, "translateX(-40px)");
    left.querySelectorAll(".m-title, .m-caption").forEach((e, k) => appear(e, 1350 + k * 200, "translateY(12px)"));
    cards.forEach((e, i) => A(e, [{ opacity: 0, transform: `translateY(260px) rotate(${(i - 2) * 9}deg)` }, { opacity: 1, transform: "none" }], { duration: 420, delay: 620 + i * 70 }));
    at(620 + (cards.length - 1) * 70 + 420, () => shake(stage, 0, 5));
    cards.forEach((e, i) => snd("cardPlay", 620 + i * 70 + 420));
    rows.forEach((r, k) => appear(r, 560 + k * 90, "translateX(30px)"));
    let n = 0;
    at(2000, () => {
      const to = centre(pl.querySelector(".av"));
      rows.forEach((r) => { const from = centre(r.querySelector(".av")); for (let c = 0; c < 5; c++) arc([500, 100, 2500][n % 3], NORM.momentCoin, from, to, (n++) * NORM.coinGap); });
    });
    const coins = rows.length * 5;
    coinTicks(T0 + 2000 + NORM.coinDur, coins, NORM.coinGap);
    counter(pl.querySelector(".stack"), Math.max(0, p.stack - moment.pot), p.stack, 2000 + NORM.coinDur, Math.max(160, (coins - 1) * NORM.coinGap));
    at(2000 + NORM.coinDur + coins * NORM.coinGap, () => markWinner(pl));
  }

  return () => { alive = false; timers.forEach(clearTimeout); anims.forEach((a) => a.cancel()); veil.remove(); root.replaceChildren(); };
}
