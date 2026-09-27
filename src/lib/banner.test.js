import { test } from "node:test";
import assert from "node:assert/strict";
import { normalize, cropBox, cropCss, PLATE_ASPECT, TAB_ASPECT, readability, readable, inksFor, inkOnSteps, inkHex, MAX_WASH, isRenderName, GOLD } from "./banner.js";
import { plateStyle } from "./cosmetics.js";

test("settings are clamped to safe values", () => {
  assert.deepEqual(normalize({}), { layout: "plate", x: 0.5, y: 0.5, z: 1, ink: "cream", wash: 0 });
  assert.deepEqual(normalize({ layout: "tab", x: -3, y: 9, z: 99, ink: "ebony", wash: 5 }), { layout: "tab", x: 0, y: 1, z: 4, ink: "ebony", wash: MAX_WASH });
  assert.equal(normalize({ layout: "<script>", ink: "nope", x: "abc" }).layout, "plate");
  assert.equal(normalize({ ink: "nope" }).ink, "cream");
  assert.equal(normalize({ x: "abc" }).x, 0.5);
});

test("the crop is the plate's shape, inside the picture, slid by x / y and shrunk by the zoom", () => {
  const wide = cropBox(2000, 500, PLATE_ASPECT, {});
  assert.equal(wide.height, 500);
  assert.ok(Math.abs(wide.width / wide.height - PLATE_ASPECT) < 0.01);
  assert.equal(wide.left, Math.round((2000 - wide.width) / 2));
  const left = cropBox(2000, 500, PLATE_ASPECT, { x: 0 }), right = cropBox(2000, 500, PLATE_ASPECT, { x: 1 });
  assert.equal(left.left, 0);
  assert.equal(right.left + right.width, 2000);
  const tall = cropBox(400, 1200, TAB_ASPECT, { y: 0 });
  assert.equal(tall.width, 400);
  assert.equal(tall.top, 0);
  const zoomed = cropBox(1600, 900, PLATE_ASPECT, { z: 2 });
  const full = cropBox(1600, 900, PLATE_ASPECT, { z: 1 });
  assert.ok(Math.abs(zoomed.width - full.width / 2) <= 1);
  for (const b of [wide, left, right, tall, zoomed]) assert.ok(b.left >= 0 && b.top >= 0);
});

test("readability: white on white fails, a wash helps, dark text over dark needs a light wash", () => {
  const white = Array.from({ length: 200 }, () => [255, 255, 255]);
  const black = Array.from({ length: 200 }, () => [0, 0, 0]);
  assert.ok(!readable(readability(white, "#ffffff", 0)));
  assert.ok(readable(readability(black, "#ffffff", 0)));
  assert.ok(readable(readability(white, "#ffffff", 0.7)));
  assert.ok(!readable(readability(black, inkHex("ebony"), 0)));
  assert.ok(readable(readability(black, inkHex("ebony"), 0.7)), "under dark ink the wash is light");
});

test("the CSS crop draws exactly the server's crop", () => {
  for (const [w, h, s] of [[1400, 800, { x: 0.3, y: 0.8, z: 1.6 }], [900, 1200, { x: 1, y: 0, z: 1 }], [2000, 500, { x: 0.5, y: 0.5, z: 3 }]]) {
    const b = cropBox(w, h, PLATE_ASPECT, s), c = cropCss(w, h, PLATE_ASPECT, s);
    // a box of the crop's shape, W wide: the picture is drawn size% of W wide, placed pos% along the free room
    const W = 1000, H = W / PLATE_ASPECT, scale = (parseFloat(c.size) / 100) * W / w;
    const [px, py] = c.pos.split(" ").map((v) => parseFloat(v) / 100);
    const offX = (W - w * scale) * px, offY = (H - h * scale) * py;
    assert.ok(Math.abs(-offX / scale - b.left) <= 1.5, `left ${-offX / scale} vs ${b.left}`);
    assert.ok(Math.abs(-offY / scale - b.top) <= 1.5 + h * 0.002, `top ${-offY / scale} vs ${b.top}`);
  }
});

test("the stack is gold only where gold reads; the soft ink leans toward the picture", () => {
  const black = Array.from({ length: 50 }, () => [10, 10, 10]);
  const white = Array.from({ length: 50 }, () => [250, 250, 250]);
  assert.equal(inksFor(black, "#fbf8ef", 0).money, GOLD);
  const dark = inksFor(white, inkHex("ebony"), 0);
  assert.equal(dark.money, inkHex("ebony"), "gold on white doesn't read: the stack follows the ink");
  assert.match(inksFor(black, "#fbf8ef", 0).sub, /^#[0-9a-f]{6}$/);
});

test("a tab banner keeps the metal behind the text, and only a readable ink", () => {
  const b = { l: "tab", src: "0123456789abcdef0123456789abcdef.webp", ink: "#1c1a15" };
  const st = plateStyle("default", b);
  assert.equal(st.tab, true);
  assert.match(st.bg, /^url\("\/banner\/0123456789abcdef0123456789abcdef\.webp"\) right center \/ auto 100% no-repeat, linear-gradient/);
  assert.equal(st.ink, plateStyle("default").ink, "ebony on the dark chess plate falls back to the metal's ink");
  assert.equal(plateStyle("default", { ...b, ink: "#fbf8ef" }).ink, "#fbf8ef");
  assert.ok(inkOnSteps("#ffffff", ["#6E685B", "#3E3A31", "#1C1A15"]));
});

test("a plate banner fills the plate over the metal, with its own inks; junk is ignored", () => {
  const b = { l: "plate", src: "0123456789abcdef0123456789abcdef.webp", ink: "#ffffff", sub: "#dddddd", money: "#f5b60d" };
  const st = plateStyle("ruby", b);
  assert.equal(st.tab, false);
  assert.match(st.bg, /cover no-repeat, linear-gradient/);
  assert.deepEqual([st.ink, st.sub, st.money], ["#ffffff", "#dddddd", "#f5b60d"]);
  // a hostile src or ink never reaches the CSS
  assert.deepEqual(plateStyle("ruby", { l: "plate", src: 'x"); background: url(evil' }), { ...plateStyle("ruby"), tab: false });
  assert.equal(plateStyle("ruby", { ...b, ink: "red; x: y" }).ink, plateStyle("ruby").ink);
  assert.ok(isRenderName("0123456789abcdef0123456789abcdef.webp") && !isRenderName("../../etc/passwd") && !isRenderName("a.webp"));
});
