// One of MY table visits (History's sheet, owner 2026-09-28): its games, in order, with how many
// replay steps each has — enough to draw the whole visit's slider and its markers before any table
// views load (those come a few games at a time from /api/history/steps).
import { json, error } from "@sveltejs/kit";
import { visitsFor } from "$lib/server/visits.js";
import { historySinceFor } from "$lib/server/replay-access.js";

export async function GET({ url, locals }) {
  if (!locals.user) throw error(401, "Sign in.");
  const id = String(url.searchParams.get("id") || "");
  const visits = await visitsFor(locals.user.id, { sinceMs: historySinceFor(locals.user) });
  const v = visits.find((x) => x.id === id);
  if (!v) throw error(404, "That visit isn't in your history.");
  return json(v);
}
