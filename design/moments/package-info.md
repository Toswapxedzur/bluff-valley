# design/moments

Design demo of the **table moments** — the full-screen animations for significant events, where
the whole table pauses (owner, 2026-09-27: two kinds of animation — full-screen moments on big
events where everybody pauses, and normal in-place ones). Nothing here ships with the app; it
draws with the real art: card faces/back (`composer.js`), metal coins (`chips.js coinSvg`),
rhombus rings + stepped plates (`cosmetics.js`), game icons (`static/games`).

- `index.html` — the demo page: a mock table, a button per moment (+ variants), Replay, Slow 0.4×,
  and a spec card (when / length / who pauses / notes) for each.
- `demo.js` — every moment's choreography (Web Animations); `demo.bundle.js` is its esbuild bundle.
  Rebuild from `bluff-valley/`: `sh design/moments/build.sh` (also copies the icons and deck art
  into `games/` and `deck-parts/`, which are git-ignored).
- Local preview: `.claude/launch.json` entry `moments` (port 4186). Frames for review can be
  captured with headless Chrome (the Browser pane throttles animations while hidden).

Owner's rule (2026-09-27): **gameplay** moments (shuffle, all-in showdown, monster pot, rare hand,
jackpot, Big Two out) only BLUR the table and play over it. **Proclamations** (cosmetics, personal
news, tournament calls: Sprint go, knockout, champion) also get the BANNER — the logo's three tilted
steps — which opens smoothly from its centre line, carries a drain bar for the pause, and closes
back to a line. Coin flights pass under the plates (won coins sink into the badge); celebration
coins (rain, fountains) fly behind the content. A new look: a ring of the new metal appears above
the avatar, comes down and covers the old ring.

Moments: shuffle (stand-in cards) · all-in showdown · monster pot · rare hand (quads / straight flush / royal / Three Card) ·
jackpot (slots / roulette / sic bo) · Big Two out · Sprint go · knockout · champion · new look
(personal — nobody waits). Slot symbols are placeholders; no sounds yet.

**Normal animations** (second tab, 2026-09-27) — in place, nobody waits, nothing on the table moves
or resizes (cards, coins, tokens and glows travel on layers over / under the fixed plates):
money (all-in push, split pot, House pays, Big Two antes) · cards (Blackjack, Three Card, Baccarat,
Big Two deal + play, winning five) · resolves at table size (roulette, sic bo, slots) · seats
(join / leave, your turn, fold, dealer button) · rewards (daily bonus, quest claim, achievement
toast — the medal is a placeholder) · cosmetics (equip ring, equip badge, look change at a table).

**Layering (owner flagged recurring bugs, 2026-09-27):** every scene uses ONE named stack, bottom →
top: surface (board, hands, piles of cards, pot pill) · piles (coins at rest) · seats (plates) ·
top (anything moving). Never rely on append order. A coin reaching a badge sinks by shrinking at
its centre; it never passes under anything. Check mid-flight frames. (Memory: feedback-layering.)

**Shared norms (owner, 2026-09-27: fixes kept landing in one animation only):** `NORM` at the top of
`demo.js` holds one value per kind of motion — card flip 280 ms, coin flight 560 ms, 45 ms between
coins of a stream, 100 ms between columns of a bet, ring draw 600 ms, one card size per table (58,
my hand 68), close-up coins 40, page coins 22 — plus one helper each for the winner mark (the game's
green outline), the loser dim (the game's fold style), count-ups that run while coins ARRIVE, pile
departure (top-down) and the plate change (spread from the upper left). Scenes use these, never
their own numbers; the rare exceptions are named in place (the all-in river's slow squeeze,
moment ring draws at twice the norm).
