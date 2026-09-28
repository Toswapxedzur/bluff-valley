<script>
  // The table itself — seats, cards, coins, moments, sounds — for ANY table view, live or replayed
  // (owner, 2026-09-28: history plays on the real table). The live page (/table/[id]) feeds it the
  // server's views; the replay page (/replay/[id]) feeds it views rebuilt from a recording. Every
  // animation (deal, flips, bets → pot → winner, all-in, glides, moments) and every sound comes from
  // diffing one view against the next, so both get all of them. Re-mount it ({#key}) to JUMP to a
  // view without animating the way there: the motion engines take their first view as the baseline.
  //
  // It renders no wrapper element: its layers and the arena sit straight in the page's .tablepage,
  // exactly as when they lived in the page.
  import PokerTable from "./PokerTable.svelte";
  import BankedTable from "./BankedTable.svelte";
  import BetGameTable from "./BetGameTable.svelte";
  import ShedTable from "./ShedTable.svelte";
  import DeckLayer from "./DeckLayer.svelte";
  import MoneyLayer from "./MoneyLayer.svelte";
  import ButtonGlide from "./ButtonGlide.svelte";
  import CardLayer from "./CardLayer.svelte";
  import MomentLayer from "./MomentLayer.svelte";
  import { isBanked as isBankedGame, tableLayout } from "$lib/poker/games.js";
  import { tableSounds } from "$lib/poker/table-sounds.svelte.js";
  import { tableMotion } from "$lib/poker/table-motion.svelte.js";
  import { fade } from "svelte/transition";
  import { d, DUR } from "$lib/motion.js";
  import { dev } from "$app/environment";
  import { MOMENT_MS, allInMs } from "$lib/poker/moments.js";

  let {
    view = null, me = null, privates = null,
    deadline = null,            // my turn's deadline (the turn clock's ticks)
    pick = null,                // Big Two card picking (my turn)
    onSit = () => {},
    loadingText = "Loading table…",
    watchOnly = false,          // a replay: nobody can sit
    onMotion = () => {}         // hands the page the table's motion (the replay paces itself by it)
  } = $props();

  let gameKey = $derived(view?.game || view?.config?.variant);
  let banked = $derived(isBankedGame(gameKey));
  let layout = $derived(tableLayout(gameKey));
  let betGame = $derived(layout === "bet");
  let shedGame = $derived(layout === "shed");
  let mySeat = $derived(me && view ? (view.seats || []).find((s) => s.userId === me.id) || null : null);

  tableSounds({
    get view() { return view; }, get me() { return me; },
    get dealer() { return motion.dealer; }, get bank() { return motion.bank; }, get cards() { return motion.cards; },
    get deadline() { return deadline; }
  });
  const motion = tableMotion({
    get view() { return view; }, get mySeatNo() { return mySeat?.seat ?? null; }, get privates() { return privates; }
  });
  onMotion(motion);
  const dealer = $derived(motion.dealer);
  const bank = $derived(motion.bank);

  // DEV ONLY: ?moment=monsterPot|rare|royal|roulette|sic-bo|slots|bigTwo plays a sample moment with this
  // table's players (moments are rare in real play; this is how they get checked). Compiled out of builds.
  let devMomentDone = false;
  $effect(() => {
    if (!dev || !view || devMomentDone) return;
    const k = new URLSearchParams(location.search).get("moment");
    const seats = (view.seats || []).filter((s) => s.userId != null);
    if (!k || !seats.length) return;
    devMomentDone = true;
    const a = seats[0].seat, others = seats.slice(1).map((s, i) => ({ seat: s.seat, cards: 2 + i * 3, pays: 100 * (2 + i * 3) }));
    const sample = {
      monsterPot: { kind: "monsterPot", seat: a, amount: 18640, won: 18640, bb: 93 },
      allIn: seats[1] ? { kind: "allIn", from: 0, board: ["Kd", "7c", "2h", "5s", "Qc"], stages: [{ board: 0, pct: { [a]: 46, [seats[1].seat]: 54 } }, { board: 3, pct: { [a]: 92, [seats[1].seat]: 8 } }, { board: 4, pct: { [a]: 95, [seats[1].seat]: 5 } }, { board: 5, pct: { [a]: 0, [seats[1].seat]: 100 } }],
        players: [{ seat: a, cards: ["Ah", "Kh"], best: null, won: false }, { seat: seats[1].seat, cards: ["Qs", "Qd"], best: ["Qs", "Qd", "Qc", "Kd", "7c"], handName: "Three of a Kind", won: true }] } : null,
      rare: { kind: "rare", seat: a, cards: ["9s", "9h", "9d", "9c", "Kh"], name: "Four of a Kind", royal: false, game: "holdem" },
      royal: { kind: "rare", seat: a, cards: ["Ts", "Js", "Qs", "Ks", "As"], name: "Royal Flush", royal: true, game: "holdem" },
      roulette: { kind: "jackpot", seat: a, game: "roulette", outcome: { pocket: 17 }, mult: 35, bet: 200, payout: 7000 },
      "sic-bo": { kind: "jackpot", seat: a, game: "sic-bo", outcome: { dice: [5, 5, 5] }, mult: 30, bet: 200, payout: 6000 },
      slots: { kind: "jackpot", seat: a, game: "slots", outcome: { reels: ["diamond", "diamond", "diamond"] }, mult: 100, bet: 200, payout: 20000 },
      bigTwo: { kind: "bigTwo", seat: a, pile: ["8s", "8h", "8d", "Kc", "Kh"], pot: others.reduce((x, o) => x + o.pays, 0), others }
    }[k];
    if (!sample) return;
    const ms = k === "royal" ? MOMENT_MS.royal : k === "allIn" ? allInMs(0) : MOMENT_MS[sample.kind];
    setTimeout(() => { motion.moment = { ...sample, ms, id: "dev" }; setTimeout(() => { motion.moment = null; }, ms + 60); }, 800);
  });
