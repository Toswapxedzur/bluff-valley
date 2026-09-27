// A plate taking a new metal (equipped on /cosmetics, or a player at the table changing looks — the
// shared norm): the new colour spreads across it from the upper left, the side the light comes from.
// The plate's own background changes at once; the OLD colour lies over it and shrinks away toward
// the lower right. use:plateSpread={background}. The plate's content must sit above z-index 0.
import { reducedMotion } from "$lib/motion.js";

// A banner's picture must be DECODED before the old plate uncovers it: a background whose image is
// still decoding paints nothing, and the bare metal flashed through (owner, 2026-09-27: "the
// background banner is always flashy"). Resolves when every url(...) in `bg` is ready (or ~1.5 s).
function pictures(bg) {
  const urls = [...String(bg || "").matchAll(/url\("([^"]+)"\)/g)].map((m) => m[1]);
  if (!urls.length) return Promise.resolve();
  const ready = Promise.all(urls.map((u) => { const im = new Image(); im.src = u; return im.decode().catch(() => {}); }));
  return Promise.race([ready, new Promise((r) => setTimeout(r, 1500))]);
}

export function plateSpread(node, bg) {
  let cur = bg;
  return {
    update(next) {
      if (next === cur) return;
      const was = cur;
      cur = next;
      if (!was) return;
      // the banner editor's live preview (one blob: picture after another as you drag): it decodes
      // each frame itself before handing it over, so swap at once
      if (was.includes('url("blob:') && next?.includes('url("blob:')) return;
      // the old look lies over the plate at once, and stays whole until the new picture is ready
      const ov = document.createElement("span");
      Object.assign(ov.style, { position: "absolute", inset: "0", borderRadius: "inherit", background: was, zIndex: "0", pointerEvents: "none" });
      node.prepend(ov);
      pictures(next).then(() => {
        if (reducedMotion()) { ov.remove(); return; }
        ov.animate([{ clipPath: "circle(150% at 100% 100%)" }, { clipPath: "circle(0% at 100% 100%)" }], { duration: 640, easing: "cubic-bezier(.65,0,.35,1)", fill: "both" })
          .finished.catch(() => {}).finally(() => ov.remove());
      });
    }
  };
}
