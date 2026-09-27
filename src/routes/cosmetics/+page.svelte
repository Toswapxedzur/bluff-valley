<script>
  import { enhance } from "$app/forms";
  import Avatar from "$lib/poker/components/Avatar.svelte";
  import Chip from "$lib/poker/components/Chip.svelte";
  import { LOOKS, plateStyle, FREE_SLOTS } from "$lib/cosmetics.js";
  import { SITE_NAME } from "$lib/config.js";
  import SeatBadge from "$lib/poker/components/SeatBadge.svelte";
  import BannerEditor from "./BannerEditor.svelte";

  let { data } = $props();
  let ring = $state(data.ring);
  let badge = $state(data.badge);
  let error = $state(null);
  // the banner the preview draws: the editor's unsaved picture while you edit, else the live one
  let shown = $state(data.banner.live);

  const owned = new Set(data.owned);
  const fmt = (n) => Number(n).toLocaleString("en-US");
  const short = (n) => (n >= 1e6 ? `${n / 1e6}M` : n >= 1e3 ? `${n / 1e3}K` : String(n));
  const progress = (at) => Math.min(100, Math.round(((data.peak || 0) / at) * 100));
  const plateVars = (p) => `background:${p.bg};--ink:${p.ink};--sub:${p.sub};--money:${p.money}`;

  // equip without a reload; the server re-checks the unlock
  const equipping = (slot, look) => () => async ({ result }) => {
    if (result.type === "success") { error = null; if (slot === "ring") ring = look; else badge = look; }
    else if (result.type === "failure") error = result.data?.error || "Couldn't equip that.";
  };

  // the one preview of how you look (left column, beside the rings and badges it shows off): your
  // own seat with the clock running, and the smaller seat everyone else sees, then that one at 2×
  let deadline = $state(Date.now() + 25_000);
  $effect(() => { const id = setInterval(() => { deadline = Date.now() + 25_000; }, 25_000); return () => clearInterval(id); });
  let mine = $derived({ seat: 1, userId: data.me.id, name: data.me.name, avatar: data.me.avatarMediaId, ring, badge, banner: shown, stack: data.wealth, connected: true, isToAct: true, isButton: true, status: null, lastAction: null, committed: 0 });
  let other = $derived({ ...mine, seat: 2, isToAct: false, isButton: false, isBB: true, lastAction: "Raise 400" });
</script>

<svelte:head><title>Cosmetics — {SITE_NAME}</title></svelte:head>

