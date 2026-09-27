<script>
  // The banner moments, site-wide (banner-player.js plays them; the server sends them — S2C.MOMENT):
  // River Sprint's calls (go, a knockout, the champion) and your personal news (a metal unlocked).
  // One at a time. A new look while you're at a table waits as a small toast instead — nobody at the
  // table waits for your news; the full banner is for off the table.
  import { onDestroy } from "svelte";
  import { page } from "$app/stores";
  import { poker } from "$lib/poker/client.svelte.js";
  import { playBanner } from "$lib/poker/banner-player.js";
  import { reducedMotion } from "$lib/motion.js";

  let { me = null } = $props();
  let host;
  let playing = null;

  async function wear(key) {
    for (const slot of ["ring", "badge"]) {
      const fd = new FormData(); fd.set("slot", slot); fd.set("look", key);
      try { await fetch("/cosmetics?/equip", { method: "POST", body: fd, headers: { "x-sveltekit-action": "true" } }); } catch { /* the page shows it next time */ }
    }
  }

  $effect(() => {
    const q = poker.proclamationQueue;
    if (playing || !q.length || !host) return;
    const [next, ...rest] = q;
    poker.proclamationQueue = rest;
    if (next.kind === "newLook" && ($page.url.pathname.startsWith("/table/") || reducedMotion())) {
      poker.achievementQueue = [...poker.achievementQueue, { key: next.key, name: `${next.name} unlocked`, desc: "A new ring and plate — see Cosmetics", metal: next.key }];
      return;
    }
    if (reducedMotion()) return;
    playing = playBanner(host, next, { me: { name: me?.displayName || me?.email || "You", ring: poker.me?.ring || "default", badge: poker.me?.badge || "default", banner: poker.me?.banner ?? null }, onWear: wear });
    playing.done.then(() => { playing = null; host?.replaceChildren(); poker.proclamationQueue = [...poker.proclamationQueue]; });
  });
  onDestroy(() => playing?.stop());
</script>

<div class="proclaim" bind:this={host}></div>

<style>
  .proclaim { position: fixed; inset: 0; z-index: 55; pointer-events: none; }
  .proclaim :global(.b-veil) { position: absolute; inset: 0; background: rgba(6, 10, 22, 0.62); backdrop-filter: blur(3px); -webkit-backdrop-filter: blur(3px); }
  .proclaim :global(.b-veil.light) { background: rgba(6, 10, 22, 0.42); }
  .proclaim :global(.b-band) { position: absolute; left: 0; right: 0; top: 50%; overflow: hidden; box-shadow: 0 30px 80px rgba(0,0,0,.45); }
  .proclaim :global(.b-inner) { position: absolute; left: 50%; top: 50%; transform-origin: 50% 50%; }
  .proclaim :global(.b-kicker) { position: absolute; left: 30px; top: 20px; display: flex; align-items: center; gap: 10px; font-size: 13px; font-weight: 800; letter-spacing: 1.2px; text-transform: uppercase; color: var(--sub); }
  .proclaim :global(.b-bar) { position: absolute; left: 30px; right: 30px; bottom: 18px; display: flex; align-items: center; gap: 12px; }
  .proclaim :global(.b-bar .lbl) { font-size: 11px; font-weight: 800; letter-spacing: 1.2px; text-transform: uppercase; color: var(--sub); opacity: .8; }
  .proclaim :global(.b-bar .track) { flex: 1; height: 8px; border-radius: 8px; background: color-mix(in srgb, var(--ink) 14%, transparent); overflow: hidden; }
  .proclaim :global(.b-bar .fill) { display: block; height: 100%; border-radius: 8px; background: color-mix(in srgb, var(--ink) 55%, transparent); transform-origin: left center; }
  .proclaim :global(.b-back) { position: absolute; inset: 0; pointer-events: none; overflow: hidden; }
  .proclaim :global(.b-coin) { position: absolute; left: 0; top: 0; line-height: 0; }
  .proclaim :global(.b-content) { position: absolute; inset: 56px 30px 44px; display: flex; align-items: center; justify-content: center; gap: 48px; }
  .proclaim :global(.b-content.low) { align-items: flex-end; padding-bottom: 22px; }
  .proclaim :global(.b-content > *) { flex-shrink: 0; }
  .proclaim :global(.b-mid) { display: flex; flex-direction: column; gap: 12px; align-items: flex-start; max-width: 460px; }
  .proclaim :global(.b-mid.wide) { max-width: 580px; }
  .proclaim :global(.b-title) { font-family: var(--f-display); font-weight: 800; font-size: 56px; line-height: 1; letter-spacing: -0.5px; }
  .proclaim :global(.b-caption) { font-size: 17px; font-weight: 600; color: var(--sub); }
  .proclaim :global(.b-icon) { line-height: 0; }
  .proclaim :global(.b-count) { width: 170px; height: 170px; display: grid; place-items: center; font-family: var(--f-display); font-weight: 800; font-size: 130px; line-height: 1; }
  .proclaim :global(.b-count .go) { font-size: 96px; }
  .proclaim :global(.b-plate) { position: relative; display: flex; align-items: center; padding: 4px 12px 4px 6px; border-radius: 999px; box-sizing: border-box; box-shadow: 0 6px 16px rgba(0,0,0,.28); }
  .proclaim :global(.b-plate > .av), .proclaim :global(.b-plate > .txt) { position: relative; z-index: 1; }
  .proclaim :global(.b-plate .ring) { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); line-height: 0; }
  .proclaim :global(.b-plate .face) { position: absolute; inset: 0; border-radius: 50%; display: grid; place-items: center; color: #fff; font-weight: 700; }
  .proclaim :global(.b-plate .name) { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .proclaim :global(.b-old) { position: absolute; inset: 0; border-radius: inherit; z-index: 0; }
  .proclaim :global(.b-newring) { position: absolute; line-height: 0; z-index: 4; filter: drop-shadow(0 10px 14px rgba(0,0,0,.3)); }
  .proclaim :global(.b-btns) { display: flex; gap: 10px; margin-top: 6px; pointer-events: auto; }
  .proclaim :global(.b-btns button) { font: inherit; border: 0; cursor: pointer; padding: 11px 20px; border-radius: 12px; font-weight: 800; font-size: 15px; }
  .proclaim :global(.b-btns .wear) { background: var(--ink); color: var(--on-ink); }
  .proclaim :global(.b-btns .later) { background: color-mix(in srgb, var(--ink) 14%, transparent); color: var(--ink); }
</style>
