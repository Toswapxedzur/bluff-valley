// GameTable — a generic real-time table runtime for pluggable GameModules
// (Blackjack today; poker could migrate here later). It reuses LiveTable's
// battle-tested seat/escrow/clock/vacate/op-lock machinery by EXTENDING it, and
// overrides only the round-lifecycle methods to delegate to a GameModule
// (see games/blackjack.js). LiveTable itself is untouched, so the poker path
// keeps all its guarantees; this class inherits the same escrow-authoritative,
// crash-safe money handling.
//
// A GameModule is a pure state machine in the poker-engine shape:
//   startRound(ctx) -> state          legalActions(state) -> {toActSeat, actions}
//   applyAction(state, action) -> {state, events}   isComplete(state) -> bool
//   actorSeat(state) -> seat|null     defaultAction(state, seat) -> action
//   settle(state) -> [{seat, delta}]  (deltas sum to zero; banker absorbs)
//   publicView(state) / privateFor(state, seat) / turnInfo(state, seat)
//   deck() -> string[]   minPlayers   usesBanker
//
// "Banked" games (usesBanker) need one seat flagged as the banker (the house):
// it is dealt against but never acts, and absorbs the net of every player's
// win/loss so chips stay conserved.

import { encode, S2C } from "../../poker/protocol.js";
import { MatchRecorder } from "./recorder.js";
import { shuffle } from "./engine/index.js";
import { LiveTable, ACTION_TIMEOUT_MS, DISCONNECT_GRACE_MS } from "./table.js";
import { shuffleHoldMs } from "../../poker/card-motion.js";

export class GameTable extends LiveTable {
  constructor(config, hub, deps = {}) {
    super(config, hub, deps);
    if (!deps.game) throw new Error("GameTable requires a game module");
    this.game = deps.game;
    // Per-table game config (e.g. blackjack minBet); the table's smallBlind
    // column doubles as the minimum bet for banked games.
    this.gameConfig = { minBet: this.config.smallBlind, ...(deps.gameConfig || {}) };
    this.bankerSeat = null; // set when a banker sits (usesBanker games)
    // The deck, by the real game's rules (owner, 2026-09-27): a shoe game (Blackjack, Baccarat) deals
    // from one shoe across rounds and reshuffles at the cut card; Three Card / Big Two shuffle before
    // every round. `shuffle` tells the page to play it; the round's first turn waits for it.
    this.shoe = null;        // { cards, pos } — shoe games only
    this.shuffle = null;     // { no, full, cards } — the latest shuffle
    this._shuffleNo = 0;
    this.dealHoldUntil = 0;
    this.roundNo = 0;        // counts this table's rounds (handNo only moves when a hand is stored)
  }

  /** The deck for a new round, and whether it starts with a shuffle ({ full } = the shoe's, with cuts). */
  _deckForRound(hands) {
    const g = this.game;
    if (!g.shoe) {
      const deck = shuffle(g.deck(this.gameConfig), this.rng);
      return { deck, shuffled: g.shuffleEveryRound ? { full: false, cards: deck.length } : null };
    }
    let shuffled = null, s = this.shoe;
    if (!s || s.pos >= s.cards.length * g.shoe.penetration || s.cards.length - s.pos < g.shoe.perRound(hands)) {
      s = this.shoe = { cards: shuffle(g.deck(this.gameConfig), this.rng), pos: 0 };
      shuffled = { full: true, cards: s.cards.length };
    }
    // a round that outruns the shoe carries on into the discards, shuffled (as a dealer would)
    return { deck: s.cards.slice(s.pos).concat(shuffle(s.cards.slice(0, s.pos), this.rng)), shuffled };
  }

  /** Someone is looking at this table (bots don't watch the shuffle, so a bot-only table never waits). */
  _humanWatching() {
    for (const c of this.watchers) if (!c.isBot) return true;
    return false;
  }

  // Enough to start: (banked) a funded, connected banker + minPlayers others;
  // (non-banked) minPlayers eligible seats.
  _canStartRound() {
    if (this.game.usesBanker) {
      const banker = this.bankerSeat != null ? this.seats.get(this.bankerSeat) : null;
      if (!banker || !this.isConnected(banker) || banker.stack < 1) return false;
      const others = this.eligibleSeats().filter((s) => s.seat !== this.bankerSeat);
      return others.length >= this.game.minPlayers;
    }
    return this.eligibleSeats().length >= Math.max(2, this.game.minPlayers);
  }

