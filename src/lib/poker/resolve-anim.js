// The resolve of the bet games — Roulette's wheel, Sic Bo's dice, the Slots' reels — played in the
// middle of the table. One set of timings shared by everyone who must agree on them (no DOM, no
// Svelte: the server imports it too):
//   the table (Resolve.svelte) plays it;
//   the bank (bank.svelte.js) settles the coins only once it has landed;
//   the win / lose lines and winner marks wait for it (BetGameTable);
//   the sounds (table-sfx.js) hit on its moments;
//   the server (table.js) waits this much longer before the next round.
export const RESOLVE = {
  roulette: { spin: 2200, pop: 2300, done: 2700 },            // the ball drops at `spin`, the number pops out
  "sic-bo": { every: 110, tumble: 1400, done: 1900 },         // three dice, `every` apart, each tumbling `tumble`
  slots: { stops: [1400, 1850, 2300], done: 2600 }            // the reels stop left to right
};

/** How long the resolve takes before the round can settle (0 for games without one). */
export function resolveMs(game) { return RESOLVE[game]?.done ?? 0; }
