<script>
  // The banner editor (owner, 2026-09-27): upload a picture, crop it to the plate (or the end tab),
  // pick the text colour and the wash, and see the real seat plate update as you go. The preview is
  // drawn here with the same maths the server uses ($lib/banner.js); on Save the server re-cuts it,
  // re-checks the wash, and the banner is live on every seat at once.
  import SeatBadge from "$lib/poker/components/SeatBadge.svelte";
  import {
    normalize, cropBox, inkHex, INKS, PLATE_ASPECT, TAB_ASPECT, PLATE_PX, TAB_PX, MAX_WASH, MAX_ZOOM,
    regionLums, minWash, inksFor, washRgb, inkOnSteps
  } from "$lib/banner.js";
  import { plateStyle } from "$lib/cosmetics.js";

  import { untrack } from "svelte";

  let { me, wealth = 0, ring = "default", badge = "default", initial: initialIn, onLive = () => {} } = $props();
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
  let busy = $state("");           // "" | "upload" | "save" | "remove"
  let error = $state(null), note = $state(initial.removed ? "An admin took your last banner down. You can make a new one." : null);
  let dragOver = $state(false);

  // the picture as it will look (crop + wash), as a blob: URL the plates can draw
  let previewUrl = $state(null), autoWash = $state(0), inks = $state({ ink: inkHex("cream"), sub: null, money: null });
  let work;                         // offscreen canvas
  let frame = $state(null);         // the crop frame element (for drag scale)

  const loadMaster = (src) => new Promise((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = bad; i.src = src; });
  $effect(() => {
    const id = fileId;
    if (!id) { img = null; return; }
    let dead = false;
    loadMaster(`/banner/master/${id}`).then((i) => { if (!dead) img = i; }).catch(() => { if (!dead) error = "Couldn't load your picture. Upload it again."; });
    return () => { dead = true; };
  });

  // the metal behind a tab banner (its three steps), for which inks read on it
  const METAL_STEPS = { default: ["#6E685B", "#3E3A31", "#1C1A15"] };
  function stepsOf(look) {
    if (METAL_STEPS[look]) return METAL_STEPS[look];
    const bg = plateStyle(look).bg, m = bg.match(/#[0-9a-f]{6}/gi);
    return m ? m.slice(0, 3) : METAL_STEPS.default;
  }
  const inkReads = (key) => s.layout === "plate" || inkOnSteps(inkHex(key), stepsOf(badge));

  // redraw the preview whenever the picture or a setting changes (one frame at a time)
  let raf = 0;
  $effect(() => {
    const deps = [img, s.layout, s.x, s.y, s.z, s.ink, s.wash];
    void deps;
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  });
  function draw() {
    if (!img) { swap(null); return; }
    const plate = s.layout === "plate";
    const [W, H] = plate ? PLATE_PX : TAB_PX;
    work ??= document.createElement("canvas");
    work.width = W; work.height = H;
    const ctx = work.getContext("2d", { willReadFrequently: true });
    ctx.imageSmoothingQuality = "high";
    ctx.fillStyle = "#3e3a31"; ctx.fillRect(0, 0, W, H);
    const box = cropBox(img.naturalWidth, img.naturalHeight, plate ? PLATE_ASPECT : TAB_ASPECT, s);
    ctx.drawImage(img, box.left, box.top, box.width, box.height, 0, 0, W, H);
    const ink = inkHex(s.ink);
    let wash = s.wash, got = { ink, sub: null, money: null };
    if (plate) {
      const px = regionLums(ctx.getImageData(0, 0, W, H).data, W, H, 4);
      wash = minWash(px, ink, s.wash);
      got = inksFor(px, ink, wash);
    }
    if (wash > 0) { const [r, g, b] = washRgb(ink); ctx.fillStyle = `rgba(${r},${g},${b},${wash})`; ctx.fillRect(0, 0, W, H); }
    autoWash = wash; inks = got;
    work.toBlob((b) => swap(b ? URL.createObjectURL(b) : null), "image/webp", 0.9);
  }
  function swap(url) { const old = previewUrl; previewUrl = url; if (old) setTimeout(() => URL.revokeObjectURL(old), 1500); }

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
      s = normalize({ layout: s.layout, ink: s.ink });   // a new picture starts centred
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
    const plate = s.layout === "plate";
    const box = cropBox(img.naturalWidth, img.naturalHeight, plate ? PLATE_ASPECT : TAB_ASPECT, s);
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

  // the seats in the preview: yours (to act, the clock running) and how others see you
  let banner = $derived(img && previewUrl ? { l: s.layout, preview: previewUrl, ink: inks.ink, sub: inks.sub, money: inks.money } : live);
  let deadline = $state(Date.now() + 25_000);
  $effect(() => { const id = setInterval(() => { deadline = Date.now() + 25_000; }, 25_000); return () => clearInterval(id); });
  const LONG = "Maximilian_the_Great";
  let mine = $derived({ seat: 1, userId: me.id, name: me.name, avatar: me.avatarMediaId, ring, badge, banner, stack: wealth, connected: true, isToAct: true, isButton: true, status: null, lastAction: null, committed: 0 });
  let other = $derived({ ...mine, seat: 2, name: LONG, isToAct: false, isButton: false, isBB: true, lastAction: "Raise 400" });
  let folded = $derived({ ...mine, seat: 3, isToAct: false, isButton: false, status: "folded", lastAction: "Fold" });
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

  <div class="be-grid">
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
        <div class="row">
          <span class="lbl">Layout</span>
          <div class="seg" role="radiogroup" aria-label="Layout">
            <button type="button" role="radio" aria-checked={s.layout === "plate"} class="seg-btn" class:on={s.layout === "plate"} onclick={() => (s.layout = "plate")}>Whole plate</button>
            <button type="button" role="radio" aria-checked={s.layout === "tab"} class="seg-btn" class:on={s.layout === "tab"} onclick={() => (s.layout = "tab")}>End tab</button>
          </div>
        </div>

        <div class="row col">
          <span class="lbl">Crop <span class="muted small">— drag to move, scroll or slide to zoom</span></span>
          <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
          <div class="frame" class:tab={s.layout === "tab"} bind:this={frame} tabindex="0" role="application" aria-label="Crop: arrow keys move the picture"
            onpointerdown={down} onpointermove={move} onpointerup={up} onpointercancel={up} onwheel={wheel} onkeydown={key}>
            {#if previewUrl}<img src={previewUrl} alt="" draggable="false" />{/if}
            {#if s.layout === "plate"}<span class="textzone" aria-hidden="true"></span>{/if}
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
              {@const ok = inkReads(i.key)}
              <button type="button" role="radio" aria-checked={s.ink === i.key} class="ink" class:on={s.ink === i.key} class:no={!ok}
                style="--c:{i.hex}" title={ok ? i.name : `${i.name} — doesn't read on your plate's metal`} aria-label={i.name} onclick={() => (s.ink = i.key)}></button>
            {/each}
          </div>
          {#if s.layout === "tab" && !inkReads(s.ink)}<span class="muted small">That colour doesn't read on your plate's metal, so the metal's own colour shows.</span>{/if}
        </div>

        <div class="row col">
          <span class="lbl">Wash <span class="muted small">— fades the picture behind the text</span></span>
          <div class="zoom">
            <input type="range" min="0" max={MAX_WASH} step="0.05" bind:value={s.wash} aria-label="Wash" />
            <span class="val">{pct(Math.max(s.wash, autoWash))}</span>
          </div>
          {#if s.layout === "plate" && autoWash > s.wash + 1e-9}<span class="muted small">Raised to {pct(autoWash)} so your name stays readable.</span>{/if}
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

    <div class="be-preview" style="--plate-w:136px;--plate-w-mine:164px">
      <span class="muted small cap">Your seat</span>
      <div class="seatbox"><SeatBadge seat={mine} isMine deadline={deadline} seatNo={1} /></div>
      <span class="muted small cap">What others see</span>
      <div class="seatbox"><SeatBadge seat={other} seatNo={2} /></div>
      <div class="seatbox"><SeatBadge seat={folded} seatNo={3} /></div>
      <span class="muted small cap">Twice the size</span>
      <div class="seatbox big"><SeatBadge seat={other} seatNo={4} /></div>
    </div>
  </div>
</section>

<style>
  .be { margin-bottom: 26px; }
  .be-head { display: flex; align-items: baseline; gap: 10px; margin-bottom: 10px; flex-wrap: wrap; }
  .be-head h2 { margin: 0; font-size: 15px; }
  .small { font-size: 12.5px; }
  .be-grid { display: grid; grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr); gap: 16px; align-items: start; }
  @media (max-width: 640px) { .be-grid { grid-template-columns: minmax(0, 1fr); } .be-preview { order: -1; } }
  .be-controls { display: flex; flex-direction: column; gap: 14px; background: var(--surface); border-radius: var(--r-card); box-shadow: var(--shadow-card); padding: 14px; }
  .be-preview { display: flex; flex-direction: column; align-items: center; gap: 8px; background: var(--well); border-radius: var(--r-card); padding: 16px 12px 22px; }
  .cap { align-self: flex-start; margin-top: 4px; }
  .seatbox { padding: 6px 0 6px 12px; }
  .seatbox.big { zoom: 2; padding: 4px 0 2px 8px; }

  .drop { position: relative; display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 18px 12px; border-radius: var(--r-card);
    background: var(--well); cursor: pointer; text-align: center; transition: box-shadow var(--dur) var(--ease); }
  .drop.has { padding: 10px 12px; }
  .drop.over { box-shadow: 0 0 0 2px var(--accent); }
  .drop input { position: absolute; inset: 0; opacity: 0; cursor: pointer; }
  .drop-main { font-weight: 700; color: var(--accent-ink); }

  .row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
  .row.col { flex-direction: column; align-items: stretch; gap: 7px; }
  .lbl { font-weight: 700; font-size: 13px; }
  .seg { display: inline-flex; background: var(--well); border-radius: var(--r-pill); padding: 3px; gap: 2px; }
  .seg-btn { border: 0; background: transparent; color: var(--muted); font: inherit; font-weight: 600; font-size: 13px; padding: 7px 14px; border-radius: var(--r-pill); cursor: pointer;
    transition: color var(--dur) var(--ease), background-color var(--dur) var(--ease); }
  .seg-btn:hover { color: var(--text); }
  .seg-btn.on { color: var(--text); background: var(--surface-2); box-shadow: var(--shadow-card); }

  .frame { position: relative; width: 100%; max-width: 492px; aspect-ratio: 492 / 138; border-radius: 12px; overflow: hidden; background: var(--well);
    cursor: grab; touch-action: none; user-select: none; outline: none; }
  .frame:focus-visible { box-shadow: 0 0 0 2px var(--accent); }
  .frame:active { cursor: grabbing; }
  .frame.tab { width: auto; height: 210px; aspect-ratio: 96 / 140; align-self: flex-start; }
  .frame img { position: absolute; inset: 0; width: 100%; height: 100%; display: block; pointer-events: none; }
  /* where the name and stack will sit — a faint guide, so the crop keeps faces out from under the text */
  .textzone { position: absolute; left: 30%; right: 4%; top: 14%; bottom: 14%; border-radius: 8px; box-shadow: inset 0 0 0 1px rgba(255,255,255,0.35); pointer-events: none; }
  .zoom { display: flex; align-items: center; gap: 10px; }
  .zoom input { flex: 1; accent-color: var(--accent); }
  .val { font-variant-numeric: tabular-nums; font-weight: 700; font-size: 13px; min-width: 3.2em; text-align: right; }
  .link { border: 0; background: none; color: var(--accent-ink); font: inherit; font-weight: 600; cursor: pointer; padding: 0; }

  .inks { display: flex; gap: 8px; flex-wrap: wrap; }
  .ink { width: 30px; height: 30px; border-radius: 50%; border: 0; cursor: pointer; background: var(--c); box-shadow: 0 0 0 1px rgba(128,128,128,0.35);
    transition: box-shadow var(--dur) var(--ease); }
  .ink.on { box-shadow: 0 0 0 2px var(--surface), 0 0 0 4px var(--accent); }
  .ink.no { opacity: 0.35; }

  .acts { display: flex; gap: 10px; flex-wrap: wrap; }
  .err { color: var(--danger); margin: 0; font-weight: 600; }
  .ok { color: var(--ok); margin: 0; font-weight: 600; }
  .warn { color: var(--danger); font-weight: 600; margin: 0 0 10px; }
</style>
