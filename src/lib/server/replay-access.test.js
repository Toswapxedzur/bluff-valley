import { test } from "node:test";
import assert from "node:assert/strict";
import { normHistoryWindow, sharesHistory } from "./replay-access.js";

test("history window: missing = friends, legacy windows = everyone", () => {
  assert.equal(normHistoryWindow(null), "friends");
  assert.equal(normHistoryWindow("private"), "private");
  assert.equal(normHistoryWindow("friends"), "friends");
  for (const w of ["7d", "30d", "90d", "all", "everyone"]) assert.equal(normHistoryWindow(w), "everyone");
});

test("who sees a player's history: only me / friends / everybody, under the profile's visibility", () => {
  const p = (history_window, profile_visibility = "public") => ({ history_window, profile_visibility });
  // yourself: always
  assert.equal(sharesHistory(p("private", "private"), "self"), true);
  // only me
  assert.equal(sharesHistory(p("private"), "friends"), false);
  assert.equal(sharesHistory(p("private"), null), false);
  // friends (the default)
  assert.equal(sharesHistory(p("friends"), "friends"), true);
  assert.equal(sharesHistory(p("friends"), "outgoing"), false);
  assert.equal(sharesHistory(p("friends"), null), false);
  assert.equal(sharesHistory(p(undefined), "friends"), true);
  // everybody
  assert.equal(sharesHistory(p("everyone"), null), true);
  assert.equal(sharesHistory(p("7d"), null), true);
  // a profile you can't see never shows its history
  assert.equal(sharesHistory(p("everyone", "private"), "friends"), false);
  assert.equal(sharesHistory(p("everyone", "friends"), null), false);
  assert.equal(sharesHistory(p("everyone", "friends"), "friends"), true);
});
