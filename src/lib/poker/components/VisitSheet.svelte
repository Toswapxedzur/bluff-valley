<script>
  // One table visit, opened from the Data page's History or /history (owner, 2026-09-28): a sheet over the page that fills the
  // window except a small margin, with the REAL table replaying the whole visit — game after game —
  // and one play bar whose slider has a marker at every game (VisitPlayer). Esc, ✕ or a click on
  // the margin closes it (the page puts it in the URL, so Back closes it too).
  //   stacking: above the site bar (20), below full-screen moments (40), banners and toasts
  import { onMount, onDestroy } from "svelte";
  import TableStage from "$lib/poker/components/TableStage.svelte";
  import ReplayBar from "$lib/poker/components/ReplayBar.svelte";
  import Chip from "$lib/poker/components/Chip.svelte";
  import { VisitPlayer } from "$lib/poker/visit-player.svelte.js";
  import { variantLabel, gameIcon, SPRINT_ICON } from "$lib/poker/games.js";
  import { soundEnabled, setSoundEnabled } from "$lib/sfx.js";
  import { portal } from "$lib/actions/portal.js";

  // player: whose visit (default me); another player's plays as a watcher saw it, within what they share
  let { visitId, player: owner = null, onClose = () => {} } = $props();

  let player = $state(null), visit = $state(null), error = $state(null);
  let sfxOn = $state(true);
  let closeBtn = $state(null);

  onMount(() => {
    sfxOn = soundEnabled();
    const was = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeBtn?.focus({ preventScroll: true });
    (async () => {
      try {
        const r = await fetch(`/api/history/visit?id=${encodeURIComponent(visitId)}${owner ? `&player=${encodeURIComponent(owner)}` : ""}`);
        if (!r.ok) { error = r.status === 404 ? "This visit isn't in your history any more." : "Couldn't open this visit."; return; }
        visit = await r.json();
        const p = new VisitPlayer(visit);
        player = p;
        p.ensure(0);
        // start once the first game's table is there, so its deal animates
        const start = setInterval(() => { if (p.ready) { clearInterval(start); setTimeout(() => { if (p.i === 0 && p.jump === 0) p.playing = true; }, 600); } }, 120);
        setTimeout(() => clearInterval(start), 15000);
      } catch { error = "Couldn't open this visit."; }
    })();
    return () => { document.body.style.overflow = was; };
  });
  onDestroy(() => player?.stop());
  $effect(() => { if (player) return player.run(); });

  function onKey(e) {
    if (e.key === "Escape") { e.preventDefault(); onClose(); return; }
    player?.key(e);
  }
  function toggleSfx() { sfxOn = !sfxOn; setSoundEnabled(sfxOn); }

  const fmt = (n) => Number(n || 0).toLocaleString("en-US");
  const gameKey = $derived(visit ? (visit.mode === "holdem" ? visit.variant || "holdem" : visit.mode) : null);
  const icon = $derived(visit ? (visit.kind === "sprint" ? SPRINT_ICON : gameIcon(gameKey)) : null);
  const when = $derived(visit ? new Date(visit.startedAt).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "");
  const mins = $derived(visit ? Math.max(1, Math.round((visit.endedAt - visit.startedAt) / 60000)) : 0);
</script>

<svelte:window onkeydown={onKey} />

<!-- moved to <body> (use:portal), so it stacks over the site bar, not under it -->
<div class="visit-layer" use:portal>
<button type="button" class="scrim" aria-label="Close" tabindex="-1" onclick={onClose}></button>
<div class="sheet" role="dialog" aria-modal="true" aria-label={visit ? `Visit to ${visit.tableName}` : "Visit"}>
  <div class="stagebox">
    {#if player}
      {#key player.jump}
        {#if player.view}
          <TableStage view={player.view} me={player.me} privates={player.privates} watchOnly onMotion={(m) => (player.motion = m)} />
        {:else}
          <div class="wait"><p class="muted">{player.missing ? "This game can't be replayed." : "Loading…"}</p></div>
        {/if}
      {/key}
    {:else}
      <div class="wait"><p class="muted">{error || "Loading your visit…"}</p></div>
    {/if}

    <div class="hud">
      {#if icon}<img class="gicon" src={icon} alt="" width="34" height="34" />{/if}
      <div class="title">
        <b>{visit?.tableName || "Your visit"}</b>
        {#if visit}
          <span class="meta">{visit.kind === "sprint" ? "River Sprint" : variantLabel(gameKey)}{visit.kind === "tournament" ? " · tournament" : ""} · {when} · {mins} min · {visit.hands} game{visit.hands === 1 ? "" : "s"}</span>
        {/if}
      </div>
      {#if visit}
        <span class="net" class:pos={visit.net > 0} class:neg={visit.net < 0}>{#if visit.net}<Chip value={Math.abs(visit.net)} size={16} />{/if}{visit.net > 0 ? "+" : ""}{fmt(visit.net)}</span>
      {/if}
      <div class="hud-right">
        <button type="button" class="btn-icon float" class:off={!sfxOn} onclick={toggleSfx} title={sfxOn ? "Mute table sounds" : "Unmute table sounds"} aria-pressed={sfxOn}>{sfxOn ? "🔊" : "🔇"}</button>
        <button type="button" class="btn-icon float close" bind:this={closeBtn} onclick={onClose} title="Close (Esc)" aria-label="Close">✕</button>
      </div>
    </div>

    {#if player}
      <div class="dock"><ReplayBar {player} /></div>
    {/if}
  </div>
</div>
</div>

<style>
  .scrim { position: fixed; inset: 0; z-index: 29; border: 0; padding: 0; background: rgba(4, 8, 18, 0.62); backdrop-filter: blur(3px); -webkit-backdrop-filter: blur(3px); cursor: default; }
  /* the sheet: the whole window but a small margin (owner: "cover almost the full screen except on the edge") */
  .sheet { position: fixed; inset: 16px; z-index: 30; border-radius: 20px; overflow: hidden; background: var(--bg); box-shadow: var(--shadow-panel); }
  @media (max-width: 600px) { .sheet { inset: 12px; border-radius: 16px; } }
  /* the live table page's frame (routes/table/[id]), so the stage sits exactly as it does there */
  .stagebox { position: relative; height: 100%; display: flex; flex-direction: column; overflow: hidden; }
  .wait { flex: 1; display: grid; place-items: center; }
  .hud { position: absolute; top: 0; left: 0; right: 0; z-index: 6; display: flex; align-items: center; gap: 12px; padding: 10px 14px; pointer-events: none; }
  .hud > * { pointer-events: auto; }
  .gicon { display: block; flex: none; }
  .title { display: flex; flex-direction: column; line-height: 1.15; min-width: 0; }
  .title b { font-family: var(--f-display); font-size: 17px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  @media (max-width: 480px) { .title b { font-size: 15px; } .hud { gap: 8px; padding: 10px; } }
  .meta { color: var(--muted); font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .net { display: inline-flex; align-items: center; gap: 5px; font-weight: 800; font-variant-numeric: tabular-nums; padding: 5px 12px; border-radius: 999px; background: var(--surface); box-shadow: var(--shadow-card); }
  .net.pos { color: var(--ok); } .net.neg { color: var(--danger); }
  .hud-right { margin-left: auto; display: flex; gap: 8px; }
  .close { font-size: 14px; font-weight: 700; }
  .dock { flex: 0 0 auto; display: flex; justify-content: center; padding: 8px 14px 14px; }
  .dock > :global(*) { max-width: 760px; }
</style>
