<script>
  // The cards in motion for Blackjack, Three Card Poker, Baccarat and Big Two (card-motion.js has the
  // rules). Every frame it reads the cards the page shows — each hand's slots carry data-slot /
  // data-card inside a [data-cards] container — and compares them with the frame before:
  //   a new card            → flies in face-down from the deck, then turns over where it landed
  //   the same face elsewhere → flies from the old hand to the new one (a Big Two play)
  //   back → face in place  → nothing to do: the hand turns it over itself
  //   a card gone           → flies to the used pile
  // The real card waits hidden until its flight lands, so it never shows twice. Flights draw on this
  // page-level layer, above everything on the table (the layer stack: "top").
  import { onMount } from "svelte";
  import { renderBack, renderSmall, renderBoard, formFor } from "$lib/poker/composer.js";
  import { CARD, spacing } from "$lib/poker/card-motion.js";

  let { motion } = $props();
  let layer, deckEl, usedEl;
  let usedFace = $state(null);

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
        // a face is itself (several decks can repeat one: count them); a back is its place
        const base = face ? `${where}:${face}` : `${where}:#${i}`, n = (seen.get(base) || 0) + 1;
        seen.set(base, n);
        out.set(`${base}:${n}`, { el, where, face, i, x: r.left + r.width / 2 - lr.left, y: r.top + r.height / 2 - lr.top, w: r.width });
      }
    }
    return out;
  }

  // ---- flights ----
  const flying = new Set();
  function fly(from, to, w, { face = null, delay = 0, dur = CARD.flight, target = null, flipAfter = false, onLand = null } = {}) {
    const e = document.createElement("div");
    e.className = "fc";
    e.innerHTML = artOf(face, w);
    Object.assign(e.style, { left: from.x - w / 2 + "px", top: from.y - (w * 78) / 60 / 2 + "px", opacity: "0" });
    layer.appendChild(e);
    if (target) { target.style.visibility = "hidden"; flying.add(target); }
    const lift = w * CARD.arc, kf = [];
    for (let i = 0; i <= 10; i++) {
      const t = i / 10;
      kf.push({ transform: `translate(${((to.x - from.x) * t).toFixed(1)}px, ${((to.y - from.y) * t - lift * 4 * t * (1 - t)).toFixed(1)}px) rotate(${(-8 * (1 - t)).toFixed(1)}deg)`, opacity: 1, offset: t });
    }
    e.animate(kf, { duration: dur, delay, easing: "cubic-bezier(.3,.7,.3,1)", fill: "both" }).finished.catch(() => {}).finally(() => {
      e.remove();
      if (target) {
        if (flipAfter) {
          // it arrived face-down: show the back for a beat, then let the hand turn it over
          const f = target.querySelector(".flip");
          if (f) { f.style.transition = "none"; f.style.transform = "none"; void f.offsetWidth; requestAnimationFrame(() => { f.style.transition = ""; f.style.transform = ""; }); }
        }
        target.style.visibility = "";
        flying.delete(target);
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
      if (flipped) { usedGone.add(flipped); continue; }
      // the same face somewhere else a moment ago: it moved there
      const from = n.face && gone.find((g) => g.face === n.face && g.where !== n.where && !usedGone.has(g));
      if (from) { usedGone.add(from); moves.push({ n, from }); continue; }
      deals.push(n);
    }
    // a play from a hand of backs (someone else's Big Two hand): the new faces leave from their backs
    for (const n of [...deals]) {
      if (n.where !== "pile") continue;
      const from = gone.find((g) => !g.face && g.where !== n.where && !usedGone.has(g));
      if (from) { usedGone.add(from); moves.push({ n, from }); deals.splice(deals.indexOf(n), 1); }
    }
    // moves: face-up, together, from the old spot
    moves.forEach(({ n, from }, j) => {
      const land = fly(from, n, n.w, { face: n.face, delay: j * 60, dur: CARD.move, target: n.el });
      if (j === 0) cue(land, "cardPlay");
    });
    // deals: face-down from the deck, round by round (slot 0 to everyone, then slot 1 …), the House last
    deals.sort((x, y) => x.i - y.i || (x.where === "house") - (y.where === "house"));
    const gap = spacing(deals.length);
    deals.forEach((n, j) => {
      const land = fly(sp.deck, n, n.w, { delay: j * gap, target: n.el, flipAfter: !!n.face });
      cue(land, "cardLand");
      if (n.face) cue(land + 60, "flip");
    });
    // what left: to the used pile
    const rest = gone.filter((g) => !usedGone.has(g));
    const cgap = spacing(rest.length, 30, CARD.collectSpan);
    rest.forEach((g, j) => {
      const land = fly(g, sp.used, g.w, { face: g.face, delay: j * cgap, dur: CARD.collect, onLand: () => { if (g.face) usedFace = g.face; } });
      if (j === 0) cue(land, "pileTap");
    });
  }

  onMount(() => {
    let raf = 0, alive = true;
    const loop = () => { if (!alive) return; frame(); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    return () => { alive = false; cancelAnimationFrame(raf); };
  });
</script>

<div class="card-layer" bind:this={layer} aria-hidden="true">
  <div class="pile deck" bind:this={deckEl}>{@html renderBack(60)}{@html renderBack(60)}{@html renderBack(60)}</div>
  <div class="pile used" bind:this={usedEl}>{@html usedFace ? artOf(usedFace, 60) : renderBack(60)}</div>
</div>

<style>
  .card-layer { position: absolute; inset: 0; z-index: 5; pointer-events: none; overflow: hidden; }
  .card-layer :global(.fc) { position: absolute; line-height: 0; will-change: transform; }
  .pile { position: absolute; left: 0; top: 0; line-height: 0; }
  .pile :global(.card-wrap) { position: absolute; left: 0; top: 0; }
  .pile :global(.card-wrap svg) { width: var(--w, 60px); height: auto; }
  .pile.deck :global(.card-wrap:nth-child(2)) { transform: translate(2px, -2px); }
  .pile.deck :global(.card-wrap:nth-child(3)) { transform: translate(4px, -4px); }
</style>
