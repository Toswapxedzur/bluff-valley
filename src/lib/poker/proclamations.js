// The proclamation moments (owner, 2026-09-27: these — and only these — bring the BANNER): River
// Sprint's calls and your personal news. The server sends each one to the players it concerns
// (S2C.MOMENT); a table that should pause for it holds its next hand this long.
export const PROCLAIM_MS = {
  sprintGo: 4200,    // a round goes live — every table in the round holds its first deal
  knockout: 3900,    // a player is out — the table they were at holds its next hand
  champion: 5000,    // the winner at the buzzer (the tables close; it plays site-wide)
  newLook: 9000      // a metal unlocked — only yours, nobody waits (until you tap, or this long)
};
