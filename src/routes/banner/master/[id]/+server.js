// A master picture, for the editor to crop again: only the player who uploaded it, or an admin.
import { error } from "@sveltejs/kit";
import { readMaster, ownsFile } from "$lib/server/banners.js";

export async function GET({ params, locals }) {
  if (!locals.user) throw error(401, "Sign in.");
  if (!locals.user.isAdmin && !(await ownsFile(locals.user.id, params.id))) throw error(404, "Not found.");
  const buf = await readMaster(params.id);
  if (!buf) throw error(404, "Not found.");
  return new Response(buf, {
    headers: { "content-type": "image/webp", "cache-control": "private, max-age=86400", "x-content-type-options": "nosniff" }
  });
}
