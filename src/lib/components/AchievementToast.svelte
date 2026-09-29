<script>
  // An achievement just unlocked: a toast slides in at the top right (never over a table's seats),
  // a light sweeps across it, it slides out. Site-wide (in +layout.svelte); the queue is the poker
  // client's (S2C achievement messages) plus anything a page pushes (the daily bonus's new badges).
  // The medal is a placeholder until the achievement medals are designed.
  import { poker } from "$lib/poker/client.svelte.js";
  import { reducedMotion } from "$lib/motion.js";
  import { METALS } from "$lib/cosmetics.js";
  import { cueAt } from "$lib/poker/table-audio.js";

  const TIERS = {   // [light, mid, dark] — the coin metals' ramps
    bronze: ["#eda45e", "#c1691f", "#71390c"],
    silver: ["#ffffff", "#c6cdda", "#79808f"],
    gold: ["#ffe485", "#f5b60d", "#8f6503"],
    none: ["#FBF8EF", "#E1D3AD", "#6E685B"]
  };
  const medal = (tier, metalKey) => {
    const mt = metalKey && METALS.find((x) => x.key === metalKey);
    const [l, m, dk] = mt ? [mt.hi, mt.base, mt.lo] : TIERS[tier] || TIERS.none;
    return `<svg viewBox="0 0 60 60" width="44" height="44" aria-hidden="true"><polygon points="30,4 56,30 30,56 4,30" fill="${dk}"/><polygon points="30,4 4,30 30,30" fill="${l}"/><polygon points="30,4 56,30 30,30" fill="${m}"/><polygon points="4,30 30,56 30,30" fill="${m}"/><polygon points="30,15 45,30 30,45 15,30" fill="${dk}" opacity=".35"/></svg>`;
  };

  let current = $state(null);
  let busy = false;
  $effect(() => {
    const q = poker.achievementQueue;
    if (busy || !q.length || poker.replaying > 0) return;   // a replay is on screen: it waits
    busy = true;
    current = q[0];
    cueAt(current.metal ? "ringSet" : "medalClink", performance.now() + 300);   // as it slides in
    poker.achievementQueue = q.slice(1);
    setTimeout(() => { current = null; setTimeout(() => { busy = false; poker.achievementQueue = [...poker.achievementQueue]; }, 420); }, reducedMotion() ? 2600 : 3400);
  });
</script>

{#if current}
  <div class="achv" class:quiet={reducedMotion()} role="status">
    {@html medal(current.tier, current.metal)}
    <div class="txt">
      <div class="k">{current.metal ? "New look" : `Achievement${current.tier ? ` · ${current.tier[0].toUpperCase()}${current.tier.slice(1)}` : ""}`}</div>
      <b>{current.name}</b>
      <div class="sub">{current.desc}{current.reward ? ` · +${current.reward.toLocaleString()} chips` : ""}</div>
    </div>
    <span class="sheen" aria-hidden="true"></span>
  </div>
{/if}

<style>
  .achv {
    position: fixed; right: 18px; top: 70px; z-index: 60; display: flex; align-items: center; gap: 14px;
    padding: 12px 20px 12px 14px; border-radius: 16px; background: var(--surface-2); color: var(--text);
    box-shadow: 0 12px 30px rgba(0, 0, 0, 0.4); overflow: hidden; max-width: min(360px, calc(100vw - 36px));
    animation: achvIn 0.46s cubic-bezier(.3,1.45,.5,1) both, achvOut 0.38s cubic-bezier(.5,0,.75,.2) 3s both;
  }
  .txt { display: flex; flex-direction: column; min-width: 0; }
  .k { font-size: 11px; font-weight: 800; letter-spacing: 1.2px; text-transform: uppercase; color: var(--faint); }
  b { font-family: var(--f-display); font-size: 18px; }
  .sub { color: var(--muted); font-size: 13px; }
  .sheen { position: absolute; top: -20%; left: 0; width: 22%; height: 140%; background: rgba(255,255,255,.35); mix-blend-mode: soft-light; transform: translateX(-140%) skewX(-20deg); animation: sheen 0.7s cubic-bezier(.65,0,.35,1) 0.5s both; pointer-events: none; }
  @keyframes achvIn { from { transform: translateX(120%); } to { transform: none; } }
  @keyframes achvOut { from { transform: none; } to { transform: translateX(120%); } }
  @keyframes sheen { to { transform: translateX(460%) skewX(-20deg); } }
  .achv.quiet, .achv.quiet .sheen { animation: none; }
</style>
