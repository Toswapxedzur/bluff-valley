// Replays on the REAL table (owner, 2026-09-28): a recorded match (see poker/recorder.js) re-simulated
// through the pure engines and turned, step by step, into the SAME table views the live server
// broadcasts (table.js / runtime.js publicView) — so the shared TableStage draws a replay exactly like
// live play, with every animation (they all diff one view against the next).
//
// Steps (owner, 2026-09-29: "for each tiny action, a frame"), each coming a `gap` after the last:
//   Hold'em — before the deal · the blinds posted · cards dealt · one per action (an action that closes
//     a street keeps its street; the next street is dealt as its own step) · an all-in's run-out /
//     the rest of the board a street a step · the showdown, one hand at a time (the last to bet or raise
//     first) · the pots paid, one step each (main pot, side pots)
//   other games — before the deal · the round starts · one per action · the automatic part a step
//     each (the dealer turns over / hits, baccarat's draws, the ball, the dice, the reels, the dealer's
//     three cards) · the result
// Privacy is decided by the caller: `viewerSeat` gets its own private cards (hole cards / a Big Two
// hand); everyone else is public view only, exactly what a watcher at the table saw.
import { createHand, applyAction as pokerApply } from "./poker/engine/index.js";
import { GAMES } from "./poker/games/registry.js";
import { tableLayout } from "../poker/games.js";
import { momentOfResult, momentLabel } from "../poker/moments.js";

const THINK_CAP_MS = 1500;          // a long think plays at most this long (at 1×)
const RESULT_HOLD_MS = 1200;        // the last action → the result
const RUNOUT_MS = 1500;             // an all-in run-out: one street → the next (the board deals, the chances update)
const STREET = { 3: "Flop", 4: "Turn", 5: "River" };
const STREET_MS = 1000;             // a street dealt: its own step (owner, 2026-09-29: every tiny action a frame)
const SHOW_MS = 1100;               // one hand turned up at the showdown
const POT_MS = 1300;                // the next pot paid (a side pot)
const AUTO_MS = 1100;               // a dealer's draw / the ball / the dice / the reels
const MIN_GAP_MS = 400;             // no two steps closer than this
const SUIT = { s: "♠", h: "♥", d: "♦", c: "♣" };
const cardText = (c) => (c && c !== "??" ? `${c[0] === "T" ? "10" : c[0]}${SUIT[c[1]] || ""}` : "?");
const cardsText = (cs) => (cs || []).map(cardText).join(" ");
const fmt = (n) => Number(n || 0).toLocaleString("en-US");
const DEAL_MS = 900;                // the table before the deal → dealt

// The live table's action labels (table.js onAction)
const POKER_LABEL = { fold: "Fold", check: "Check", call: "Call", allin: "All-in" };
const pokerLabel = (a) => (a.type === "bet" ? `Bet ${a.amount}` : a.type === "raise" ? `Raise ${a.amount}` : POKER_LABEL[a.type] ?? null);

// one readable line per step, for the play bar ("Johnny raises to 400", "Ivy stands")
const VERBS = {
  fold: "folds", check: "checks", call: "calls", bet: "bets", raise: "raises to", allin: "goes all-in",
  hit: "hits", stand: "stands", double: "doubles down", split: "splits", surrender: "surrenders", insurance: "takes insurance",
  play: "plays", pass: "passes", ante: "antes", spin: "spins", roll: "rolls", deal: "deals", place: "bets"
};
function stepText(name, a) {
  if (!a) return null;
  const type = String(a.type || "");
  const verb = VERBS[type] ?? type.replace(/[-_]/g, " ");
  // a betting game's action carries its spots: say the total
  const sum = Array.isArray(a.bets) ? a.bets.reduce((t, b) => t + (Number(b?.amount) || 0), 0) : null;
  const n = sum ?? (a.amount != null && a.amount !== "" && Number.isFinite(Number(a.amount)) ? Number(a.amount) : null);
  if (sum === 0) return `${name} skips this round`;
  const amt = n ? ` ${n.toLocaleString("en-US")}` : "";
  return `${name} ${verb}${amt}`;
}

