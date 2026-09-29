<script>
  // One of the site's own UI icons (design/ui-icons; owner 2026-09-29: no emoji). Coloured by the
  // theme (--ic-a* / --ic-b* in app.css): the lights on the dark theme, the darks on the light one.
  // Each instance renames its clip / mask ids, so any number of icons can share a page.
  import { UI_ICONS } from "$lib/ui-icons.js";
  let { name, size = 18, label = null } = $props();
  const uid = `i${Math.random().toString(36).slice(2, 8)}`;
  const markup = $derived((UI_ICONS[name] || "").replace(/id="([a-z]\d+)"/g, `id="${uid}$1"`).replace(/url\(#([a-z]\d+)\)/g, `url(#${uid}$1)`));
</script>

<svg class="ui-icon" viewBox="0 0 96 96" width={size} height={size} role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : "true"} focusable="false">{@html markup}</svg>

<style>
  .ui-icon { display: inline-block; flex: none; vertical-align: -0.18em; }
</style>
