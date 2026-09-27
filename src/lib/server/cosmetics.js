// Cosmetics on the server: peak wealth (what unlocks the metals), and equipping a ring / badge.
// The catalog and the drawing live in $lib/cosmetics.js (shared with the client).
//
// Wealth = wallet (`user.chips`) + chips sitting on tables (`poker_escrow.stack`). `peak_wealth` only
// ever rises, so an unlock never lapses. It is bumped after every event that can raise wealth: a
// wallet credit, a cash-out (a staked bot's winnings reach its funder), a received transfer, and each
// hand's stack sync — and once more whenever the Cosmetics page loads, as a catch-all.
import { query, execute } from "./db.js";
import { LOOKS, isLook, ownedLooks, ownsLook, METALS, CUSTOM } from "../cosmetics.js";
import { bannersFor, hasSavedBanner } from "./banners.js";

// Who hears about a new metal (the hub registers: the player's personal "new look" banner).
let lookNotifier = null;
export function setLookNotifier(fn) { lookNotifier = fn; }

export const SLOTS = ["ring", "badge"];

/** Raise each user's peak to their current wealth (never lowers it). Best effort: never throws. */
export async function bumpPeakWealth(userIds) {
  const ids = [...new Set((userIds || []).filter(Boolean))];
  if (!ids.length) return;
  const qs = ids.map(() => "?").join(",");
  const peaks = async () => new Map((await query(`SELECT id, peak_wealth FROM user WHERE id IN (${qs})`, ids)).map((r) => [r.id, Number(r.peak_wealth) || 0]));
  try {
    const before = lookNotifier ? await peaks() : null;
    await execute(
      `UPDATE user u LEFT JOIN (SELECT user_id, SUM(stack) AS s FROM poker_escrow WHERE user_id IN (${qs}) GROUP BY user_id) e
         ON e.user_id = u.id
       SET u.peak_wealth = GREATEST(u.peak_wealth, u.chips + COALESCE(e.s, 0))
       WHERE u.id IN (${qs})`,
      [...ids, ...ids]
    );
    if (before) {
      const after = await peaks();
      for (const [id, was] of before) {
        const now = after.get(id) ?? was;
        for (const m of METALS) if (m.at > was && m.at <= now) { try { lookNotifier(id, { key: m.key, name: m.name, at: m.at }); } catch { /* best-effort */ } }
      }
    }
  } catch { /* a missed bump is caught by the next one */ }
}

/** A player's cosmetics: current + peak wealth, what they own, what they wear. */
export async function cosmeticsFor(userId) {
  await bumpPeakWealth([userId]);
  const rows = await query(
    `SELECT u.chips, u.peak_wealth, u.ring, u.badge, COALESCE((SELECT SUM(stack) FROM poker_escrow e WHERE e.user_id = u.id), 0) AS on_tables
       FROM user u WHERE u.id = ?`,
    [userId]
  );
  const r = rows[0];
  if (!r) return null;
  const peak = Number(r.peak_wealth), owned = ownedLooks(peak);
  const wearing = (slot, k) => (ownsLook(slot, k, peak) ? k : "default");
  // the custom badge counts only while a saved banner exists
  const badge = r.badge === CUSTOM ? ((await hasSavedBanner(userId)) ? CUSTOM : "default") : wearing("badge", r.badge);
  return { wealth: Number(r.chips) + Number(r.on_tables), peak, owned, ring: wearing("ring", r.ring), badge };
}

/** Equip `look` in `slot` ("ring" | "badge"). Refuses a look the player hasn't unlocked, and the
 *  custom badge until they have saved a banner. */
export async function equip(userId, slot, look) {
  if (!SLOTS.includes(slot)) return { error: "Unknown cosmetic slot." };
  if (slot === "badge" && look === CUSTOM) {
    if (!(await hasSavedBanner(userId))) return { error: "Make a banner first." };
    await execute("UPDATE user SET badge = ? WHERE id = ?", [CUSTOM, userId]);
    const c = await cosmeticsFor(userId);
    return { ...c, badge: CUSTOM };
  }
  if (!isLook(look)) return { error: "Unknown look." };
  const c = await cosmeticsFor(userId);
  if (!c) return { error: "No such player." };
  if (!ownsLook(slot, look, c.peak)) {
    const need = LOOKS.find((l) => l.key === look).at;
    return { error: `Unlocks at ${need.toLocaleString("en-US")} chips of wealth.` };
  }
  await execute(`UPDATE user SET ${slot} = ? WHERE id = ?`, [look, userId]);
  return { ...c, [slot]: look };
}

/** Equipped looks for many users at once (for seats, the lobby, the leaderboard): id → { ring, badge,
 *  banner } (banner = the picture they WEAR — badge CUSTOM — or null). */
export async function looksFor(userIds) {
  const ids = [...new Set((userIds || []).filter(Boolean))];
  if (!ids.length) return new Map();
  const rows = await query(`SELECT id, ring, badge, peak_wealth FROM user WHERE id IN (${ids.map(() => "?").join(",")})`, ids);
  let banners = new Map();
  try { banners = await bannersFor(ids); } catch { /* banners optional */ }
  return new Map(rows.map((r) => {
    const peak = Number(r.peak_wealth);
    const banner = banners.get(r.id) ?? null;   // bannersFor returns worn banners only
    const badge = r.badge === CUSTOM ? (banner ? CUSTOM : "default") : ownsLook("badge", r.badge, peak) ? r.badge : "default";
    return [r.id, { ring: ownsLook("ring", r.ring, peak) ? r.ring : "default", badge, banner }];
  }));
}