  // Overrides maybeStartHand's gate so the inherited scheduler only fires when a
  // round can actually begin. (maybeStartHand checks eligibleSeats().length >= 2,
  // which we keep, but beginHand re-checks _canStartRound for the banker rule.)
  async beginHand() {
    if (this.hand) return;
    this.clearStartTimer();
    if (!this._canStartRound()) return;

    let handNo;
    try { handNo = await this.store.nextHandNo(this.id); } catch { return; }
    if (this.hand || !_stillStartable(this)) return;

    const roundSeats = [];
    for (const s of this.eligibleSeats()) roundSeats.push({ seat: s.seat, userId: s.userId, stack: s.stack });
    if (this.game.usesBanker) {
      const banker = this.seats.get(this.bankerSeat);
      if (banker && !roundSeats.some((r) => r.seat === this.bankerSeat)) {
        roundSeats.push({ seat: banker.seat, userId: banker.userId, stack: banker.stack });
      }
    }
    const { deck, shuffled } = this._deckForRound(roundSeats.length);

    let round;
    try {
      round = this.game.startRound({
        players: roundSeats,
        bankerSeat: this.game.usesBanker ? this.bankerSeat : null,
        deck,
        config: this.gameConfig
      });
    } catch { return; }

    this.hand = round;
    this.handNo = handNo;
    this.roundNo += 1;
    if (shuffled) {
      this.shuffle = { no: ++this._shuffleNo, ...shuffled };
      if (this._humanWatching()) this.dealHoldUntil = this.now() + shuffleHoldMs({ full: shuffled.full, dealsAtStart: !!this.game.dealsAtStart });
    }
    this._handStartedAt = this.now();
    this.result = null;

    // Record this round for replay (recorder.js): initial deck + config +
    // every action. Persisted at finishHand; dropped if the round aborts.
    this.recorder = new MatchRecorder({
      mode: this.game.key,
      context: "cash",
      tableId: this.id,
      tableName: this.config.name,
      handNo,
      startedAt: this._handStartedAt,
      config: this.gameConfig,
      bankerSeat: this.game.usesBanker ? this.bankerSeat : null,
      // the live table's settings, so a replay seats everyone where they sat (replay-views.js)
      table: { name: this.config.name, maxSeats: this.config.maxSeats, smallBlind: this.config.smallBlind, bigBlind: this.config.bigBlind, minBuyin: this.config.minBuyin, maxBuyin: this.config.maxBuyin },
      deck,
      players: roundSeats.map((r) => {
        const s = this.seats.get(r.seat);
        return { seat: r.seat, stack: r.stack, userId: r.userId ?? null, name: s?.name ?? null };
      })
    }, this.now);

    for (const s of this.seats.values()) { s.inHand = false; s.stackAtHandStart = undefined; s.lastAction = null; }
    for (const r of roundSeats) {
      const s = this.seats.get(r.seat);
      if (s) { s.inHand = true; s.stackAtHandStart = s.stack; }
    }

    // the new round's view first, then each player's own cards: the page sees the new round (and its
    // shuffle) before any new face arrives, so last round's cards are never mistaken for this round's
    this.broadcast();
    this.sendAllPrivates();
    this.hub?.onTableChanged?.(this);
    await this.promptActor();
  }

