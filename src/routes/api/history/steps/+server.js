// The table views for a few games of a visit (History's sheet loads them around the playhead): each
// game built exactly as /replay/[id] builds it (replay-build.js — the same access rules).
import { json, error } from "@sveltejs/kit";
import { replayById } from "$lib/server/poker/store.js";
import { buildReplay } from "$lib/server/replay-build.js";

const MAX = 8;

export async function GET({ url, locals }) {
  if (!locals.user) throw error(401, "Sign in.");
  const ids = String(url.searchParams.get("ids") || "").split(",").filter((x) => /^[a-f0-9-]{8,64}$/i.test(x)).slice(0, MAX);
  if (!ids.length) throw error(400, "Which games?");
  const out = [];
  for (const id of ids) {
    const d = await buildReplay(await replayById(id), locals.user);
    out.push(d && d.steps ? { id, tableId: d.tableId, viewerId: d.viewerId, steps: d.steps, privates: d.privates } : { id, missing: true });
  }
  return json(out);
}
