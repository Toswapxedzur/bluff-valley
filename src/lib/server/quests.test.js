// Quest engine tests — period bucketing, progress capping, and claim idempotency.
// A tiny in-memory `db` mock recognizes the three exact statements quests.js runs
// and applies their intended semantics, so the real logic is exercised without MySQL.

import { test } from "node:test";
import assert from "node:assert/strict";
import { periodKey, nextReset, recordEvent, recordHand, activeQuestsFor, claim, QUESTS } from "./quests.js";

function makeDb() {
  const rows = new Map(); // "user|quest|pk" -> { user_id, quest_id, period_key, progress, claimed_at }
  return {
    rows,
    async execute(sql, p) {
      if (sql.includes("INSERT IGNORE INTO quest_progress")) {      // the hidden per-day marker
        const [userId, pk] = p, key = `${userId}|_day|${pk}`;
        if (rows.has(key)) return { affectedRows: 0 };
        rows.set(key, { user_id: userId, quest_id: "_day", period_key: pk, progress: 1, claimed_at: null });
        return { affectedRows: 1 };
      }
      if (sql.includes("INSERT INTO quest_progress")) {
        const [userId, questId, pk, seed, , target, amount] = p;
        const key = `${userId}|${questId}|${pk}`;
        const cur = rows.get(key);
        if (!cur) rows.set(key, { user_id: userId, quest_id: questId, period_key: pk, progress: seed, claimed_at: null });
        else cur.progress = Math.min(target, cur.progress + amount);
        return { affectedRows: 1 };
      }
      if (sql.includes("UPDATE quest_progress SET claimed_at")) {
        const [at, userId, questId, pk, target] = p;
        const cur = rows.get(`${userId}|${questId}|${pk}`);
        if (cur && cur.claimed_at == null && cur.progress >= target) { cur.claimed_at = at; return { affectedRows: 1 }; }
        return { affectedRows: 0 };
      }
      throw new Error("unexpected execute: " + sql);
    },
    async query(sql, p) {
      if (sql.includes("SELECT quest_id, period_key, progress, claimed_at")) {
        const [userId] = p;
        return [...rows.values()].filter((r) => r.user_id === userId);
      }
      throw new Error("unexpected query: " + sql);
    },
  };
}

const AT = Date.UTC(2026, 7, 27, 12, 0, 0); // 2026-08-27 (a Thursday)

test("periodKey buckets by day / week / month (China time)", () => {
  assert.equal(periodKey("daily", AT), "2026-08-27");
  assert.equal(periodKey("monthly", AT), "2026-08");
  assert.match(periodKey("weekly", AT), /^\d{4}-W\d{2}$/);
  // Same ISO week is stable; a week later differs.
  assert.equal(periodKey("weekly", AT), periodKey("weekly", AT + 2 * 86400000));
  assert.notEqual(periodKey("weekly", AT), periodKey("weekly", AT + 7 * 86400000));
});

test("recordEvent advances matching quests and caps at target", async () => {
  const db = makeDb();
  // d_win_3 target 3. Three wins completes it; a fourth never exceeds target.
  for (let i = 0; i < 4; i++) await recordEvent("u1", "pots_won", 1, db, AT);
  const q = (await activeQuestsFor("u1", db, AT)).find((x) => x.id === "d_win_3");
  assert.equal(q.progress, 3);
  assert.equal(q.done, true);
  assert.equal(q.claimed, false);
});

test("a large single event is capped to the quest target", async () => {
  const db = makeDb();
  await recordEvent("u2", "chips_won", 999999, db, AT); // no chips_won quest in catalog → no-op is fine
  // hands_played does exist; a big amount caps at daily target (10).
  await recordEvent("u2", "hands_played", 999, db, AT);
  const daily = (await activeQuestsFor("u2", db, AT)).find((x) => x.id === "d_play_10");
  assert.equal(daily.progress, 10);
  assert.equal(daily.done, true);
});