// Table config: recordings since 2026-09-28 carry the live table's settings (doc.table); older ones
// fall back to the game's usual table so the seats still sit where they would have.
function tableConfig(doc, row) {
  const layout = tableLayout(doc.mode === "holdem" ? doc.variant || "holdem" : doc.mode);
  const t = doc.table || {};
  const sb = t.smallBlind ?? doc.config?.smallBlind ?? doc.config?.minBet ?? 10;
  const maxSeat = Math.max(0, ...(doc.players || []).map((p) => p.seat));
  const maxSeats = Math.max(t.maxSeats ?? (layout === "poker" ? 9 : layout === "shed" ? 4 : 7), maxSeat + 1);
  return {
    name: t.name ?? row.table_name ?? "Replay",
    variant: doc.mode === "holdem" ? doc.variant || "holdem" : doc.mode,
    smallBlind: sb,
    bigBlind: t.bigBlind ?? doc.config?.bigBlind ?? sb * 2,
    maxSeats,
    minBuyin: t.minBuyin ?? 0,
    maxBuyin: t.maxBuyin ?? 0,
    straddle: !!doc.config?.straddle,
    runItTwice: !!doc.config?.runItTwice
  };
}

// who sat where, as a live seat shows them: name + their CURRENT looks (looks at the time were never
// recorded) — `people`: seat → { userId, name, avatar, ring, badge, banner }
function seatBase(p, people) {
  const who = people.get(p.seat) || {};
  return {
    seat: p.seat, userId: who.userId ?? p.userId ?? `seat-${p.seat}`, name: who.name ?? p.name ?? `Seat ${p.seat}`,
    avatar: who.avatar ?? null, ring: who.ring ?? "default", badge: who.badge ?? "default", banner: who.banner ?? null,
    sittingOut: false, connected: true
  };
}

