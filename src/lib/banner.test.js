import { test } from "node:test";
import assert from "node:assert/strict";
import { normalize, cropBox, PLATE_ASPECT, TAB_ASPECT, readability, readable, minWash, inksFor, inkOnSteps, inkHex, MAX_WASH, isRenderName, GOLD } from "./banner.js";
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

test("readability: white text needs a wash over a white picture, none over black", () => {
  const white = Array.from({ length: 200 }, () => [255, 255, 255]);
  const black = Array.from({ length: 200 }, () => [0, 0, 0]);
  assert.ok(!readable(readability(white, "#ffffff", 0)));
  assert.equal(minWash(black, "#ffffff"), 0);
  const w = minWash(white, "#ffffff");
  assert.ok(w > 0.3 && w <= MAX_WASH, `wash ${w}`);
  assert.ok(readable(readability(white, "#ffffff", w)));
  assert.ok(!readable(readability(white, "#ffffff", Math.round((w - 0.05) * 100) / 100)), "the least wash that works");
  // dark text over a dark picture: a LIGHT wash rescues it
  const dw = minWash(black, inkHex("ebony"));
  assert.ok(dw > 0 && readable(readability(black, inkHex("ebony"), dw)));
  // the player's own wash is a floor
  assert.equal(minWash(black, "#ffffff", 0.4), 0.4);
});

test("a busy picture: the worst tenth of the pixels decides", () => {
  // 85% black, 15% white: the median reads, the worst tenth doesn't until washed
  const px = Array.from({ length: 1000 }, (_, i) => (i % 100 < 15 ? [255, 255, 255] : [0, 0, 0]));
  assert.ok(!readable(readability(px, "#ffffff", 0)));
  assert.ok(minWash(px, "#ffffff") > 0);
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
