// Dealing & shuffling in the real game — the rules both sides share (no DOM, no Svelte, so the
// server's table.js can import it too).
//
// Owner's decisions (2026-09-25): POKER only for now (the flop games: Hold'em, Omaha, Short
// Deck); the face-down deck lives top-left and the face-up used pile top-right, just below the
// top bar, each ~70% buried past the screen edge (30% showing); cards leave the deck face-down one at a time,
// clockwise from the left of the button; your own cards flip once they land; the flop flies
// out and flips together, turn and river singly; folded hands and, at the end of the hand, all
// cards fly to the used pile; then the full shuffle routine plays, every hand — the server
// waits long enough between hands for it.

import { routineMs } from "./deck-routine.js";

/** The tables that get the dealt / shuffled deck: Hold'em, two hole cards each. */
export const ANIMATED_VARIANTS = new Set(["holdem"]);
export const HOLE_COUNT = { holdem: 2 };

/** Does this table get the animated deck? (Not tournaments / River Sprint — fast-fold.) */
export function animatesTable(view) {
  return !!view && animatesConfig(view.config);
}
export function animatesConfig(config) {
  return !!config && !config.tournament && ANIMATED_VARIANTS.has(config.variant);
}

export const DEAL = {
  every: 110,            // a card leaves the deck every 110 ms …
  flight: 380,           // … and lands 380 ms later
  arc: 14,               // lift at mid-flight (units, a card is 60 wide)
  boardEvery: 90,
  flipAfterLand: 120,    // own cards / board: land face-down, flip this long after
  muckFlight: 420,
  muckEvery: 60,
  showdownHold: 900,     // the result stays readable this long before the cards are collected
  collectEvery: 30,       // … but all launches fit in collectSpan, however many cards
  collectSpan: 700,
  collectFlight: 420
};
// ---- the deck across hands (owner, 2026-09-27: "shuffle when the deck runs out completely, at the
// instant the deck needs to deal a card"). The deck is NOT reshuffled after every hand: used cards pile
// up top-right, the deck deals on down, and only when it's empty and a card is still needed is the
// used pile shuffled into a new deck — right there, mid-deal if need be — then dealing carries on.
// Shared by the server (it holds the table's next turn while the shuffle plays) and the page.
export const DECK_SIZE = 52;
/**
 * Draw n cards from a deck of `left`, with `onTable` cards out on the table (in hands / on the board —
 * not in the deck, not in the used pile). → { left, shuffle: null | { before, used, after } }: `before`
 * cards come off the old deck, then the `used` pile is shuffled into the new deck, then `after` more.
 */
export function drawFromDeck(left, n, onTable) {
  if (n <= left) return { left: left - n, shuffle: null };
  const before = left, used = DECK_SIZE - onTable - before, after = n - before;
  return { left: used - after, shuffle: { before, used, after } };
}
/** How long a table holds its next turn for a shuffle in the middle of a deal of cards `every` apart. */
export function shuffleHoldMs(sh, every = DEAL.every) {
  return sh.before * every + routineMs(sh.used) + sh.after * every + DEAL.flight + 250;
}
/** From the result to the table being clear (hold the result, collect everything to the used pile). */
export function collectionMs(cards) {
  return DEAL.showdownHold + DEAL.collectEvery + Math.max(0, cards - 1) * collectEvery(cards) + DEAL.collectFlight + 30;
}

/** Spacing between collection launches for n cards (the whole collection launches within 0.7 s). */
export const collectEvery = (n) => (n > 1 ? Math.min(DEAL.collectEvery, DEAL.collectSpan / (n - 1)) : 0);


/**
 * Deal order: seats holding cards, clockwise (increasing seat number) starting from the seat
 * after the button. seats = view.seats; returns seat numbers.
 */
export function dealOrder(seats, buttonSeat) {
  const inHand = seats.filter((s) => s.inHand && s.hasCards).map((s) => s.seat).sort((a, b) => a - b);
  if (!inHand.length) return [];
  const i = inHand.findIndex((n) => n > (buttonSeat ?? -1));
  const k = i === -1 ? 0 : i;
  return inHand.slice(k).concat(inHand.slice(0, k));
}

/** The flights of one deal, in launch order: `rounds` passes round the table, one card each. */
export function planDeal(order, rounds) {
  const plan = [];
  for (let r = 0; r < rounds; r++) for (const seat of order) plan.push({ seat, slot: r });
  return plan.map((p, i) => ({ ...p, t0: i * DEAL.every }));
}
