// Plays a whole TABLE VISIT as one continuous replay (owner, 2026-09-28: "the replay will be divided
// into individual games… a marker on the slider"): every game of the visit, one after another, on the
// shared TableStage, the way the table actually went — a game's result, then the next deal.
//   the timeline = game 1's steps (with its "before the deal"), then each next game from its deal on
//                  (the previous result is its "before"); a marker on the slider at every game's deal
//   the views load a few games at a time around the playhead (/api/history/steps), so a long visit
//   opens at once; until a game's views arrive the sheet shows "Loading…"
//   the same controls as ReplayPlayer (ReplayBar drives either): forward animates, a jump re-mounts
//   the stage, speed only changes the pause (a replay plays no full-screen moments: its big moments
//   are gold marks on the slider — owner, 2026-09-29). ⏮ ⏭ here go
//   to the previous / next game.
const MIN_GAP = 450;          // ms: the least time between two steps, at any speed
const BETWEEN_GAMES = 1500;   // ms at 1×: a game's result → the next deal
const AHEAD = 2, BEHIND = 1;  // games kept loaded around the one playing

export class VisitPlayer {
  i = $state(0);
  jump = $state(0);
  playing = $state(false);
  speed = $state(1);
  loaded = $state(0);         // bumps when a batch of games arrives
  motion = null;

  constructor(visit, fetchSteps = defaultFetch) {
    this.visit = visit;
    this.fetchSteps = fetchSteps;
    let off = 0;
    this.games = (visit.games || []).map((g, k) => {
      const own = Math.max(3, g.steps ?? 3);
      const count = k === 0 ? own : own - 1;              // later games start at their deal
      const r = { ...g, k, offset: off, count, skip: k === 0 ? 0 : 1 };
      off += count;
      return r;
    });
    this.total = off;
    this.last = Math.max(0, off - 1);
    this.cache = new Map();                                // replayId → { views, privates, steps, viewerId } | { missing }
    this.pending = new Set();
    this._timer = null;
    this.gameMarks = this.games.map((g) => ({
      at: g.offset + (g.k === 0 ? 1 : 0),
      label: `Game ${g.k + 1}${g.handNo ? ` (#${g.handNo})` : ""} · ${g.net > 0 ? `you won ${g.net.toLocaleString("en-US")}` : g.net < 0 ? `you lost ${(-g.net).toLocaleString("en-US")}` : "even"}`
    }));
    // a game's big moment (the visit's API names it): a gold mark at that game's result
    this.marks = [...this.gameMarks, ...this.games.filter((g) => g.moment).map((g) => ({ at: g.offset + g.count - 1, label: `Game ${g.k + 1} · ${g.moment}`, kind: "moment" }))];
  }

  gameAt(n) {
    let lo = 0, hi = this.games.length - 1;
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (this.games[mid].offset <= n) lo = mid; else hi = mid - 1; }
    return this.games[lo];
  }
  _local(g, n) { return n - g.offset + g.skip; }
  _chunk(g) { void this.loaded; return g ? this.cache.get(g.replayId) : null; }

  get game() { return this.games.length ? this.gameAt(this.i) : null; }
  get ready() { const c = this._chunk(this.game); return !!c && !c.missing; }
  get missing() { return !!this._chunk(this.game)?.missing; }
  get view() { const g = this.game, c = this._chunk(g); return c && !c.missing ? c.views[this._local(g, this.i)] ?? null : null; }
  get privates() { const g = this.game, c = this._chunk(g); return c && !c.missing ? c.privates?.[this._local(g, this.i)] ?? null : null; }
  get me() { const c = this._chunk(this.game); return c?.viewerId ? { id: c.viewerId } : null; }
  get text() {
    const g = this.game;
    if (!g) return "";
    const c = this._chunk(g);
    const t = c?.missing ? "can't be replayed" : c ? c.steps[this._local(g, this.i)]?.text : "loading…";
    return `Game ${g.k + 1} · ${t ?? ""}`;
  }

