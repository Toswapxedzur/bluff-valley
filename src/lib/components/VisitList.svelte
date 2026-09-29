<script>
  // A list of table visits (visits.js summaries), newest first — the Data page's History (owner,
  // 2026-09-28/29). Each row opens that visit's sheet (onOpen(id)): the game's icon, the table, how
  // many games and how long, the net, and when.
  import Chip from "$lib/poker/components/Chip.svelte";
  import { gameIcon, variantLabel, SPRINT_ICON } from "$lib/poker/games.js";

  let { visits = [], empty = "No table visits in this window.", onOpen = () => {} } = $props();

  const keyOf = (v) => (v.mode === "holdem" ? v.variant || "holdem" : v.mode);
  const fmt = (n) => Number(n || 0).toLocaleString("en-US");
  function when(ms) {
    const d = Date.now() - Number(ms);
    if (d < 60_000) return "just now";
    if (d < 3_600_000) return `${Math.floor(d / 60_000)}m ago`;
    if (d < 86_400_000) return `${Math.floor(d / 3_600_000)}h ago`;
    return new Date(Number(ms)).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }
</script>

{#if visits.length}
  <ul class="vl">
    {#each visits as v (v.id)}
      <li>
        <button type="button" class="row" onclick={() => onOpen(v.id)}>
          <span class="ic"><img src={v.kind === "sprint" ? SPRINT_ICON : gameIcon(keyOf(v))} alt="" width="26" height="26" /></span>
          <span class="main">
            <span class="name">{v.tableName || variantLabel(keyOf(v))}</span>
            <span class="sub">{v.kind === "sprint" ? "River Sprint" : variantLabel(keyOf(v))}{v.kind === "tournament" ? " · tournament" : ""} · {v.hands} game{v.hands === 1 ? "" : "s"} · {Math.max(1, Math.round((v.endedAt - v.startedAt) / 60_000))} min</span>
          </span>
          <span class="end">
          <span class="net" class:pos={v.net > 0} class:neg={v.net < 0}>{#if v.net}<Chip value={Math.abs(v.net)} size={14} />{/if}{v.net > 0 ? "+" : ""}{fmt(v.net)}</span>
          <span class="when">{when(v.endedAt)}</span>
          </span>
        </button>
      </li>
    {/each}
  </ul>
{:else}
  <p class="empty-note">{empty}</p>
{/if}

<style>
  .vl { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
  .row { display: flex; align-items: center; gap: 12px; width: 100%; padding: 10px 14px; border: 0; border-radius: 12px; cursor: pointer;
    background: var(--well); color: var(--text); font: inherit; text-align: left;
    transition: background-color var(--dur) var(--ease), transform var(--dur) var(--ease); }
  .row:hover { background: color-mix(in srgb, var(--well) 70%, var(--surface-2) 30%); transform: translateY(-1px); }
  .ic { width: 36px; height: 36px; flex: none; display: grid; place-items: center; border-radius: 50%; background: var(--surface); }
  .ic img { display: block; }
  .main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
  .name { font-weight: 700; font-size: 14px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .sub { font-size: 12px; color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .net { flex: none; display: inline-flex; align-items: center; gap: 5px; font-weight: 800; font-variant-numeric: tabular-nums; font-size: 14px; }
  .net.pos { color: var(--ok); } .net.neg { color: var(--danger); }
  .when { flex: none; min-width: 64px; text-align: right; color: var(--faint); font-size: 12px; }
  .end { display: contents; }
  /* phones: the net over the time, and the details may take two lines */
  @media (max-width: 480px) {
    .row { gap: 10px; padding: 10px 12px; }
    .end { display: flex; flex-direction: column; align-items: flex-end; gap: 2px; flex: none; }
    .when { min-width: 0; }
    .sub { white-space: normal; }
  }
</style>
