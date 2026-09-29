// Top-level layout server load: exposes the current user (+ chips wallet)
// and a couple of global counts for the topbar.

import { queryOne } from "$lib/server/db.js";
import { dailyBonusReady } from "$lib/server/wallet.js";

export async function load({ locals }) {
  const handRow = await queryOne("SELECT COUNT(*) AS n FROM hand_canonical");

  let chips = null;
  let bonusReady = false;
  let look = null;   // your avatar in the top bar (opens your profile popup)
  if (locals.user) {
    const u = await queryOne(
      "SELECT chips, last_daily_bonus_at, avatar_media_id, ring FROM user WHERE id = ?",
      [locals.user.id]
    );
    chips = u ? Number(u.chips) : 0;
    bonusReady = u ? dailyBonusReady(u.last_daily_bonus_at) : false;
    look = { avatarMediaId: u?.avatar_media_id || null, ring: u?.ring || "default" };
  }

  return {
    user: locals.user,
    chips,
    bonusReady,
    look,
    handCount: handRow ? Number(handRow.n) : 0
  };
}
