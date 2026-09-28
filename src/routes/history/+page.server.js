// History (owner, 2026-09-28): your TABLE VISITS (visits.js — each opens as a near-full-screen sheet
// with one continuous replay of the visit) mixed with the rest of your timeline (rewards, transfers,
// friends — activity.js; buy-ins / cash-outs are folded into the visits).
//   ?filter=all | visits | money | friends (| achievements when they're on)
import { redirect } from "@sveltejs/kit";
import { recentActivity } from "$lib/server/activity.js";
import { modeBreakdown, overviewStats } from "$lib/server/stats.js";
import { historySinceFor } from "$lib/server/replay-access.js";
import { visitsFor, visitSummary } from "$lib/server/visits.js";

export async function load({ locals, url }) {
  if (!locals.user) throw redirect(303, "/account/login");
  const filter = url.searchParams.get("filter") || "all";
  // Hard 7-day horizon: only the owner sees beyond it (replay-access.js).
  const sinceMs = historySinceFor(locals.user);
  const wantVisits = filter === "all" || filter === "visits";
  const [events, overview, modes, visits] = await Promise.all([
    filter === "visits" ? [] : recentActivity(locals.user.id, { filter, sinceMs }),
    overviewStats(locals.user.id, { sinceMs }),
    modeBreakdown(locals.user.id, { sinceMs }),
    wantVisits ? visitsFor(locals.user.id, { sinceMs }).then((vs) => vs.map(visitSummary)) : []
  ]);
  const bestMode = modes
    .filter((row) => row.role === "player")
    .sort((a, b) => b.net - a.net || b.matches - a.matches)[0] || null;
  return { events, visits, filter, stats: { matches: overview.matches, net: overview.totalNet, bestMode } };
}
