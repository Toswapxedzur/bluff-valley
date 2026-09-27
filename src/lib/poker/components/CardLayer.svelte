<script>
  // The cards in motion for Blackjack, Three Card Poker, Baccarat and Big Two (card-motion.js has the
  // rules). Every frame it reads the cards the page shows — each hand's slots carry data-slot /
  // data-card inside a [data-cards] container — and compares them with the frame before:
  //   a new card            → flies in face-down from the deck, then turns over where it landed
  //   the same face elsewhere → flies from the old hand to the new one (a Big Two play)
  //   back → face in place  → nothing to do: the hand turns it over itself
  //   a card gone           → flies to the used pile
  // A round that opened with a shuffle (card-motion.js onView → motion.pending): the rest of the deck
  // joins the used pile, the shuffle plays on the canvas here (the full one with the three cuts for a
  // Blackjack / Baccarat shoe, the quick one every round in Three Card / Big Two), and only then are
  // the cards dealt. The table blurs behind it (onShuffling → the page's veil).
  // The real card waits hidden until its flight lands, so it never shows twice. Flights draw on this
  // page-level layer, above everything on the table (the layer stack: "top").
  import { onMount } from "svelte";
  import { renderBack, renderSmall, renderBoard, formFor } from "$lib/poker/composer.js";
  import { CARD, spacing } from "$lib/poker/card-motion.js";
  import { buildRoutine, TIMING, QUICK } from "$lib/poker/deck-routine.js";
  import { drawStack, drawStackShadow, W } from "$lib/poker/deck3d.js";
  import { toImage } from "$lib/poker/card-image.js";

  let { motion, onShuffling = () => {} } = $props();
  let layer, deckEl, usedEl, canvas;
  let usedFace = $state(null);
  let deckAway = $state(false);    // the deck is in the air / inside the shuffle
  let usedEmpty = $state(false);   // the used pile went into the shuffle: gone until a card lands on it
  let shuffleOn = $state(false);   // the shuffle is playing (the pile has left its corner)
  let routine = null;              // { R, t0, k, face, on } while a shuffle is queued or playing
  let dealsFrom = 0;               // no card is dealt before this (the shuffle's end): my own cards come a frame later

  const artOf = (face, w) => (face ? (formFor(w) === 1 ? renderSmall(face, w) : renderBoard(face, w)) : renderBack(w));

  // ---- geometry (layer px) ----
  function spots(cw) {
    const lr = layer.getBoundingClientRect(), hud = document.querySelector(".hud");
    const hudBottom = hud ? hud.getBoundingClientRect().bottom - lr.top : 48;
    const ch = (cw * 78) / 60, y = hudBottom + 6 + ch / 2;
    // the Hold'em dealer's corners: 70% of the card buried past the edge, 30% showing
    return { deck: { x: -0.2 * cw, y }, used: { x: lr.width + 0.2 * cw, y }, lr };
  }
  function scan(lr) {
    const out = new Map(), seen = new Map();
    for (const box of document.querySelectorAll("[data-cards]")) {
      const where = box.dataset.cards;
      for (const el of box.querySelectorAll(".slot[data-slot]")) {
        const r = el.getBoundingClientRect();
        if (!r.width) continue;
        const face = el.dataset.card || null, i = +el.dataset.slot;
        // a face is itself (several decks can repeat one: count them); a back is its place. Keys carry
        // the round: at a new round every card is new (a repeat face in the same hand is still re-dealt)
        const base = `${motion.round}/` + (face ? `${where}:${face}` : `${where}:#${i}`), n = (seen.get(base) || 0) + 1;
        seen.set(base, n);
        out.set(`${base}:${n}`, { el, where, face, i, x: r.left + r.width / 2 - lr.left, y: r.top + r.height / 2 - lr.top, w: r.width });
      }
    }
    return out;
  }

  // ---- flights ----
  // each waiting / flying card's slot element(s) → its flight: hidden until it lands (a hand of backs
  // that turns into my faces while its deal waits hands the hiding on to the new elements)
  const flying = new Map();
  function fly(from, to, w, { face = null, delay = 0, dur = CARD.flight, target = null, flipAfter = false, onLand = null } = {}) {
    const e = document.createElement("div");
    e.className = "fc";
    e.innerHTML = artOf(face, w);
    Object.assign(e.style, { left: from.x - w / 2 + "px", top: from.y - (w * 78) / 60 / 2 + "px", opacity: "0" });
    layer.appendChild(e);
    const rec = { els: [], flipAfter };
    if (target) { target.dataset.inFlight = ""; rec.els.push(target); flying.set(target, rec); }
    const lift = w * CARD.arc, kf = [];
    for (let i = 0; i <= 10; i++) {
      const t = i / 10;
      kf.push({ transform: `translate(${((to.x - from.x) * t).toFixed(1)}px, ${((to.y - from.y) * t - lift * 4 * t * (1 - t)).toFixed(1)}px) rotate(${(-8 * (1 - t)).toFixed(1)}deg)`, opacity: 1, offset: t });
    }
    // (not shown while it waits its turn: it sits at opacity 0 until its flight starts)
    e.animate(kf, { duration: dur, delay, easing: "cubic-bezier(.3,.7,.3,1)", fill: "forwards" }).finished.catch(() => {}).finally(() => {
      e.remove();
      for (const el of rec.els) {
        if (rec.flipAfter) {
          // it arrived face-down: show the back for a beat, then let the hand turn it over
          const f = el.querySelector(".flip");
          if (f) { f.style.transition = "none"; f.style.transform = "none"; void f.offsetWidth; requestAnimationFrame(() => { f.style.transition = ""; f.style.transform = ""; }); }
        }
        delete el.dataset.inFlight;
        flying.delete(el);
      }
      onLand?.();
    });
    return performance.now() + delay + dur;
  }
  const cue = (t, name) => motion.cues.push({ t, name });

  // ---- the watcher ----
  let prev = null;
  function frame() {
    if (!layer) return;
    const { lr } = spots(60);
    const cur = scan(lr);
    if (prev) diff(prev, cur);
    prev = cur;
    // a shuffle with nothing on the table to collect (the first round after joining): play it now
    if (motion.pending) shuffleAfter(performance.now(), spots(cur.values().next().value?.w || 60), cur.values().next().value?.w || 60);
    drawShuffle(performance.now());
    // the corner piles take the table's card size
    const any = cur.values().next().value;
    const cw = any?.w || 60, sp = spots(cw);
    place(deckEl, sp.deck, cw); place(usedEl, sp.used, cw);
  }
  function place(el, p, cw) {
    if (!el) return;
    const w = Math.round(cw);
    if (el.dataset.w !== String(w)) { el.dataset.w = w; el.style.setProperty("--w", w + "px"); }
    el.style.transform = `translate(${(p.x - cw / 2).toFixed(1)}px, ${(p.y - (cw * 78) / 60 / 2).toFixed(1)}px)`;
  }
  function diff(a, b) {
    // the same card re-rendered as a new element while its flight is still coming: the new one waits hidden too
    for (const [k, v] of b) {
      const old = a.get(k), rec = old && old.el !== v.el ? flying.get(old.el) : null;
      if (rec && !flying.has(v.el)) { v.el.dataset.inFlight = ""; rec.els.push(v.el); flying.set(v.el, rec); }
    }
    const added = [...b.entries()].filter(([k]) => !a.has(k)).map(([k, v]) => ({ k, ...v }));
    const gone = [...a.entries()].filter(([k]) => !b.has(k)).map(([k, v]) => ({ k, ...v }));
    if (!added.length && !gone.length) return;
    const sp = spots(added[0]?.w || gone[0]?.w || 60);
    const usedGone = new Set();
    const deals = [], moves = [];
    for (const n of added) {
      if (flying.has(n.el)) continue;
      // turned over in place (a back at the same place became this face): the hand flips it itself
      const flipped = n.face && gone.find((g) => !g.face && g.where === n.where && g.i === n.i && !usedGone.has(g));
      if (flipped) {
        usedGone.add(flipped);
        // its back is still on the way (or waiting for the shuffle): the face stays hidden until it lands, then turns
        const rec = flying.get(flipped.el);
        if (rec && flipped.el !== n.el) { n.el.dataset.inFlight = ""; rec.els.push(n.el); rec.flipAfter = true; flying.set(n.el, rec); }
        continue;
      }
      // the same face somewhere else a moment ago: it moved there
      // (never out of the pile: played cards only leave it for the used pile)
      const from = n.face && gone.find((g) => g.face === n.face && g.where !== n.where && g.where !== "pile" && !usedGone.has(g));
      if (from) { usedGone.add(from); moves.push({ n, from }); continue; }
      deals.push(n);
    }
    // a play from a hand of backs (someone else's Big Two hand): the new faces leave from their backs
    for (const n of [...deals]) {
      if (n.where !== "pile") continue;
      const from = gone.find((g) => !g.face && g.where !== n.where && !usedGone.has(g));
      if (from) { usedGone.add(from); moves.push({ n, from }); deals.splice(deals.indexOf(n), 1); }
    }
    // what left: to the used pile
    const rest = gone.filter((g) => !usedGone.has(g));
    const cgap = spacing(rest.length, 30, CARD.collectSpan);
    let collected = performance.now();
    rest.forEach((g, j) => {
      const land = fly(g, sp.used, g.w, { face: g.face, delay: j * cgap, dur: CARD.collect, onLand: () => { if (g.face) usedFace = g.face; usedEmpty = false; } });
      collected = Math.max(collected, land);
      if (j === 0) cue(land, "pileTap");
    });
    // a round that opens with a shuffle: it plays once the table is collected; the deal waits for it
    if (motion.pending) shuffleAfter(collected, sp, added[0]?.w || gone[0]?.w || 60);
    const wait = Math.max(0, dealsFrom - performance.now());
    // opt-in log for testing (set window.__bvCardLog = [] in the console)
    if (window.__bvCardLog) window.__bvCardLog.push({ t: Math.round(performance.now()), round: motion.round, added: added.length, gone: gone.length,
      deals: deals.length, moves: moves.length, skipped: added.length - deals.length - moves.length, collect: rest.length, wait: Math.round(wait) });
    // moves: face-up, together, from the old spot
    moves.forEach(({ n, from }, j) => {
      const land = fly(from, n, n.w, { face: n.face, delay: j * 60, dur: CARD.move, target: n.el });
      if (j === 0) cue(land, "cardPlay");
    });
    // deals: face-down from the deck, round by round (slot 0 to everyone, then slot 1 …), the House last
    deals.sort((x, y) => x.i - y.i || (x.where === "house") - (y.where === "house"));
    const gap = spacing(deals.length);
    deals.forEach((n, j) => {
      const land = fly(sp.deck, n, n.w, { delay: wait + j * gap, target: n.el, flipAfter: !!n.face });
      cue(land, "cardLand");
      if (n.face) cue(land + 60, "flip");
    });
  }

  // ---- the shuffle ----
  /** The rest of the deck turns over onto the used pile, then (after `t`, the collection) the pile is
   *  shuffled into a new deck. Returns when the deck is back in its corner: the deal starts then. */
  function shuffleAfter(t, sp, cw) {
    const { full } = motion.pending;
    motion.pending = null;
    deckAway = true;
    const packet = fly(sp.deck, sp.used, cw, { dur: CARD.collect + 180, onLand: () => { usedEmpty = false; } });
    cue(packet, "pileTap");
    const k = cw / W, at = (p) => ({ fx: p.x / k, fy: p.y / k });
    const R = buildRoutine({ start: at(sp.used), end: at(sp.deck), centre: { fx: sp.lr.width / 2 / k, fy: sp.lr.height / 2 / k },
      seed: Math.floor(Math.random() * 1e9), timing: full ? TIMING : QUICK });
    const t0 = Math.max(t, packet) + 60;
    routine = { R, t0, k, face: usedFace, on: false };
    dealsFrom = t0 + R.duration;
    const ph = R.phases.find((p) => p.name === "shuffle");
    motion.cues.push({ t: t0 + ph.t0, name: "riffle", dur: ph.t1 - ph.t0 });
  }
  let backImg = null;
  const faceImgs = new Map();
  function faceImg(card) {
    if (!card) return null;
    if (!faceImgs.has(card)) { faceImgs.set(card, null); toImage(renderBoard(card, 60, { edge: false })).then((img) => faceImgs.set(card, img)).catch(() => {}); }
    return faceImgs.get(card);
  }
  function drawShuffle(now) {
    if (!canvas) return;
    const ctx = canvas.getContext("2d"), r = routine;
    const e = r ? now - r.t0 : -1;
    if (r && e >= r.R.duration) {             // the new deck is in its corner
      routine = null; deckAway = false; usedEmpty = true; usedFace = null;
      if (r.on) { shuffleOn = false; onShuffling(false); }
    }
    if (!routine || e < 0) { if (canvas.width) canvas.width = 0; return; }
    if (!r.on) { r.on = true; shuffleOn = true; onShuffling(true); }
    const lr = layer.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
    const wpx = Math.round(lr.width * dpr), hpx = Math.round(lr.height * dpr);
    if (canvas.width !== wpx || canvas.height !== hpx) { canvas.width = wpx; canvas.height = hpx; }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, wpx, hpx);
    if (!backImg) return;
    ctx.setTransform(dpr * r.k, 0, 0, dpr * r.k, 0, 0);
    const art = { back: backImg, face: faceImg(r.face) };
    const stacks = r.R.frameAt(e).stacks;
    for (const st of stacks) drawStackShadow(ctx, st);   // every shadow on the table first
    for (const st of stacks) drawStack(ctx, st, art);
  }

  onMount(() => {
    let raf = 0, alive = true;
    const loop = () => { if (!alive) return; frame(); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    toImage(renderBack(60, { edge: false })).then((img) => { backImg = img; }).catch(() => {});
    return () => { alive = false; cancelAnimationFrame(raf); if (routine?.on) onShuffling(false); };
  });
</script>

<div class="card-layer" bind:this={layer} aria-hidden="true">
  <canvas class="shuffle" bind:this={canvas}></canvas>
  <div class="pile deck" class:away={deckAway} bind:this={deckEl}>{@html renderBack(60)}{@html renderBack(60)}{@html renderBack(60)}</div>
  <div class="pile used" class:away={usedEmpty || shuffleOn} bind:this={usedEl}>{@html usedFace ? artOf(usedFace, 60) : renderBack(60)}</div>
</div>

<style>
  .card-layer { position: absolute; inset: 0; z-index: 5; pointer-events: none; overflow: hidden; }
  .card-layer :global(.fc) { position: absolute; line-height: 0; will-change: transform; }
  .pile { position: absolute; left: 0; top: 0; line-height: 0; }
  .pile.away { visibility: hidden; }
  /* a card whose flight hasn't landed yet (a data attribute: the hands re-set their own style / class) */
  :global([data-in-flight]) { visibility: hidden !important; }
  .shuffle { position: absolute; inset: 0; width: 100%; height: 100%; }
  .pile :global(.card-wrap) { position: absolute; left: 0; top: 0; }
  .pile :global(.card-wrap svg) { width: var(--w, 60px); height: auto; }
  .pile.deck :global(.card-wrap:nth-child(2)) { transform: translate(2px, -2px); }
  .pile.deck :global(.card-wrap:nth-child(3)) { transform: translate(4px, -4px); }
</style>
