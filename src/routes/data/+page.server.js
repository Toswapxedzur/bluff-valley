// The Data page is gone (owner, 2026-09-29): a player's history is its own page now (/history/<id>,
// from the History button on their profile popup), and Ranks were dropped. Old links land there.
import { redirect } from "@sveltejs/kit";

export function load({ url }) {
  const u = url.searchParams.get("u");
  throw redirect(301, u ? `/history/${encodeURIComponent(u)}` : "/history");
}
