// A plate taking a new metal (equipped on /cosmetics, or a player at the table changing looks — the
// shared norm): the new colour spreads across it from the upper left, the side the light comes from.
// The plate's own background changes at once; the OLD colour lies over it and shrinks away toward
// the lower right. use:plateSpread={background}. The plate's content must sit above z-index 0.
import { reducedMotion } from "$lib/motion.js";

export function plateSpread(node, bg) {
  let cur = bg;
  return {
    update(next) {
      if (next === cur) return;
      const was = cur;
      cur = next;
      if (!was || reducedMotion()) return;
      // the banner editor's live preview (one blob: picture after another as you drag): swap at once
      if (was.includes('url("blob:') && next?.includes('url("blob:')) return;
      const ov = document.createElement("span");
      Object.assign(ov.style, { position: "absolute", inset: "0", borderRadius: "inherit", background: was, zIndex: "0", pointerEvents: "none" });
      node.prepend(ov);
      ov.animate([{ clipPath: "circle(150% at 100% 100%)" }, { clipPath: "circle(0% at 100% 100%)" }], { duration: 640, easing: "cubic-bezier(.65,0,.35,1)", fill: "both" })
        .finished.catch(() => {}).finally(() => ov.remove());
    }
  };
}
