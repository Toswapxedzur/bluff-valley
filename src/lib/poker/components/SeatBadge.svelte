<script>
  import Avatar from "./Avatar.svelte";
  import Num from "./Num.svelte";
  import CoinStack from "./CoinStack.svelte";
  import HandFan from "./HandFan.svelte";
  import { scale, fade, fly } from "svelte/transition";
  import { d, DUR, NORM, tween } from "$lib/motion.js";
  import { getContext, untrack } from "svelte";
  import { plateStyle, ringBox } from "$lib/cosmetics.js";
  import { plateSpread } from "$lib/actions/plate-spread.js";
  import { cueAt } from "$lib/poker/table-audio.js";

  // The one seat badge every game uses: avatar · name · stack · status line, with
  // the player's cards fanned underneath. Layout is the same for every game; games
  // only decide WHAT goes in the status line and which cards are shown.
  //   seat       — TableView seat ({userId, name, avatar, stack, isToAct, sittingOut,
  //                connected, status, lastAction, committed, isButton/isSB/isBB}) | null.
  //   isMine     — my own seat: bigger cards, side-by-side for ≤2, fanned above.
  //   cards      — string[] face-up cards | null; `cardCount` backs when null.
  //   cardCount  — number of face-down cards to show.
  //   line       — status text override (e.g. "bet 40", "18 bust", "win +30").
  //   lineKind   — "" | "win" | "lose" | "push" | "muted" — colours the line.
  //   deadline   — action deadline (ms) when this seat is to act (countdown ring).
  //   winner/won — highlight + floating winnings.
  //   canSit/onSit/seatNo — empty-seat button.
  //   selectable/onSelect/labelOf — forwarded to HandFan for pick-a-card turns.
  //   reveal     — false: my own cards show their backs (just dealt, about to flip).
  //   hideCards  — the hand is on the dealer's canvas (in the air / collected): keep its place, hide it.
  //   house      — render as the House (dealer) badge: label + bankroll, no ring.
  let {
    seat: seatIn = null, isMine = false, me = null,
    cards = null, cardCount = 0, reveal = true, hideCards = false,
    line = null, lineKind = "",
    deadline = null, winner = false, won = 0,
    canSit = false, onSit = () => {}, seatNo = 0,
    selectable = null, onSelect = () => {}, labelOf = null,
    house = false, size = "sm", children = null,
    lost = false,           // this hand is out (a bust, a fold): the shared fold dim + one shake
    handSpace = 0,          // px to keep for this seat's hand from the start (a card game: the card height)
    cardWidth = 82          // the table's card size (my hand + centre); shrinks on crowded tables
  } = $props();

  // The table's bank (coin motion, every game mode): while coins move, the stack number is the
  // bank's (it drops as a bet leaves, counts up as winnings sink in) and the coins themselves
  // replace the bet / winnings pills. Absent under reduced motion → the pills and the view's stack.
  // Arriving / leaving (the norm: ring draw 600 ms). Someone sitting down while we watch: the plate
  // fades in and the ring draws on round the avatar, gem by gem. Someone leaving: the ring un-draws,
  // then the plate fades — the last seat stays on screen (`leaving`) until then, so nothing jumps.
  let ringDraw = $state(1), leaving = $state(null), gone = $state(false);
  let seat = $derived(seatIn && seatIn.userId != null ? seatIn : leaving);
  let lastSeat = null, lastUid = untrack(() => seatIn?.userId ?? null), stopDraw = () => {};
  $effect(() => {
    const s = seatIn, uid = s?.userId ?? null;
    untrack(() => {
      if (uid != null) lastSeat = s;
      if (uid === lastUid) return;
      const was = lastUid;
      lastUid = uid;
      stopDraw();
      if (house) return;
      if (uid != null) {                                       // arrived
        leaving = null; gone = false; ringDraw = 0;
        stopDraw = tween(NORM.ringDraw, (k) => { ringDraw = k; });
      } else if (was != null && lastSeat) {                    // left
        leaving = lastSeat; gone = false;
        stopDraw = tween(NORM.ringDraw, (k) => {
          ringDraw = 1 - k;
          if (k >= 1) { gone = true; setTimeout(() => { if (lastUid == null) { leaving = null; gone = false; ringDraw = 1; } }, 220); }
        });
      }
    });
  });
  $effect(() => () => stopDraw());

  // My own hand goes out (a bust, a fold): a knock with its shake
  let wasLost = untrack(() => lost);
  $effect(() => {
    const now = !!lost;
    untrack(() => { if (now && !wasLost && isMine) cueAt("bust", performance.now() + 20); wasLost = now; });
  });

  // My turn starts: one glow laps my ring (then its gems count the clock down)
  let glowKey = $state(0), wasToAct = false;
  $effect(() => {
    const on = !!(seat?.isToAct && isMine);
    untrack(() => { if (on && !wasToAct) glowKey += 1; wasToAct = on; });
  });

  const bankCtx = getContext("bank");
  let bank = $derived(bankCtx?.current ?? null);
  let stackShown = $derived(bank && seat ? bank.stackFor(house ? "house" : seatNo) : null);

  const RING_MAX_MS = 25_000;
  let nowMs = $state(Date.now());
  $effect(() => {
    if (!seat?.isToAct || !deadline) return;
    nowMs = Date.now();
    const id = setInterval(() => { nowMs = Date.now(); }, 100);
    return () => clearInterval(id);
  });
  let remainMs = $derived(seat?.isToAct && deadline ? Math.max(0, deadline - nowMs) : 0);
  let remainSec = $derived(Math.ceil(remainMs / 1000));
  let frac = $derived(Math.max(0, Math.min(1, remainMs / RING_MAX_MS)));
  let urgent = $derived(seat?.isToAct && remainMs > 0 && remainMs <= 6000);

  let folded = $derived(seat?.status === "folded");
  // the all-in shows when its pile LANDS (the stamp + red pulse ride the drop), not when the bet leaves
  let allin = $derived(seat?.status === "allin" && !(bank?.airborne ?? []).includes(seatNo));
  let sittingOut = $derived(!!seat?.sittingOut);
  let badge = $derived(seat?.isButton ? "D" : seat?.isSB ? "SB" : seat?.isBB ? "BB" : null);
  // Default status line: all-in / sitting out / last action; games may override via `line`.
  // The blind markers already show as chips next to the name; don't repeat them as status.
  let statusText = $derived(line != null ? line : allin ? "ALL-IN" : sittingOut ? "sitting out" : (seat?.lastAction && seat.lastAction !== "SB" && seat.lastAction !== "BB" ? seat.lastAction : ""));
  let statusKind = $derived(line != null ? lineKind : allin ? "allin" : sittingOut ? "muted" : "muted");
  // Same card size as my hand and the centre (82 px). Opponents / the House keep it too unless
  // their fan would be wider than an opponent badge can afford; then it shrinks to fit.
  const MIN_W = 34;
  let cardW = $derived.by(() => {
    const base = cardWidth;
    if (isMine) return base;
    // Opponents: same size as my hand, or smaller when their fan would not fit an
    // opponent badge (≈2.6 card widths). Never larger than mine.
    const n = (cards && cards.length) || cardCount || 0;
    if (n <= 0) return base;
    const cap = base * 2.6;
    const total = n > 2 ? base * (1 + 0.38 * (n - 1)) : n * base + (n - 1) * 5;
    return total <= cap ? base : Math.max(MIN_W, Math.floor(base * cap / total));
  });
  let avSize = $derived(isMine ? 36 : 28);
  // Layout stability (owner, 2026-09-26: everything stays in one place, whatever happens, in every
  // game). The seat's box is ONLY its fixed-size plate plus a constant hang below it: the hand, the
  // bet summary and anything else under the plate are positioned absolutely, so nothing they do —
  // cards dealt or mucked, a bet list appearing — changes the seat's size. An empty seat has exactly
  // the plate's size, so someone sitting down moves nothing either. `hang` is the room a card game
  // keeps under the plate (its card height, + the lift a picked card gets on my own hand).
  let hasCards = $derived(!!((cards && cards.length) || cardCount > 0));
  let hang = $derived(handSpace > 0 ? handSpace + (isMine ? 14 : 0) + 6 : 0);
  // cosmetics: the player's ring round the avatar, and their badge = the plate's stepped colour, with
  // their banner (their own picture, $lib/banner.js) laid over it (the House keeps its own plate, no ring)
  let look = $derived(!house && seat ? plateStyle(seat.badge || "default", seat.banner ?? null) : null);
  let plateVars = $derived(look ? `background:${look.bg};--plate-ink:${look.ink};--plate-sub:${look.sub};--plate-money:${look.money}` : undefined);
  // the turn clock IS the ring: its gems vanish one by one as the time runs down (no separate circle)
  let ringRemain = $derived(Math.min(ringDraw, seat?.isToAct && deadline ? frac : 1));
