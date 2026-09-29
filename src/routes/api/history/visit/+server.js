// One table visit — mine, or (with ?player=) another player's that they let me see — for the visit
// sheet (owner 2026-09-28): its games, in order, with how many replay steps each has, enough to draw
// the whole visit's slider and its markers before any table views load (those come a few games at a
// time from /api/history/steps, each game under /replay's own access rules).
import { json, error } from "@sveltejs/kit";
import { visitsFor } from "$lib/server/visits.js";
import { historySinceForTarget } from "$lib/server/replay-access.js";

export async function GET({ url, locals }) {
  if (!locals.user) throw error(401, "Sign in.");
  const id = String(url.searchParams.get("id") || "");
  const target = String(url.searchParams.get("player") || locals.user.id);
  const since = await historySinceForTarget(locals.user, target);
  if (since === null) throw error(404, "That visit isn't visible to you.");
  const v = (await visitsFor(target, { sinceMs: since })).find((x) => x.id === id);
  if (!v) throw error(404, "That visit isn't in the visible history.");
  return json(v);
}
