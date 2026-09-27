<script>
  // D / SB / BB glide to their new seats when a hand starts, instead of jumping (the badges sit in
  // each plate's name row). Before the page updates we note where every marker is; after it, each one
  // that moved flies from its old spot to its new one through the table's inside, while the real
  // marker waits hidden. Page-level overlay, like the MoneyLayer (layer px, measured every time).
  import { untrack } from "svelte";
  import { reducedMotion } from "$lib/motion.js";

  let { view } = $props();
  let layer;
  const ROLES = [["D", "b-d"], ["SB", "b-sb"], ["BB", "b-bb"]];
  const GLIDE = 720;

  const roleSeats = (v) => {
    const m = {};
    for (const s of v?.seats || []) { if (s.isButton) m.D = s.seat; if (s.isSB) m.SB = s.seat; if (s.isBB) m.BB = s.seat; }
    return m;
  };
  function markerAt(seat, cls) {
    const el = document.querySelector(`[data-seat="${seat}"] .badge.${cls}`);
    if (!el || !layer) return null;
    const r = el.getBoundingClientRect(), lr = layer.getBoundingClientRect();
    return { el, x: r.left + r.width / 2 - lr.left, y: r.top + r.height / 2 - lr.top, w: r.width, h: r.height };
  }
  function centreOf() {
    const a = document.querySelector(".arena");
    if (!a || !layer) return null;
    const r = a.getBoundingClientRect(), lr = layer.getBoundingClientRect();
    return { x: r.left + r.width / 2 - lr.left, y: r.top + r.height / 2 - lr.top };
  }

  // where each marker was on the last frame (so the new hand's page can be compared with it)
  let seen = {}, beforeRoles = {}, lastHand = null, gliding = 0;
  $effect(() => {
    let raf = 0, alive = true;
    const loop = () => {
      if (!alive) return;
      if (!gliding) for (const [role, cls] of ROLES) seen[role] = beforeRoles[role] != null ? markerAt(beforeRoles[role], cls) : null;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { alive = false; cancelAnimationFrame(raf); };
  });
  $effect(() => {
    const v = view;
    untrack(() => {
      if (!v) return;
      const roles = roleSeats(v), newHand = v.handNo !== lastHand;
      const was = beforeRoles;
      beforeRoles = roles; lastHand = v.handNo;
      const before = seen;
      if (!newHand || reducedMotion() || !layer) return;
      const c = centreOf();
      for (const [role, cls] of ROLES) {
        const from = before[role], seat = roles[role];
        if (!from || seat == null || was[role] === seat) continue;
        const to = markerAt(seat, cls);
        if (!to) continue;
        to.el.style.visibility = "hidden";
        gliding += 1;
        const tok = document.createElement("span");
        tok.className = `tok badge ${cls}`;
        tok.textContent = role;
        Object.assign(tok.style, { width: to.w + "px", height: to.h + "px", left: from.x - to.w / 2 + "px", top: from.y - to.h / 2 + "px", fontSize: to.h * 0.62 + "px" });
        layer.appendChild(tok);
        const kf = [];
        for (let i = 0; i <= 10; i++) {
          const t = i / 10, x = from.x + (to.x - from.x) * t, y = from.y + (to.y - from.y) * t;
          const pull = c ? 0.22 * 4 * t * (1 - t) : 0;            // curve through the table's inside
          kf.push({ transform: `translate(${(x + ((c?.x ?? x) - x) * pull - from.x).toFixed(1)}px, ${(y + ((c?.y ?? y) - y) * pull - from.y).toFixed(1)}px)`, offset: t });
        }
        tok.animate(kf, { duration: GLIDE, easing: "cubic-bezier(.65,0,.35,1)" }).finished
          .catch(() => {})
          .finally(() => { tok.remove(); to.el.style.visibility = ""; gliding -= 1; });
      }
    });
  });
</script>

<div class="glide-layer" bind:this={layer} aria-hidden="true"></div>

<style>
  .glide-layer { position: absolute; inset: 0; z-index: 5; pointer-events: none; overflow: hidden; }
  .glide-layer :global(.tok) {
    position: absolute; display: grid; place-items: center; box-sizing: border-box;
    font-weight: 800; line-height: 1; border-radius: 4px; color: #12202e;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.35);
  }
  .glide-layer :global(.tok.b-d) { background: #f3f6fb; }
  .glide-layer :global(.tok.b-sb) { background: #a9dcef; }
  .glide-layer :global(.tok.b-bb) { background: #e7c14b; }
</style>