</script>

{#if bank}<MoneyLayer {bank} />{/if}
{#if view && layout === "poker"}<ButtonGlide {view} />{/if}
<!-- the shuffle is a moment: the table blurs behind the deck while it plays (Hold'em's DeckLayer, or
     the other card games' CardLayer — both sit above this veil) -->
{#if dealer?.shuffling || motion.cardShuffling}<div class="shuffle-veil" aria-hidden="true" transition:fade={{ duration: d(DUR.base) }}></div>{/if}
{#if motion.cards}<CardLayer motion={motion.cards} onShuffling={(on) => (motion.cardShuffling = on)} />{/if}
{#if motion.moment}{#key motion.moment.id}<MomentLayer moment={motion.moment} {view} />{/key}{/if}
{#if dealer}<DeckLayer {dealer} />{/if}

<!-- the arena: seats around the ring, my seat + big cards at the bottom -->
<div class="arena-wrap">
  {#if view}
    {#if shedGame}
      <ShedTable {view} {me} hand={privates?.holeCards || []} {onSit} {pick} {watchOnly} />
    {:else if betGame}
      <BetGameTable {view} {me} {onSit} {watchOnly} />
    {:else if banked}
      <BankedTable {view} {me} {onSit} {watchOnly} />
    {:else}
      <PokerTable {view} {me} {privates} {onSit} {dealer} {watchOnly} />
    {/if}
  {:else}
    <div class="loading"><p class="muted">{loadingText}</p></div>
  {/if}
</div>

<style>
  .shuffle-veil { position: absolute; inset: 0; z-index: 5; pointer-events: none; background: rgba(6, 10, 22, 0.35); backdrop-filter: blur(7px) saturate(.85); -webkit-backdrop-filter: blur(7px) saturate(.85); }
  .arena-wrap { flex: 1; min-height: 0; position: relative; padding: 48px 8px 0; }
  .loading { height: 100%; display: grid; place-items: center; }
  @media (max-width: 960px) {
    .arena-wrap { flex: none; height: 72vh; padding-top: 88px; }   /* the title wraps on phones */
  }
</style>
