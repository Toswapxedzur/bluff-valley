// One recorded match, built for playing ON THE REAL TABLE (owner, 2026-09-28): re-simulated
// server-side into the same table views the live server broadcasts (replay-views.js), which the
// shared TableStage plays — every animation included. Used by /replay/[id] and by a live table's
// "Watch last hand" (/api/replay/last). The raw replay document (above all the deck) never leaves the
// server. Access (replay-access.js):
//   a player in the match → the table views + their own private cards (+ showdown reveals);
//   anyone else allowed   → the table views as a watcher saw them (showdown reveals only);
//   otherwise             → null (the caller says 404).
//
// Tiering: matches past the archive window live on the home archive (mini2); the DB keeps only
// metadata + `final_json`. We fetch the archived document through the reverse-SSH tunnel
// (REPLAY_ARCHIVE_URL → 127.0.0.1:8790 on the VPS → mini2) with a short timeout; if home is offline
// the page degrades to the outcome summary.
import { gunzipSync } from "node:zlib";
import { replayAccess } from "./replay-access.js";
import { replayViews } from "./replay-views.js";
import { looksFor } from "./cosmetics.js";
import { query } from "./db.js";

const ARCHIVE_URL = (process.env.REPLAY_ARCHIVE_URL || "").replace(/\/$/, "");
const ARCHIVE_TIMEOUT_MS = 2500;

async function loadDocument(row) {
  if (row.replay_json) return { doc: JSON.parse(row.replay_json), archived: false, offline: false };
  if (row.archive_ref && ARCHIVE_URL) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), ARCHIVE_TIMEOUT_MS);
    try {
      const res = await fetch(`${ARCHIVE_URL}/${row.archive_ref}`, { signal: ctrl.signal });
      if (res.ok) {
        const gz = Buffer.from(await res.arrayBuffer());
        return { doc: JSON.parse(gunzipSync(gz).toString("utf8")), archived: true, offline: false };
      }
    } catch {
      /* home archive unreachable — fall through to the summary */
    } finally {
      clearTimeout(timer);
    }
  }
  return { doc: null, archived: row.archived_at != null, offline: true };
}

/** Everything a replay page needs for one recorded match, as `user` may see it — or null when they
 *  may not (the caller answers 404, indistinguishable from a replay that doesn't exist). */
export async function buildReplay(row, user) {
  if (!row) return null;
  const viewerId = user?.id ?? null;
  const access = await replayAccess(row, row.players, user ?? null);
  if (!access) return null;

  const { doc, archived, offline } = await loadDocument(row);

  // Whose eyes: a player in the match (whatever their access — the owner too) sees their own private
  // cards (hole cards / a Big Two hand), exactly as at the table; everyone else sees what a watcher
  // saw, plus the showdown.
  const mine = viewerId ? row.players.find((p) => p.user_id === viewerId) ?? null : null;
  const viewerSeat = mine ? mine.seat : null;

  // who sat where, wearing their CURRENT looks (looks at the time weren't recorded)
  const people = new Map();
  if (doc) {
    const ids = row.players.map((p) => p.user_id).filter(Boolean);
    let looks = new Map(), avatars = new Map();
    try { looks = await looksFor(ids); } catch { /* looks optional */ }
    try {
      if (ids.length) avatars = new Map((await query(`SELECT id, avatar_media_id FROM user WHERE id IN (${ids.map(() => "?").join(",")})`, ids)).map((r) => [r.id, r.avatar_media_id]));
    } catch { /* avatars optional */ }
    for (const p of row.players) {
      const l = looks.get(p.user_id) || {};
      people.set(p.seat, { userId: p.user_id ?? `seat-${p.seat}`, name: p.display_name || `Seat ${p.seat}`, avatar: avatars.get(p.user_id) ?? null,
        ring: l.ring || "default", badge: l.badge || "default", banner: l.banner ?? null });
    }
  }
  const replay = doc ? replayViews(doc, row, { people, viewerSeat }) : null;

  let final = null;
  if (!replay) {
    if (doc?.final) final = doc.final;
    else if (row.final_json) { try { final = JSON.parse(row.final_json); } catch { final = null; } }
  }

  return {
    id: row.id,
    tableId: row.table_id ?? null,
    mode: row.mode,
    variant: row.variant,
    context: row.context,
    tableName: row.table_name,
    handNo: row.hand_no == null ? null : Number(row.hand_no),
    startedAt: Number(row.started_at),
    endedAt: Number(row.ended_at),
    potTotal: Number(row.pot_total),
    access,
    archived,
    archiveOffline: archived && offline,
    players: row.players.map((p) => ({
      userId: p.user_id, seat: p.seat, name: p.display_name, role: p.role, net: Number(p.net)
    })),
    viewerId: mine ? viewerId : null,
    // the table views, one per step, with their times (ms at 1×), labels and my private cards
    steps: replay ? replay.steps : null,
    privates: replay ? replay.privates : null,
    layout: replay?.layout ?? null,
    // Summary fallback: archive offline, or re-simulation failed (engine drift).
    final
  };
}
