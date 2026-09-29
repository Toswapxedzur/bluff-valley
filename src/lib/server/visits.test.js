import { test } from "node:test";
import assert from "node:assert/strict";
import { groupVisits, VISIT_GAP_MS } from "./visits.js";

const MIN = 60_000;
const hand = (id, table, t, net, extra = {}) => ({ id, table_id: table, table_name: `Table ${table}`, context: "cash", mode: "holdem", hand_no: id.length, started_at: t, ended_at: t + MIN, net, nact: 8, ...extra });

test("consecutive hands at one table are one visit; a long pause or another table starts a new one", () => {
  const t0 = 1_000_000_000;
  const v = groupVisits([
    hand("a1", "A", t0, 20), hand("a2", "A", t0 + 2 * MIN, -10), hand("a3", "A", t0 + 5 * MIN, 5),
    hand("b1", "B", t0 + 7 * MIN, -40),
    hand("a4", "A", t0 + 7 * MIN + VISIT_GAP_MS + MIN, 100)
  ]);
  assert.equal(v.length, 3);
  const [late, b, a] = v;   // newest first
  assert.deepEqual(a.games.map((g) => g.replayId), ["a1", "a2", "a3"]);
  assert.equal(a.net, 15);
  assert.equal(a.hands, 3);
  assert.equal(a.games[0].steps, 11, "actions + 3 steps (before the deal, dealt, …, the result)");
  assert.deepEqual(b.games.map((g) => g.replayId), ["b1"]);
  assert.deepEqual(late.games.map((g) => g.replayId), ["a4"], "back after a long pause: a new visit");
  assert.equal(a.kind, "cash");
  assert.notEqual(a.id, late.id);
});

test("a River Sprint round is one visit across every table, its net is prize − bid", () => {
  const t0 = 2_000_000_000;
  const s = (id, table, t) => hand(id, table, t, 500, { context: "sprint" });
  const v = groupVisits(
    [s("s1", "sprint-r9-0", t0), s("s2", "sprint-r9-3", t0 + MIN), s("s3", "sprint-r9-1", t0 + 2 * MIN)],
    [{ reason: "sprint_bid", ref: "sprint:r9", delta: -200 }, { reason: "sprint_prize", ref: "sprint:r9", delta: 900 }]
  );
  assert.equal(v.length, 1);
  assert.equal(v[0].kind, "sprint");
  assert.equal(v[0].tableName, "River Sprint");
  assert.deepEqual(v[0].games.map((g) => g.tableId), ["sprint-r9-0", "sprint-r9-3", "sprint-r9-1"]);
  assert.equal(v[0].net, 700, "the wallet's result, not the round's chips");
});

test("a tournament's net is prize − entry; an archived hand has no step count", () => {
  const v = groupVisits(
    [hand("t1", "tid", 3_000_000_000, 999, { context: "tournament", nact: null })],
    [{ reason: "tourney_entry", ref: "tid", delta: -100 }, { reason: "tourney_prize", ref: "tid", delta: 250 }]
  );
  assert.equal(v[0].kind, "tournament");
  assert.equal(v[0].net, 150);
  assert.equal(v[0].games[0].steps, null);
});
