import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { compileModule } from "svelte/compiler";
import { dealOrder, planDeal, DEAL, drawFromDeck, shuffleHoldMs, collectionMs } from "./deal-anim.js";
import { routineMs } from "./deck-routine.js";

// dealer.svelte.js uses runes: compile it (client), point its relative imports back here, and
// load it from node_modules/.cache so `svelte/internal/...` resolves.
const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, "dealer.svelte.js"), "utf8");
let js = compileModule(src, { filename: "dealer.svelte.js", generate: "client" }).js.code;
js = js.replace(/from "\.\/([^"]+)"/g, (_, f) => `from "${pathToFileURL(join(here, f)).href}"`);
const cache = join(here, "../../../node_modules/.cache/dealer-test");
mkdirSync(cache, { recursive: true });
writeFileSync(join(cache, "dealer.mjs"), js);
const clock = { t: 0 };
Object.defineProperty(globalThis, "performance", { value: { now: () => clock.t }, configurable: true, writable: true });
const { Dealer } = await import(pathToFileURL(join(cache, "dealer.mjs")).href);

const run = (d, until, step = 16) => { while (clock.t < until) { clock.t += step; d.tick(clock.t); } };
const seat = (n, o = {}) => ({ seat: n, inHand: true, hasCards: true, status: "active", ...o });
// a new hand's deal opens with the shuffle (the deck ran out at the last collection): play it through
const pastShuffle = (d) => { run(d, clock.t + 40); assert.ok(d.routine, "the deal opens with the shuffle"); run(d, clock.t + d.routine.R.duration); };
const everyId = (d) => [...d.deck, ...d.used, ...d.flights.flatMap((f) => f.ids || [f.id]), ...d.held.map((h) => h.id)];

test("deal order: clockwise from the seat after the button, wrapping", () => {
  const seats = [0, 2, 5, 7].map((n) => seat(n)).concat([{ seat: 3, inHand: false, hasCards: false }]);
  assert.deepEqual(dealOrder(seats, 5), [7, 0, 2, 5]);
  assert.deepEqual(dealOrder(seats, 7), [0, 2, 5, 7]);
  const plan = planDeal([7, 0], 2);
  assert.deepEqual(plan.map((p) => [p.seat, p.slot, p.t0]), [[7, 0, 0], [0, 0, DEAL.every], [7, 1, 2 * DEAL.every], [0, 1, 3 * DEAL.every]]);
});

test("the between-hands pause (3.5 s) covers the collection for the largest tables", () => {
  assert.ok(collectionMs(10 * 2 + 5) < 3500);
  assert.ok(collectionMs(9 * 5 + 5) < 3500);
});

test("drawFromDeck: the used pile is shuffled in only when a card is needed and none is left", () => {
  assert.deepEqual(drawFromDeck(52, 8, 0), { left: 44, shuffle: null });
  assert.deepEqual(drawFromDeck(3, 3, 0), { left: 0, shuffle: null }, "emptied exactly: no shuffle until the next card");
  // 3 left, 8 hole cards to deal: 3 go, the other 49 (all on the pile) are shuffled, 5 more go
  assert.deepEqual(drawFromDeck(3, 8, 0), { left: 44, shuffle: { before: 3, used: 49, after: 5 } });
  // the turn with 6 live hole cards and a 3-card board out, the deck empty: the pile is 52 − 9
  assert.deepEqual(drawFromDeck(0, 1, 9), { left: 42, shuffle: { before: 0, used: 43, after: 1 } });
  const sh = { before: 3, used: 49, after: 5 };
  assert.equal(shuffleHoldMs(sh), 8 * DEAL.every + routineMs(49) + DEAL.flight + 250);
});

