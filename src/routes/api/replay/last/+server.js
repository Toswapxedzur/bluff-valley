// A live table's "Watch last hand" (owner, 2026-09-28): the table's most recent recorded hand /
// round, built for the real table (replay-build.js) — the same access rules as /replay/[id].
import { json, error } from "@sveltejs/kit";
import { queryOne } from "$lib/server/db.js";
import { replayById } from "$lib/server/poker/store.js";
import { buildReplay } from "$lib/server/replay-build.js";

export async function GET({ url, locals }) {
  const tableId = String(url.searchParams.get("table") || "");
  if (!tableId || tableId.length > 64) throw error(400, "Which table?");
  const r = await queryOne("SELECT id FROM match_replay WHERE table_id = ? ORDER BY ended_at DESC LIMIT 1", [tableId]);
  const data = r ? await buildReplay(await replayById(r.id), locals.user ?? null) : null;
  if (!data || !data.steps) throw error(404, "No hand to watch yet.");
  return json(data);
}
