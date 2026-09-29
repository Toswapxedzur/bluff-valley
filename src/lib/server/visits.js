// History's entries (owner, 2026-09-28): a player's TABLE VISITS — sat down → the hands / rounds they
// played → got up — each replayed as ONE continuous replay with a marker per game. Built from the
// recorded hands (match_replay + match_replay_player), so every visit has something to replay.
//   a cash table     → consecutive hands at one table; a pause over VISIT_GAP_MS starts a new visit;
//                      the net is the sum of the hands' results
//   a River Sprint   → the whole round is one visit, across every table it teleported you to; the
//                      net is the prize minus the bid (the round's chips aren't real money)
//   a tournament     → its table (the table id is the tournament's id); net = prize − entry
// Table buy-ins / cash-outs, Sprint bids / prizes and tournament entries / prizes are folded into the
// visit, so the feed doesn't list them separately (activity.js skips FOLDED_REASONS).
import { query } from "./db.js";

export const VISIT_GAP_MS = 30 * 60 * 1000;
export const FOLDED_REASONS = ["table_buyin", "table_cashout", "sprint_bid", "sprint_prize", "tourney_entry", "tourney_prize"];

const sprintRound = (tableId) => { const m = /^sprint-(.+)-\d+$/.exec(String(tableId || "")); return m ? m[1] : null; };

/** Recorded hands (oldest first) + the wallet lines they fold → visits (newest first). Pure. */
export function groupVisits(hands, ledger = []) {
  const visits = [];
  const open = new Map();   // key → the visit being extended
  for (const h of hands) {
    const round = h.context === "sprint" ? sprintRound(h.table_id) : null;
    const key = round ? `sprint:${round}` : `table:${h.table_id}`;
    const started = Number(h.started_at), ended = Number(h.ended_at);
    let v = open.get(key);
    if (!v || (!round && started - v.endedAt > VISIT_GAP_MS)) {
      v = {
        id: `${key}@${started}`,
        key, kind: round ? "sprint" : h.context === "tournament" ? "tournament" : "cash",
        mode: h.mode, variant: h.variant ?? null, tableId: h.table_id,
        tableName: round ? "River Sprint" : h.table_name || null,
        round, startedAt: started, endedAt: ended, net: 0, games: []
      };
      visits.push(v);
      open.set(key, v);
    }
    v.endedAt = Math.max(v.endedAt, ended);
    v.net += Number(h.net) || 0;
    const actions = h.nact == null ? null : Number(h.nact);
    // replay-views.js: before the deal, dealt, one per action, the result — plus an all-in run-out's
    // street steps (a Hold'em showdown with ≥ 2 hands up and no run-it-twice)
    const runout = h.nrun && Number(h.nrev) >= 2 && (!h.btype || h.btype === "NULL") ? Number(h.nrun) : 0;
    v.games.push({ replayId: h.id, handNo: h.hand_no == null ? null : Number(h.hand_no), tableId: h.table_id,
      net: Number(h.net) || 0, steps: actions == null ? null : actions + 3 + runout, startedAt: started });
  }
  // Sprint / tournament: the money result is the wallet's, not the table chips'
  const money = new Map();
  for (const l of ledger) {
    const ref = String(l.ref || "");
    const k = l.reason.startsWith("sprint") ? `sprint:${ref.replace(/^(sprint|refund):/, "")}` : `table:${ref}`;
    if (!money.has(k)) money.set(k, 0);
    money.set(k, money.get(k) + Number(l.delta || 0));
  }
  for (const v of visits) if (v.kind !== "cash" && money.has(v.key)) v.net = money.get(v.key);
  for (const v of visits) v.hands = v.games.length;
  return visits.sort((a, b) => b.endedAt - a.endedAt);
}

/** A player's visits since `sinceMs` (newest first). `games` stay on each visit (the sheet needs them). */
export async function visitsFor(userId, { sinceMs = 0, limit = 3000 } = {}) {
  const hands = await query(
    `SELECT mr.id, mr.mode, mr.variant, mr.context, mr.table_id, mr.table_name, mr.hand_no, mr.started_at, mr.ended_at,
            mrp.net, JSON_LENGTH(mr.replay_json, '$.actions') AS nact,
            JSON_LENGTH(mr.replay_json, '$.final.result.runout.stages') AS nrun,
            JSON_LENGTH(mr.replay_json, '$.final.result.revealed') AS nrev,
            JSON_TYPE(JSON_EXTRACT(mr.replay_json, '$.final.result.boards')) AS btype
       FROM match_replay_player mrp
       JOIN match_replay mr ON mr.id = mrp.replay_id
      WHERE mrp.user_id = ? AND mrp.ended_at >= ?
      ORDER BY mrp.ended_at ASC
      LIMIT ?`,
    [userId, sinceMs, limit]
  );
  const ledger = await query(
    `SELECT reason, ref, delta FROM chip_ledger WHERE user_id = ? AND created_at >= ? AND reason IN ('sprint_bid','sprint_prize','tourney_entry','tourney_prize')`,
    [userId, Math.max(0, sinceMs - 6 * 60 * 60 * 1000)]
  );
  return groupVisits(hands, ledger);
}

/** The list's summary of a visit (no per-game detail). */
export const visitSummary = ({ games: _g, ...v }) => v;
