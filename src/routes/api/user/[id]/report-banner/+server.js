// Report a player's banner (the avatar popover's "Report banner"). It lands in the admins' report
// queue on /account with the picture beside it; the banner stays up until an admin acts.
import { json, error } from "@sveltejs/kit";
import { report } from "$lib/server/moderation.js";
import { bannersFor } from "$lib/server/banners.js";
import { queryOne } from "$lib/server/db.js";

export async function POST({ params, locals }) {
  if (!locals.user) throw error(401, "Sign in to report.");
  if (params.id === locals.user.id) throw error(400, "That's your own banner.");
  const b = (await bannersFor([params.id])).get(params.id);
  if (!b) throw error(404, "They have no banner.");
  // one report per reporter per picture is enough
  const dup = await queryOne("SELECT 1 AS d FROM report WHERE reporter_id = ? AND target_id = ? AND reason = ? LIMIT 1", [locals.user.id, params.id, `banner:${b.src}`]);
  if (!dup) await report(locals.user.id, params.id, `banner:${b.src}`);
  return json({ ok: true });
}
