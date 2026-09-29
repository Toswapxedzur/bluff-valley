// One table visit — mine, or (with ?player=) another player's that they let me see — for the visit
// sheet (owner 2026-09-28): its games, in order, with how many replay steps each has, enough to draw
// the whole visit's slider and its markers before any table views load (those come a few games at a
// time from /api/history/steps, each game under /replay's own access rules). Each game's step count is
// exact and it names its big moment, if it had one (a gold mark on the slider — owner 2026-09-29).
import { json, error } from "@sveltejs/kit";
import { visitsFor } from "$lib/server/visits.js";
import { historySinceForTarget } from "$lib/server/replay-access.js";
import { query } from "$lib/server/db.js";
import { replayViews } from "$lib/server/replay-views.js";

export async function GET({ url, locals }) {
  if (!locals.user) throw error(401, "Sign in.");
  const id = String(url.searchParams.get("id") || "");
  const target = String(url.searchParams.get("player") || locals.user.id);
  const since = await historySinceForTarget(locals.user, target);
  if (since === null) throw error(404, "That visit isn't visible to you.");
  const v = (await visitsFor(target, { sinceMs: since })).find((x) => x.id === id);
  if (!v) throw error(404, "That visit isn't in the visible history.");
  // each game's exact step count (replay-views.js — blinds, streets, showdown, pots, automatic moves)
  // and its big moment, from the recording itself; an archived hand keeps the first guess
  const ids = v.games.map((g) => g.replayId);
  if (ids.length) {
    const rows = await query(`SELECT id, hand_no, table_name, context, replay_json FROM match_replay WHERE id IN (${ids.map(() => "?").join(",")})`, ids);
    const byId = new Map(rows.map((r) => [r.id, r]));
    for (const g of v.games) {
      const r = byId.get(g.replayId);
      if (!r?.replay_json) continue;
      try {
        const out = replayViews(JSON.parse(r.replay_json), r, { people: new Map(), viewerSeat: null });
        if (!out) continue;
        g.steps = out.steps.length;
        g.moment = out.steps[out.steps.length - 1].mark ?? null;
      } catch { /* the guess stays */ }
    }
  }
  return json(v);
}