test("a whole hand: deal, early fold, board, showdown, collection, routine — every card accounted for", () => {
  clock.t = 1000;
  const d = new Dealer({ variant: "holdem", mySeat: 0 });
  const idle = { handNo: 1, buttonSeat: 3, board: [], seats: [0, 1, 2, 3].map((n) => seat(n, { hasCards: false, inHand: false })) };
  d.init(idle);
  d.geom = { deckSpot: { fx: 12, fy: 80 }, usedSpot: { fx: 900, fy: 80 }, centre: { fx: 450, fy: 300 } };
  const h2 = { handNo: 2, buttonSeat: 3, board: [], seats: [0, 1, 2, 3].map((n) => seat(n)) };
  d.onView(idle, h2, null);
  assert.deepEqual([...d.hiddenSeats], [0, 1, 2, 3]);
  assert.equal(d.ownRevealed, false);
  pastShuffle(d);
  const T = clock.t;
  // seat 2 folds while cards are still in the air (before its second card lands)
  run(d, T + 150);
  const f2 = { ...h2, seats: h2.seats.map((s) => (s.seat === 2 ? { ...s, status: "folded" } : s)) };
  d.onView(h2, f2, { holeCards: ["As", "Kd"] });
  run(d, T + 2000);
  assert.equal(d.deck.length, 44);
  assert.ok(d.seatHidden(2), "a hand folded mid-deal stays hidden");
  assert.ok(!d.seatHidden(0) && !d.seatHidden(1) && !d.seatHidden(3));
  assert.equal(d.ownRevealed, true);
  assert.equal(d.used.length, 2, "exactly the folded seat's two cards reach the pile");
  assert.deepEqual(new Set(d.used), new Set(d._seatIds.get(2)));
  let ids = everyId(d).concat([...d._seatIds].filter(([s]) => s !== 2).flatMap(([, v]) => v));
  assert.equal(new Set(ids).size, 52);
  // flop, then a showdown result (the server clears hasCards with it)
  const flop = { ...f2, board: ["2c", "7d", "9h"] };
  d.onView(f2, flop, null);
  run(d, T + 3000);
  assert.deepEqual([d.boardShown, d.boardFaceUp], [3, 3]);
  assert.equal(d.deck.length, 41);
  const res = { ...flop, board: ["2c", "7d", "9h", "Jc", "Qs"], seats: flop.seats.map((s) => ({ ...s, hasCards: false })),
    result: { type: "showdown", revealed: [{ seat: 1, holeCards: ["3c", "3d"] }], winners: [{ seat: 1, amount: 10 }] } };
  d.onView(flop, res, { holeCards: ["Ah", "Ad"] });
  assert.equal(d.deck.length, 39, "the run-out board is taken from the deck");
  assert.equal(d.tableHidden, true);
  assert.equal(d.held.length, 3 * 2 + 5, "three live hands and the board are held on the canvas");
  assert.ok(d.held.filter((h) => h.at.kind === "seat" && h.at.seat === 3).every((h) => !h.faceUp), "unshown hands stay face-down");
  assert.ok(d.held.filter((h) => h.at.kind === "seat" && h.at.seat === 1).every((h) => h.faceUp));
  // the collection: the rest of the deck and every card on the table go to the used pile; no shuffle yet
  run(d, clock.t + 6000);
  assert.equal(d.routine, null, "no shuffle at the end of the round");
  assert.equal(d.shuffling, false);
  assert.equal(d.deck.length, 0, "the deck has run out");
  assert.equal(new Set(d.used).size, 52);
  assert.ok(d.tableHidden, "the collected table stays hidden until the next hand");
  // the next hand: the deal's first card finds the deck empty → the shuffle, then the deal
  const h3 = { handNo: 3, buttonSeat: 0, board: [], seats: [0, 1, 2, 3].map((n) => seat(n)) };
  d.onView(res, h3, null);
  assert.equal(d.tableHidden, false);
  run(d, clock.t + 40);
  assert.ok(d.routine && d.shuffling, "the shuffle opens the deal");
  assert.equal(d.routine.R.finalOrder.length, 52);
  assert.equal([...d._seatIds.values()].flat().filter((id) => id != null).length, 0, "no card leaves before the shuffle ends");
  run(d, clock.t + d.routine.R.duration + 1500);
  assert.equal(d.routine, null);
  assert.equal([...d._seatIds.values()].flat().filter((id) => id != null).length, 8);
  assert.equal(d.deck.length, 44);
  assert.equal(new Set([...d.deck, ...[...d._seatIds.values()].flat()]).size, 52);
});

