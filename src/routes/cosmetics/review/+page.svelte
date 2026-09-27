<script>
  import { enhance } from "$app/forms";
  import { SITE_NAME } from "$lib/config.js";
  import { bannerUrl } from "$lib/banner.js";

  let { data, form } = $props();
  const when = (ms) => new Date(Number(ms)).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  const STATUS = { live: "Live", none: "Taken off by the player", removed: "Removed by an admin" };
</script>

<svelte:head><title>Banner review — {SITE_NAME}</title></svelte:head>

<div class="wrap">
  <div class="head">
    <h1>Banner review</h1>
    <a class="muted" href="/cosmetics">Back to Cosmetics</a>
  </div>
  <p class="muted intro">Every banner, newest first. Banners go live as soon as a player saves them. Reports land in the queue on your Account page.</p>
  {#if form?.error}<p class="err" role="alert">{form.error}</p>{/if}

  {#if data.banners.length === 0}
    <p class="muted">No banners yet.</p>
  {:else}
    <div class="list">
      {#each data.banners as b (b.user_id)}
        <div class="item" class:off={b.status !== "live"}>
          <img class="pic" class:tab={b.layout === "tab"} src={bannerUrl(b.src)} alt="Banner by {b.name || b.email}" loading="lazy" />
          <div class="meta">
            <a class="who" href="/u/{b.user_id}">{b.name || b.email}</a>
            <span class="muted small">{STATUS[b.status] || b.status} · {b.layout === "tab" ? "End tab" : "Whole plate"} · {when(b.updated_at)}{#if Number(b.banned)} · <b class="bad">barred from uploading</b>{/if}</span>
            {#if b.file_id}<a class="small" href="/banner/master/{b.file_id}" target="_blank" rel="noopener">Full picture</a>{/if}
          </div>
          <div class="acts">
            {#if b.status === "live"}
              <form method="POST" action="?/remove" use:enhance><input type="hidden" name="userId" value={b.user_id} /><button class="btn btn-sm btn-secondary">Remove</button></form>
            {/if}
            {#if Number(b.banned)}
              <form method="POST" action="?/unban" use:enhance><input type="hidden" name="userId" value={b.user_id} /><button class="btn btn-sm btn-secondary">Lift bar</button></form>
            {:else}
              <form method="POST" action="?/ban" use:enhance><input type="hidden" name="userId" value={b.user_id} /><button class="btn btn-sm danger">Remove and bar</button></form>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .wrap { max-width: 820px; margin: 0 auto; }
  .head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
  h1 { margin: 0; font-size: 26px; }
  .intro { margin: 6px 0 18px; }
  .small { font-size: 12.5px; }
  .err { color: var(--danger); font-weight: 600; }
  .list { display: flex; flex-direction: column; gap: 10px; }
  .item { display: flex; align-items: center; gap: 14px; padding: 10px 12px; background: var(--surface); border-radius: var(--r-card); box-shadow: var(--shadow-card); flex-wrap: wrap; }
  .item.off { opacity: 0.6; }
  .pic { width: 246px; height: 69px; border-radius: 10px; object-fit: cover; background: var(--well); flex: none; }
  .pic.tab { width: 48px; height: 70px; }
  .meta { display: flex; flex-direction: column; gap: 3px; min-width: 0; flex: 1; }
  .who { font-weight: 700; color: var(--text); text-decoration: none; }
  .bad { color: var(--danger); }
  .acts { display: flex; gap: 8px; flex-wrap: wrap; }
  .acts form { margin: 0; }
  .danger { background: var(--danger); color: #fff; }
</style>
