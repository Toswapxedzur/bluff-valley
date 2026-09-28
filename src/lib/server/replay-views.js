// Replays on the REAL table (owner, 2026-09-28): a recorded match (see poker/recorder.js) re-simulated
// through the pure engines and turned, step by step, into the SAME table views the live server
// broadcasts (table.js / runtime.js publicView) — so the shared TableStage draws a replay exactly like
// live play, with every animation (they all diff one view against the next).
//
// Steps: 0 = the table just before the deal (so the deal itself animates), 1 = the hand / round as
// dealt, then one per recorded action, then the result (the hand over, winners paid).
// Privacy is decided by the caller: `viewerSeat` gets its own private cards (hole cards / a Big Two
// hand); everyone else is public view only, exactly what a watcher at the table saw.
import { createHand, applyAction as pokerApply } from "./poker/engine/index.js";
import { GAMES } from "./poker/games/registry.js";
import { tableLayout } from "../poker/games.js";

const THINK_CAP_MS = 1500;          // a long think plays at most this long (at 1×)
const RESULT_HOLD_MS = 1200;        // the last action → the result
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

// step times (ms from the replay's start, at 1×): recorded, with long thinks capped
function paced(rawTimes) {
  const out = [];
  let prevRaw = 0, at = 0;
  for (const raw of rawTimes) {
    at += Math.min(THINK_CAP_MS, Math.max(0, raw - prevRaw));
    prevRaw = raw;
    out.push(at);
  }
  return out;
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

  const steps = [];
  // 0: the table before the deal — still on the previous hand's number, as a live table is while it
  // waits, so the next step is a NEW hand to the dealer (it deals it: cards fly, mine flip)
  steps.push({
    t: 0, text: "Before the deal",
    view: {
      ...base, handNo: base.handNo - 1, phase: "waiting", street: null, board: [], potTotal: 0, pots: [], toActSeat: null, result: null,
      seats: doc.players.map((p) => ({ ...seatBase(p, people), stack: p.stack, committed: 0, status: null, inHand: false, hasCards: false,
        isButton: p.seat === doc.buttonSeat, isSB: false, isBB: false, isToAct: false, lastAction: null, timeBankMs: 0, usingTimeBank: false }))
    }
  });
  // 1: dealt, blinds in
  steps.push({ t: DEAL_MS, text: "Cards dealt", view: liveView(state) });
  const raw = [];
  for (const a of doc.actions) {
    const { s, t, auto: _a, ...rest } = a;
    ({ state } = pokerApply(state, { ...rest, seat: s }));
    lastAction.set(s, pokerLabel(a));
    const name = seatBase({ seat: s }, people).name;
    steps.push({ t: 0, text: stepText(name, a) + (a.auto ? " (timed out)" : ""), view: liveView(state) });
    raw.push(t || 0);
  }
  // the result: hand over, seats cleared, the result window up (table.js finishHand)
  const result = doc.final?.result ?? null;
  steps.push({
    t: 0, text: "Result",
    view: {
      ...base, phase: "running", street: "complete", board: [...(result?.board || state.board || [])], potTotal: potOf(state),
      pots: (state.pots || []).map((p) => ({ ...p })), toActSeat: null, result,
      seats: doc.players.map((p) => {
        const ep = state.players.find((x) => x.seat === p.seat);
        return { ...seatBase(p, people), stack: ep ? ep.stack : p.stack, committed: 0, status: null, inHand: false, hasCards: false,
          isButton: p.seat === doc.buttonSeat, isSB: p.seat === sbSeat, isBB: p.seat === bbSeat, isToAct: false, lastAction: null, timeBankMs: 0, usingTimeBank: false };
      })
    }
  });
  retime(steps, raw);
  const mine = viewerSeat != null && holes[viewerSeat] ? { seat: viewerSeat, holeCards: holes[viewerSeat] } : null;
  // hole cards are dealt at step 1 and stay mine until the hand is over
  const privates = steps.map((_, i) => (i >= 1 && i < steps.length - 1 ? mine : null));
  return { kind: "poker", steps, privates };
}

// ---------------------------------------------------------------- every other game (GameModules)
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
  // 0: before the deal, on the previous round's number (see holdemReplay): the next step is a new round
  steps.push({ t: 0, text: "Before the deal", view: { ...base, handNo: base.handNo - 1, roundNo: base.roundNo - 1, phase: "waiting", toActSeat: null, seats: seatsAt(null, { inHand: false }), round: null, result: null } });
  privates.push(null);
  let actor = actorOf(state);
  steps.push({ t: DEAL_MS, text: "Round starts", view: { ...base, phase: "running", toActSeat: actor, seats: seatsAt(actor), round: game.publicView(state), result: null } });
  privates.push(privFor(state));
  const raw = [];
  for (const a of doc.actions) {
    const { s, t, auto, ...rest } = a;
    ({ state } = game.applyAction(state, { ...rest, seat: s }));
    actor = actorOf(state);
    steps.push({ t: 0, text: stepText(seatBase({ seat: s }, people).name, a) + (auto ? " (timed out)" : ""),
      view: { ...base, phase: "running", toActSeat: actor, seats: seatsAt(actor), round: game.publicView(state), result: null } });
    privates.push(privFor(state));
    raw.push(t || 0);
  }
  // the result: the settled round, stacks paid (runtime.js: round = result = the settled public view)
  const result = doc.final?.result ?? game.publicView(state);
  steps.push({ t: 0, text: "Result", view: { ...base, phase: "running", toActSeat: null, seats: seatsAt(null, { settled: true, inHand: false }), round: result, result } });
  privates.push(null);
  retime(steps, raw);
  return { kind: "module", steps, privates };
}

// give every step its time: 0 → the deal → the recorded actions (capped thinks) → the result
function retime(steps, raw) {
  const acts = paced(raw);
  const dealt = steps[1].t;
  for (let i = 0; i < acts.length; i += 1) steps[2 + i].t = dealt + Math.max(400, acts[i]);
  // strictly increasing, so every step gets its moment
  for (let i = 2; i < steps.length - 1; i += 1) steps[i].t = Math.max(steps[i].t, steps[i - 1].t + 400);
  const last = steps.length - 1;
  steps[last].t = steps[last - 1].t + RESULT_HOLD_MS;
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
