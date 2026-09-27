// Banners on the server (owner, 2026-09-27): a player uploads a picture, crops it in the editor on
// /cosmetics, and it goes live on their seat plate at once. The owner reviews afterwards (the
// admin gallery on /cosmetics/review + the report queue on /account) and can take one down or bar a
// player from uploading. Shared settings, crop maths and the readability rule: $lib/banner.js.
//
// Files live on the app's own disk, never OSS: BANNER_DIR (default var/banners — on the live box it
// points OUTSIDE the deploy folder, so a deploy's rsync --delete can never wipe them):
//   m/<hash>.webp  master pictures (≤ 1600 px, re-encoded, hidden data stripped) — kept after a removal
//   r/<hash>.webp  rendered banners (crop + wash baked in) — what plates draw; named by content, so a
//                  browser may cache them forever
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import sharp from "sharp";
import { query, queryOne, execute } from "./db.js";
import {
  normalize, cropBox, inkHex, PLATE_ASPECT, TAB_ASPECT, PLATE_PX, TAB_PX,
  regionLums, inksFor, washRgb, isRenderName
} from "../banner.js";

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;   // owner-approved default
export const UPLOADS_PER_DAY = 10;                 // owner-approved default
const MASTER_MAX = 1600;
const LIMIT_PIXELS = 40_000_000;                   // a decompression bomb stops here
const FORMATS = new Set(["jpeg", "png", "webp", "gif"]);
const BACKDROP = "#3e3a31";                        // transparent pictures sit on the chess charcoal
const DAY = 24 * 60 * 60 * 1000;

const dir = () => resolve(process.env.BANNER_DIR || "var/banners");
const hash = (buf) => createHash("sha256").update(buf).digest("hex").slice(0, 32);
const isId = (s) => typeof s === "string" && /^[a-f0-9]{32}$/.test(s);

async function put(sub, name, buf) {
  const d = join(dir(), sub);
  await mkdir(d, { recursive: true });
  await writeFile(join(d, name), buf);
}

/** A rendered banner's bytes (for /banner/<name>), or null. */
export async function readRender(name) {
  if (!isRenderName(name)) return null;
  try { return await readFile(join(dir(), "r", name)); } catch { return null; }
}
/** A master picture's bytes, or null. */
export async function readMaster(fileId) {
  if (!isId(fileId)) return null;
  try { return await readFile(join(dir(), "m", `${fileId}.webp`)); } catch { return null; }
}
/** Did `userId` upload `fileId`? */
export async function ownsFile(userId, fileId) {
  if (!isId(fileId)) return false;
  return !!(await queryOne("SELECT 1 AS ok FROM banner_file WHERE id = ? AND user_id = ?", [fileId, userId]));
}

async function isBanned(userId) {
  const r = await queryOne("SELECT banned FROM banner WHERE user_id = ?", [userId]);
  return !!(r && Number(r.banned));
}
async function uploadsToday(userId) {
  const r = await queryOne("SELECT COUNT(*) AS n FROM banner_file WHERE user_id = ? AND created_at > ?", [userId, Date.now() - DAY]);
  return Number(r?.n) || 0;
}

/** Take an uploaded picture: check it, re-encode it as the master, remember who sent it.
 *  → { file: { id, w, h } } | { error } */
export async function ingest(userId, buf) {
  if (!buf || !buf.length) return { error: "Choose a picture first." };
  if (buf.length > MAX_UPLOAD_BYTES) return { error: "That picture is over 5 MB." };
  if (await isBanned(userId)) return { error: "You can't upload banners." };
  if ((await uploadsToday(userId)) >= UPLOADS_PER_DAY) return { error: `That's ${UPLOADS_PER_DAY} uploads today. Try again tomorrow.` };
  let meta;
  try { meta = await sharp(buf, { limitInputPixels: LIMIT_PIXELS }).metadata(); } catch { return { error: "That file isn't a picture we can read." }; }
  if (!FORMATS.has(meta.format)) return { error: "Use a PNG, JPG, WebP or GIF." };
  if ((meta.width || 0) < 32 || (meta.height || 0) < 32) return { error: "That picture is too small." };
  let out;
  try {
    // rotate() applies the camera's orientation; sharp drops EXIF / GPS / ICC unless asked to keep them;
    // a GIF or animated WebP keeps its first frame only
    out = await sharp(buf, { limitInputPixels: LIMIT_PIXELS, animated: false })
      .rotate()
      .resize(MASTER_MAX, MASTER_MAX, { fit: "inside", withoutEnlargement: true })
      .flatten({ background: BACKDROP })
      .webp({ quality: 90 })
      .toBuffer({ resolveWithObject: true });
  } catch { return { error: "That picture couldn't be processed." }; }
  const id = hash(out.data);
  await put("m", `${id}.webp`, out.data);
  await execute(
    "INSERT IGNORE INTO banner_file (id, user_id, w, h, bytes, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    [id, userId, out.info.width, out.info.height, out.data.length, Date.now()]
  );
  return { file: { id, w: out.info.width, h: out.info.height } };
}

/** Cut a banner from a master: crop, the player's own wash (never more), encode.
 *  → { src, layout, ink, sub, money, wash } */