<div class="wrap">
  <div class="head">
    <h1>Cosmetics</h1>
    {#if data.isAdmin}<a class="review" href="/cosmetics/review">Banner review</a>{/if}
    <span class="bal" title="Your highest wealth ever: wallet plus chips on tables"><Chip value={data.peak} size={20} /> {fmt(data.peak)}</span>
  </div>
  <p class="muted intro">
    Every badge is free: pick any colour for your seat plate, or put your own picture on it. Rings
    unlock as you get richer: reaching a wealth milestone unlocks that metal's ring for good. Your
    wealth is your wallet plus the chips on your tables, and it counts your highest ever.
  </p>

  {#if error}<p class="err" role="alert">{error}</p>{/if}

  <div class="cols">
    <!-- left: how you look, and your banner -->
    <div class="look">
      <section class="preview" aria-label="How you look at a table" style="--plate-w:136px;--plate-w-mine:164px">
        <div class="seats">
          <div class="seatcol"><span class="muted small cap">Your seat</span><SeatBadge seat={mine} isMine {deadline} seatNo={1} /></div>
          <div class="seatcol"><span class="muted small cap">What others see</span><SeatBadge seat={other} seatNo={2} /></div>
        </div>
        <span class="muted small cap">Twice the size</span>
        <div class="big"><SeatBadge seat={other} seatNo={3} /></div>
      </section>
      <BannerEditor initial={data.banner} onShow={(b) => (shown = b)} />
    </div>

    <!-- right: the rings and badges -->
    <div class="picks">
  {#each [["ring", "Rings", "The band round your avatar."], ["badge", "Badges", "The colour of your seat plate."]] as [slot, title, sub]}
    <section class="grp">
      <div class="grp-head"><h2>{title}</h2><span class="muted small">{sub}</span></div>
      <div class="grid">
        {#each LOOKS as l (l.key)}
          {@const has = FREE_SLOTS.has(slot) || owned.has(l.key)}
          {@const on = (slot === "ring" ? ring : badge) === l.key}
          <form method="POST" action="?/equip" use:enhance={equipping(slot, l.key)} class="tile" class:on class:locked={!has}>
            <input type="hidden" name="slot" value={slot} />
            <input type="hidden" name="look" value={l.key} />
            <div class="swatch">
              {#if slot === "ring"}
                <Avatar id={data.me.id} name={data.me.name} mediaId={data.me.avatarMediaId} size={40} ring={l.key} />
              {:else}
                <span class="mini" style={plateVars(plateStyle(l.key))}><b>Aa</b><i>12,480</i></span>
              {/if}
            </div>
            <div class="nm">{l.name}</div>
            {#if on}
              <span class="state wearing">Wearing</span>
            {:else if has}
              <button class="state wear" type="submit">Wear</button>
            {:else}
              <span class="state lock">Unlocks at<b>{short(l.at)}</b></span>
              <div class="bar" aria-label="{progress(l.at)}% of the way"><div class="fill" style="width:{progress(l.at)}%"></div></div>
            {/if}
          </form>
        {/each}
      </div>
    </section>
  {/each}
    </div>
  </div>
</div>

<style>
  .wrap { max-width: 1180px; margin: 0 auto; }
  .head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
  h1 { margin: 0; font-size: 26px; }
  .review { margin-left: auto; font-weight: 700; font-size: 13px; }
  .bal { font-weight: 800; font-variant-numeric: tabular-nums; color: var(--gold-ink); font-size: 17px; display: inline-flex; align-items: center; gap: 7px; }
  .intro { margin: 6px 0 18px; max-width: 62ch; }
  .small { font-size: 12.5px; }
  .err { color: var(--danger); margin: 0 0 12px; font-weight: 600; }

  /* two columns: how you look (kept in view while you pick) | the rings and badges */
  .cols { display: grid; grid-template-columns: minmax(0, 5fr) minmax(0, 6fr); gap: 22px; align-items: start; }
  .look { display: flex; flex-direction: column; gap: 16px; min-width: 0; }
  @media (min-height: 860px) { .look { position: sticky; top: 72px; } }
  .picks { min-width: 0; }
  @media (max-width: 900px) { .cols { grid-template-columns: minmax(0, 1fr); } .look { position: static; } }

  .preview { display: flex; flex-direction: column; gap: 12px; padding: 14px 16px 20px; background: var(--well); border-radius: var(--r-card); }
  .seats { display: flex; flex-wrap: wrap; gap: 14px 24px; justify-content: space-around; }
  .seatcol { display: flex; flex-direction: column; gap: 12px; align-items: flex-start; padding-left: 12px; }
  .seatcol .cap { margin-left: -12px; }
  .preview > .cap { margin-top: 10px; }
  .big { zoom: 2; padding: 2px 0 0 8px; align-self: center; }

  .grp { margin-bottom: 24px; }
  .grp:last-child { margin-bottom: 0; }
  .grp-head { display: flex; align-items: baseline; gap: 10px; margin-bottom: 10px; flex-wrap: wrap; }
  .grp-head h2 { margin: 0; font-size: 15px; }
  /* twelve looks: 6, 4 or 3 to a row by the column's own width, so every row is full */
  .picks { container-type: inline-size; }
  .grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
  @container (min-width: 420px) { .grid { grid-template-columns: repeat(4, minmax(0, 1fr)); } }
  @container (min-width: 600px) { .grid { grid-template-columns: repeat(6, minmax(0, 1fr)); } }
  .tile { margin: 0; display: grid; justify-items: center; align-content: start; gap: 6px; padding: 12px 6px 11px; text-align: center; background: var(--surface); border-radius: var(--r-card);
    box-shadow: var(--shadow-card); transition: box-shadow var(--dur) var(--ease); }
  .tile.on { box-shadow: 0 0 0 2px var(--accent), var(--shadow-card); }
  .tile.locked .swatch { filter: grayscale(0.85) brightness(0.8); opacity: 0.75; }
  .swatch { height: 70px; display: grid; place-items: center; }
  .mini { display: inline-flex; align-items: baseline; gap: 5px; padding: 8px 9px; border-radius: 12px; box-shadow: var(--shadow-card); }
  .mini b { color: var(--ink); font-size: 13px; }
  .mini i { color: var(--money); font-style: normal; font-weight: 700; font-size: 12px; font-variant-numeric: tabular-nums; }
  .nm { font-weight: 700; font-size: 13.5px; }
  .state { font-size: 11.5px; font-weight: 700; }
  .wearing { color: var(--accent); }
  .wear { border: 0; cursor: pointer; background: var(--accent); color: var(--on-accent, #fff); padding: 5px 14px; border-radius: var(--r-pill); font: inherit; font-size: 12px; font-weight: 700; }
  .wear:hover { filter: brightness(1.08); }
  .lock { color: var(--muted); font-weight: 600; display: grid; line-height: 1.25; }   /* two fixed lines in every locked tile */
  .lock b { color: var(--text); font-weight: 800; font-size: 12.5px; }
  .bar { width: 80%; height: 5px; background: var(--well); border-radius: var(--r-pill); overflow: hidden; }
  .fill { height: 100%; background: var(--gold-ink); border-radius: var(--r-pill); }
</style>
