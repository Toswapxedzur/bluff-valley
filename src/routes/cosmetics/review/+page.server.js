// Admins: every banner, newest first — the owner's "check it later" (banners go live at once).
// Take one down, bar a player from uploading, or lift the bar. The player's seats redraw at once.
import { redirect, fail, error } from "@sveltejs/kit";
import { recentBanners, adminRemove, setBanned } from "$lib/server/banners.js";
import { pushLooks } from "$lib/server/poker/looks-push.js";

export async function load({ locals }) {
  if (!locals.user) throw redirect(303, "/account/login");
  if (!locals.user.isAdmin) throw error(404, "Not found.");
  return { banners: await recentBanners(200) };
}

const admin = (locals) => locals.user?.isAdmin;
const drop = (userId) => pushLooks(userId);

export const actions = {
  remove: async ({ request, locals }) => {
    if (!admin(locals)) return fail(403, { error: "Admins only." });
    const id = String((await request.formData()).get("userId") || "");
    if (!id) return fail(400, { error: "No player." });
    await adminRemove(id);
    await drop(id);
    return { done: "removed" };
  },
  ban: async ({ request, locals }) => {
    if (!admin(locals)) return fail(403, { error: "Admins only." });
    const id = String((await request.formData()).get("userId") || "");
    if (!id) return fail(400, { error: "No player." });
    await adminRemove(id, { ban: true });
    await drop(id);
    return { done: "banned" };
  },
  unban: async ({ request, locals }) => {
    if (!admin(locals)) return fail(403, { error: "Admins only." });
    const id = String((await request.formData()).get("userId") || "");
    if (!id) return fail(400, { error: "No player." });
    await setBanned(id, false);
    return { done: "unbanned" };
  }
};
