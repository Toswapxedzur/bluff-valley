// One recorded match, replayed on the real table (the building: $lib/server/replay-build.js).
import { error } from "@sveltejs/kit";
import { replayById } from "$lib/server/poker/store.js";
import { buildReplay } from "$lib/server/replay-build.js";

export async function load({ params, locals }) {
  const data = await buildReplay(await replayById(params.id), locals.user ?? null);
  if (!data) throw error(404, "Not found");
  return data;
}
