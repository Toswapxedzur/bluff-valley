# design/logo-valley — the Bluffing Valley icon (official since 2026-09-27)

A red sunset valley: an octagon sun sitting down between two coral back peaks, a brick-maroon front
mountain, the sky in three regions — two ten-sided rings round the sun (144° corners) and the rest.
No round edges anywhere in the art (the tile's corners are the platform's). Each mountain is split
along its ridge (the owner's sketch: a short drop from the peak, then wide near-horizontal zig-zag
strokes going down, drifting a little right), lit on the left, shadowed on the right.

- `gen.py <outdir>` → `valley-square.svg` (full bleed: maskable, apple-touch) and `valley-round.svg`
  (rounded tile: favicons, any-purpose icons, the top bar's `static/brand.svg`).
- The PNGs here are rendered from those SVGs with headless Chrome (transparent corners on the rounded
  ones) and copied to `static/favicon*.png` and `static/icons/*`. When the art changes, re-render all
  six and bump the `?v=` on the icon links in `src/app.html`.
