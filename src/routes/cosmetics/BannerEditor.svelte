<script>
  // The banner editor (owner, 2026-09-27): upload a picture, crop it to the seat plate,
  // pick the text colour and an optional wash, and see the real seat plate update as you go. The
  // picture keeps its own brightness: only the player's wash, exactly as set (owner, 2026-09-27).
  // The preview is instant (owner: "the image feels laggy"): the plates and the crop frame draw the
  // master itself with CSS, placed by the crop (cropCss) — nothing is encoded while you drag. On Save
  // the server cuts the same crop ($lib/banner.js) and the banner is live on every seat at once.
  import {
    normalize, cropBox, inkHex, INKS, PLATE_ASPECT, PLATE_PX, MAX_WASH, MAX_ZOOM,
    regionLums, inksFor, washRgb, cropCss
  } from "$lib/banner.js";

  import { untrack } from "svelte";

  // onShow(banner): what the page's seat preview should draw now — this unsaved picture while editing,
  // else the live banner (the preview itself lives on the page, beside the rings and badges)
  let { initial: initialIn, onLive = () => {}, onShow = () => {} } = $props();
  const initial = untrack(() => initialIn);   // the page's load: the editor's starting point, read once

  const MAX_BYTES = 5 * 1024 * 1024;
  const TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];

  // what is saved (live) and what is being edited
  let live = $state(initial.live);
  let fileId = $state(initial.removed ? null : initial.fileId);
  let s = $state(normalize(initial.removed ? {} : initial.settings || {}));
  let saved = $state(initial.live && !initial.removed && initial.fileId ? JSON.stringify({ fileId: initial.fileId, s: normalize(initial.settings || {}) }) : null);
  let uploadsLeft = $state(initial.uploadsLeft);
  let banned = initial.banned;

  let img = $state(null);          // the master, loaded
  let masterUrl = $state(null);    // …as a blob: URL the plates may draw
  let busy = $state("");           // "" | "upload" | "save" | "remove"
  let error = $state(null), note = $state(initial.removed ? "An admin took your last banner down. You can make a new one." : null);
  let dragOver = $state(false);

  let inks = $state({ ink: inkHex("cream"), sub: null, money: null });
  let work;                         // offscreen canvas
  let frame = $state(null);         // the crop frame element (for drag scale)

  const loadMaster = (src) => new Promise((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = bad; i.src = src; });
  $effect(() => {
    const id = fileId;
    if (!id) { img = null; masterUrl = null; return; }
    let dead = false, made = null;
    fetch(`/banner/master/${id}`)
      .then((r) => (r.ok ? r.blob() : Promise.reject(new Error("gone"))))
      .then((b) => { made = URL.createObjectURL(b); return loadMaster(made); })
      .then((i) => { if (!dead) { img = i; masterUrl = made; } })
      .catch(() => { if (!dead) error = "Couldn't load your picture. Upload it again."; });
    return () => { dead = true; if (made) setTimeout(() => URL.revokeObjectURL(made), 1500); };
  });

  // the crop as CSS for the frame and the whole-plate preview, and the wash as a flat layer over it
  let crop = $derived(img ? cropCss(img.naturalWidth, img.naturalHeight, PLATE_ASPECT, s) : null);
  let washLayer = $derived.by(() => {
    if (!(s.wash > 0)) return "";
    const c = washRgb(inkHex(s.ink)).join(",");
    return `linear-gradient(rgba(${c},${s.wash}), rgba(${c},${s.wash})), `;
  });
  let frameBg = $derived(masterUrl && crop ? `${washLayer}url("${masterUrl}") ${crop.pos} / ${crop.size} no-repeat` : "");

  // once a frame: the stack's colour (gold only where gold reads) from a sample of the crop —
  // drawn, never encoded
  let raf = 0;
  $effect(() => {
    const deps = [img, s.x, s.y, s.z, s.ink, s.wash];
    void deps;
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  });
  function draw() {
    if (!img) return;
    const [W, H] = PLATE_PX;
    work ??= document.createElement("canvas");
    work.width = W; work.height = H;
    const ctx = work.getContext("2d", { willReadFrequently: true });
    const box = cropBox(img.naturalWidth, img.naturalHeight, PLATE_ASPECT, s);
    ctx.drawImage(img, box.left, box.top, box.width, box.height, 0, 0, W, H);
    inks = inksFor(regionLums(ctx.getImageData(0, 0, W, H).data, W, H, 4), inkHex(s.ink), s.wash);
  }

  // ---- upload
  async function upload(file) {
    error = null; note = null;
    if (!file) return;
    if (!TYPES.includes(file.type)) { error = "Use a PNG, JPG, WebP or GIF."; return; }
    if (file.size > MAX_BYTES) { error = "That picture is over 5 MB."; return; }
    busy = "upload";
    try {
      const fd = new FormData(); fd.set("file", file);
      const r = await fetch("/api/banner", { method: "POST", body: fd });
      const j = await r.json().catch(() => ({ error: "Upload failed. Try again." }));
      if (!r.ok || j.error) { error = j.error || "Upload failed. Try again."; return; }
      fileId = j.file.id;
      s = normalize({ ink: s.ink });   // a new picture starts centred
      uploadsLeft = Math.max(0, uploadsLeft - 1);
    } catch { error = "Upload failed. Check your connection."; }
    finally { busy = ""; }
  }
  const onPick = (e) => { upload(e.currentTarget.files?.[0]); e.currentTarget.value = ""; };
  const onDrop = (e) => { e.preventDefault(); dragOver = false; upload(e.dataTransfer?.files?.[0]); };

  // ---- save / remove
  let dirty = $derived(!!fileId && JSON.stringify({ fileId, s: normalize(s) }) !== saved);
  // a fresh edit retires the last "Saved" / "Banner off" message
  $effect(() => { if (dirty) untrack(() => { if (note && !error) note = null; }); });
  async function save() {
    if (!fileId || busy) return;
    busy = "save"; error = null; note = null;
    try {
      const r = await fetch("/api/banner", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ fileId, settings: normalize(s) }) });
      const j = await r.json().catch(() => ({ error: "Couldn't save. Try again." }));
      if (!r.ok || j.error) { error = j.error || "Couldn't save. Try again."; return; }
      live = j.banner; saved = JSON.stringify({ fileId, s: normalize(s) });
      onLive(live);
      note = "Saved. It's on your seat now.";
    } catch { error = "Couldn't save. Check your connection."; }
    finally { busy = ""; }
  }
  async function remove() {
    if (busy) return;
    busy = "remove"; error = null; note = null;
    try {
      const r = await fetch("/api/banner", { method: "DELETE" });
      if (!r.ok) { error = "Couldn't remove it. Try again."; return; }
      live = null; saved = null; onLive(null);
      note = "Banner off. Your plate shows its metal again.";
    } finally { busy = ""; }
  }

  // ---- crop frame: drag to move, wheel / slider to zoom
  let drag = null;
  function down(e) {
    if (!img || !frame) return;
    const box = cropBox(img.naturalWidth, img.naturalHeight, PLATE_ASPECT, s);
    drag = { x0: e.clientX, y0: e.clientY, box, k: box.width / frame.getBoundingClientRect().width,
      freeW: img.naturalWidth - box.width, freeH: img.naturalHeight - box.height };
    frame.setPointerCapture(e.pointerId);
  }
  function move(e) {
    if (!drag) return;
    const { x0, y0, box, k, freeW, freeH } = drag;
    const clamp = (v) => Math.min(1, Math.max(0, v));
    if (freeW > 0) s.x = clamp((box.left - (e.clientX - x0) * k) / freeW);
    if (freeH > 0) s.y = clamp((box.top - (e.clientY - y0) * k) / freeH);
  }
  const up = () => { drag = null; };
  function wheel(e) {
    if (!img) return;
    e.preventDefault();
    s.z = Math.min(MAX_ZOOM, Math.max(1, s.z * (e.deltaY < 0 ? 1.08 : 1 / 1.08)));
  }
  const nudge = (dx, dy) => { s.x = Math.min(1, Math.max(0, s.x + dx)); s.y = Math.min(1, Math.max(0, s.y + dy)); };
  function key(e) {
    const st = e.shiftKey ? 0.1 : 0.02;
    const m = { ArrowLeft: [-st, 0], ArrowRight: [st, 0], ArrowUp: [0, -st], ArrowDown: [0, st] }[e.key];
    if (m) { e.preventDefault(); nudge(...m); }
  }

  let banner = $derived(
    !img ? live
    : masterUrl && crop ? { l: "plate", preview: masterUrl, size: crop.size, pos: crop.pos, wash: s.wash, ink: inks.ink, sub: inks.sub, money: inks.money }
    : live
  );
  $effect(() => { onShow(banner); });
  const pct = (v) => `${Math.round(v * 100)}%`;