  /** Load the games around the playhead that aren't loaded yet. */
  ensure(around = this.i) {
    if (!this.games.length) return;
    const k = this.gameAt(around).k;
    const want = this.games.slice(Math.max(0, k - BEHIND), k + AHEAD + 1).filter((g) => !this.cache.has(g.replayId) && !this.pending.has(g.replayId));
    if (!want.length) return;
    for (const g of want) this.pending.add(g.replayId);
    this.fetchSteps(want.map((g) => g.replayId)).then((list) => {
      for (const d of list || []) {
        this.pending.delete(d.id);
        if (d.missing || !d.steps) { this.cache.set(d.id, { missing: true }); continue; }
        // one table id per real table, so the motion engines carry on from game to game (a Sprint's
        // move to another table is a new table to them, as it was live)
        const vid = `visit-${d.tableId ?? d.id}`;
        this.cache.set(d.id, { steps: d.steps, privates: d.privates, viewerId: d.viewerId, views: d.steps.map((s) => ({ ...s.view, id: vid })) });
      }
      for (const g of want) if (this.pending.delete(g.replayId)) this.cache.set(g.replayId, { missing: true });
      this.loaded += 1;
    }).catch(() => { for (const g of want) this.pending.delete(g.replayId); });
  }

  jumpTo(n) {
    this.playing = false;
    this.i = Math.max(0, Math.min(this.last, n));
    this.jump += 1;
    this.ensure();
  }
  forward() {
    if (this.i >= this.last) { this.playing = false; return; }
    this.i += 1;
    this.ensure();
  }
  step() { this.playing = false; this.forward(); }
  back() { this.jumpTo(this.i - 1); }
  toggle() {
    if (this.playing) { this.playing = false; return; }
    if (this.i >= this.last) this.jumpTo(0);
    this.playing = true;
  }
  /** ⏮: to the start of this game (or the previous one when already at its start). */
  prevGame() {
    const g = this.game; if (!g) return;
    const start = this.gameMarks[g.k].at;
    this.jumpTo(this.i > start || g.k === 0 ? start : this.gameMarks[g.k - 1].at);
  }
  /** ⏭: to the next game's deal (or the very end on the last game). */
  nextGame() {
    const g = this.game; if (!g) return;
    this.jumpTo(g.k + 1 < this.games.length ? this.gameMarks[g.k + 1].at : this.last);
  }
  get atFirst() { return this.i <= (this.gameMarks[0]?.at ?? 0); }
  get atLast() { return this.i >= this.last; }

  /** The clock (call inside an $effect). */
  run() {
    const on = this.playing, at = this.i, sp = this.speed;
    void this.loaded;
    clearTimeout(this._timer);
    if (!on) return;
    if (at >= this.last) { this.playing = false; return; }
    const g = this.gameAt(at), next = this.gameAt(at + 1), c = this._chunk(g), cn = this._chunk(next);
    // the next game's views haven't arrived: wait for them (run() re-arms when they do)
    if (!cn) { this.ensure(at + 1); return; }
    let gap;
    if (c?.missing || cn.missing) gap = 1200;
    else if (next === g) gap = (c.steps[this._local(g, at + 1)].t - c.steps[this._local(g, at)].t) / sp;
    else gap = BETWEEN_GAMES / sp;
    const tick = () => {
      if (!this.playing) return;
      this.forward();
    };
    this._timer = setTimeout(tick, Math.max(MIN_GAP, gap));
    return () => clearTimeout(this._timer);
  }
  stop() { this.playing = false; clearTimeout(this._timer); }

  /** Keyboard: ← → one step, space play / pause, Home / End the visit's ends, PageUp / PageDown a game. */
  key(e) {
    if (e.target?.closest?.("input, textarea, select, [contenteditable], [role=slider]")) return false;
    if (e.key === "ArrowRight") this.step();
    else if (e.key === "ArrowLeft") this.back();
    else if (e.key === " ") this.toggle();
    else if (e.key === "Home") this.jumpTo(0);
    else if (e.key === "End") this.jumpTo(this.last);
    else if (e.key === "PageUp") this.prevGame();
    else if (e.key === "PageDown") this.nextGame();
    else return false;
    e.preventDefault();
    return true;
  }
}

async function defaultFetch(ids) {
  const r = await fetch(`/api/history/steps?ids=${ids.map(encodeURIComponent).join(",")}`);
  if (!r.ok) throw new Error("steps");
  return r.json();
}
