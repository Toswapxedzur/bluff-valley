import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { replayViews } from "./replay-views.js";

// real recordings from local play (anonymised): one per game + a Hold'em showdown and a fold-out
const dir = new URL("./fixtures/replays/", import.meta.url);
const fixtures = Object.fromEntries(readdirSync(dir).filter((f) => f.endsWith(".json")).map((f) => [f.replace(".json", ""), JSON.parse(readFileSync(new URL(f, dir), "utf8"))]));
const people = (doc) => new Map(doc.players.map((p) => [p.seat, { userId: p.userId ?? `bot-${p.seat}`, name: p.name ?? `Bot ${p.seat}`, ring: "default", badge: "default", banner: null }]));
const views = (name, viewerSeat = null) => {
  const { doc, row } = fixtures[name];
  return { doc, out: replayViews(doc, row, { people: people(doc), viewerSeat }) };
};

test("every game's recording becomes table views: before the deal, dealt, one per action (+ the finer steps), the result", () => {
  assert.equal(Object.keys(fixtures).length, 10);
  for (const name of Object.keys(fixtures)) {
    const { doc, out } = views(name);
    assert.ok(out, `${name}: re-simulates`);
    assert.ok(out.steps.length >= doc.actions.length + 3, `${name}: at least a step per action`);
    const first = out.steps[0], dealt = out.steps.find((s) => s.text === "Cards dealt" || s.text === "Round starts"), last = out.steps.at(-1);
    assert.equal(first.view.phase, "waiting", `${name}: starts before the deal`);
    assert.equal(first.view.handNo, dealt.view.handNo - 1, `${name}: the dealt step is a NEW hand to the motion engines`);
    assert.equal(dealt.view.phase, "running", name);
    assert.ok(last.view.result, `${name}: ends on the result`);
    for (const s of out.steps) {
      assert.deepEqual(s.view.seats.map((x) => x.seat).sort(), doc.players.map((p) => p.seat).sort(), `${name}: every seat, every step`);
      assert.equal(s.view.id, `replay-fixture-${name}`, `${name}: one table id, so the motion engines diff instead of resetting`);
      assert.ok(s.view.config.maxSeats > Math.max(...doc.players.map((p) => p.seat)), `${name}: every seat fits the table`);
    }
    for (let i = 1; i < out.steps.length; i += 1) assert.ok(out.steps[i].t > out.steps[i - 1].t, `${name}: time only moves on`);
    assert.equal(out.privates.length, out.steps.length);
  }
});

test("Hold'em: blinds, labels and the paid result match the live table", () => {
  for (const name of ["holdem-showdown", "holdem-uncontested"]) {
    const { doc, out } = views(name);
    // the blinds go in as their own step (a new hand, no cards yet), then the cards are dealt
    const blinds = out.steps[1];
    assert.match(blinds.text, /posts/);
    assert.equal(blinds.view.handNo, out.steps[0].view.handNo + 1, "the blinds step is the new hand");
    assert.ok(blinds.view.seats.every((s) => !s.hasCards), "no cards yet");
    const dealt = out.steps[2].view;
    assert.equal(out.steps[2].text, "Cards dealt");
    assert.equal(dealt.handNo, blinds.view.handNo);
    assert.equal(dealt.street, "preflop");
    assert.deepEqual(dealt.seats.filter((s) => s.lastAction === "SB" || s.lastAction === "BB").map((s) => s.lastAction).sort(), ["BB", "SB"]);
    assert.ok(dealt.seats.every((s) => s.inHand && s.hasCards));
    // a step's label is the live table's ("Raise 400", "Fold", …) on the seat that acted
    const a = doc.actions[0], step = out.steps[3].view.seats.find((s) => s.seat === a.s);
    assert.ok(step.lastAction, `${name}: the actor's label`);
    const last = out.steps.at(-1).view;
    assert.equal(last.street, "complete");
    assert.equal(last.result.type, name.endsWith("showdown") ? "showdown" : "uncontested");
    // stacks after the hand = start + net, exactly
    for (const n of doc.final.nets) {
      const start = doc.players.find((p) => p.seat === n.seat).stack;
      assert.equal(last.seats.find((s) => s.seat === n.seat).stack, start + n.net, `${name}: seat ${n.seat} paid`);
    }
    assert.ok(last.seats.every((s) => !s.inHand && !s.hasCards && s.lastAction == null), "the hand is cleared, as on the live table");
  }
});

test("privacy: only the viewer's own hole cards, and only while the hand runs", () => {
  const { doc, out } = views("holdem-showdown", views("holdem-showdown").doc.players[0].seat);
  const seat = doc.players[0].seat;
  assert.equal(out.privates[0], null, "not before the deal");
  assert.equal(out.privates.at(-1), null, "gone once the hand is over (the result shows what was revealed)");
  assert.equal(out.privates[1], null, "not while the blinds go in");
  assert.equal(out.privates[2].seat, seat);
  assert.equal(out.privates[2].holeCards.length, 2);
  const spectator = views("holdem-showdown").out;
  assert.ok(spectator.privates.every((p) => p === null), "a watcher sees nobody's cards");
});

