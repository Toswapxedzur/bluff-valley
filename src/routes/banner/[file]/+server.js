// A rendered banner (a player's picture, cropped and washed — $lib/server/banners.js). Named by its
// content hash, so it never changes: browsers keep it for a year.
import { error } from "@sveltejs/kit";
import { readRender } from "$lib/server/banners.js";

export async function GET({ params }) {
  const buf = await readRender(params.file);
  if (!buf) throw error(404, "Not found.");
  return new Response(buf, {
    headers: {
      "content-type": "image/webp",
      "cache-control": "public, max-age=31536000, immutable",
      "x-content-type-options": "nosniff"
    }
  });
}
