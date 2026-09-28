<script>
  // The play bar (where a live table's action bar sits): the step, a scrubber, ⏮ ◀ ▶/⏸ ▶| ⏭ and the
  // speed. Drives a ReplayPlayer ($lib/poker/replay-player.svelte.js). `extra`: a snippet at the end
  // of the controls (a live table's "Back to live").
  import { SPEEDS } from "$lib/poker/replay-player.svelte.js";

  let { player, extra = null } = $props();
  const p = $derived(player);
</script>

<div class="bar card">
  <div class="now"><span class="count">{p.i + 1} / {p.steps.length}</span><span class="what">{p.text}</span></div>
  <input class="scrub" type="range" min="0" max={p.last} step="1" value={p.i} aria-label="Scrub through the match"
    oninput={(e) => p.jumpTo(Number(e.currentTarget.value))} />
  <div class="ctl">
    <button type="button" class="ib" onclick={() => p.jumpTo(0)} disabled={p.i === 0} aria-label="To the start" title="Start (Home)">⏮</button>
    <button type="button" class="ib" onclick={() => p.back()} disabled={p.i === 0} aria-label="Step back" title="Back (←)">◀</button>
    <button type="button" class="ib play" onclick={() => p.toggle()} aria-label={p.playing ? "Pause" : "Play"} title="Play / pause (space)">{p.playing ? "⏸" : "▶"}</button>
    <button type="button" class="ib" onclick={() => p.step()} disabled={p.i >= p.last} aria-label="Step forward" title="Forward (→)">▶|</button>
    <button type="button" class="ib" onclick={() => p.jumpTo(p.last)} disabled={p.i >= p.last} aria-label="To the result" title="Result (End)">⏭</button>
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
  .scrub { width: 100%; accent-color: var(--accent); }
  .ctl { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .ib { appearance: none; border: 0; min-width: 40px; height: 36px; padding: 0 10px; border-radius: var(--r-btn); background: var(--surface-2); color: var(--text); font-size: 14px; cursor: pointer; box-shadow: var(--shadow-card); }
  .ib:disabled { opacity: 0.4; cursor: default; }
  .ib.play { background: var(--accent); color: var(--on-accent); min-width: 54px; font-size: 16px; }
  .seg { display: inline-flex; background: var(--well); border-radius: var(--r-pill); padding: 3px; gap: 2px; margin-left: auto; }
  .seg-btn { border: 0; background: transparent; color: var(--muted); font: inherit; font-weight: 700; font-size: 12.5px; padding: 6px 11px; border-radius: var(--r-pill); cursor: pointer; }
  .seg-btn.on { color: var(--text); background: var(--surface); box-shadow: var(--shadow-card); }
</style>
