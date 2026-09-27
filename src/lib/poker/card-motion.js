// Card motion for the card games that don't use the Hold'em dealer (Blackjack, Three Card Poker,
// Baccarat, Big Two). One per table page, beside the Bank (table-motion.svelte.js); CardLayer.svelte
// watches the cards the page shows and moves them, and announces sounds here the way the Dealer does
// (table-sounds drains `cues`).
//
// The rules (the shared norms, owner 2026-09-27): a card that appears in a hand flies in face-down
// from the deck (top-left, 70% buried past the edge — where the Hold'em deck sits) and turns over
// once it lands; the same face moving between hands (a Big Two play) flies as itself; a card that
// turns over in place just turns; a card that leaves flies to the used pile (top-right).
export const CARD = {
  every: 110,        // cards of one deal leave this far apart (the Hold'em dealer's spacing) …
  span: 1400,        // … but a whole deal launches within this (Big Two deals 52)
  flight: 380,       // and land this long after leaving
  move: 420,         // a card moving between hands (a play)
  collect: 420,      // to the used pile
  collectSpan: 700,
  arc: 14 / 60       // lift at mid-flight, as a share of the card's width
};

/** Launch spacing for n cards: every CARD.every ms, but all within `span`. */
export const spacing = (n, every = CARD.every, span = CARD.span) => (n > 1 ? Math.min(every, span / (n - 1)) : 0);

export class CardMotion {
  constructor() {
    this.cues = [];        // { t, name } on the performance.now() clock: cardLand · flip · pileTap · cardPlay
  }
}
