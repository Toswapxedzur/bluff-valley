// use:portal — move an element to the end of <body>, so a fixed overlay (History's visit sheet)
// stacks against the whole window, not inside the page's own stacking context (under the site bar).
export function portal(node) {
  document.body.appendChild(node);
  return { destroy() { node.remove(); } };
}