test("house games: stacks hold during the round and settle at the end; Big Two shows only my hand", () => {
  for (const name of ["blackjack", "baccarat", "three-card", "roulette", "sic-bo", "slots"]) {
    const { doc, out } = views(name);
    const nets = new Map(doc.final.nets.map((n) => [n.seat, n.net]));
    for (const p of doc.players) {
      assert.equal(out.steps[1].view.seats.find((s) => s.seat === p.seat).stack, p.stack, `${name}: seat ${p.seat} during the round`);
      assert.equal(out.steps.at(-1).view.seats.find((s) => s.seat === p.seat).stack, p.stack + (nets.get(p.seat) || 0), `${name}: seat ${p.seat} settled`);
    }
    assert.equal(out.steps.at(-1).view.round, out.steps.at(-1).view.result, `${name}: the settled round is the result (runtime.js)`);
  }
  const me = views("big-two").doc.players[0].seat;
  const bt = views("big-two", me).out;
  assert.ok(bt.privates[1] && bt.privates[1].seat === me && bt.privates[1].holeCards?.length > 0, "my Big Two hand");
  assert.ok(views("big-two").out.privates.every((p) => p === null));
});

test("a broken recording gives null, never a throw", () => {
  assert.equal(replayViews(null, {}, { people: new Map() }), null);
  assert.equal(replayViews({ v: 1, mode: "nope", players: [], actions: [] }, { id: "x" }, { people: new Map() }), null);
});

test("an all-in run-out is steps on the table (hands up, then a street a step, each with the chances), marked All-in", () => {
  const { out } = views("holdem-allin");
  const up = out.steps.findIndex((x) => x.text.startsWith("All in — hands up"));
  assert.ok(up > 0, "the hands turn up");
  const run = out.steps.slice(up, up + 4);
  assert.deepEqual(run.map((x) => x.view.board.length), [0, 3, 4, 5], "then the board, a street a step");
  assert.ok(run.every((x) => !x.view.result), "not the result yet: the dealer deals these cards");
  assert.ok(run.every((x) => Object.keys(x.view.shown).length === 2 && Object.keys(x.view.equity).length === 2), "both hands up, both chances");
  assert.match(run[1].text, /^Flop · /); assert.match(run[2].text, /^Turn · /); assert.match(run[3].text, /^River · /);
  assert.ok(out.steps.at(-1).view.result && /wins/.test(out.steps.at(-1).text));
  assert.equal(out.steps.at(-1).mark, "All-in", "the result carries the moment's slider mark");
  for (let i = 1; i < out.steps.length; i += 1) assert.ok(out.steps[i].t > out.steps[i - 1].t);
  assert.equal(views("holdem-showdown").out.steps.at(-1).mark, undefined, "an ordinary showdown has no mark");
});

test("Hold'em's finer steps: each street dealt after the action that closed it, the showdown a hand at a time, then the pot", () => {
  const { doc, out } = views("holdem-showdown");
  const texts = out.steps.map((x) => x.text);
  for (const [street, n] of [["Flop", 3], ["Turn", 4], ["River", 5]]) {
    const k = texts.findIndex((t) => t.startsWith(`${street} · `));
    assert.ok(k > 0, `${street} has its own step`);
    assert.equal(out.steps[k].view.board.length, n);
    assert.equal(out.steps[k - 1].view.board.length, n === 3 ? 0 : n - 1, "the closing action still shows the old board");
    assert.ok(!/^(Flop|Turn|River)/.test(texts[k - 1]), "right after the action that closed the street");
  }
  const shows = out.steps.filter((x) => / shows /.test(x.text));
  assert.equal(shows.length, doc.final.result.revealed.length, "one step per hand shown");
  assert.deepEqual(shows.map((x) => Object.keys(x.view.shown).length), shows.map((_, i) => i + 1), "the hands turn up one at a time");
  assert.ok(shows.every((x) => !x.view.result));
  const pay = out.steps.at(-1);
  assert.match(pay.text, /wins \d/);
  assert.deepEqual(pay.view.result.winners, doc.final.result.winners);
  // an uncontested hand: no showdown, the pot straight to the last player in
  const un = views("holdem-uncontested").out;
  assert.ok(!un.steps.some((x) => / shows /.test(x.text)));
  assert.match(un.steps.at(-1).text, /wins \d/);
});

test("the other games: the table as the last move left it, then the automatic part a step each, then the payout", () => {
  const expect = { blackjack: /^Dealer turns over /, baccarat: /^Player .* — Banker /, roulette: /^Ball lands /, "sic-bo": /^Dice: /, slots: /^Reels: /, "three-card": /^Dealer shows / };
  for (const [name, re] of Object.entries(expect)) {
    const { doc, out } = views(name);
    const k = out.steps.findIndex((x) => re.test(x.text));
    assert.ok(k > 1, `${name}: the automatic part has its own step`);
    const beforeAuto = out.steps[k - 1].view.round, auto = out.steps[k].view.round;
    assert.ok(!beforeAuto.results?.length, `${name}: nothing settled before the automatic part`);
    if (name === "blackjack") assert.ok(beforeAuto.dealer.cards.includes("??"), "the dealer's hole card still down");
    if (name === "three-card") assert.ok(beforeAuto.dealer.cards.every((c) => c === "??"), "the dealer's cards still down");
    if (["roulette", "sic-bo", "slots", "baccarat"].includes(name)) { assert.ok(!beforeAuto.outcome, `${name}: no outcome yet`); assert.ok(auto.outcome); }
    for (let i = k; i < out.steps.length - 1; i += 1)
      for (const p of doc.players) assert.equal(out.steps[i].view.seats.find((x) => x.seat === p.seat).stack, p.stack, `${name}: no money moves before the payout`);
    assert.equal(out.steps.at(-1).text, "Result");
  }
  const bj = views("blackjack").out.steps.filter((x) => /^Dealer (turns over|hits)/.test(x.text));
  assert.deepEqual(bj.map((x) => x.view.round.dealer.cards.length), bj.map((_, i) => i + 2), "the dealer's cards a draw at a time");
});
