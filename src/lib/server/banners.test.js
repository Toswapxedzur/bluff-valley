import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { PLATE_PX, TAB_PX } from "../banner.js";

const dir = mkdtempSync(join(tmpdir(), "banners-"));
process.env.BANNER_DIR = dir;
const { renderBanner, readRender } = await import("./banners.js");

const solid = (w, h, c) => sharp({ create: { width: w, height: h, channels: 3, background: c } }).webp().toBuffer();

test("a plate banner is cut to the plate's size, keeps the picture's brightness, and is saved by content", async () => {
  const master = await solid(1600, 900, { r: 250, g: 250, b: 250 });
  const r = await renderBanner(master, { layout: "plate", ink: "white" });
  assert.match(r.src, /^[a-f0-9]{32}\.webp$/);
  assert.equal(r.wash, 0, "never dimmed on the player's behalf");
  const buf = await readRender(r.src);
  assert.ok(buf && buf.length < 60_000, "small");
  const out = await sharp(buf).raw().toBuffer({ resolveWithObject: true });
  assert.deepEqual([out.info.width, out.info.height], PLATE_PX);
  assert.ok(out.data[0] > 240, `still white: ${out.data[0]}`);
  // the same input gives the same file
  assert.equal((await renderBanner(master, { layout: "plate", ink: "white" })).src, r.src);
});

test("the player's own wash is applied exactly as set", async () => {
  const r = await renderBanner(await solid(1600, 900, { r: 250, g: 250, b: 250 }), { layout: "plate", ink: "white", wash: 0.4 });
  assert.equal(r.wash, 0.4);
  const out = await sharp(await readRender(r.src)).raw().toBuffer({ resolveWithObject: true });
  assert.ok(Math.abs(out.data[0] - 150) <= 4, `250 washed 40% toward black = 150, got ${out.data[0]}`);
});

test("a dark picture under light text needs no wash; the stack stays gold", async () => {
  const r = await renderBanner(await solid(800, 800, { r: 20, g: 24, b: 40 }), { layout: "plate", ink: "cream" });
  assert.equal(r.wash, 0);
  assert.equal(r.money, "#f5b60d");
});

test("a tab banner is the tab's shape and keeps the player's wash as set", async () => {
  const r = await renderBanner(await solid(600, 1200, { r: 200, g: 30, b: 50 }), { layout: "tab", ink: "white", wash: 0.2 });
  const out = await sharp(await readRender(r.src)).metadata();
  assert.deepEqual([out.width, out.height], TAB_PX);
  assert.equal(r.wash, 0.2);
  assert.equal(r.layout, "tab");
});

test("junk names never read from disk", async () => {
  assert.equal(await readRender("../../package.json"), null);
  assert.equal(await readRender("nothere00000000000000000000000000.webp"), null);
});

test.after(() => rmSync(dir, { recursive: true, force: true }));
