// A player's history (owner, 2026-09-29): their table visits — each opens the near-full-screen replay
// of the whole visit — reached from the History button on their profile popup (your own: your avatar
// in the top bar, or Settings). Visible when they share their history with you (Settings → Privacy:
// only me / friends / everybody — replay-access.js), inside the 7-day horizon (the owner: all of it).
import { error, redirect } from "@sveltejs/kit";
import { historySinceForTarget } from "$lib/server/replay-access.js";
import { visitsFor, visitSummary } from "$lib/server/visits.js";
import { getProfile } from "$lib/server/profiles.js";

export async function load({ params, locals }) {
  const me = locals.user ?? null;
  if (!me) throw redirect(303, "/account/login");
  const profile = await getProfile(params.id, me.id).catch(() => null);
  if (!profile) throw error(404, "No such player.");
  const since = await historySinceForTarget(me, params.id);
  const visits = since === null ? null : (await visitsFor(params.id, { sinceMs: since })).map(visitSummary);
  return {
    player: { id: params.id, name: profile.name, avatarMediaId: profile.avatarMediaId ?? null, ring: profile.ring || "default", isSelf: profile.isSelf },
    visits,
    horizonDays: me.isAdmin ? null : 7
  };
}