export async function renderBanner(master, settingsIn) {
  const s = normalize(settingsIn);
  const plate = s.layout === "plate";
  const [W, H] = plate ? PLATE_PX : TAB_PX;
  const meta = await sharp(master).metadata();
  const box = cropBox(meta.width, meta.height, plate ? PLATE_ASPECT : TAB_ASPECT, s);
  const { data } = await sharp(master).extract(box).resize(W, H, { fit: "fill" }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const ink = inkHex(s.ink);
  // the picture keeps its brightness: only the player's wash, exactly as set (owner, 2026-09-27)
  const wash = s.wash;
  const inks = plate ? inksFor(regionLums(data, W, H, 3), ink, wash) : { ink, sub: null, money: null };
  if (wash > 0) {
    const w = washRgb(ink);
    for (let i = 0; i < data.length; i += 3) for (let c = 0; c < 3; c++) data[i + c] = Math.round(data[i + c] + (w[c] - data[i + c]) * wash);
  }
  const webp = await sharp(data, { raw: { width: W, height: H, channels: 3 } }).webp({ quality: 86 }).toBuffer();
  const src = `${hash(webp)}.webp`;
  await put("r", src, webp);
  return { src, layout: s.layout, ...inks, wash, settings: s };
}

/** Save `userId`'s banner from one of their masters; it is live at once. → the wire banner | { error } */
export async function saveBanner(userId, fileId, settingsIn) {
  if (await isBanned(userId)) return { error: "You can't upload banners." };
  if (!(await ownsFile(userId, fileId))) return { error: "Upload a picture first." };
  const master = await readMaster(fileId);
  if (!master) return { error: "That picture is gone. Upload it again." };
  let r;
  try { r = await renderBanner(master, settingsIn); } catch { return { error: "That banner couldn't be made." }; }
  await execute(
    `INSERT INTO banner (user_id, file_id, settings, src, layout, ink, sub, money, wash, status, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'live', ?)
     ON DUPLICATE KEY UPDATE file_id = VALUES(file_id), settings = VALUES(settings), src = VALUES(src),
       layout = VALUES(layout), ink = VALUES(ink), sub = VALUES(sub), money = VALUES(money),
       wash = VALUES(wash), status = 'live', updated_at = VALUES(updated_at)`,
    [userId, fileId, JSON.stringify({ ...r.settings, wash: r.settings.wash }), r.src, r.layout, r.ink, r.sub, r.money, r.wash, Date.now()]
  );
  return { banner: wire({ src: r.src, layout: r.layout, ink: r.ink, sub: r.sub, money: r.money }), wash: r.wash, settings: r.settings };
}

/** The player takes their banner off (the master stays, so they can put it back). */
export async function clearBanner(userId) {
  await execute("UPDATE banner SET status = 'none', updated_at = ? WHERE user_id = ? AND status = 'live'", [Date.now(), userId]);
}

/** An admin takes a banner down (and, with `ban`, bars the player from uploading). */
export async function adminRemove(userId, { ban = false } = {}) {
  const now = Date.now();
  await execute(
    `INSERT INTO banner (user_id, status, banned, updated_at) VALUES (?, 'removed', ?, ?)
     ON DUPLICATE KEY UPDATE status = IF(status = 'live', 'removed', status), banned = GREATEST(banned, VALUES(banned)), updated_at = VALUES(updated_at)`,
    [userId, ban ? 1 : 0, now]
  );
}
export async function setBanned(userId, on) {
  await execute(
    "INSERT INTO banner (user_id, banned, updated_at) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE banned = VALUES(banned)",
    [userId, on ? 1 : 0, Date.now()]
  );
}

// the compact form every seat carries
const wire = (r) => ({ l: r.layout === "tab" ? "tab" : "plate", src: r.src, ink: r.ink || null, sub: r.sub || null, money: r.money || null });

/** Live banners for many players at once: id → { l, src, ink, sub, money }. */
export async function bannersFor(userIds) {
  const ids = [...new Set((userIds || []).filter(Boolean))];
  if (!ids.length) return new Map();
  const rows = await query(
    `SELECT user_id, src, layout, ink, sub, money FROM banner WHERE status = 'live' AND src IS NOT NULL AND user_id IN (${ids.map(() => "?").join(",")})`,
    ids
  );
  return new Map(rows.map((r) => [r.user_id, wire(r)]));
}

/** Everything the editor needs about a player's banner. */
export async function bannerState(userId) {
  const r = await queryOne("SELECT file_id, settings, src, layout, ink, sub, money, wash, status, banned FROM banner WHERE user_id = ?", [userId]);
  let settings = null;
  try { settings = r?.settings ? normalize(JSON.parse(r.settings)) : null; } catch { settings = null; }
  return {
    live: r?.status === "live" && r.src ? wire(r) : null,
    removed: r?.status === "removed",
    banned: !!Number(r?.banned || 0),
    fileId: r?.file_id || null,
    settings,
    wash: r ? Number(r.wash) : 0,
    uploadsLeft: Math.max(0, UPLOADS_PER_DAY - (await uploadsToday(userId)))
  };
}

/** The admin gallery: every banner, newest first. */
export async function recentBanners(limit = 120) {
  return query(
    `SELECT b.user_id, b.src, b.layout, b.status, b.banned, b.updated_at, b.file_id,
            u.display_name AS name, u.email
       FROM banner b JOIN user u ON u.id = b.user_id
      WHERE b.src IS NOT NULL
      ORDER BY b.updated_at DESC LIMIT ?`,
    [limit]
  );
}
