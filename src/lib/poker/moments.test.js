import { test } from "node:test";
import assert from "node:assert/strict";
import { detectMoment, threeCardRare, MOMENT_MS } from "./moments.js";

const holdem = (result, extra = {}) => ({ config: { variant: "holdem", bigBlind: 200 }, result, ...extra });

test("Hold'em: a winner's four of a kind or better is a rare hand; a royal flush is its own", () => {
  const quads = holdem({ type: "showdown", winners: [{ seat: 2, amount: 800 }], revealed: [{ seat: 2, handName: "Four of a Kind", best: ["9s", "9h", "9d", "9c", "Kh"] }, { seat: 3, handName: "Pair", best: [] }] });
  assert.deepEqual([detectMoment(quads).kind, detectMoment(quads).seat, detectMoment(quads).ms], ["rare", 2, MOMENT_MS.rare]);
  const royal = holdem({ type: "showdown", winners: [{ seat: 1, amount: 800 }], revealed: [{ seat: 1, handName: "Straight Flush", best: ["Ts", "Js", "Qs", "Ks", "As"] }] });
  assert.equal(detectMoment(royal).name, "Royal Flush");
  assert.equal(detectMoment(royal).ms, MOMENT_MS.royal);
  const loserQuads = holdem({ type: "showdown", winners: [{ seat: 1, amount: 800 }], revealed: [{ seat: 2, handName: "Four of a Kind", best: ["9s", "9h", "9d", "9c", "Kh"] }] });
  assert.equal(detectMoment(loserQuads), null, "only a WINNING rare hand");
});

test("Hold'em: a pot of 50+ big blinds is a monster; tournaments and River Sprint never pause", () => {
  const big = holdem({ type: "showdown", winners: [{ seat: 4, amount: 9_320 }, { seat: 5, amount: 9_320 }], revealed: [] });
  const m = detectMoment(big);
  assert.equal(m.kind, "monsterPot");
  assert.equal(m.bb, 93);
  assert.equal(detectMoment(holdem({ type: "showdown", winners: [{ seat: 4, amount: 9_000 }], revealed: [] })), null, "45 big blinds");
  assert.equal(detectMoment({ ...big, config: { ...big.config, tournament: true } }), null);
  assert.equal(detectMoment(holdem({ type: "uncontested", winners: [{ seat: 1, amount: 50_000 }] })), null, "no showdown, no moment");
});

test("jackpots: 25x the bet or more; Three Card rare hands; Big Two's winner", () => {
  const roulette = { game: "roulette", config: {}, result: {}, round: { outcome: { pocket: 17 }, results: [{ seat: 1, delta: 7_000, bets: [{ amount: 200 }] }, { seat: 2, delta: 400, bets: [{ amount: 200 }] }] } };
  const j = detectMoment(roulette);
  assert.deepEqual([j.kind, j.seat, j.mult, j.payout], ["jackpot", 1, 35, 7_000]);
  assert.equal(detectMoment({ ...roulette, round: { ...roulette.round, results: [{ seat: 2, delta: 400, bets: [{ amount: 200 }] }] } }), null);
  assert.equal(threeCardRare(["7d", "8d", "9d"]), "Straight Flush");
  assert.equal(threeCardRare(["Ah", "2h", "3h"]), "Straight Flush", "A-2-3 counts");
  assert.equal(threeCardRare(["9s", "9h", "9d"]), "Three of a Kind");
  assert.equal(threeCardRare(["9s", "9h", "8d"]), null);
  const tc = { game: "three-card", config: {}, result: {}, round: { hands: [{ seat: 3, cards: ["7d", "8d", "9d"], folded: false }], results: [{ seat: 3, delta: 100 }] } };
  assert.equal(detectMoment(tc).kind, "rare");
  const b2 = { game: "big-two", config: {}, result: {}, round: { winner: 2, pile: ["8s", "8h", "8d", "Kc", "Kh"], players: [{ seat: 1, cardCount: 4 }, { seat: 2, cardCount: 0 }], results: [{ seat: 2, delta: 300 }, { seat: 1, delta: -300 }] } };
  const b = detectMoment(b2);
  assert.deepEqual([b.kind, b.seat, b.pot, b.others[0].pays], ["bigTwo", 2, 300, 300]);
});

test("Hold'em: an all-in run-out is the all-in showdown (before a monster pot or a rare hand)", async () => {
  const { allInMs } = await import("./moments.js");
  const v = holdem({ type: "showdown", board: ["Kd", "7c", "2h", "5s", "Qc"], winners: [{ seat: 2, amount: 20_000 }],
    runout: { from: 0, stages: [{ board: 0, pct: { 1: 46, 2: 54 } }, { board: 3, pct: { 1: 92, 2: 8 } }, { board: 4, pct: { 1: 95, 2: 5 } }, { board: 5, pct: { 1: 0, 2: 100 } }] },
    revealed: [{ seat: 1, holeCards: ["Ah", "Kh"], handName: "Pair", best: [] }, { seat: 2, holeCards: ["Qs", "Qd"], handName: "Three of a Kind", best: ["Qs", "Qd", "Qc", "Kd", "7c"] }] });
  const m = detectMoment(v);
  assert.equal(m.kind, "allIn");
  assert.equal(m.ms, allInMs(0));
  assert.ok(allInMs(0) > allInMs(3) && allInMs(3) > allInMs(4), "fewer streets to come, a shorter moment");
  assert.deepEqual(m.players.map((p) => [p.seat, p.won]), [[1, false], [2, true]]);
});
