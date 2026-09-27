// Shared, isomorphic site config (safe to import from both client and
// server — contains no secrets).
//
// The poker room's brand name lives here as a single constant so it can
// be renamed in ONE place. Change SITE_NAME and everything (topbar,
// <title>, landing copy, emails' From-name via env) follows.
export const SITE_NAME = "Bluff Valley";
export const SITE_TAGLINE = "Poker with friends";

// Achievements are switched OFF for now (owner, 2026-09-27: the tab stays empty until new
// players join; then new ones get designed). Off = nothing unlocks or pays, and every list
// of badges (quests page, account, history, profiles) is empty. Badges already earned stay
// in user_achievement untouched, so switching this back on restores them.
export const ACHIEVEMENTS_ON = false;
