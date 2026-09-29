<script>
  import { play } from "$lib/sfx.js";
  import Icon from "$lib/components/Icon.svelte";
  import { enhance } from "$app/forms";
  import { fly } from "svelte/transition";
  import { d, DUR } from "$lib/motion.js";
  import Chip from "$lib/poker/components/Chip.svelte";
  import { flyCoinsToWallet } from "$lib/reward-fly.js";

  let { data } = $props();
  let quests = $state(data.quests);
  let chips = $state(data.chips);

  const PERIOD_LABELS = { daily: "Daily", weekly: "Weekly", monthly: "Monthly" };
  // "Resets in 5 h 12 m" — midnight China time (daily), Monday (weekly), the 1st (monthly)
  let now = $state(Date.now());
  $effect(() => { const t = setInterval(() => (now = Date.now()), 30_000); return () => clearInterval(t); });
  function resetsIn(at) {
    const m = Math.max(1, Math.ceil((at - now) / 60_000)), dd = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60), mm = m % 60;
    return "Resets in " + (dd ? `${dd} d ${h} h` : h ? `${h} h ${mm} m` : `${mm} m`);
  }
  const ORDER = ["daily", "weekly", "monthly"];
  const groups = $derived(
    ORDER
      .map((p) => { const items = quests.filter((q) => q.period === p); return { period: p, label: PERIOD_LABELS[p], items, resetsAt: items[0]?.resetsAt }; })
      .filter((g) => g.items.length)
  );

  const fmt = (n) => Number(n).toLocaleString();
  const achievements = data.achievements || [];
  const CATS = [["volume", "Volume"], ["skill", "Skill"], ["dedication", "Dedication"], ["event", "Events"]];
  const unlockedCount = achievements.filter((a) => a.unlocked).length;
  const apct = (a) => Math.min(100, Math.round((a.progress.value / a.progress.target) * 100));
  // Difficulty → a coin from the metal ladder (copper < brass < silver < gold):
  // the coin at the front of a locked badge IS its difficulty marker.
  const TIER_COIN = { bronze: 5, silver: 25, gold: 100 };
  const tierCoin = (a) => TIER_COIN[a.tier] ?? 1;
  const pct = (q) => Math.min(100, Math.round((q.progress / q.target) * 100));

  function claimHandler(id) {
    return ({ formElement }) => async ({ result, update }) => {
      if (result.type === "success" && result.data?.claimedId === id) {
        // the reward flies from the button into the wallet (which counts up as it lands)
        flyCoinsToWallet(formElement.querySelector("button") || formElement, result.data.reward);
        play("reward");                                // the same chime as the daily bonus
        play("check", { delay: 60 });                  // the check stamping in: a knock
        quests = quests.map((q) => (q.id === id ? { ...q, claimed: true } : q));
        if (result.data.chips != null) chips = Number(result.data.chips);
      }
      await update({ reset: false });
    };
  }
</script>

<svelte:head><title>Quests — Bluff Valley</title></svelte:head>

