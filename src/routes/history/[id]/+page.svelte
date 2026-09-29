<script>
  // One player's history: their table visits (see +page.server.js).
  import Avatar from "$lib/poker/components/Avatar.svelte";
  import VisitHistory from "$lib/components/VisitHistory.svelte";

  let { data } = $props();
  const p = $derived(data.player);
</script>

<svelte:head><title>{p.isSelf ? "Your history" : `${p.name}'s history`} — Bluff Valley</title></svelte:head>

<div class="wrap">
  <div class="head">
    <Avatar id={p.id} name={p.name} mediaId={p.avatarMediaId} size={36} ring={p.ring || "default"} />
    <div class="id">
      <h1>{p.isSelf ? "Your history" : `${p.name}'s history`}</h1>
      <span class="links">
        <a class="muted small" href="/u/{p.id}">Open profile →</a>
        {#if p.isSelf}<a class="muted small" href="/stats">Full statistics →</a>{/if}
      </span>
    </div>
  </div>
  <p class="muted intro">Every table visit{data.horizonDays ? ` from the last ${data.horizonDays} days` : ""}, replayed game by game on the real table.</p>

  <section class="card">
    {#if data.visits === null}
      <p class="muted small">{p.name} doesn't share their play history with you.</p>
    {:else}
      <VisitHistory visits={data.visits} playerId={p.id}
        empty={p.isSelf ? "You haven't sat at a table in this window yet. Play a hand and your visit shows up here to rewatch." : "No table visits in the visible window."} />
    {/if}
  </section>
</div>

<style>
  .wrap { max-width: 760px; margin: 0 auto; }
  .head { display: flex; align-items: center; gap: 14px; }
  .id { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
  h1 { margin: 0; font-size: 26px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .links { display: flex; gap: 14px; }
  .intro { margin: 10px 0 16px; }
</style>