// ---------------------------------------------------------------- Hold'em (every poker variant)
function holdemReplay(doc, row, { people, viewerSeat }) {
  const config = tableConfig(doc, row);
  let state = createHand({
    variant: doc.variant || "holdem",
    players: doc.players.map((p) => ({ id: p.seat, seat: p.seat, stack: p.stack })),
    buttonSeat: doc.buttonSeat, smallBlind: doc.config.smallBlind, bigBlind: doc.config.bigBlind,
    straddle: doc.config.straddle, runItTwice: doc.config.runItTwice, deck: [...doc.deck]
  });
  const blinds = (state.initialEvents || []).find((e) => e.type === "blindsPosted");
  const sbSeat = blinds?.smallBlind?.seat ?? null, bbSeat = blinds?.bigBlind?.seat ?? null;
  const lastAction = new Map();
  if (sbSeat != null) lastAction.set(sbSeat, "SB");
  if (bbSeat != null) lastAction.set(bbSeat, "BB");
  const holes = Object.fromEntries((state.players || []).map((p) => [p.seat, [...(p.holeCards || [])]]));
  const base = { id: `replay-${row.id}`, config, handNo: row.hand_no == null ? 0 : Number(row.hand_no), buttonSeat: doc.buttonSeat, actionDeadline: null, tournament: null };
  const potOf = (st) => (st.players || []).reduce((s, p) => s + (p.totalCommitted || 0), 0);
  const nameOf = (seat) => seatBase(doc.players.find((p) => p.seat === seat) || { seat }, people).name;

  const liveView = (st) => ({
    ...base, phase: "running", street: st.street, board: [...(st.board || [])], potTotal: potOf(st),
    pots: (st.pots || []).map((p) => ({ ...p })), toActSeat: st.toActSeat ?? null, result: null,
    seats: doc.players.map((p) => {
      const ep = st.players.find((x) => x.seat === p.seat);
      return {
        ...seatBase(p, people), stack: ep ? ep.stack : p.stack, committed: ep ? ep.committedThisStreet : 0,
        status: ep ? ep.status : null, inHand: true, hasCards: true,
        isButton: p.seat === doc.buttonSeat, isSB: p.seat === sbSeat, isBB: p.seat === bbSeat,
        isToAct: p.seat === st.toActSeat, lastAction: lastAction.get(p.seat) ?? null, timeBankMs: 0, usingTimeBank: false
      };
    })
  });

  const mine = viewerSeat != null && holes[viewerSeat] ? { seat: viewerSeat, holeCards: holes[viewerSeat] } : null;
  const steps = [], privates = [];
  const push = (step, priv) => { steps.push(step); privates.push(priv); };

  // the table before the deal — still on the previous hand's number, as a live table is while it waits
  push({
    gap: 0, text: "Before the deal",
    view: {
      ...base, handNo: base.handNo - 1, phase: "waiting", street: null, board: [], potTotal: 0, pots: [], toActSeat: null, result: null,
      seats: doc.players.map((p) => ({ ...seatBase(p, people), stack: p.stack, committed: 0, status: null, inHand: false, hasCards: false,
        isButton: p.seat === doc.buttonSeat, isSB: false, isBB: false, isToAct: false, lastAction: null, timeBankMs: 0, usingTimeBank: false }))
    }
  }, null);
  // the blinds go in (a NEW hand to the motion engines: the button glides, the blinds leave the stacks)…
  const bl = liveView(state);
  bl.toActSeat = null;
  bl.seats = bl.seats.map((x) => ({ ...x, hasCards: false, isToAct: false }));
  push({ gap: 700, text: bl.seats.filter((x) => x.committed > 0).sort((x, y) => x.committed - y.committed).map((x) => `${x.name} posts ${fmt(x.committed)}`).join(" · ") || "Blinds", view: bl }, null);
  // …then the cards are dealt
  push({ gap: DEAL_MS, text: "Cards dealt", view: liveView(state) }, mine);

  let prevRaw = 0, lastStreet = null, aggressor = null, closing = null;
  for (const a of doc.actions) {
    const { s, t, auto: _a, ...rest } = a;
    const before = state;
    ({ state } = pokerApply(state, { ...rest, seat: s }));
    lastAction.set(s, pokerLabel(a));
    if (before.street !== lastStreet) { lastStreet = before.street; aggressor = null; }
    if (a.type === "bet" || a.type === "raise" || (a.type === "allin" && state.players.find((x) => x.seat === s)?.totalCommitted > Math.max(...before.players.filter((x) => x.seat !== s).map((x) => x.totalCommitted || 0)))) aggressor = s;
    const think = Math.min(THINK_CAP_MS, Math.max(0, (t || 0) - prevRaw));
    prevRaw = t || 0;
    const text = stepText(nameOf(s), a) + (a.auto ? " (timed out)" : "");
    const moved = !!state.result || state.street !== before.street || (state.board || []).length !== (before.board || []).length;
    if (!moved) { push({ gap: Math.max(MIN_GAP_MS, think), text, view: liveView(state) }, mine); continue; }
    // the action that closed a street (or the hand), on that street: its chips go in, the board waits
    const bp = before.players.find((x) => x.seat === s), np = state.players.find((x) => x.seat === s);
    const d = Math.max(0, (np?.totalCommitted || 0) - (bp?.totalCommitted || 0));
    const av = liveView(before);
    av.toActSeat = null;
    av.potTotal = potOf(before) + d;
    av.seats = av.seats.map((x) => x.seat === s
      ? { ...x, stack: x.stack - d, committed: x.committed + d, status: np?.status ?? x.status, isToAct: false }
      : { ...x, isToAct: false });
    push({ gap: Math.max(MIN_GAP_MS, think), text, view: av }, mine);
    if (state.result) { closing = av; break; }
    // the next street, dealt as its own step
    const sv = liveView(state);
    push({ gap: STREET_MS, text: `${STREET[sv.board.length] || "Board"} · ${cardsText(sv.board.slice((before.board || []).length))}`, view: sv }, mine);
  }
  if (!closing) closing = liveView(state);

  // ---- the hand is over: the rest of the board, the showdown, then the pots, one step each
  const result = doc.final?.result ?? null;
  const board = result?.board || state.board || [];
  const from = closing.board.length;
  const streetOf = (n) => (n >= 5 ? "river" : n === 4 ? "turn" : n === 3 ? "flop" : "preflop");
  const pre = (over) => ({ ...closing, toActSeat: null, pots: [], seats: closing.seats.map((x) => ({ ...x, committed: 0, isToAct: false })), ...over });
  let shown = {};
  // An all-in run-out (owner, 2026-09-29): live, a full-screen moment deals it; a replay covers
  // nothing, so the hands turn up, then the flop / turn / river come a step each, every seat's line
  // showing its chance to win.
  const runout = result?.runout && !result.boards && (result.revealed || []).length >= 2 && result.runout.from === from ? result.runout : null;
  if (runout) {
    shown = Object.fromEntries(result.revealed.map((h) => [h.seat, [...h.holeCards]]));
    let at = from;
    for (const st of runout.stages) {
      const odds = result.revealed.map((h) => `${nameOf(h.seat)} ${st.pct[h.seat] ?? 0}%`).join(" · ");
      const head = st.board === runout.from ? "All in — hands up" : `${STREET[st.board] || "Board"} · ${cardsText(board.slice(at, st.board))}`;
      push({ gap: st.board === runout.from ? RESULT_HOLD_MS : RUNOUT_MS, text: `${head} · ${odds}`,
        view: pre({ board: board.slice(0, st.board), street: streetOf(st.board), shown: { ...shown }, equity: { ...st.pct } }) }, mine);
      at = st.board;
    }
  } else if (board.length > from && !result?.boards) {
    // the rest of the board with no recorded chances (an older recording): still a street a step
    let at = from;
    for (const n of [3, 4, 5].filter((n) => n > from && n <= board.length)) {
      push({ gap: STREET_MS, text: `${STREET[n]} · ${cardsText(board.slice(at, n))}`, view: pre({ board: board.slice(0, n), street: streetOf(n) }) }, mine);
      at = n;
    }
  }
  // the showdown: each hand turns up in turn — the last to bet or raise first, else clockwise from the button
  if (!runout && result?.type === "showdown" && (result.revealed || []).length) {
    const seats = result.revealed.map((h) => h.seat);
    const clockwise = [...seats].sort((x, y) => ((x - doc.buttonSeat + 100) % 100) - ((y - doc.buttonSeat + 100) % 100) || x - y);
    const order = aggressor != null && seats.includes(aggressor) ? [aggressor, ...clockwise.filter((x) => x !== aggressor)] : clockwise;
    for (const seat of order) {
      const h = result.revealed.find((x) => x.seat === seat);
      shown = { ...shown, [seat]: [...h.holeCards] };
      push({ gap: SHOW_MS, text: `${nameOf(seat)} shows ${cardsText(h.holeCards)}${h.handName ? ` — ${h.handName}` : ""}`,
        view: pre({ board, street: "showdown", shown: { ...shown } }) }, mine);
    }
  }
  // the pots, one step each (the main pot, then each side pot): winners paid, the rest still in the middle
  const winners = result?.winners || [];
  const total = new Map();
  for (const w of winners) total.set(w.seat, (total.get(w.seat) || 0) + (w.amount || 0));
  const engPots = state.result?.pots;
  let potShares;
  if (!result?.boards && Array.isArray(engPots) && engPots.length > 1) {
    potShares = engPots.map((pt) => splitPot(pt.amount, pt.winnerSeats || []));
    // odd chips: settle the last pot so every winner's total is exactly what the table paid
    const got = new Map();
    for (const shares of potShares) for (const x of shares) got.set(x.seat, (got.get(x.seat) || 0) + x.amount);
    const last = potShares[potShares.length - 1];
    for (const [seat, amt] of total) {
      const diff = amt - (got.get(seat) || 0);
      if (!diff) continue;
      const hit = last.find((x) => x.seat === seat);
      if (hit) hit.amount += diff; else last.push({ seat, amount: diff });
    }
    potShares = potShares.map((sh) => sh.filter((x) => x.amount > 0)).filter((sh) => sh.length);
  } else {
    potShares = [[...total].map(([seat, amount]) => ({ seat, amount })).filter((x) => x.amount > 0)];
  }
  const finalStack = new Map(state.players.map((p) => [p.seat, p.stack]));
  const potAll = [...total.values()].reduce((a, b) => a + b, 0);
  const handOf = (seat) => (result?.revealed || []).find((h) => h.seat === seat)?.handName || null;
  const paid = new Map();
  potShares.forEach((shares, i) => {
    for (const x of shares) paid.set(x.seat, (paid.get(x.seat) || 0) + x.amount);
    const owed = (seat) => (total.get(seat) || 0) - (paid.get(seat) || 0);
    const cum = [...paid].filter(([, a]) => a > 0).map(([seat, amount]) => ({ seat, amount }));
    const sum = shares.reduce((a, x) => a + x.amount, 0);
    const who = shares.length > 1 ? `${shares.map((x) => nameOf(x.seat)).join(" and ")} split ${fmt(sum)}` : shares.length ? `${nameOf(shares[0].seat)} wins ${fmt(sum)}` : "Result";
    const potName = potShares.length > 1 ? (i === 0 ? " · main pot" : ` · side pot${potShares.length > 2 ? ` ${i}` : ""}`) : "";
    const hand = result?.type === "showdown" && shares.length ? handOf(shares[0].seat) : null;
    push({
      gap: i === 0 ? RESULT_HOLD_MS : POT_MS, text: `${who}${potName}${hand ? ` · ${hand}` : ""}`,
      view: {
        ...base, phase: "running", street: "complete", board: [...board], potTotal: Math.max(0, potAll - [...paid.values()].reduce((a, b) => a + b, 0)),
        pots: [], toActSeat: null, result: result ? { ...result, winners: cum } : null,
        seats: doc.players.map((p) => ({ ...seatBase(p, people), stack: (finalStack.get(p.seat) ?? p.stack) - owed(p.seat), committed: 0, status: null, inHand: false, hasCards: false,
          isButton: p.seat === doc.buttonSeat, isSB: p.seat === sbSeat, isBB: p.seat === bbSeat, isToAct: false, lastAction: null, timeBankMs: 0, usingTimeBank: false }))
      }
    }, null);
  });
  const mo = momentOfResult("holdem", { ...doc.config, tournament: row.context === "tournament" || row.context === "sprint" }, result);
  if (mo) steps[steps.length - 1].mark = momentLabel(mo);
  timeline(steps);
  return { kind: "poker", steps, privates };
}