<div class="wrap">
  <div class="head">
    <h1>Quests</h1>
    <div class="bal" title="Your chip balance">
      <Chip value={chips} size={20} /> {fmt(chips)}
    </div>
  </div>
  <p class="muted intro">Complete objectives to earn chips. Progress tracks as you play; the daily set refreshes at midnight (China time).</p>

  {#each groups as g (g.period)}
    <section class="grp">
      <div class="grp-head">
        <h2>{g.label}</h2>
        <span class="muted small">{g.resetsAt ? resetsIn(g.resetsAt) : ""}</span>
      </div>
      <div class="list">
        {#each g.items as q, i (q.id)}
          <div class="q card" class:done={q.done} in:fly={{ y: d(8), duration: d(DUR.base), delay: d(Math.min(i, 8) * 25) }}>
            <div class="q-main">
              <div class="q-top">
                <span class="q-title">{q.title}</span>
                <span class="q-reward" class:muted={q.claimed}>
                  {#if q.claimed}Claimed{:else}<Chip value={q.reward} size={15} /> {fmt(q.reward)}{/if}
                </span>
              </div>
              <div class="bar" role="progressbar" aria-valuenow={q.progress} aria-valuemin="0" aria-valuemax={q.target}>
                <div class="fill" class:full={q.done} style="width:{pct(q)}%"></div>
              </div>
              <div class="q-foot">
                <span class="muted small">{fmt(Math.min(q.progress, q.target))} / {fmt(q.target)}</span>
                {#if q.done && !q.claimed}
                  <form method="POST" action="?/claim" use:enhance={claimHandler(q.id)}>
                    <input type="hidden" name="questId" value={q.id} />
                    <button class="claim" type="submit">Claim</button>
                  </form>
                {:else if q.claimed}
                  <span class="check" aria-hidden="true"><svg viewBox="0 0 24 24" width="16" height="16"><path d="M2.5 12.5l3.2-3.2 4 4 8.6-8.6 3.2 3.2L9.7 19.7z" fill="currentColor"/></svg></span>
                {/if}
              </div>
            </div>
          </div>
        {/each}
      </div>
    </section>
  {/each}

  {#if !achievements.length}
    <section class="grp">
      <div class="grp-head"><h2>Achievements</h2></div>
      <p class="empty-note boxed">Achievements are on the way.</p>
    </section>
  {:else}
    <section class="grp">
      <div class="grp-head">
        <h2>Achievements</h2>
        <span class="muted small">{unlockedCount} / {achievements.length} unlocked · one-time chip rewards</span>
      </div>
      {#each CATS as [cat, label]}
        {@const items = achievements.filter((a) => a.category === cat)}
        {#if items.length}
          <div class="ach-cat">{label}</div>
          <div class="list ach-list">
            {#each items as a (a.key)}
              <div class="q card" class:done={a.unlocked} title={a.desc}>
                <div class="q-main">
                  <div class="q-top">
                    <span class="q-title">
                      {#if a.unlocked}<span class="ach-ico"><Icon name="medal" size={18} /></span>{:else}<span class="ach-coin"><Chip value={tierCoin(a)} size={18} /></span>{/if}
                      {a.name}
                    </span>
                    <span class="q-reward" class:muted={a.unlocked}>
                      {#if a.unlocked}Earned{:else if a.reward}<Chip value={a.reward} size={15} /> {fmt(a.reward)}{/if}
                    </span>
                  </div>
                  <div class="ach-desc muted small">{a.desc}</div>
                  {#if a.progress && !a.unlocked}
                    <div class="bar" role="progressbar" aria-valuenow={a.progress.value} aria-valuemin="0" aria-valuemax={a.progress.target}>
                      <div class="fill" style="width:{apct(a)}%"></div>
                    </div>
                    <div class="q-foot"><span class="muted small">{fmt(a.progress.value)} / {fmt(a.progress.target)}</span></div>
                  {:else if a.unlocked}
                    <div class="q-foot"><span class="muted small"></span><span class="check" aria-hidden="true">✓</span></div>
                  {/if}
                </div>
              </div>
            {/each}
          </div>
        {/if}
      {/each}
    </section>
  {/if}
</div>

<style>
  .wrap { max-width: 640px; margin: 0 auto; }
  .head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
  h1 { margin: 0; font-size: 26px; }
  .bal { font-weight: 800; font-variant-numeric: tabular-nums; color: var(--gold-ink); font-size: 17px; display: inline-flex; align-items: center; gap: 7px; }
  .intro { margin: 6px 0 20px; }

  .grp { margin-bottom: 24px; }
  .grp-head { display: flex; align-items: baseline; gap: 10px; margin-bottom: 10px; }
  .grp-head h2 { margin: 0; font-size: 15px; letter-spacing: .01em; }
  .list { display: flex; flex-direction: column; gap: 8px; }

  .q { padding: 14px 16px; margin-bottom: 0; transition: box-shadow var(--dur) var(--ease); }
  .q.done { box-shadow: 0 0 0 1px var(--gold-line, rgba(200,160,60,.3)), var(--shadow-card); }
  .q-top { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; margin-bottom: 9px; }
  .q-title { font-weight: 700; font-size: 14.5px; color: var(--text); }
  .q-reward { font-weight: 800; font-variant-numeric: tabular-nums; font-size: 13.5px; color: var(--gold-ink); white-space: nowrap; display: inline-flex; align-items: center; gap: 5px; }

  .bar { height: 7px; background: var(--well); border-radius: var(--r-pill); overflow: hidden; }
  .fill { height: 100%; background: var(--accent); border-radius: var(--r-pill);
    transition: width var(--dur) var(--ease); }
  .fill.full { background: var(--gold-ink); }

  .q-foot { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 9px; min-height: 24px; }
  .q-foot form { margin: 0; }
  .claim { border: 0; cursor: pointer; font-weight: 700; font-size: 12.5px; color: #1a1200;
    background: var(--gold-ink); padding: 6px 15px; border-radius: var(--r-pill);
    transition: filter var(--dur) var(--ease); }
  .claim:hover { filter: brightness(1.08); }
  .check { display: inline-flex; animation: claimStamp 0.36s cubic-bezier(.3,1.45,.5,1) both; color: var(--ok); font-weight: 800; }

  .ach-cat { font-size: 11px; font-weight: 700; letter-spacing: .07em; text-transform: uppercase; color: var(--muted); margin: 14px 0 8px; }
  .ach-list { margin-bottom: 4px; }
  .ach-ico { margin-right: 2px; }
  .ach-coin { display: inline-flex; vertical-align: -3px; margin-right: 4px; }
  .ach-desc { margin-bottom: 8px; }
  @keyframes claimStamp { from { transform: scale(1.6); opacity: 0; } to { transform: none; opacity: 1; } }
  @media (prefers-reduced-motion: reduce) { .check { animation: none; } }
</style>
