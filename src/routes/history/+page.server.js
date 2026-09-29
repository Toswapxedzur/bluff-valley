// /history → your own history page (/history/<you>). (The old timeline page — visits mixed with
// rewards, transfers and friends — was folded into the per-player history, owner 2026-09-29.)
import { redirect } from "@sveltejs/kit";

export function load({ locals, url }) {
  if (!locals.user) throw redirect(303, "/account/login");
  throw redirect(303, `/history/${encodeURIComponent(locals.user.id)}${url.search}`);
}
