<script>
  import { goto, pushState } from "$app/navigation";
  import { page } from "$app/stores";
  import VisitSheet from "./VisitSheet.svelte";
  import { gameIcon, variantLabel, SPRINT_ICON } from "$lib/poker/games.js";
  import { slidingIndicator } from "$lib/actions/slider.js";
  import HistoryFeed from "$lib/poker/components/HistoryFeed.svelte";
  import Chip from "$lib/poker/components/Chip.svelte";
  import { ACHIEVEMENTS_ON } from "$lib/config.js";
  let { data } = $props();

  const FILTERS = [
    { key: "all", label: "All" },
    { key: "visits", label: "Visits" },   // your table visits, each one replayed whole on the real table
    { key: "money", label: "Chips" },
    ...(ACHIEVEMENTS_ON ? [{ key: "achievements", label: "Achievements" }] : []),   // switched off for now
    { key: "friends", label: "Friends" },
  ];
  function setFilter(k) { goto(`/history?filter=${k}`, { keepFocus: true, noScroll: true }); }
  const fmt = (n) => Number(n).toLocaleString();
  const signed = (n) => `${Number(n) >= 0 ? "+" : ""}${fmt(n)}`;
  const modeName = (mode) => mode === "holdem" ? "Poker" : String(mode || "—").split("-").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
  function when(ts) {
    const dt = new Date(ts), now = new Date();
    const diff = now - dt, day = 86400000;
    if (diff < 60000) return "just now";
    if (diff < 3600000) return Math.floor(diff / 60000) + "m ago";
    if (dt.toDateString() === now.toDateString()) return dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    if (diff < 7 * day) return dt.toLocaleDateString([], { weekday: "short" }) + " " + dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    return dt.toLocaleDateString([], { month: "short", day: "numeric" });
  }

  // History's entries (owner, 2026-09-28): your table visits, mixed into the timeline — each opens
  // as a near-full-screen sheet replaying the whole visit (VisitSheet). The sheet lives in the URL
  // (?visit=…, shallow routing), so Back closes it and a visit can be linked to.
  const visitRow = (v) => ({
    type: "visit", id: v.id, ts: v.endedAt, amount: v.net,
    img: v.kind === "sprint" ? SPRINT_ICON : gameIcon(v.mode === "holdem" ? v.variant || "holdem" : v.mode),
    label: v.tableName || variantLabel(v.mode),
    sub: `${v.kind === "sprint" ? "River Sprint" : variantLabel(v.mode === "holdem" ? v.variant || "holdem" : v.mode)}${v.kind === "tournament" ? " · tournament" : ""} · ${v.hands} game${v.hands === 1 ? "" : "s"} · ${Math.max(1, Math.round((v.endedAt - v.startedAt) / 60000))} min`
  });
  const items = $derived.by(() => {
    const vs = (data.visits || []).map(visitRow);
    if (data.filter === "visits") return vs;
    if (data.filter !== "all") return data.events;
    return [...vs, ...data.events].sort((a, b) => b.ts - a.ts);
  });
  const openId = $derived($page.state?.visit ?? $page.url.searchParams.get("visit"));
  function openVisit(id) {
    const u = new URL($page.url);
    u.searchParams.set("visit", id);
    pushState(u.pathname + u.search, { visit: id });
  }
  function closeVisit() {
    if ($page.state?.visit) { history.back(); return; }
    const u = new URL($page.url);
    u.searchParams.delete("visit");
    goto(u.pathname + u.search, { replaceState: true, noScroll: true, keepFocus: true });
  }
</script>

<svelte:head><title>History — Bluff Valley</title></svelte:head>

