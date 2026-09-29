<script>
  // A recorded match, replayed ON THE REAL TABLE (owner, 2026-09-28): the shared TableStage draws the
  // views the server rebuilt from the recording, so every animation plays — the deal, card flips,
  // bets → pot → winner, all-in, glides, moments — and the table's sounds. The play bar sits where the
  // action bar does at a live table.
  //   step forward (▶, play) → the next view: animated
  //   back / start / end / scrub → a JUMP: the stage re-mounts on that view, nothing animates
  //   speed (1× 2× 4×) → only the pause between steps; animations keep their one shared timing
  import { onMount, onDestroy } from "svelte";
  import Icon from "$lib/components/Icon.svelte";
  import TableStage from "$lib/poker/components/TableStage.svelte";
  import ReplayTag from "$lib/poker/components/ReplayTag.svelte";
  import ReplayBar from "$lib/poker/components/ReplayBar.svelte";
  import Chip from "$lib/poker/components/Chip.svelte";
  import { ReplayPlayer } from "$lib/poker/replay-player.svelte.js";
  import { SITE_NAME } from "$lib/config.js";
  import { variantLabel, gameIcon } from "$lib/poker/games.js";
  import { soundEnabled, setSoundEnabled } from "$lib/sfx.js";
  import { untrack } from "svelte";

  let { data } = $props();
  const player = new ReplayPlayer(untrack(() => data));
  const steps = player.steps;
  const me = untrack(() => data.viewerId) ? { id: untrack(() => data.viewerId) } : null;
  const gameKey = untrack(() => (data.mode === "holdem" ? data.variant || "holdem" : data.mode));
  $effect(() => player.run());

  let sfxOn = $state(true);
  onMount(() => {
    sfxOn = soundEnabled();
    // start playing once the table is up, so the deal itself animates
    if (steps.length > 1) setTimeout(() => { if (player.i === 0 && player.jump === 0) player.playing = true; }, 700);
  });
  onDestroy(() => player.stop());
  function toggleSfx() { sfxOn = !sfxOn; setSoundEnabled(sfxOn); }

  const fmt = (n) => Number(n || 0).toLocaleString("en-US");
  const when = new Date(data.startedAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  const title = `${data.tableName || variantLabel(gameKey)}${data.handNo ? ` · hand ${data.handNo}` : ""}`;
  let listEl = $state(null);
  $effect(() => { void player.i; listEl?.querySelector(".on")?.scrollIntoView({ block: "nearest" }); });
</script>

<svelte:head><title>Replay · {title} — {SITE_NAME}</title></svelte:head>
<svelte:window onkeydown={(e) => player.key(e)} />

<div class="tablepage">
  {#if steps.length}
    {#key player.jump}
      <TableStage view={player.view} {me} privates={player.privates} watchOnly onMotion={(m) => (player.motion = m)} />
    {/key}
  {/if}

  <div class="hud">
    <a href="/history" class="btn-icon float back" aria-label="Back to your history" title="History">‹</a>
    {#if gameIcon(gameKey)}<img class="gicon" src={gameIcon(gameKey)} alt="" width="34" height="34" />{/if}
    <ReplayTag />
    <div class="title">
      <b>{title}</b>
      <span class="stakes">{variantLabel(gameKey)} · {when}{#if data.archived} · from the archive{/if}</span>
    </div>
    <div class="hud-right">
      <button type="button" class="btn-icon float" class:off={!sfxOn} onclick={toggleSfx} title={sfxOn ? "Mute table sounds" : "Unmute table sounds"} aria-pressed={sfxOn}><Icon name={sfxOn ? "sound-on" : "sound-off"} /></button>
    </div>
  </div>

  {#if !steps.length}
    <div class="summary">
      {#if data.archiveOffline}
        <p class="muted">This match is in the home archive, which is offline right now. Here's how it ended.</p>
      {:else}
        <p class="muted">This match can't be replayed step by step. Here's how it ended.</p>
      {/if}
      <ul class="nets">
        {#each data.players as p (p.seat)}<li><span>{p.name || `Seat ${p.seat}`}</span><b class:pos={p.net > 0} class:neg={p.net < 0}>{p.net > 0 ? "+" : ""}{fmt(p.net)}</b></li>{/each}
      </ul>
    </div>
  {/if}

  <!-- the dock, as at a live table: the steps | the play bar | who played -->
  {#if steps.length}
    <div class="dock">
      <div class="dock-steps card" bind:this={listEl} aria-label="Steps">
        {#each steps as st, n (n)}
          <button type="button" class="stp" class:on={n === player.i} class:done={n < player.i} onclick={() => player.jumpTo(n)}>
            <span class="no">{n + 1}</span><span class="tx">{st.text}</span>
          </button>
        {/each}
      </div>

      <div class="dock-actions">
        <ReplayBar {player} />
      </div>

      <div class="dock-side">
        <ul class="nets">
          {#each data.players as p (p.seat)}
            <li>
              <a href={p.userId ? `/u/${p.userId}` : undefined}>{p.name || `Seat ${p.seat}`}</a>{#if p.role === "banker"}<span class="muted small"> · house</span>{/if}
              <b class:pos={p.net > 0} class:neg={p.net < 0}>{#if p.net}<Chip value={Math.abs(p.net)} size={13} />{/if}{p.net > 0 ? "+" : ""}{fmt(p.net)}</b>
            </li>
          {/each}
        </ul>
      </div>
    </div>
  {/if}
</div>

<style>
  /* the live table page's frame (routes/table/[id]), so the stage sits exactly as it does there */
  .tablepage { position: relative; display: flex; flex-direction: column; height: 100vh; height: 100dvh; overflow: hidden; }
  .hud { position: absolute; top: 0; left: 0; right: 0; z-index: 6; display: flex; align-items: center; gap: 12px; padding: 10px 14px; pointer-events: none; }
  .hud > * { pointer-events: auto; }
  .back { font-size: 22px; text-decoration: none; }
  .gicon { display: block; flex: none; }
  .title { display: flex; flex-direction: column; line-height: 1.15; }
  .title b { font-family: var(--f-display); font-size: 17px; }
  .stakes { color: var(--muted); font-size: 12px; }
  .hud-right { margin-left: auto; display: flex; align-items: center; gap: 8px; }

  .summary { flex: 1; display: grid; place-content: center; gap: 14px; padding: 80px 16px; text-align: center; }

  .dock { flex: 0 0 auto; display: grid; grid-template-columns: minmax(240px, 1fr) minmax(360px, 2fr) minmax(240px, 1fr); gap: 12px; align-items: stretch; padding: 8px 14px 14px; height: 236px; }
  .dock-steps { margin: 0; padding: 6px; overflow-y: auto; display: flex; flex-direction: column; gap: 2px; min-width: 0; }
  .stp { display: flex; gap: 8px; align-items: baseline; text-align: left; border: 0; background: transparent; color: var(--muted); font: inherit; font-size: 12.5px; padding: 5px 8px; border-radius: 8px; cursor: pointer; }
  .stp:hover { background: var(--surface-2); color: var(--text); }
  .stp.done { color: var(--text); }
  .stp.on { background: var(--accent-soft); color: var(--text); font-weight: 700; }
  .stp .no { min-width: 1.8em; font-variant-numeric: tabular-nums; opacity: 0.7; }
  .stp .tx { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

  .dock-actions { display: flex; align-items: center; justify-content: center; min-width: 0; }

  .dock-side { display: flex; flex-direction: column; justify-content: center; min-width: 0; }
  .nets { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; font-size: 13.5px; }
  .nets li { display: flex; align-items: center; gap: 6px; }
  .nets a { color: var(--text); text-decoration: none; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .nets b { margin-left: auto; display: inline-flex; align-items: center; gap: 4px; font-variant-numeric: tabular-nums; }
  .pos { color: var(--ok); } .neg { color: var(--danger); }
  .small { font-size: 12px; }

  @media (max-width: 960px) {
    .tablepage { height: auto; min-height: 100vh; overflow: visible; }
    .dock { grid-template-columns: 1fr; height: auto; }
    .dock-actions { order: -1; }
    .dock-steps { max-height: 180px; }
  }
</style>
