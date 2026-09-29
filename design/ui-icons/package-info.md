# design/ui-icons — the site's own UI icons (replacing emoji)

- `icons.js` — 27 icons on a 96×96 grid under the owner's icon rules (~/Desktop/autome/memory/icon-design-rules.md):
  the ten warm tones, no borders / thin lines / letters, stepped upper-left lighting inside one family (`lit()`).
  Fills are theme tokens (`var(--ic-a0…a4)` = the icon's own family, `--ic-b…` = the other): lights on the dark
  theme, darks on the light theme (`themeVars(dark)`), so each icon reads on both.
- `sheet.mjs` → `sheet.html` / `sheet.png` — review sheet (dark big, dark at button size, light big, light small).
- `build.mjs` → `src/lib/ui-icons.js` (generated; `<Icon name size label>` in `src/lib/components/Icon.svelte` renames clip ids per instance). Tones come from `--ic-a*` / `--ic-b*` in app.css (+ `.on-color` / coloured `.btn` keep lights, `.btn-gold` darks).
- Status 2026-09-29: WIRED (every emoji replaced); REDRAWN under the owner's TWO-TONE GLYPH RULE — each part exactly two tones of one family (lit / shadow, one diagonal cut), inner details are cut-outs (`knock()`), parts ≥ 10 units thick. Next: owner review of sheet.png.
