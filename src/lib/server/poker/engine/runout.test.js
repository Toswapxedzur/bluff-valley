import { test } from "node:test";
import assert from "node:assert/strict";
import { equities, runoutOf } from "./runout.js";

const hands = [{ seat: 1, holeCards: ["Ah", "Kh"] }, { seat: 2, holeCards: ["Qs", "Qd"] }];

test("win chances street by street: exact from the flop, the river decides", () => {
  const board = ["Kd", "7c", "2h", "5s", "Qc"];
  const r = runoutOf(hands, board, 3);
  assert.deepEqual(r.stages.map((s) => s.board), [3, 4, 5]);
  assert.deepEqual(r.stages[0].pct, { 1: 92, 2: 8 }, "top pair vs QQ on K-7-2: QQ needs a queen (and no runner hearts for AK)");
  assert.deepEqual(r.stages[1].pct, { 1: 95, 2: 5 });
  assert.deepEqual(r.stages[2].pct, { 1: 0, 2: 100 }, "the river queen");
});

test("before the flop the chances are sampled (AKs vs QQ ≈ 46 / 54)", () => {
  let seed = 1;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const pct = equities(hands, [], rand);
  assert.ok(Math.abs(pct[1] - 46) <= 4 && Math.abs(pct[2] - 54) <= 4, JSON.stringify(pct));
});
