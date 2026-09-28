<script>
  // Our own slider — no native <input type="range"> anywhere (owner, 2026-09-28: "No native UI").
  // Track + fill + thumb in the design tokens; drag it, click anywhere on the track, or use the keys
  // (← → ↑ ↓ one step, PageUp / PageDown ten, Home / End). A screen reader hears a slider
  // (role="slider" + aria values). bind:value like the native one; oninput(v) while it moves,
  // onchange(v) once let go.
  let {
    value = $bindable(0),
    min = 0,
    max = 100,
    step = 1,
    disabled = false,
    ariaLabel = null,
    valueText = null,          // (v) => string: what a screen reader says for a value
    marks = null,              // [{ at, label }]: ticks on the track (a visit's games); the label is their tooltip
    oninput = () => {},
    onchange = () => {},
    class: klass = ""
  } = $props();

  let el = $state(null);
  let dragging = $state(false);

  const lo = $derived(Number(min) || 0);
  const hi = $derived(Math.max(lo, Number(max) || 0));
  const pct = $derived(hi > lo ? ((Math.min(hi, Math.max(lo, Number(value) || 0)) - lo) / (hi - lo)) * 100 : 0);
  // round to the step's own decimals, so 0.05 steps never show 0.30000000000000004
  const decimals = $derived((String(step).split(".")[1] || "").length);

  function snap(v) {
    const st = Number(step) > 0 ? Number(step) : 1;
    const n = lo + Math.round((v - lo) / st) * st;
    return Number(Math.min(hi, Math.max(lo, n)).toFixed(decimals));
  }
  function set(v, final = false) {
    const n = snap(v);
    if (n !== value) { value = n; oninput(n); }
    if (final) onchange(n);
  }
  function fromPointer(e) {
    const r = el.getBoundingClientRect();
    const k = r.width > 0 ? (e.clientX - r.left) / r.width : 0;
    return lo + Math.min(1, Math.max(0, k)) * (hi - lo);
  }
  function down(e) {
    if (disabled || e.button > 0) return;
    dragging = true;
    el.setPointerCapture?.(e.pointerId);
    el.focus({ preventScroll: true });
    set(fromPointer(e));
    e.preventDefault();
  }
  function move(e) { if (dragging) set(fromPointer(e)); }
  function up(e) {
    if (!dragging) return;
    dragging = false;
    el.releasePointerCapture?.(e.pointerId);
    set(fromPointer(e), true);
  }
  function key(e) {
    if (disabled) return;
    const st = Number(step) > 0 ? Number(step) : 1, v = Number(value) || 0;
    const to = { ArrowRight: v + st, ArrowUp: v + st, ArrowLeft: v - st, ArrowDown: v - st,
      PageUp: v + st * 10, PageDown: v - st * 10, Home: lo, End: hi }[e.key];
    if (to === undefined) return;
    e.preventDefault();
    e.stopPropagation();   // the key is the slider's: a page's own shortcuts (the replay's ← →) mustn't act too
    set(to, true);
  }
</script>

<div bind:this={el} class="sl {klass}" class:dragging class:disabled
  role="slider" tabindex={disabled ? -1 : 0} aria-label={ariaLabel} aria-valuemin={lo} aria-valuemax={hi} aria-valuenow={value}
  aria-valuetext={valueText ? valueText(value) : undefined} aria-disabled={disabled || undefined}
  onpointerdown={down} onpointermove={move} onpointerup={up} onpointercancel={up} onkeydown={key}>
  <div class="track"><div class="fill" style:width="{pct}%"></div></div>
  {#if marks?.length && hi > lo}
    {#each marks as m, n (n)}
      <span class="mark" class:past={m.at <= value} style:left="{((Math.min(hi, Math.max(lo, m.at)) - lo) / (hi - lo)) * 100}%" title={m.label}></span>
    {/each}
  {/if}
  <div class="thumb" style:left="{pct}%"></div>
</div>

<style>
  /* the same look the old styled range had (.rng): a 6 px well track, an accent fill, an 18 px thumb */
  .sl { position: relative; width: 100%; height: 22px; cursor: pointer; touch-action: none; user-select: none; outline: none; }
  .track { position: absolute; left: 0; right: 0; top: 50%; height: 6px; margin-top: -3px; border-radius: 999px; background: var(--well); overflow: hidden; }
  .fill { height: 100%; background: var(--accent); border-radius: 999px; }
  /* a marker: a short raised tick across the track, easy to hover (its label shows in our tooltip) */
  .mark { position: absolute; top: 50%; width: 4px; height: 14px; margin: -7px 0 0 -2px; border-radius: 2px; background: var(--muted); opacity: 0.8;
    transition: background-color var(--dur) var(--ease), transform var(--dur) var(--ease); }
  .mark.past { background: var(--on-accent, #fff); opacity: 0.9; }
  .mark:hover { transform: scaleY(1.3); }
  .thumb { z-index: 1; position: absolute; top: 50%; width: 18px; height: 18px; margin: -9px 0 0 -9px; border-radius: 50%; background: var(--accent);
    box-shadow: var(--shadow-card); transition: transform var(--dur) var(--ease), box-shadow var(--dur) var(--ease); }
  .sl:hover .thumb { transform: scale(1.12); }
  .sl.dragging .thumb { transform: scale(1.18); box-shadow: 0 0 0 6px var(--accent-soft); }
  .sl:focus-visible .thumb { box-shadow: 0 0 0 6px var(--accent-soft); }
  .sl.disabled { opacity: 0.45; cursor: default; }
  .sl.disabled .thumb { transform: none; }
</style>
