// /data — Bluff Valley's own data hub: your in-game history (as TABLE VISITS — owner 2026-09-29:
// each opens as a near-full-screen sheet replaying the whole visit; visits.js), another player's
// in-game history (within what they expose and the 7-day horizon), and
// player search (client-side via /api/friends/find). Replaces the old
// casino.org upload tool, which now lives hidden at /casino-data.
import { historySinceFor } from "$lib/server/replay-access.js";
import { visitsFor, visitSummary, historySinceForTarget } from "$lib/server/visits.js";
import { getProfile } from "$lib/server/profiles.js";
import { getLeaderboard } from "$lib/server/leaderboards.js";

export async function load({ locals, url }) {
  const me = locals.user ?? null;
  const horizon = historySinceFor(me); // 0 for the owner, now-7d otherwise

  // Ranks (the former /leaderboards) live here as a view.
  const view = url.searchParams.get("view") === "ranks" ? "ranks" : "history";
  let ranks = null;
  if (view === "ranks") {
    const metric = url.searchParams.get("metric") || "chips";
    const timeframe = url.searchParams.get("tf") || "all";
    let scope = url.searchParams.get("scope") || "global";
    if (scope === "friends" && !me) scope = "global";
    const rows = await getLeaderboard({ metric, timeframe, scope, viewerId: me?.id || null });
    ranks = { rows, metric, timeframe, scope };
  }

  const myVisits = me ? (await visitsFor(me.id, { sinceMs: horizon })).map(visitSummary) : null;

  let player = null;
  const target = String(url.searchParams.get("u") || "").trim();
  if (target) {
    const profile = await getProfile(target, me?.id ?? null).catch(() => null);
    if (profile) {
      // The owner sees everything; everyone else needs the player's exposure window AND stays inside
      // the 7-day horizon (one rule, shared with the visit sheet's API: visits.js)
      const since = await historySinceForTarget(me, target);
      const visits = since === null ? null : (await visitsFor(target, { sinceMs: since })).map(visitSummary);
      player = {
        id: target,
        name: profile.name || profile.displayName || "Player",
        avatarMediaId: profile.avatarMediaId ?? null,
        restricted: !!profile.restricted,
        privateHistory: since === null,
        visits
      };
    } else {
      player = { id: target, missing: true };
    }
  }

  return {
    view,
    ranks,
    signedIn: !!me,
    isOwner: !!me?.isAdmin,
    horizonDays: me?.isAdmin ? null : 7,
    myVisits,
    player
  };
}