/** A pot split between winners: equal shares, odd chips to the first. */
function splitPot(amount, seats) {
  if (!seats.length) return [];
  const share = Math.floor(amount / seats.length);
  let odd = amount - share * seats.length;
  return seats.map((seat) => ({ seat, amount: share + (odd-- > 0 ? 1 : 0) }));
}

// ---------------------------------------------------------------- every other game (GameModules)
// A round's automatic part (owner, 2026-09-29: "each tiny action a frame"): live, the dealer's draws /
// the ball / the dice / the reels all land with the last player's move; a replay shows the table as
// that move left it, then each automatic move as its own step, then the payouts.
const bjValue = (cards) => {
  let v = 0, aces = 0;
  for (const c of cards) { const r = c[0]; if (r === "A") { aces += 1; v += 11; } else v += "TJQK".includes(r) ? 10 : Number(r); }
  while (v > 21 && aces) { v -= 10; aces -= 1; }
  return v;
};
const bacValue = (cards) => cards.reduce((a, c) => a + (c[0] === "A" ? 1 : "TJQK".includes(c[0]) ? 0 : Number(c[0])), 0) % 10;
const HIDE = { blackjack: ["dealer", "results", "phase"], "three-card": ["dealer", "results", "phase"], baccarat: ["outcome", "results", "phase"], roulette: ["outcome", "results", "phase"], "sic-bo": ["outcome", "results", "phase"], slots: ["outcome", "results", "phase"] };
function autoSteps(game, fin, hidden) {
  const out = [];
  if (game === "blackjack" && fin.dealer?.cards?.length >= 2) {
    const cs = fin.dealer.cards;
    for (let n = 2; n <= cs.length; n += 1) {
      const v = bjValue(cs.slice(0, n));
      out.push({ text: n === 2 ? `Dealer turns over ${cardText(cs[1])} · ${v}` : `Dealer hits ${cardText(cs[n - 1])} · ${v}${v > 21 ? " — bust" : ""}`,
        round: { ...hidden, dealer: { cards: cs.slice(0, n), value: v, bust: v > 21 } } });
    }
  } else if (game === "baccarat" && fin.outcome?.hands?.length === 2) {
    const [P, B] = fin.outcome.hands.map((h) => h.cards);
    const hands = (np, nb) => [{ label: `Player (${bacValue(P.slice(0, np))})`, cards: P.slice(0, np) }, { label: `Banker (${bacValue(B.slice(0, nb))})`, cards: B.slice(0, nb) }];
    out.push({ text: `Player ${cardsText(P.slice(0, 2))} · ${bacValue(P.slice(0, 2))} — Banker ${cardsText(B.slice(0, 2))} · ${bacValue(B.slice(0, 2))}`, round: { ...hidden, outcome: { headline: "", hands: hands(2, 2) } } });
    if (P.length > 2) out.push({ text: `Player draws ${cardText(P[2])} · ${bacValue(P)}`, round: { ...hidden, outcome: { headline: "", hands: hands(3, 2) } } });
    if (B.length > 2) out.push({ text: `Banker draws ${cardText(B[2])} · ${bacValue(B)}`, round: { ...hidden, outcome: { headline: "", hands: hands(P.length, 3) } } });
  } else if (game === "roulette" && fin.outcome) {
    out.push({ text: `Ball lands ${fin.outcome.headline}`, round: { ...hidden, outcome: fin.outcome } });
  } else if (game === "sic-bo" && fin.outcome) {
    out.push({ text: `Dice: ${fin.outcome.headline}`, round: { ...hidden, outcome: fin.outcome } });
  } else if (game === "slots" && fin.outcome) {
    out.push({ text: `Reels: ${(fin.outcome.reels || []).join(" · ")} — ${fin.outcome.headline}`, round: { ...hidden, outcome: fin.outcome } });
  } else if (game === "three-card" && fin.dealer?.cards?.length) {
    out.push({ text: `Dealer shows ${cardsText(fin.dealer.cards)} · ${fin.dealer.hand}${fin.dealer.qualified === false ? " — doesn't qualify" : ""}`, round: { ...hidden, dealer: fin.dealer } });
  }
  return out;
}

