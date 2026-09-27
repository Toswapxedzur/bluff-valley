// The banner editor's calls (/cosmetics): upload a picture, save a banner from it, take it off.
// A saved banner is live at once — every seat the player holds redraws (hub.setLooks); the owner
// reviews afterwards on /cosmetics/review.
import { json, error } from "@sveltejs/kit";
import { ingest, saveBanner, clearBanner, MAX_UPLOAD_BYTES } from "$lib/server/banners.js";
import { hub } from "$lib/server/poker/hub.js";

const live = (userId, banner) => { try { hub.setLooks(userId, { banner }); } catch { /* the next sit carries it */ } };

/** Upload: multipart `file` → { file: { id, w, h } } */
export async function POST({ request, locals }) {
  if (!locals.user) throw error(401, "Sign in first.");
  const len = Number(request.headers.get("content-length") || 0);
  if (len > MAX_UPLOAD_BYTES + 64 * 1024) return json({ error: "That picture is over 5 MB." }, { status: 413 });
  let fd;
  try { fd = await request.formData(); } catch { return json({ error: "That upload didn't arrive whole. Try again." }, { status: 400 }); }
  const f = fd.get("file");
  if (!f || typeof f === "string") return json({ error: "Choose a picture first." }, { status: 400 });
  if (f.size > MAX_UPLOAD_BYTES) return json({ error: "That picture is over 5 MB." }, { status: 413 });
  const res = await ingest(locals.user.id, Buffer.from(await f.arrayBuffer()));
  if (res.error) return json(res, { status: 400 });
  return json(res);
}

/** Save: { fileId, settings } → { banner, wash, settings } */
export async function PUT({ request, locals }) {
  if (!locals.user) throw error(401, "Sign in first.");
  const body = await request.json().catch(() => ({}));
  const res = await saveBanner(locals.user.id, String(body.fileId || ""), body.settings || {});
  if (res.error) return json(res, { status: 400 });
  live(locals.user.id, res.banner);
  return json(res);
}

/** Take it off. */
export async function DELETE({ locals }) {
  if (!locals.user) throw error(401, "Sign in first.");
  await clearBanner(locals.user.id);
  live(locals.user.id, null);
  return json({ ok: true });
}
