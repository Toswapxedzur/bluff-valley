<script>
  // The table's full-screen moments (moments.js detects them, moment-player.js plays them): the page
  // blurs under a veil and the moment plays in a 1120 × 700 screen scaled to the window. Everybody at
  // the table sees it at the same time; the server holds the next hand for its length.
  import { onMount } from "svelte";
  import { playMoment, W, H } from "$lib/poker/moment-player.js";

  let { moment, view } = $props();
  let host, screen;
  let k = $state(1);

  const fit = () => { k = Math.min(window.innerWidth / W, window.innerHeight / H); };
  onMount(() => {
    fit();
    window.addEventListener("resize", fit);
    const seats = new Map((view?.seats || []).map((s) => [s.seat, s]));
    const stop = playMoment(screen, moment, {
      veilHost: host,
      seat: (no) => { const s = seats.get(no); return s ? { name: s.name, ring: s.ring, badge: s.badge, stack: s.stack } : null; }
    });
    return () => { window.removeEventListener("resize", fit); stop(); };
  });
</script>

<div class="moment-layer" bind:this={host} aria-hidden="true">
  <div class="m-screen" bind:this={screen} style="transform: translate(-50%, -50%) scale({k})"></div>
</div>

<style>
  .moment-layer { position: fixed; inset: 0; z-index: 40; pointer-events: none; }
  .m-screen { position: absolute; left: 50%; top: 50%; width: 1120px; height: 700px; transform-origin: 50% 50%; }
  .moment-layer :global(.m-veil) { position: absolute; inset: 0; background: rgba(6, 10, 22, 0.5); backdrop-filter: blur(9px) saturate(.8); -webkit-backdrop-filter: blur(9px) saturate(.8); }
  .moment-layer :global(.m-stage) { position: absolute; inset: 0; color: #eef2ff; }
  .moment-layer :global(.m-back), .moment-layer :global(.m-fly) { position: absolute; inset: 0; pointer-events: none; overflow: hidden; }
  .moment-layer :global(.m-fly) { z-index: 4; overflow: visible; }
  .moment-layer :global(.m-content) { position: absolute; inset: 40px; display: flex; align-items: center; justify-content: center; gap: 48px; }
  .moment-layer :global(.m-content > *) { flex-shrink: 0; }
  .moment-layer :global(.m-row) { flex-direction: row; }
  .moment-layer :global(.m-colc) { flex-direction: column; gap: 12px; }
  .moment-layer :global(.m-col) { display: flex; flex-direction: column; align-items: center; gap: 10px; }
  .moment-layer :global(.m-left) { align-items: flex-start; }
  .moment-layer :global(.m-title) { font-family: var(--f-display); font-weight: 800; font-size: 60px; line-height: 1; letter-spacing: -0.5px; }
  .moment-layer :global(.m-title.silver) { color: #dfe5ef; } .moment-layer :global(.m-title.gold) { color: #f5c542; }
  .moment-layer :global(.m-caption) { font-size: 17px; font-weight: 600; color: #9db0d6; }
  .moment-layer :global(.m-bignum) { font-family: var(--f-display); font-weight: 800; font-size: 84px; line-height: 1; font-variant-numeric: tabular-nums; letter-spacing: -1px; }
  .moment-layer :global(.money) { color: var(--gold-ink, #f4c94b); }
  .moment-layer :global(.m-mult) { font-family: var(--f-display); font-weight: 800; font-size: 110px; line-height: 0.9; }
  .moment-layer :global(.m-coin), .moment-layer :global(.m-coin-rest) { line-height: 0; }
  .moment-layer :global(.m-coin) { position: absolute; left: 0; top: 0; will-change: transform; }
  .moment-layer :global(.m-pile) { display: flex; gap: 6px; align-items: flex-end; height: 130px; }
  .moment-layer :global(.m-pcol) { position: relative; width: 40px; height: 130px; }
  .moment-layer :global(.m-coin-rest) { position: absolute; left: 0; }
  .moment-layer :global(.m-cards) { position: relative; display: flex; gap: 14px; padding: 6px; overflow: hidden; border-radius: 12px; }
  .moment-layer :global(.m-card) { line-height: 0; }
  .moment-layer :global(.m-card .card-wrap) { filter: drop-shadow(0 2px 4px rgba(0,0,0,.35)); }
  .moment-layer :global(.m-sheen) { position: absolute; top: -20%; left: 0; width: 22%; height: 140%; background: rgba(255,255,255,.42); mix-blend-mode: soft-light; pointer-events: none; }
  .moment-layer :global(.m-plate) { position: relative; display: flex; align-items: center; padding: 4px 12px 4px 6px; border-radius: 999px; box-sizing: border-box; box-shadow: 0 6px 16px rgba(0,0,0,.28); }
  .moment-layer :global(.m-plate.won) { box-shadow: 0 0 0 2px rgba(74,222,128,.7), 0 0 18px rgba(74,222,128,.45); }
  .moment-layer :global(.m-plate .av) { position: relative; flex: none; }
  .moment-layer :global(.m-plate .ring) { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); line-height: 0; }
  .moment-layer :global(.m-plate .face) { position: absolute; inset: 0; border-radius: 50%; display: grid; place-items: center; color: #fff; font-weight: 700; }
  .moment-layer :global(.m-plate .txt) { display: flex; flex-direction: column; min-width: 0; line-height: 1.12; }
  .moment-layer :global(.m-plate .name) { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .moment-layer :global(.m-plate .stack) { font-weight: 800; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .moment-layer :global(.m-spin) { position: relative; display: flex; gap: 14px; align-items: center; justify-content: center; min-width: 420px; height: 300px; }
  .moment-layer :global(.m-wheelbox) { position: relative; width: 300px; height: 300px; }
  .moment-layer :global(.m-wheel) { position: absolute; inset: 0; line-height: 0; }
  .moment-layer :global(.m-arm) { position: absolute; left: 150px; top: 150px; width: 0; height: 0; }
  .moment-layer :global(.m-ball) { position: absolute; left: 0; top: 0; width: 18px; height: 18px; margin-top: -9px; border-radius: 50%; background: #FBF8EF; box-shadow: inset -3px -3px 0 #E1D3AD, 0 2px 4px rgba(0,0,0,.4); }
  .moment-layer :global(.m-pocket) { width: 108px; height: 108px; border-radius: 50%; display: grid; place-items: center; color: #FBF8EF; font-family: var(--f-display); font-weight: 800; font-size: 52px; box-shadow: 0 0 0 6px #FBF8EF, 0 10px 24px rgba(0,0,0,.35); }
  .moment-layer :global(.m-die) { width: 96px; height: 96px; line-height: 0; filter: drop-shadow(0 8px 10px rgba(0,0,0,.3)); }
  .moment-layer :global(.m-die.hit) { filter: drop-shadow(0 0 16px rgba(255,255,255,.9)); }
  .moment-layer :global(.m-reel) { position: relative; width: 120px; height: 128px; border-radius: 18px; background: #FBF8EF; overflow: hidden; box-shadow: inset 0 10px 18px rgba(0,0,0,.18); }
  .moment-layer :global(.m-reel.hit) { box-shadow: 0 0 0 5px #fff, 0 0 30px rgba(255,255,255,.8); }
  .moment-layer :global(.m-strip) { position: absolute; left: 0; top: 0; width: 100%; }
  .moment-layer :global(.m-sym) { height: 128px; display: grid; place-items: center; }
  .moment-layer :global(.m-sym svg) { width: 88px; height: 88px; }
  .moment-layer :global(.m-opp) { display: flex; flex-direction: column; gap: 14px; }
  .moment-layer :global(.m-opprow) { display: flex; align-items: center; gap: 12px; }
  .moment-layer :global(.m-fanmini) { display: flex; line-height: 0; }
  .moment-layer :global(.m-fanmini .card-wrap) { margin-left: -12px; }
</style>
