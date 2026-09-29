// Compact profile for the avatar popover (name, avatar, relationship, presence,
// stats). Respects profile_visibility via getProfile.
import { json, error } from "@sveltejs/kit";
import { getProfile } from "$lib/server/profiles.js";
import { hub } from "$lib/server/poker/hub.js";
import { bannersFor } from "$lib/server/banners.js";
import { historySinceForTarget } from "$lib/server/replay-access.js";

export async function GET({ params, locals }) {
  const p = await getProfile(params.id, locals.user?.id || null);
  if (!p) throw error(404, "No such player.");
  const online = (hub.connsForUser?.(params.id) || []).length > 0;
  let banner = null;
  try { banner = (await bannersFor([params.id])).get(params.id) ?? null; } catch { /* optional */ }
  // the popup's History button shows only when you may see their history (only me / friends / everyone)
  // (signed in only — the visit sheet needs an account)
  const canSeeHistory = !!locals.user && (await historySinceForTarget(locals.user, params.id).catch(() => null)) !== null;
  return json({ ...p, online, banner, canSeeHistory });
}