test("sound cues: each landing is announced as its card launches, for the frame it lands", () => {
  clock.t = 50000;
  const d = new Dealer({ variant: "holdem", mySeat: 0 });
  const idle = { handNo: 1, buttonSeat: 2, board: [], seats: [0, 1, 2].map((n) => seat(n, { hasCards: false, inHand: false })) };
  d.init(idle);
  d.geom = { deckSpot: { fx: 12, fy: 80 }, usedSpot: { fx: 900, fy: 80 }, centre: { fx: 450, fy: 300 } };
  const h = { handNo: 2, buttonSeat: 2, board: [], seats: [0, 1, 2].map((n) => seat(n)) };
  const cues = [], lands = [];
  const step = (until) => {
    while (clock.t < until) {
      clock.t += 16;
      d.tick(clock.t);
      for (const f of d.flights) if (!f.seen) { f.seen = true; lands.push({ t: f.t0 + f.dur, to: f.to.kind, seat: f.to.seat }); }
      for (const c of d.cues.splice(0)) { assert.ok(c.t >= clock.t, `${c.name} announced before its moment`); cues.push(c); }
    }
  };
  d.onView(idle, h, null);
  step(clock.t + 40);
  step(clock.t + d.routine.R.duration + 1200);
  cues.splice(0, cues.length, ...cues.filter((c) => c.name !== "riffle"));
  const dealt = lands.filter((l) => l.to === "seat").map((l) => l.t);
  assert.equal(dealt.length, 6);
  assert.deepEqual(cues.filter((c) => c.name === "cardLand").map((c) => c.t), dealt, "a card sound on every landing frame");
  const myFlip = cues.find((c) => c.name === "flip");
  const mine = lands.filter((l) => l.seat === 0).map((l) => l.t);
  assert.equal(myFlip?.at.seat, 0);
  const late = myFlip.t - (Math.max(...mine) + DEAL.flipAfterLand);   // the landing is seen on the next frame
  assert.ok(late >= 0 && late < 16, "my cards' flip, as they start to turn");
  // seat 1 folds: two taps on the used pile, on the frames its cards land there
  const f = { ...h, seats: h.seats.map((s) => (s.seat === 1 ? { ...s, status: "folded" } : s)) };
  d.onView(h, f, null);
  step(clock.t + 600);
  const taps = cues.filter((c) => c.name === "pileTap").map((c) => c.t);
  assert.deepEqual(taps, lands.filter((l) => l.to === "used").map((l) => l.t));
  assert.equal(taps.length, 2);
  // the result: the collection taps grow quieter; no shuffle at the round's end
  const res = { ...f, board: [], seats: f.seats.map((s) => ({ ...s, hasCards: false })), result: { type: "fold", winners: [{ seat: 0, amount: 3 }] } };
  d.onView(f, res, { holeCards: ["As", "Ks"] });
  step(clock.t + 3000);
  const collected = cues.filter((c) => c.name === "pileTap").slice(2);
  assert.ok(collected.length >= 5, "the leftover deck and the live hands");
  assert.ok(collected.every((c, i) => i === 0 || (c.gain ?? 1) <= (collected[i - 1].gain ?? 1)));
  assert.equal(cues.find((c) => c.name === "riffle"), undefined);
  assert.equal(d.routine, null);
  // the next deal starts with it: one riffle for the shuffle phase
  const h2 = { handNo: 3, buttonSeat: 0, board: [], seats: [0, 1, 2].map((n) => seat(n)) };
  d.onView(res, h2, null);
  step(clock.t + 100);
  const riffle = cues.find((c) => c.name === "riffle");
  const phase = d.routine.R.phases.find((p) => p.name === "shuffle");
  assert.equal(riffle.t, d.routine.t0 + phase.t0);
  assert.equal(riffle.dur, phase.t1 - phase.t0);
});
