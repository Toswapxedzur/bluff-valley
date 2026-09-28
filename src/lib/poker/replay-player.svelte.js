// Plays a replay's table views (replay-views.js) through the shared TableStage — the /replay page
// and a live table's "Watch last hand" both use one of these (owner, 2026-09-28).
//   forward (▶|, play)            → the next view: the stage animates it, like live play
//   back / start / end / scrub    → a JUMP: `jump` bumps, the page re-mounts the stage on that view,
//                                   so nothing animates on the way (the engines baseline on it)
//   speed 1× / 2× / 4×            → only the pause between steps; animations keep their timing
// A full-screen moment playing on the stage holds the next step until it's done.
export const SPEEDS = [1, 2, 4];
const MIN_GAP = 450;   // ms: the least time between two steps, at any speed

export class ReplayPlayer {
  i = $state(0);
  jump = $state(0);
  playing = $state(false);
  speed = $state(1);
  motion = null;       // the stage's motion (TableStage onMotion)

  constructor(data) {
    this.data = data;
    this.steps = data.steps || [];
    this.last = Math.max(0, this.steps.length - 1);
    this._timer = null;
  }

  get view() { return this.steps[this.i]?.view ?? null; }
  get privates() { return this.data.privates?.[this.i] ?? null; }
  get text() { return this.steps[this.i]?.text ?? ""; }

  jumpTo(n) {
    this.playing = false;
    this.i = Math.max(0, Math.min(this.last, n));
    this.jump += 1;
  }
  forward() {
    if (this.i >= this.last) { this.playing = false; return; }
    this.i += 1;
  }
  step() { this.playing = false; this.forward(); }
  back() { this.jumpTo(this.i - 1); }
  toggle() {
    if (this.playing) { this.playing = false; return; }
    if (this.i >= this.last) this.jumpTo(0);
    this.playing = true;
  }

  /** Run the clock (call inside an $effect: it re-arms on every step / speed / play change). */
  run() {
    const on = this.playing, at = this.i, sp = this.speed;
    clearTimeout(this._timer);
    if (!on) return;
    if (at >= this.last) { this.playing = false; return; }
    const gap = Math.max(MIN_GAP, (this.steps[at + 1].t - this.steps[at].t) / sp);
    const tick = () => {
      if (!this.playing) return;
      if (this.motion?.moment) { this._timer = setTimeout(tick, 150); return; }
      this.forward();
    };
    this._timer = setTimeout(tick, gap);
    return () => clearTimeout(this._timer);
  }
  stop() { this.playing = false; clearTimeout(this._timer); }

  /** Keyboard: ← → space Home End. Returns true when it used the key. */
  key(e) {
    if (e.target?.closest?.("input, textarea, select, [contenteditable], [role=slider]")) return false;
    if (e.key === "ArrowRight") this.step();
    else if (e.key === "ArrowLeft") this.back();
    else if (e.key === " ") this.toggle();
    else if (e.key === "Home") this.jumpTo(0);
    else if (e.key === "End") this.jumpTo(this.last);
    else return false;
    e.preventDefault();
    return true;
  }
}