</script>

<div class="seat" style="--hang:{hang}px" data-seat={house ? undefined : seatNo} data-house={house ? "" : undefined} class:mine={isMine} class:folded class:sitting-out={sittingOut} class:winner class:allin class:house class:toact={!!seat?.isToAct} class:leaving={!!leaving} class:gone>
  {#if seat && seat.userId != null}
    {#if winner && won > 0 && !bank}
      <div class="won" in:fly={{ y: d(10), duration: d(DUR.slow) }} out:fade={{ duration: d(DUR.base) }}>
        <CoinStack value={won} size={17} />+<Num value={won} />
      </div>
    {/if}
    {#if !house && seat.committed > 0 && !bank}
      <div class="bet" in:scale={{ start: 0.6, duration: d(DUR.base) }} out:fade={{ duration: d(DUR.fast) }}><CoinStack value={seat.committed} size={18} /><Num value={seat.committed} /></div>
    {/if}

    <div class="plate" style={plateVars} use:plateSpread={look?.bg} in:fade={{ duration: d(DUR.base) }}>   <!-- fades in: no size change -->
      <div class="av">
        <Avatar id={seat.userId} name={house ? "House" : seat.name} mediaId={seat.avatar ?? null} userId={isMine || house ? null : seat.userId} size={avSize} ring={house ? null : seat.ring || "default"} {ringRemain} ringFloat />
        {#key glowKey}{#if glowKey}<span class="turnglow" style="--box:{ringBox(avSize)}px;--in:{avSize / 2}px" aria-hidden="true"></span>{/if}{/key}
      </div>
      <div class="txt">
        <!-- owner, 2026-09-26: the name with the D / SB / BB marker right of it (a long name gives way with
             an ellipsis); the chips, the status and the countdown on the second row -->
        <div class="row1">
          <span class="name" title={seat.name}>{house ? "House" : seat.name}</span>
          {#if badge}<span class="badge b-{badge.toLowerCase()}">{badge}</span>{/if}
          {#if !seat.connected && !house}<span class="dot off" title="disconnected"></span>{/if}
        </div>
        <div class="row3 {statusKind}">
          <span class="stack">{#if stackShown != null}{stackShown.toLocaleString()}{:else}<Num value={seat.stack} />{/if}</span>
          <span class="status">{statusText}</span>
          <!-- always there (hidden when not acting), so nothing moves as the turn passes -->
          <span class="secs" class:urgent class:off={!(seat.isToAct && deadline)}>{seat.isToAct && deadline ? remainSec : 88}s</span>
        </div>
      </div>
    </div>

    <!-- everything under the plate HANGS: it never counts toward the seat's size -->
    <div class="below">
      {#if children}<div class="extra">{@render children()}</div>{/if}
      <div class="hand" class:dealt-away={hideCards} class:has={hasCards} class:lost data-cards={house ? "house" : `s${seatNo}`}>
        <HandFan {cards} count={cardCount} width={cardW} fan={isMine ? "auto" : (cardCount > 3 || (cards?.length ?? 0) > 3 ? "stack" : "auto")} {selectable} {onSelect} {labelOf} {reveal} />
      </div>
    </div>
  {:else}
    <div class="empty">
      {#if canSit}
        <button class="btn sit-btn" onclick={() => onSit(seatNo)}>Sit here</button>
      {:else if me}
        <span class="empty-lbl">Empty</span>
      {:else}
        <a class="empty-lbl link" href="/account/login">Sign in to sit</a>
      {/if}
    </div>
  {/if}
</div>

<style>
  /* a fixed box: the plate's width × (plate + hang); what hangs below never counts */
  .seat { position: relative; display: block; width: var(--plate-w, 152px); padding-bottom: var(--hang, 0px); }
  .seat.mine { width: var(--plate-w-mine, 184px); }
  .below { position: absolute; left: 50%; top: calc(100% - var(--hang, 0px) + 6px); transform: translateX(-50%);
    display: flex; flex-direction: column; align-items: center; gap: 6px; width: max-content; }
  .bet {
    position: absolute; top: -26px; left: 50%; transform: translateX(-50%); z-index: 5; white-space: nowrap;   /* out of the seat's layout */
    display: inline-flex; align-items: center; gap: 5px; padding: 2px 9px 2px 4px;
    font-size: 12px; font-weight: 800; color: var(--gold-ink);
    background: color-mix(in srgb, var(--surface) 78%, #000 22%); border-radius: 999px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.45); font-variant-numeric: tabular-nums;
  }
  .won {
    position: absolute; top: -18px; left: 50%; transform: translateX(-50%); z-index: 6;
    display: inline-flex; align-items: center; gap: 4px; font-size: 13px; font-weight: 800; color: var(--gold-ink);
    background: color-mix(in srgb, var(--surface) 90%, transparent); padding: 2px 9px 2px 5px; border-radius: 999px;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.45), 0 0 0 1px color-mix(in srgb, var(--gold) 45%, transparent);
    white-space: nowrap; pointer-events: none; font-variant-numeric: tabular-nums;
  }
  .plate {
    position: relative; display: flex; align-items: center; gap: 7px;
    padding: 4px 8px 4px 5px; box-sizing: border-box;
    width: 100%; height: 38px;   /* FIXED (width from the stage): nothing inside may resize it; the name takes an ellipsis;
                                    the avatar's ring overhangs the plate (owner, 2026-09-26) */
    background: var(--surface); border-radius: 14px; box-shadow: var(--shadow-card);
    transition: box-shadow var(--dur) var(--ease);
  }
  .mine .plate { height: 46px; }
  .mine .plate { background: var(--surface-2); box-shadow: 0 0 0 2px var(--accent-soft), var(--shadow-card); }
  .toact .plate { box-shadow: 0 0 0 2px var(--accent), 0 0 20px color-mix(in srgb, var(--accent) 45%, transparent); }
  .house .plate { background: color-mix(in srgb, var(--surface) 70%, var(--gold-bg) 30%); }
  .av { position: relative; z-index: 1; line-height: 0; flex: none; margin-right: 9px; }   /* room for the ring's overhang, then a little air before the name */
  .mine .av { margin-right: 11px; }
  .txt { position: relative; z-index: 1; display: flex; flex-direction: column; min-width: 0; flex: 1; text-align: left; }
  .row1 { display: flex; align-items: baseline; gap: 6px; }
  .row1 .badge, .row1 .dot { align-self: center; }
  .name { font-size: 13px; font-weight: 700; color: var(--plate-ink, var(--text)); min-width: 0; flex: 0 1 auto; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .row1 > :not(.name) { flex: none; }
  .mine .name { font-size: 14px; }
  .badge { font-size: 9px; font-weight: 800; line-height: 1; padding: 2px 4px; border-radius: 4px; color: #12202e; }
  .b-d { background: #f3f6fb; } .b-sb { background: #a9dcef; } .b-bb { background: #e7c14b; }
  .dot.off { width: 7px; height: 7px; border-radius: 50%; background: var(--muted); opacity: 0.6; }
  .stack { font-size: 13px; font-weight: 700; color: var(--plate-money, var(--gold-ink)); font-variant-numeric: tabular-nums; }
  .mine .stack { font-size: 15px; }
  .secs { font-size: 11px; color: var(--plate-sub, var(--muted)); font-variant-numeric: tabular-nums; }
  .secs.urgent { color: var(--danger); font-weight: 700; }
  .secs.off { visibility: hidden; }
  .row3 { display: flex; gap: 6px; }
  .row3 { align-items: baseline; }
  .row3 .stack { flex: none; }
  .row3 .stack { font-size: 12px; line-height: 1.1; }
  .mine .row3 .stack { font-size: 13px; }
  .row1 { line-height: 1.1; }
  .txt { justify-content: center; gap: 1px; }
  .row3 .status { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; }
  .row3 .secs { flex: none; margin-left: auto; }
  .row3 { font-size: 11px; min-height: 13px; line-height: 1.1; color: var(--plate-sub, var(--muted)); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .row3.win { color: var(--ok); font-weight: 700; }
  .row3.lose { color: var(--danger); font-weight: 700; }
  .row3.push { color: var(--gold-ink); font-weight: 700; }
  .row3.allin { color: var(--danger); font-weight: 800; letter-spacing: 0.4px; }
  .hand { line-height: 0; }
  .hand.dealt-away { visibility: hidden; }
  .extra { display: flex; justify-content: center; }
  .hand:not(.has) { display: none; }
  .plate, .hand { transition: opacity 0.4s var(--ease), filter 0.4s var(--ease), box-shadow var(--dur) var(--ease); }
  .seat.folded .plate, .seat.folded .hand { opacity: 0.42; filter: grayscale(0.4); }
  .seat.sitting-out .plate { opacity: 0.7; }
  .seat.gone .plate { opacity: 0; }
  .hand.lost { opacity: 0.42; filter: grayscale(0.4); animation: lostshake 0.26s ease-out 1; }
  @keyframes lostshake { 25% { transform: translate(4px, -2px); } 50% { transform: translate(-4px, 1px); } 75% { transform: translate(2px, 0); } }
  .seat.leaving .below { visibility: hidden; }
  /* the your-turn glow: a bright arc once round the ring band (masked to the band) */
  .turnglow {
    position: absolute; left: 50%; top: 50%; width: var(--box); height: var(--box); margin: calc(var(--box) / -2) 0 0 calc(var(--box) / -2);
    border-radius: 50%; pointer-events: none; z-index: 2;
    background: conic-gradient(from 0deg, transparent 0 62%, rgba(255,255,255,0.95) 88%, transparent 100%);
    -webkit-mask: radial-gradient(circle, transparent calc(var(--in) - 1px), #000 var(--in), #000 calc(var(--box) / 2 - 1px), transparent calc(var(--box) / 2));
    mask: radial-gradient(circle, transparent calc(var(--in) - 1px), #000 var(--in), #000 calc(var(--box) / 2 - 1px), transparent calc(var(--box) / 2));
    animation: turnglow 0.9s cubic-bezier(.4,0,.3,1) 1 forwards;
  }
  @keyframes turnglow {
    0% { transform: rotate(0deg); opacity: 0; }
    15%, 80% { opacity: 1; }
    100% { transform: rotate(360deg); opacity: 0; }
  }
  .seat.winner .plate { box-shadow: 0 0 0 2px rgba(74,222,128,0.65), 0 0 18px rgba(74,222,128,0.4); animation: winpulse 1.1s ease-in-out 2; }
  .seat.allin .plate { box-shadow: 0 0 0 2px color-mix(in srgb, var(--danger) 72%, transparent), 0 0 16px color-mix(in srgb, var(--danger) 32%, transparent); animation: allinpulse 0.7s ease-out 1; }
  .row3.allin .status { display: inline-block; animation: stamp 0.36s cubic-bezier(.3,1.45,.5,1) 1; transform-origin: left center; }
  @keyframes allinpulse {
    0% { box-shadow: 0 0 0 0 rgba(239,68,68,0); }
    45% { box-shadow: 0 0 0 4px rgba(239,68,68,0.9), 0 0 24px rgba(239,68,68,0.55); }
    100% { box-shadow: 0 0 0 2px color-mix(in srgb, var(--danger) 72%, transparent), 0 0 16px color-mix(in srgb, var(--danger) 32%, transparent); }
  }
  @keyframes stamp { from { transform: scale(1.6); opacity: 0; } to { transform: scale(1); opacity: 1; } }
  @keyframes winpulse {
    0%, 100% { box-shadow: 0 0 0 2px rgba(74,222,128,0.5), 0 0 12px rgba(74,222,128,0.3); }
    50% { box-shadow: 0 0 0 3px rgba(74,222,128,0.85), 0 0 24px rgba(74,222,128,0.55); }
  }
  .empty { display: flex; align-items: center; justify-content: center; width: 100%; height: 38px; box-sizing: border-box; border-radius: 14px; background: var(--well); box-shadow: inset 0 0 0 1px rgba(128,128,128,0.10); }
  .sit-btn { font-size: 12px; padding: 6px 12px; }
  .empty-lbl { font-size: 12px; color: var(--muted); }
  .empty-lbl.link { text-decoration: none; }
  @media (prefers-reduced-motion: reduce) { .seat.winner .plate, .seat.allin .plate, .row3.allin .status { animation: none; } .turnglow { display: none; } }
</style>
