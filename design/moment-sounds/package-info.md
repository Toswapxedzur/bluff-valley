# design/moment-sounds

Sound picker for the animations built 2026-09-27 (owner: "for ones that existing ones already fit, use
existing ones or a composition of existing ones; for new ones, build — I will choose"). The reused
sounds are already wired in the game (commit 5599283). This page holds the 13 NEW slots, three
candidates each (trimmed library clips or compositions, unpitched, -3 dBFS, time stretches keep
pitch), each playable alone or "in context" with the game's own sounds around it, its hit landing on
the animation's moment.

- `build.py` — builds `clips/*.mp3`, `ctx/*.mp3` (the game's sounds used in the contexts) and
  `candidates.json` (with each clip's lead, for frame-accurate playback in the game).
  Run from `statisticasino/`: `python3 design/moment-sounds/build.py`.
- `index.html` — the picker; picks stay in the browser and are copied out with "Copy my picks".
- Published as an artifact; local preview via `.claude/launch.json` entry `moment-sounds` (port 4187).
Once picked: copy the chosen clips into `static/sfx/table/`, add them to TABLE_SOUNDS
(table-audio.js) + their leads to table-sounds.json, and cue them where the table in the page says.
