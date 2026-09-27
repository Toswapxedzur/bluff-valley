// Card art for canvases: composer SVG → an Image (an SVG drawn as an image can't fetch, so its
// /deck-parts hrefs are inlined first). Shared by the Hold'em DeckLayer and the CardLayer's shuffle.
import { W, H } from "./deck3d.js";

const svgCache = new Map();
export async function toImage(markup, px = 480) {
  let svg = markup.match(/<svg[\s\S]*<\/svg>/)[0];
  for (const [, file] of svg.matchAll(/href="\/deck-parts\/([^"]+)"/g)) {
    if (!svgCache.has(file)) {
      const txt = await (await fetch(`/deck-parts/${file}`)).text();
      svgCache.set(file, "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(txt))));
    }
    svg = svg.replaceAll(`href="/deck-parts/${file}"`, `href="${svgCache.get(file)}"`);
  }
  svg = svg.replace(/width="\d+" height="\d+"/, `width="${px}" height="${Math.round((px * H) / W)}"`);
  const img = new Image();
  img.src = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  await img.decode();
  return img;
}
