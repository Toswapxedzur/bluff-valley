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

test("every game's recording becomes table views: before the deal, dealt, one per action, the result", () => {
  assert.equal(Object.keys(fixtures).length, 9);
  for (const name of Object.keys(fixtures)) {
    const { doc, out } = views(name);
    assert.ok(out, `${name}: re-simulates`);
    assert.equal(out.steps.length, doc.actions.length + 3, `${name}: step count`);
    const [first, dealt] = out.steps, last = out.steps.at(-1);
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
    const dealt = out.steps[1].view;
    assert.equal(dealt.street, "preflop");
    assert.deepEqual(dealt.seats.filter((s) => s.lastAction === "SB" || s.lastAction === "BB").map((s) => s.lastAction).sort(), ["BB", "SB"]);
    assert.ok(dealt.seats.every((s) => s.inHand && s.hasCards));
    // a step's label is the live table's ("Raise 400", "Fold", …) on the seat that acted
    const a = doc.actions[0], step = out.steps[2].view.seats.find((s) => s.seat === a.s);
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
  assert.equal(out.privates[1].seat, seat);
  assert.equal(out.privates[1].holeCards.length, 2);
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
