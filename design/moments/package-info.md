# design/moments

Design demo of the **table moments** — the full-screen animations for significant events, where
the whole table pauses (owner, 2026-09-27: two kinds of animation — full-screen moments on big
events where everybody pauses, and normal in-place ones). Nothing here ships with the app; it
draws with the real art: card faces/back (`composer.js`), metal coins (`chips.js coinSvg`),
rhombus rings + stepped plates (`cosmetics.js`), game icons (`static/games`).

- `index.html` — the demo page: a mock table, a button per moment (+ variants), Replay, Slow 0.4×,
  and a spec card (when / length / who pauses / notes) for each.
- `demo.js` — every moment's choreography (Web Animations); `demo.bundle.js` is its esbuild bundle.
  Rebuild from `statisticasino/`: `sh design/moments/build.sh` (also copies the icons and deck art
  into `games/` and `deck-parts/`, which are git-ignored).
- Local preview: `.claude/launch.json` entry `moments` (port 4186). Frames for review can be
  captured with headless Chrome (the Browser pane throttles animations while hidden).

The shared frame: the table dims under a veil (it never moves), a band in the logo's three tilted
steps wipes in along the logo's slant, the moment plays on it, a thick bar along its foot drains
for the pause, then the band wipes out right. The band's material shows the size of the event:
logo blue, silver / gold for rarer, charcoal for a knockout, the new metal for a personal unlock.

Moments: all-in showdown · monster pot · rare hand (quads / straight flush / royal / Three Card) ·
jackpot (slots / roulette / sic bo) · Big Two out · Sprint go · knockout · champion · new look
(personal — nobody waits). Slot symbols are placeholders; no sounds yet.