</script>

<section class="be">
  <div class="be-head">
    <h2>Banner</h2>
    <span class="muted small">Your own picture on your seat plate. It goes live the moment you save.</span>
  </div>

  {#if banned}
    <p class="warn" role="alert">You can't upload banners.{#if live} You can still take your current one off.{/if}</p>
  {/if}

  <div class="be-controls">
      {#if !banned}
        <label class="drop" class:over={dragOver} class:has={!!img}
          ondragover={(e) => { e.preventDefault(); dragOver = true; }} ondragleave={() => (dragOver = false)} ondrop={onDrop}>
          <input type="file" accept={TYPES.join(",")} onchange={onPick} disabled={!!busy || uploadsLeft <= 0} />
          <span class="drop-main">{busy === "upload" ? "Uploading…" : img ? "Choose another picture" : "Choose a picture"}</span>
          <span class="muted small">or drop it here · PNG, JPG, WebP or GIF · up to 5 MB · {uploadsLeft} upload{uploadsLeft === 1 ? "" : "s"} left today</span>
        </label>
      {/if}

      {#if img}
        <div class="row col">
          <span class="lbl">Crop <span class="muted small">— drag to move, scroll or slide to zoom</span></span>
          <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
          <div class="frame" style:background={frameBg || null} bind:this={frame} tabindex="0" role="application" aria-label="Crop: arrow keys move the picture"
            onpointerdown={down} onpointermove={move} onpointerup={up} onpointercancel={up} onwheel={wheel} onkeydown={key}>
          </div>
          <div class="zoom">
            <span class="muted small">Zoom</span>
            <input type="range" min="1" max={MAX_ZOOM} step="0.01" bind:value={s.z} aria-label="Zoom" />
            <button type="button" class="link small" onclick={() => { s.x = 0.5; s.y = 0.5; s.z = 1; }}>Reset crop</button>
          </div>
        </div>

        <div class="row col">
          <span class="lbl">Text colour</span>
          <div class="inks" role="radiogroup" aria-label="Text colour">
            {#each INKS as i (i.key)}
              <button type="button" role="radio" aria-checked={s.ink === i.key} class="ink" class:on={s.ink === i.key}
                style="--c:{i.hex}" title={i.name} aria-label={i.name} onclick={() => (s.ink = i.key)}></button>
            {/each}
          </div>
        </div>

        <div class="row col">
          <span class="lbl">Wash <span class="muted small">— optional: fades the picture behind the text</span></span>
          <div class="zoom">
            <input type="range" min="0" max={MAX_WASH} step="0.05" bind:value={s.wash} aria-label="Wash" />
            <span class="val">{pct(s.wash)}</span>
          </div>
        </div>
      {/if}

      {#if error}<p class="err" role="alert">{error}</p>{/if}
      {#if note}<p class="ok" role="status">{note}</p>{/if}

      <div class="acts">
        {#if img && !banned}
          <button type="button" class="btn" disabled={!dirty || !!busy} onclick={save}>{busy === "save" ? "Saving…" : live ? "Save changes" : "Save banner"}</button>
        {/if}
        {#if live}
          <button type="button" class="btn btn-secondary" disabled={!!busy} onclick={remove}>{busy === "remove" ? "Removing…" : "Remove banner"}</button>
        {/if}
      </div>
  </div>
</section>

<style>
  .be { margin: 0; }
  .be-head { display: flex; align-items: baseline; gap: 10px; margin-bottom: 10px; flex-wrap: wrap; }
  .be-head h2 { margin: 0; font-size: 15px; }
  .small { font-size: 12.5px; }
  .be-controls { display: flex; flex-direction: column; gap: 14px; background: var(--surface); border-radius: var(--r-card); box-shadow: var(--shadow-card); padding: 14px; }

  .drop { position: relative; display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 18px 12px; border-radius: var(--r-card);
    background: var(--well); cursor: pointer; text-align: center; transition: box-shadow var(--dur) var(--ease); }
  .drop.has { padding: 10px 12px; }
  .drop.over { box-shadow: 0 0 0 2px var(--accent); }
  .drop input { position: absolute; inset: 0; opacity: 0; cursor: pointer; }
  .drop-main { font-weight: 700; color: var(--accent-ink); }

  .row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
  .row.col { flex-direction: column; align-items: stretch; gap: 7px; }
  .lbl { font-weight: 700; font-size: 13px; }

  .frame { position: relative; width: 100%; max-width: 492px; aspect-ratio: 492 / 138; border-radius: 12px; overflow: hidden; background: var(--well);
    cursor: grab; touch-action: none; user-select: none; outline: none; }
  .frame:focus-visible { box-shadow: 0 0 0 2px var(--accent); }
  .frame:active { cursor: grabbing; }
  .zoom { display: flex; align-items: center; gap: 10px; }
  .zoom input { flex: 1; accent-color: var(--accent); }
  .val { font-variant-numeric: tabular-nums; font-weight: 700; font-size: 13px; min-width: 3.2em; text-align: right; }
  .link { border: 0; background: none; color: var(--accent-ink); font: inherit; font-weight: 600; cursor: pointer; padding: 0; }

  .inks { display: flex; gap: 8px; flex-wrap: wrap; }
  .ink { width: 30px; height: 30px; border-radius: 50%; border: 0; cursor: pointer; background: var(--c); box-shadow: 0 0 0 1px rgba(128,128,128,0.35);
    transition: box-shadow var(--dur) var(--ease); }
  .ink.on { box-shadow: 0 0 0 2px var(--surface), 0 0 0 4px var(--accent); }

  .acts { display: flex; gap: 10px; flex-wrap: wrap; }
  .err { color: var(--danger); margin: 0; font-weight: 600; }
  .ok { color: var(--ok); margin: 0; font-weight: 600; }
  .warn { color: var(--danger); font-weight: 600; margin: 0 0 10px; }
</style>
