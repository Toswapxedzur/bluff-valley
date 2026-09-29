// Access policy for recorded matches and play-history exposure.
//
// Every user has `history_window` (owner, 2026-09-29): WHO may see their play history —
//   'private'  → only them
//   'friends'  → their friends (the default)
//   'everyone' → anyone (legacy 7d/30d/90d/all mean this)
// on top of their profile_visibility (a profile you can't see never shows its history), a block
// (a player who blocked you never shows you theirs) and the 7-day horizon. A user always sees their
// own history in full. ONE rule — sharesHistory() / historySinceForTarget() — gates the profile popup's
// History button, /data's lookup, the visit sheet, the /u stats and whether a replay opens.
//
// A single replay is viewable by a non-participant only when at least one
// participant shares their history with that viewer and the match is inside the horizon.
// Hole-card redaction on top of this is the viewer's business (replay route):
// even a participant only ever sees what they could see at the table.

import { query, queryOne } from "./db.js";
import { areFriends } from "./friends.js";
import { hasBlocked } from "./moderation.js";

// HARD HORIZON (owner policy, 2026-09-05): the server keeps 7 days of history;
// everything older is OWNER-ONLY — not even the player themself can reach it.
// Older replay documents live on the home archive and are fetched only for
// the site owner (admin).
export const HOT_WINDOW_MS = 7 * 86_400_000;

export const HISTORY_WINDOWS = ["private", "friends", "everyone"];

/** A stored history_window → one of HISTORY_WINDOWS (legacy windows = everyone). */
export function normHistoryWindow(w) {
  if (!w) return "friends";
  return w === "private" || w === "friends" ? w : "everyone";
}

/** Does a player ({history_window, profile_visibility}) share their play history with a viewer whose
 *  relationship to them is `rel` ('self' | 'friends' | anything else)? Pure. */
export function sharesHistory(player, rel) {
  if (rel === "self") return true;
  const open = (setting) => setting === "everyone" || setting === "public" || (setting === "friends" && rel === "friends");
  return open(normHistoryWindow(player?.history_window)) && open(player?.profile_visibility || "public");
}

// Earliest ended_at (ms) a signed-in viewer may see of ANY history — their own
// included. The owner sees everything; everyone else only the hot window.
export function historySinceFor(user, now = Date.now()) {
  return user?.isAdmin ? 0 : now - HOT_WINDOW_MS;
}

/** How far back `viewer` ({id, isAdmin} | null) may see `targetId`'s play history (ms), or null when
 *  they may not: yourself or the owner → the horizon; anyone else → the horizon if the player shares
 *  their history with them (sharesHistory) and hasn't blocked them. */
export async function historySinceForTarget(viewer, targetId, now = Date.now()) {
  const horizon = historySinceFor(viewer, now);
  if (viewer && (viewer.isAdmin || viewer.id === targetId)) return horizon;
  const row = await queryOne("SELECT history_window, profile_visibility FROM user WHERE id = ?", [targetId]);
  if (!row) return null;
  const friend = viewer ? await areFriends(viewer.id, targetId) : false;
  if (!sharesHistory(row, friend ? "friends" : null)) return null;
  if (viewer && await hasBlocked(targetId, viewer.id)) return null;
  return horizon;
}

// How `viewer` ({id, isAdmin} | null) may see the replay:
//   'owner'       — the site owner; the only access past the 7-day horizon;
//   'participant' — they were dealt in (full per-seat view of their own cards);
//   'public'      — some participant shares their history with the viewer (showdown-public view only);
//   null          — not viewable.
export async function replayAccess(replayRow, participants, viewer, now = Date.now()) {
  if (viewer?.isAdmin) return "owner";
  if (now - Number(replayRow.ended_at) > HOT_WINDOW_MS) return null; // past the horizon: owner only
  const viewerUserId = viewer?.id ?? null;
  if (viewerUserId && participants.some((p) => p.user_id === viewerUserId)) return "participant";
  const ids = participants.map((p) => p.user_id).filter(Boolean);
  if (ids.length === 0) return null;
  const rows = await query(
    `SELECT id, history_window, profile_visibility FROM user WHERE id IN (${ids.map(() => "?").join(",")})`,
    ids
  );
  // the viewer's friends among the players (one query), for the players who share with friends only
  const friends = new Set();
  if (viewerUserId && rows.some((r) => normHistoryWindow(r.history_window) === "friends")) {
    const fr = await query(
      `SELECT requester_id, addressee_id FROM friendship WHERE status = 'accepted' AND (requester_id = ? OR addressee_id = ?)`,
      [viewerUserId, viewerUserId]
    );
    for (const f of fr) friends.add(f.requester_id === viewerUserId ? f.addressee_id : f.requester_id);
  }
  for (const r of rows) {
    if (!sharesHistory(r, friends.has(r.id) ? "friends" : null)) continue;
    if (viewerUserId && await hasBlocked(r.id, viewerUserId)) continue;
    return "public";
  }
  return null;
}