function moduleReplay(doc, row, { people, viewerSeat }) {
  const game = GAMES[doc.mode];
  if (!game) return null;
  const config = tableConfig(doc, row);
  let state = game.startRound({
    players: doc.players.map((p) => ({ seat: p.seat, userId: p.userId ?? null, stack: p.stack })),
    bankerSeat: doc.bankerSeat ?? null, deck: [...(doc.deck || [])], config: doc.config || {}
  });
  const base = { id: `replay-${row.id}`, config, game: doc.mode, rules: doc.config || null, handNo: row.hand_no == null ? 0 : Number(row.hand_no),
    roundNo: row.hand_no == null ? 0 : Number(row.hand_no), bankerSeat: doc.bankerSeat ?? null, actionDeadline: null, shuffle: null, shoeLeft: null };
  const nets = new Map((doc.final?.nets || []).map((n) => [n.seat, n.net]));
  const seatsAt = (actor, { settled = false, inHand = true } = {}) => doc.players.map((p) => ({
    ...seatBase(p, people), stack: settled ? p.stack + (nets.get(p.seat) || 0) : p.stack, inHand,
    isBanker: p.seat === doc.bankerSeat, isToAct: p.seat === actor
  }));
  const privFor = (st) => (viewerSeat != null && typeof game.privateFor === "function" ? (() => {
    const pr = game.privateFor(st, viewerSeat);
    return pr ? { seat: viewerSeat, ...pr } : null;
  })() : null);
  const actorOf = (st) => (typeof game.actorSeat === "function" ? game.actorSeat(st) : null);

  const steps = [], privates = [];
  const push = (step, priv) => { steps.push(step); privates.push(priv); };
  // before the deal, on the previous round's number (see holdemReplay): the next step is a new round
  push({ gap: 0, text: "Before the deal", view: { ...base, handNo: base.handNo - 1, roundNo: base.roundNo - 1, phase: "waiting", toActSeat: null, seats: seatsAt(null, { inHand: false }), round: null, result: null } }, null);
  let actor = actorOf(state);
  push({ gap: DEAL_MS, text: "Round starts", view: { ...base, phase: "running", toActSeat: actor, seats: seatsAt(actor), round: game.publicView(state), result: null } }, privFor(state));
  let prevRaw = 0;
  for (const a of doc.actions) {
    const { s, t, auto, ...rest } = a;
    ({ state } = game.applyAction(state, { ...rest, seat: s }));
    actor = actorOf(state);
    const think = Math.min(THINK_CAP_MS, Math.max(0, (t || 0) - prevRaw));
    prevRaw = t || 0;
    push({ gap: Math.max(MIN_GAP_MS, think), text: stepText(seatBase(doc.players.find((p) => p.seat === s) || { seat: s }, people).name, a) + (auto ? " (timed out)" : ""),
      view: { ...base, phase: "running", toActSeat: actor, seats: seatsAt(actor), round: game.publicView(state), result: null } }, privFor(state));
  }
  // the automatic part: the last move's step shows the table as the move left it, then a step each
  const fin = steps[steps.length - 1].view.round, prevRound = steps[steps.length - 2]?.view.round;
  if (HIDE[doc.mode] && fin?.phase === "complete" && prevRound && steps.length > 2) {
    const hidden = { ...fin, toActSeat: null };
    for (const k of HIDE[doc.mode]) hidden[k] = prevRound[k] ?? null;
    const last = steps[steps.length - 1];
    last.view = { ...last.view, toActSeat: null, seats: seatsAt(null), round: hidden };
    for (const au of autoSteps(doc.mode, fin, hidden)) push({ gap: AUTO_MS, text: au.text, view: { ...last.view, round: au.round } }, privates[privates.length - 1]);
  }
  // the result: the settled round, stacks paid (runtime.js: round = result = the settled public view)
  const result = doc.final?.result ?? game.publicView(state);
  push({ gap: RESULT_HOLD_MS, text: "Result", view: { ...base, phase: "running", toActSeat: null, seats: seatsAt(null, { settled: true, inHand: false }), round: result, result } }, null);
  const mo = momentOfResult(doc.mode, { ...doc.config, tournament: row.context === "tournament" || row.context === "sprint" }, result);
  if (mo) steps[steps.length - 1].mark = momentLabel(mo);
  timeline(steps);
  return { kind: "module", steps, privates };
}

// every step's time (ms from the replay's start, at 1×): each came `gap` after the one before
function timeline(steps) {
  let t = 0;
  steps.forEach((s, i) => { t += i === 0 ? 0 : Math.max(MIN_GAP_MS, s.gap ?? MIN_GAP_MS); s.t = t; delete s.gap; });
}

/** A recording → table views for the replay page, or null if it can't be re-simulated.
 *  opts: { people: Map(seat → looks), viewerSeat: number | null } */
export function replayViews(doc, row, opts) {
  try {
    if (!doc || doc.v !== 1) return null;
    const out = doc.mode === "holdem" ? holdemReplay(doc, row, opts) : moduleReplay(doc, row, opts);
    if (!out) return null;
    return { ...out, layout: tableLayout(doc.mode === "holdem" ? doc.variant || "holdem" : doc.mode) };
  } catch {
    return null;
  }
}
