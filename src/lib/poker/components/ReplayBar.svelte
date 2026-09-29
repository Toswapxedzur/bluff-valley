<script>
  import Slider from "$lib/components/Slider.svelte";
  import Icon from "$lib/components/Icon.svelte";
  // The play bar (where a live table's action bar sits): the step, a scrubber, ⏮ ◀ ▶/⏸ ▶| ⏭ and the
  // speed. Drives a ReplayPlayer (one hand) or a VisitPlayer (a whole table visit: the scrubber gets a
  // marker per game, and ⏮ ⏭ go to the previous / next game). `extra`: a snippet at the end of the
  // controls (a live table's "Back to live").
  import { SPEEDS } from "$lib/poker/replay-player.svelte.js";

  let { player, extra = null } = $props();
  const p = $derived(player);
  const total = $derived(p.total ?? p.steps.length);
  const games = $derived(typeof p.prevGame === "function");
</script>

<div class="bar card">
  <div class="now"><span class="count">{p.i + 1} / {total}</span><span class="what">{p.text}</span></div>
  <Slider min={0} max={p.last} step={1} value={p.i} ariaLabel={games ? "Scrub through the visit" : "Scrub through the match"} marks={p.marks ?? null}
    valueText={(v) => `Step ${v + 1} of ${total}`} oninput={(v) => p.jumpTo(v)} />
  <div class="ctl">
    {#if games}
      <button type="button" class="ib" onclick={() => p.prevGame()} disabled={p.atFirst} aria-label="Previous game" title="Previous game (PageUp)"><Icon name="first" size={16} /></button>
    {:else}
      <button type="button" class="ib" onclick={() => p.jumpTo(0)} disabled={p.i === 0} aria-label="To the start" title="Start (Home)"><Icon name="first" size={16} /></button>
    {/if}
    <button type="button" class="ib" onclick={() => p.back()} disabled={p.i === 0} aria-label="Step back" title="Back (←)"><Icon name="back" size={16} /></button>
    <button type="button" class="ib play on-color" onclick={() => p.toggle()} aria-label={p.playing ? "Pause" : "Play"} title="Play / pause (space)"><Icon name={p.playing ? "pause" : "play"} size={16} /></button>
    <button type="button" class="ib" onclick={() => p.step()} disabled={p.i >= p.last} aria-label="Step forward" title="Forward (→)"><Icon name="step" size={16} /></button>
    {#if games}
      <button type="button" class="ib" onclick={() => p.nextGame()} disabled={p.atLast} aria-label="Next game" title="Next game (PageDown)"><Icon name="last" size={16} /></button>
    {:else}
      <button type="button" class="ib" onclick={() => p.jumpTo(p.last)} disabled={p.i >= p.last} aria-label="To the result" title="Result (End)"><Icon name="last" size={16} /></button>
    {/if}
    <div class="seg" role="radiogroup" aria-label="Speed">
      {#each SPEEDS as sp (sp)}
        <button type="button" role="radio" aria-checked={p.speed === sp} class="seg-btn" class:on={p.speed === sp} onclick={() => (p.speed = sp)}>{sp}×</button>
      {/each}
    </div>
    {#if extra}{@render extra()}{/if}
  </div>
</div>

<style>
  .bar { width: 100%; max-width: 640px; margin: 0; padding: 14px 16px; display: flex; flex-direction: column; gap: 10px; }
  .now { display: flex; gap: 10px; align-items: baseline; min-width: 0; }
  .count { font-weight: 800; font-variant-numeric: tabular-nums; color: var(--muted); font-size: 12.5px; flex: none; }
  .what { font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .ctl { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .ib { appearance: none; border: 0; min-width: 40px; height: 36px; padding: 0 10px; border-radius: var(--r-btn); background: var(--surface-2); color: var(--text); font-size: 14px; cursor: pointer; box-shadow: var(--shadow-card); }
  .ib:disabled { opacity: 0.4; cursor: default; }
  .ib.play { background: var(--accent); color: var(--on-accent); min-width: 54px; font-size: 16px; }
  .seg { display: inline-flex; background: var(--well); border-radius: var(--r-pill); padding: 3px; gap: 2px; margin-left: auto; }
  .seg-btn { border: 0; background: transparent; color: var(--muted); font: inherit; font-weight: 700; font-size: 12.5px; padding: 6px 11px; border-radius: var(--r-pill); cursor: pointer; }
  .seg-btn.on { color: var(--text); background: var(--surface); box-shadow: var(--shadow-card); }
</style>