  async promptActor() {
    if (!this.hand) return;
    if (this.game.isComplete(this.hand) || this.game.actorSeat(this.hand) === null) {
      await this.finishHand();
      return;
    }
    // the round opened with a shuffle on everyone's screen: the first turn waits for it
    const hold = this.dealHoldUntil - this.now();
    if (hold > 0) {
      // (the hold lives in the turn clock's slot: an action or the round ending clears it the same way)
      this.clearActionTimer();
      const gen = this._actionGen;
      this.actionDeadline = null;
      this.actionTimer = this.setTimer(() => {
        this.actionTimer = null;
        return this._run(() => { if (this._actionGen === gen) return this.promptActor(); });
      }, hold + 5);
      this.broadcast();
      return;
    }
    const seatNo = this.game.actorSeat(this.hand);
    const seat = this.seats.get(seatNo);
    const gone = !!(seat && (!this.isConnected(seat) || seat.sittingOut));
    if (seat) seat._graceClock = gone;
    this._armActionTimer(gone ? DISCONNECT_GRACE_MS : ACTION_TIMEOUT_MS);
    // Re-push private hands each turn: shedding games (Big Two)
    // change a player's hand every play/draw. No-op for games whose privateFor
    // returns null (all the banked games show cards publicly).
    this.sendAllPrivates();
    this.broadcast();
    if (seat) this.sendTurnTo(seat);
  }

  async _act(conn, action) {
    const seat = this.seatForUser(conn.user?.id);
    if (!seat) return this._error(conn, "You are not seated.");
    if (!this.hand || this.game.actorSeat(this.hand) !== seat.seat) {
      return this._error(conn, "It is not your turn.");
    }
    if (!action || typeof action.type !== "string") return this._error(conn, "Malformed action.");
    let next;
    try {
      ({ state: next } = this.game.applyAction(this.hand, { ...action, seat: seat.seat }));
    } catch (err) {
      this._error(conn, err?.message || "Illegal action.");
      this.sendTurnTo(seat);
      return;
    }
    this.recorder?.action(seat.seat, action);
    this.hand = next;
    this.clearActionTimer();
    await this.promptActor();
  }

  async autoAct() {
    if (!this.hand) return;
    const seatNo = this.game.actorSeat(this.hand);
    if (seatNo === null) return;
    let next;
    const autoAction = this.game.defaultAction(this.hand, seatNo);
    try {
      ({ state: next } = this.game.applyAction(this.hand, autoAction));
    } catch { return; }
    this.recorder?.action(seatNo, autoAction, true);
    this.hand = next;
    this.clearActionTimer();
    await this.promptActor();
  }

  async finishHand() {
    const round = this.hand;
    if (!round) return;

    // Apply per-seat deltas (players + banker), which sum to zero, then mirror
    // post-round stacks into escrow so a crash refunds actual results.
    // the shoe moves on by the cards this round used (past its end: the discards were used too — start afresh)
    if (this.shoe) {
      this.shoe.pos += round.deckPos || 0;
      if (this.shoe.pos > this.shoe.cards.length) this.shoe = null;
    }
    const deltas = this.game.settle(round);
    const escrowSnaps = [];
    for (const d of deltas) {
      const s = this.seats.get(d.seat);
      if (!s) continue;
      s.stack = (s.stackAtHandStart ?? s.stack) + d.delta;
      escrowSnaps.push({ userId: s.userId, seatNo: s.seat, stack: s.stack });
    }
    let synced = false;
    for (let attempt = 0; attempt < 3 && !synced; attempt += 1) {
      try { await this.wallet.syncStacks(this.id, escrowSnaps); synced = true; } catch { /* retry */ }
    }
    if (!synced) {
      console.error(`[bluffing-valley] ${this.game.key} table ${this.id}: escrow syncStacks failed; mirror stale until next round`);
    }

    this.result = this.game.publicView(round);

    // Persist the universal replay (skips bot-only rounds; never let a DB
    // error break gameplay). Banker keeps its role so stats can split
    // banking results from betting results.
    if (this.recorder) {
      try {
        const isBot = (uid) => !!this.hub?.botManager?.isBotUser?.(uid);
        const participants = this.recorder.meta.players.map((p) => {
          const d = deltas.find((x) => x.seat === p.seat);
          return {
            userId: p.userId, seat: p.seat, displayName: p.name,
            role: this.game.usesBanker && p.seat === this.recorder.meta.bankerSeat ? "banker" : "player",
            net: d ? d.delta : 0
          };
        });
        const hasHuman = participants.some((p) => p.userId != null && !isBot(p.userId));
        if (hasHuman) {
          const wagered = participants.reduce((sum, p) => sum + Math.max(0, -p.net), 0);
          await this.store.persistReplay?.({
            mode: this.game.key,
            variant: null,
            context: "cash",
            tableId: this.id,
            tableName: this.config.name,
            handNo: this.handNo,
            startedAt: this._handStartedAt,
            endedAt: this.now(),
            potTotal: wagered,
            replay: this.recorder.payload({ result: this.result, nets: participants.map((p) => ({ seat: p.seat, net: p.net })) }),
            players: participants
          });
        }
      } catch { /* swallow persistence errors */ }
      this.recorder = null;
    }

    for (const s of this.seats.values()) {
      s.inHand = false;
      s.stackAtHandStart = undefined;
    }
    // NB: don't sendChips here — that pill is the WALLET balance, which only
    // moves on buy-in / cash-out / rebuy. On-table stacks are shown on the felt
    // via the broadcast below.
    this.hand = null;
    this.actionDeadline = null;
    this._handStartedAt = null;
    this.clearActionTimer();
    this.broadcast();

    for (const s of [...this.seats.values()]) { if (s.wantsToLeave) await this.creditAndRemove(s); }
    for (const s of this.seats.values()) { if (!this.isConnected(s)) this.armVacateTimer(s); }

    this.broadcast();
    this.hub?.onTableChanged?.(this);
    this.maybeStartHand();
    await this.hub?.reclaimIfEmptyLocked?.(this);
  }

