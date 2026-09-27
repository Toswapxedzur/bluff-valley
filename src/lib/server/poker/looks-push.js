// After a player's looks change (a ring or badge worn, a banner saved, deleted or taken down), read
// them back whole and hand them to their live seats + the lobby (hub.setLooks) — one source of truth,
// so the badge and the banner can never disagree on a seat. Best effort: the next sit carries it.
import { hub } from "./hub.js";
import { looksFor } from "../cosmetics.js";

export async function pushLooks(userId) {
  try {
    const l = (await looksFor([userId])).get(userId);
    if (l) hub.setLooks(userId, l);
  } catch { /* the next sit carries it */ }
}
