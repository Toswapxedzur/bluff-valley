<script>
  // A player's table visits with the visit sheet (owner, 2026-09-29): the list, and the near-full-screen
  // replay of whichever visit is open. The open visit lives in the URL (?visit=…, shallow routing), so
  // Back closes it and it can be linked. Used by a player's history page (/history/[id]) and Settings'
  // "Your history".
  import { goto, pushState } from "$app/navigation";
  import { page } from "$app/stores";
  import VisitList from "$lib/components/VisitList.svelte";
  import VisitSheet from "$lib/poker/components/VisitSheet.svelte";

  let { visits = [], playerId = null, empty = "No table visits in this window." } = $props();

  const openVisit = $derived($page.state?.visit ?? $page.url.searchParams.get("visit"));
  function show(id) {
    const u = new URL($page.url);
    u.searchParams.set("visit", id);
    pushState(u.pathname + u.search, { visit: id });
  }
  function close() {
    if ($page.state?.visit) { history.back(); return; }
    const u = new URL($page.url);
    u.searchParams.delete("visit");
    goto(u.pathname + u.search, { replaceState: true, noScroll: true, keepFocus: true });
  }
</script>

<VisitList {visits} {empty} onOpen={show} />

{#if openVisit}
  {#key openVisit}<VisitSheet visitId={openVisit} player={playerId} onClose={close} />{/key}
{/if}