<div class="wrap">
  <div class="head">
    <h1>Your history</h1>
    <div class="filters slider" use:slidingIndicator>
      {#each FILTERS as f}
        <button class="fbtn" class:on={data.filter === f.key} onclick={() => setFilter(f.key)}>{f.label}</button>
      {/each}
    </div>
  </div>

  <a class="stats-strip" href="/stats" aria-label="Open full statistics">
    <span><small>Matches</small><strong>{fmt(data.stats.matches)}</strong></span>
    <span><small>Net</small><strong class:pos={data.stats.net >= 0} class:neg={data.stats.net < 0}><Chip value={Math.abs(data.stats.net)} size={15} /> {signed(data.stats.net)}</strong></span>
    <span><small>Best mode</small><strong>{modeName(data.stats.bestMode?.mode)}</strong></span>
    <em>Full stats →</em>
  </a>

  {#if items.length === 0}
    <div class="empty card"><p class="muted">{data.filter === "visits" ? "No table visits in the last 7 days yet. Sit at a table and your visit shows up here to rewatch." : "Nothing here yet — play some hands, claim your daily reward, or add a friend."}</p></div>
  {:else}
    <HistoryFeed events={items} onVisit={openVisit} />
  {/if}
</div>

{#if openId}
  {#key openId}<VisitSheet visitId={openId} onClose={closeVisit} />{/key}
{/if}

<style>
  .wrap { max-width: 720px; margin: 0 auto; }
  .head { display: flex; align-items: center; justify-content: space-between; gap: 14px; flex-wrap: wrap; margin-bottom: 16px; }
  .head h1 { margin: 0; font-size: 26px; }
  .filters { display: inline-flex; gap: 2px; background: var(--well); padding: 3px; border-radius: var(--r-pill); position: relative; }
  .filters .sel-ind { background: var(--surface); box-shadow: var(--shadow-card); }
  .fbtn { border: 0; background: transparent; color: var(--muted); font-weight: 600; font-size: 12.5px; padding: 7px 13px; border-radius: var(--r-pill); cursor: pointer; position: relative;
    transition: color var(--dur) var(--ease); }
  .fbtn:hover { color: var(--text); }
  .fbtn.on { color: var(--text); }
  .stats-strip { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)) auto; align-items: center; gap: 10px; background: var(--surface); box-shadow: var(--shadow-card); border-radius: var(--r-card); padding: 12px 15px; margin-bottom: 14px; color: var(--text); text-decoration: none; }
  .stats-strip:hover { background: var(--surface-2); }
  .stats-strip > span { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
  .stats-strip small { color: var(--muted); text-transform: uppercase; letter-spacing: .06em; font-size: 9.5px; font-weight: 800; }
  .stats-strip strong { display: flex; align-items: center; gap: 5px; font-size: 14px; font-weight: 850; font-variant-numeric: tabular-nums; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .stats-strip em { color: var(--accent-ink); font-size: 12px; font-weight: 750; font-style: normal; white-space: nowrap; }
  .pos { color: var(--ok, #6ee7a8); }
  .neg { color: var(--danger); }
  .empty { text-align: center; padding: 40px 20px; }
  .feed { display: flex; flex-direction: column; gap: 8px; }
  .ev { display: flex; align-items: center; gap: 13px; margin-bottom: 0; padding: 13px 16px; }
  .ev-icon { font-size: 20px; width: 34px; height: 34px; display: grid; place-items: center; background: var(--well); border-radius: 50%; flex: 0 0 auto; }
  .ev-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
  .ev-label { font-weight: 600; font-size: 14px; }
  .ev-sub { font-size: 12px; color: var(--muted); }
  .ev-amt { font-weight: 800; font-variant-numeric: tabular-nums; font-size: 14px; flex: 0 0 auto; }
  .ev-amt.pos { color: var(--ok); } .ev-amt.neg { color: var(--danger); }
  .ev-time { color: var(--faint); font-size: 11.5px; flex: 0 0 auto; min-width: 58px; text-align: right; }
  @media (max-width: 560px) { .stats-strip { grid-template-columns: repeat(3, minmax(0, 1fr)); } .stats-strip em { grid-column: 1 / -1; } }
</style>
