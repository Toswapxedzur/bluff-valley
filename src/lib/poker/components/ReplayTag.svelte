<script>
  // The REPLAY tag (owner, 2026-09-29: "differentiate actual game and replay window… tag only"): the one
  // thing that says "this already happened", next to the title of every replay (the visit sheet, the
  // replay page, a live table's "Watch last hand").
  let { label = "Replay" } = $props();
</script>

<span class="replay-tag">{label}</span>

<style>
  .replay-tag { flex: none; align-self: center; padding: 5px 11px; border-radius: var(--r-pill); background: var(--danger); color: #fff;
    font-size: 11px; font-weight: 800; letter-spacing: 1.2px; text-transform: uppercase; white-space: nowrap; box-shadow: var(--shadow-card); }
</style>
