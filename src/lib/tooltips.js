// Our own tooltips, site-wide — no native `title` pop-ups (owner, 2026-09-28: "No native UI").
// Installed once (root layout). Any element with a `title` keeps working as written: the first time
// it is hovered or focused, its title moves to data-tip (so the browser never shows its own box), and
// our tooltip shows it — above the element (below when there's no room), inside the window. An
// icon-only control whose title was its only name gets that name as its aria-label, so screen
// readers lose nothing. Touch taps don't show tooltips (there's no hover).
const DELAY_MS = 450;

export function installTooltips() {
  if (typeof document === "undefined") return () => {};
  const tip = document.createElement("div");
  tip.className = "bv-tip";
  tip.setAttribute("role", "tooltip");
  tip.hidden = true;
  document.body.append(tip);
  let target = null, timer = 0;

  const adopt = (el) => {
    const t = el.getAttribute("title");
    if (t) {
      el.dataset.tip = t;
      el.removeAttribute("title");
      if (!el.hasAttribute("aria-label") && !el.hasAttribute("aria-labelledby") && !(el.textContent || "").trim()) el.setAttribute("aria-label", t);
    }
    return el.dataset.tip || "";
  };
  const find = (node) => node?.closest?.("[title], [data-tip]") ?? null;

  function place(el) {
    const r = el.getBoundingClientRect(), t = tip.getBoundingClientRect(), gap = 8, pad = 8;
    let top = r.top - t.height - gap;
    if (top < pad) top = r.bottom + gap;
    const left = Math.min(window.innerWidth - t.width - pad, Math.max(pad, r.left + r.width / 2 - t.width / 2));
    tip.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
  }
  function show(el) {
    const text = adopt(el);
    if (!text) return;
    target = el;
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (target !== el || !el.isConnected) return;
      tip.textContent = el.dataset.tip;
      tip.hidden = false;
      place(el);
      tip.classList.add("on");
    }, DELAY_MS);
  }
  function hide() {
    clearTimeout(timer);
    target = null;
    tip.classList.remove("on");
    tip.hidden = true;
  }

  const over = (e) => {
    if (e.pointerType === "touch") return;
    const el = find(e.target);
    if (el && el !== target) show(el);
    else if (!el && target) hide();
  };
  const out = (e) => { if (target && !target.contains(e.relatedTarget)) hide(); };
  const focus = (e) => { const el = find(e.target); if (el && e.target.matches?.(":focus-visible")) show(el); };
  const key = (e) => { if (e.key === "Escape") hide(); };

  document.addEventListener("pointerover", over, true);
  document.addEventListener("pointerout", out, true);
  document.addEventListener("focusin", focus, true);
  document.addEventListener("focusout", hide, true);
  document.addEventListener("pointerdown", hide, true);
  document.addEventListener("keydown", key, true);
  window.addEventListener("scroll", hide, true);
  return () => {
    hide();
    tip.remove();
    document.removeEventListener("pointerover", over, true);
    document.removeEventListener("pointerout", out, true);
    document.removeEventListener("focusin", focus, true);
    document.removeEventListener("focusout", hide, true);
    document.removeEventListener("pointerdown", hide, true);
    document.removeEventListener("keydown", key, true);
    window.removeEventListener("scroll", hide, true);
  };
}
