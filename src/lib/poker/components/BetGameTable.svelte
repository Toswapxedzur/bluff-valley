<script>
  import SeatRing from "./SeatRing.svelte";
  import SeatBadge from "./SeatBadge.svelte";
  import HandFan from "./HandFan.svelte";
  import { fade } from "svelte/transition";
  import { d, DUR } from "$lib/motion.js";
  import { tableSeats, outcomeOf, fmt, signed, deltaKind } from "$lib/poker/table-seats.js";
  import Resolve from "./Resolve.svelte";
  import { resolveMs } from "$lib/poker/resolve-anim.js";
  import { detectMoment } from "$lib/poker/moments.js";
  import { reducedMotion } from "$lib/motion.js";

  // Bet-selection games (Baccarat, Roulette, Sic Bo, Slots): the
  // round outcome (headline + any labelled card hands) sits in the middle, the
  // House on top, each player's bets + result in their badge line.
  let { view, me, onSit = () => {} } = $props();

  const round = $derived(view?.round || {});
  const outcome = $derived(round.outcome || null);
  // Roulette / Sic Bo / Slots: the wheel, dice or reels play first; the result (headline, lines,
  // winner marks — and the coins, in the bank) waits until they land (resolve-anim.js)
  // a jackpot plays as a full-screen moment, spin and all: the table's own spin steps aside for it
  const jackpot = $derived(outcome ? detectMoment(view)?.kind === "jackpot" : false);
  const spins = $derived(!!outcome && !jackpot && resolveMs(view?.game) > 0 && (outcome.pocket != null || outcome.dice || outcome.reels));
  let landedFor = $state(null);
  $effect(() => {
    const key = view?.handNo, o = outcome, ms = reducedMotion() ? 0 : jackpot ? detectMoment(view).ms : spins ? resolveMs(view?.game) : 0;
    if (!o) return;
    if (!ms) { landedFor = key; return; }
    const id = setTimeout(() => { landedFor = key; }, ms);
    return () => clearTimeout(id);
  });
  const landed = $derived(!!outcome && landedFor === view?.handNo);
  const results = $derived(landed ? round.results || null : null);
  const t = $derived(tableSeats(view, me));
  const betsBySeat = $derived(new Map((round.bets || []).map((b) => [b.seat, b.bets])));
  function lineFor(seatNo) {
    const oc = outcomeOf(results, seatNo);
    if (oc && oc.delta !== 0) return { text: signed(oc.delta), kind: deltaKind(oc.delta) };
    const bets = betsBySeat.get(seatNo);
    if (bets && bets.length) return { text: bets.map((b) => `${b.option} ${fmt(b.amount)}`).join(" · "), kind: "" };
    return { text: "", kind: "muted" };
  }
</script>

<SeatRing seatNos={t.seatNos} mySeatNo={t.mySeatNo} houseSeat={t.bankerSeat}>
  {#snippet top()}
    <SeatBadge cardWidth={t.cardW} seat={t.house} house line="" />
  {/snippet}
  {#snippet center()}
    <div class="outcome">
      {#if outcome}
        {#if spins}{#key view?.handNo}<Resolve game={view.game} {outcome} />{/key}{/if}
        {#if landed || (!spins && !jackpot)}<div class="headline" transition:fade={{ duration: d(DUR.base) }}>{outcome.headline}</div>{/if}
        {#if outcome.hands}
          <div class="ohands">
            {#each outcome.hands as h}
              <div class="ohand"><div class="hl">{h.label}</div><div data-cards="o-{h.label}"><HandFan cards={h.cards} width={t.cardW} fan="row" /></div></div>
            {/each}
          </div>
        {/if}
      {:else}
        <div class="muted waiting">Place your bets…</div>
      {/if}
    </div>
  {/snippet}
  {#snippet seat(seatNo)}
    {@const s = t.seatByNo.get(seatNo) ?? null}
    {@const ln = s ? lineFor(seatNo) : null}
    <SeatBadge cardWidth={t.cardW}
      seat={s ? { ...s, isToAct: round.toActSeat === seatNo } : null} {seatNo} {me} isMine={!!s && s.userId === me?.id}
      line={ln?.text ?? ""} lineKind={ln?.kind ?? "muted"}
      canSit={!!me && !t.iAmSeated && !s}
      deadline={round.toActSeat === seatNo ? view?.actionDeadline ?? null : null}
      winner={outcomeOf(results, seatNo)?.delta > 0}
      {onSit}
    />
  {/snippet}
</SeatRing>

<style>
  .outcome { text-align: center; min-height: 60px; display: flex; flex-direction: column; align-items: center; gap: 10px; }
  .headline { font-size: 22px; font-weight: 800; }
  .ohands { display: flex; gap: 28px; justify-content: center; flex-wrap: wrap; }
  .ohand { display: flex; flex-direction: column; align-items: center; gap: 4px; }
  .ohand .hl { font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.6px; }
  .waiting { font-size: 15px; }
</style>