  // Generic seat list + the game's own public overlay.
  publicView() {
    const actor = this.hand ? this.game.actorSeat(this.hand) : null;
    const seats = [];
    for (const [seatNo, s] of this.seats) {
      seats.push({
        seat: seatNo,
        userId: s.userId,
        name: s.name,
        avatar: s.avatar ?? null,
        ring: s.ring ?? "default",
        badge: s.badge ?? "default",
        banner: s.banner ?? null,
        stack: s.stack,
        sittingOut: !!s.sittingOut,
        connected: this.isConnected(s),
        inHand: !!s.inHand,
        isBanker: seatNo === this.bankerSeat,
        isToAct: seatNo === actor // clients clear the turn menu when this is false
      });
    }
    seats.sort((a, b) => a.seat - b.seat);
    const round = this.hand ? this.game.publicView(this.hand) : (this.result || null);
    return {
      id: this.id,
      config: this.config,
      game: this.game.key,
      rules: this.gameConfig, // house-rule knobs (blackjack: soft17, pays, decks, …)
      phase: this.hand || this.result ? "running" : "waiting",
      handNo: this.handNo,
      roundNo: this.roundNo,
      bankerSeat: this.bankerSeat,
      toActSeat: this.hand ? this.game.actorSeat(this.hand) : null,
      actionDeadline: this.hand ? this.actionDeadline : null,
      seats,
      round,
      result: this.result ?? null,
      shuffle: this.shuffle,                                         // the latest shuffle (the page plays it once)
      shoeLeft: this.shoe ? this.shoe.cards.length - this.shoe.pos : null
    };
  }

  sendTurnTo(seat) {
    if (!this.hand) return;
    const info = this.game.turnInfo(this.hand, seat.seat);
    if (!info) return;
    const msg = encode(S2C.TABLE_TURN, { tableId: this.id, seat: seat.seat, deadline: this.actionDeadline, ...info });
    for (const conn of this.connsForUser(seat.userId)) conn.send(msg);
  }

  sendPrivateTo(conn) {
    const seat = this.seatForUser(conn.user?.id);
    if (!seat || !this.hand) return;
    const priv = this.game.privateFor(this.hand, seat.seat);
    if (priv) conn.send(encode(S2C.TABLE_PRIVATE, { tableId: this.id, seat: seat.seat, ...priv }));
  }

  // When the banker's seat actually leaves, forget it — otherwise a later player
  // taking that seat number would be mistaken for the house. (The hub then seats
  // a fresh bot banker if players remain.)
  async creditAndRemove(seat) {
    const wasBanker = seat.seat === this.bankerSeat;
    await super.creditAndRemove(seat);
    if (wasBanker && this.seats.get(seat.seat) !== seat) this.bankerSeat = null;
  }
}

// beginHand fetched a hand number across an await; re-confirm the table can
// still start (nothing torn it down or started a round meanwhile).
function _stillStartable(table) {
  return !table._closed && !table.hand && table._canStartRound();
}