test("claim pays once and is idempotent", async () => {
  const db = makeDb();
  const credited = [];
  const wallet = { credit: async (u, a, r, ref) => { credited.push({ u, a, r, ref }); return 5000; } };

  // Not claimable before completion.
  let res = await claim("u3", "d_win_3", db, wallet, AT);
  assert.equal(res.ok, false);
  assert.equal(res.error, "not_claimable");

  for (let i = 0; i < 3; i++) await recordEvent("u3", "pots_won", 1, db, AT);

  res = await claim("u3", "d_win_3", db, wallet, AT);
  assert.equal(res.ok, true);
  const reward = QUESTS.find((q) => q.id === "d_win_3").reward;
  assert.equal(res.reward, reward);
  assert.equal(credited.length, 1);
  assert.equal(credited[0].a, reward);

  // Second claim in the same period is rejected and does NOT pay again.
  res = await claim("u3", "d_win_3", db, wallet, AT);
  assert.equal(res.ok, false);
  assert.equal(credited.length, 1);
});

test("claim rejects an unknown quest id", async () => {
  const db = makeDb();
  const res = await claim("u4", "nope", db, { credit: async () => 0 }, AT);
  assert.equal(res.ok, false);
  assert.equal(res.error, "unknown_quest");
});

const HOUR = 3600_000;

test("resets happen at midnight China time (16:00 UTC), not UTC midnight", () => {
  const before = Date.UTC(2026, 8, 27, 15, 59), after = Date.UTC(2026, 8, 27, 16, 0);   // 23:59 / 00:00 in China
  assert.equal(periodKey("daily", before), "2026-09-27");
  assert.equal(periodKey("daily", after), "2026-09-28");
  assert.equal(periodKey("daily", Date.UTC(2026, 8, 27, 1, 0)), "2026-09-27");         // 09:00 China, same day
  // the Sprint keeps its UTC day (offset 0)
  assert.equal(periodKey("daily", after, 0), "2026-09-27");
});

test("nextReset: the next China midnight, the next Monday, the next 1st", () => {
  const at = Date.UTC(2026, 8, 27, 4, 0);                      // Sun 27 Sep 2026, 12:00 China
  assert.equal(nextReset("daily", at), Date.UTC(2026, 8, 27, 16, 0));      // Mon 00:00 China
  assert.equal(nextReset("weekly", at), Date.UTC(2026, 8, 27, 16, 0));     // that's also Monday
  assert.equal(nextReset("monthly", at), Date.UTC(2026, 8, 30, 16, 0));    // 1 Oct 00:00 China
  const mon = Date.UTC(2026, 8, 28, 4, 0);                     // Mon 28 Sep, 12:00 China
  assert.equal(nextReset("weekly", mon), Date.UTC(2026, 9, 4, 16, 0));     // Mon 5 Oct 00:00 China
  for (const p of ["daily", "weekly", "monthly"]) assert.notEqual(periodKey(p, nextReset(p, at)), periodKey(p, at));
  for (const p of ["daily", "weekly", "monthly"]) assert.equal(periodKey(p, nextReset(p, at) - 1), periodKey(p, at));
});

test("a day played counts once per day, however many hands", async () => {
  const db = makeDb();
  const mon = Date.UTC(2026, 8, 28, 4, 0);
  for (let i = 0; i < 12; i++) await recordHand("u9", { won: i % 4 === 0, net: 10 }, db, mon + i * 60_000);
  await recordHand("u9", {}, db, mon + 24 * HOUR);             // Tuesday
  const qs = await activeQuestsFor("u9", db, mon + 24 * HOUR);
  const by = Object.fromEntries(qs.map((q) => [q.id, q]));
  assert.equal(by.w_days_5.progress, 2, "two days this week");
  assert.equal(by.m_days_20.progress, 2);
  assert.equal(by.w_play_100.progress, 13);
  assert.equal(by.w_win_25.progress, 3);
  assert.equal(by.d_play_10.progress, 1, "Tuesday's daily set is fresh");
  assert.ok(!qs.some((q) => q.id === "_day"), "the day marker is not a quest");
});

test("the basic shape: three quests in each of daily / weekly / monthly, no Sprint quests", () => {
  for (const p of ["daily", "weekly", "monthly"]) assert.equal(QUESTS.filter((q) => q.period === p).length, 3);
  assert.ok(!QUESTS.some((q) => /sprint/.test(q.objective)));
});
