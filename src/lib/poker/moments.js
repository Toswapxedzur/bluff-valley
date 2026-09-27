// The full-screen MOMENTS (owner, 2026-09-27; designed in design/moments): big events where the
// whole table pauses. Gameplay moments only blur the table and play over it; proclamations (Sprint
// calls, cosmetics, personal news) bring the banner.
//
// detectMoment(view) reads a table's PUBLIC view at the end of a hand / round and says which moment
// it shows, if any. Shared, so both sides agree: the page plays it (MomentLayer) and the server
// holds the next hand that much longer (table.js) — everybody waits the same time. Pure: no DOM.

export const MOMENT_MS = {
  monsterPot: 4300,
  rare: 4400,
  royal: 5200,
  jackpot: 5600,
  bigTwo: 4400
};
/** The all-in showdown's length: the players' cards, then each street still to come (the river slower). */
export const allInMs = (from) => 1900 + (from === 0 ? 3 : from === 3 ? 2 : 1) * 1600 + 700 + 1500;
export const MONSTER_BB = 50;        // a pot of this many big blinds is a monster
export const JACKPOT_X = 25;         // a payout of this many times the bet is a jackpot

const RANK = "23456789TJQKA";
const rankOf = (c) => RANK.indexOf(c[0]);

/** Three Card Poker's rare hands: three of a kind, a straight flush (A-2-3 counts). */
export function threeCardRare(cards) {
  if (!cards || cards.length !== 3 || cards.some((c) => !c || c.length < 2 || c === "??")) return null;
  const r = cards.map(rankOf).sort((a, b) => a - b);
  if (r[0] === r[2]) return "Three of a Kind";
  const suited = cards.every((c) => c[1] === cards[0][1]);
  const run = (r[1] === r[0] + 1 && r[2] === r[1] + 1) || (r[0] === 0 && r[1] === 1 && r[2] === 12);
  return suited && run ? "Straight Flush" : null;
}

const isRoyal = (best) => !!best && best.length === 5 && best.every((c) => c[1] === best[0][1]) && ["T", "J", "Q", "K", "A"].every((r) => best.some((c) => c[0] === r));

/**
 * The moment a finished hand / round shows: { kind, ms, ...data } or null.
 *  rare        { seat, cards, name, royal, game }
 *  monsterPot  { seat, amount, bb }
 *  jackpot     { seat, game, mult, bet, payout, outcome }
 *  bigTwo      { seat, pile, pot, others: [{ seat, cards, pays }] }
 */
export function detectMoment(view) {
  if (!view || view.config?.tournament) return null;              // tournaments / River Sprint: fast-fold, no pauses
  const game = view.game || view.config?.variant || "holdem";
  const round = view.round || null;

  if (game === "holdem") {
    const r = view.result;
    if (!r || r.type !== "showdown") return null;
    const winners = new Map();
    for (const w of r.winners || []) winners.set(w.seat, (winners.get(w.seat) || 0) + (w.amount || 0));
    // everyone was all-in with cards to come: the run-out, street by street, with the win chances
    if (r.runout && (r.revealed || []).length >= 2 && !r.boards) {
      const winSet = new Set(winners.keys());
      return {
        kind: "allIn", ms: allInMs(r.runout.from), from: r.runout.from, stages: r.runout.stages, board: [...(r.board || [])],
        players: r.revealed.map((h) => ({ seat: h.seat, cards: [...h.holeCards], best: h.best ? [...h.best] : null, handName: h.handName, won: winSet.has(h.seat) }))
      };
    }
    // a winner's four of a kind or better
    for (const h of r.revealed || []) {
      if (!winners.has(h.seat) || !h.best) continue;
      if (h.handName === "Four of a Kind" || h.handName === "Straight Flush") {
        const royal = h.handName === "Straight Flush" && isRoyal(h.best);
        return { kind: "rare", ms: royal ? MOMENT_MS.royal : MOMENT_MS.rare, seat: h.seat, cards: [...h.best], name: royal ? "Royal Flush" : h.handName, royal, game };
      }
    }
    const pot = [...winners.values()].reduce((a, b) => a + b, 0), bb = view.config?.bigBlind || 1;
    if (pot >= MONSTER_BB * bb && winners.size) {
      const [seat, amount] = [...winners].sort((a, b) => b[1] - a[1])[0];
      return { kind: "monsterPot", ms: MOMENT_MS.monsterPot, seat, amount: pot, won: amount, bb: Math.round(pot / bb) };
    }
    return null;
  }

  if (!round || !(round.results || []).length || !view.result) return null;

  if (game === "three-card") {
    for (const h of round.hands || []) {
      const name = !h.folded && threeCardRare(h.cards);
      if (name) return { kind: "rare", ms: MOMENT_MS.rare, seat: h.seat, cards: [...h.cards], name, royal: false, game };
    }
    return null;
  }

  if (game === "roulette" || game === "sic-bo" || game === "slots") {
    let best = null;
    for (const res of round.results) {
      const bet = (res.bets || []).reduce((a, b) => a + (b.amount || 0), 0);
      if (bet > 0 && res.delta >= JACKPOT_X * bet && (!best || res.delta / bet > best.mult)) best = { seat: res.seat, mult: Math.round(res.delta / bet), bet, payout: res.delta };
    }
    return best ? { kind: "jackpot", ms: MOMENT_MS.jackpot, game, outcome: round.outcome, ...best } : null;
  }

  if (game === "big-two") {
    const winner = round.winner;
    if (winner == null) return null;
    const res = round.results.find((x) => x.seat === winner);
    const others = (round.players || []).filter((p) => p.seat !== winner).map((p) => ({ seat: p.seat, cards: p.cardCount, pays: -((round.results.find((x) => x.seat === p.seat) || {}).delta || 0) }));
    return { kind: "bigTwo", ms: MOMENT_MS.bigTwo, seat: winner, pile: [...(round.pile || [])], pot: res?.delta || 0, others };
  }
  return null;
}
