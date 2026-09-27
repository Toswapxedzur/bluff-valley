<script>
  // The bet games' resolve in the middle of the table (timings: resolve-anim.js): Roulette's wheel
  // spins and the ball drops into the pocket, Sic Bo's three dice tumble in, the Slots' reels stop
  // left to right. Drawn in the chess palette with the icons' upper-left light (design/moments).
  // Keyed by the round, so each result plays once; under reduced motion it simply shows the result.
  import { onMount } from "svelte";
  import { RESOLVE } from "$lib/poker/resolve-anim.js";
  import { reducedMotion } from "$lib/motion.js";

  let { game, outcome } = $props();
  let root;

  const C = { ebony: "#1C1A15", charcoal: "#3E3A31", gray: "#6E685B", white: "#FBF8EF", cream: "#F1E9D3", ivory: "#E1D3AD" };

  // ---- roulette: the European wheel
  const WHEEL = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
  const RED = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
  const pocketFill = (n) => (n === 0 ? "#2f7d57" : RED.has(n) ? "#b43a3a" : C.ebony);
  const STEP = 360 / 37;
  function wheelSvg() {
    const R = 150, rad = (deg) => ((deg - 90) * Math.PI) / 180, p = (a, r) => `${(R + r * Math.cos(a)).toFixed(1)},${(R + r * Math.sin(a)).toFixed(1)}`;
    const wedges = WHEEL.map((n, i) => { const a0 = rad(i * STEP - STEP / 2), a1 = rad(i * STEP + STEP / 2); return `<polygon points="${p(a0, 144)} ${p(a1, 144)} ${p(a1, 96)} ${p(a0, 96)}" fill="${pocketFill(n)}"/>`; }).join("");
    return `<svg viewBox="0 0 300 300" width="100%" height="100%"><circle cx="150" cy="150" r="149" fill="${C.charcoal}"/>${wedges}<circle cx="150" cy="150" r="96" fill="${C.gray}"/><circle cx="150" cy="150" r="62" fill="${C.charcoal}"/><path d="M150 1a149 149 0 0 0 -105 254L150 150z" fill="#fff" opacity=".07"/><circle cx="150" cy="150" r="20" fill="${C.ivory}"/><path d="M150 130a20 20 0 0 0 -14 34L150 150z" fill="${C.white}"/></svg>`;
  }
  // ---- sic bo: dice with stepped light from the upper left
  const PIPS = { 1: [[50, 50]], 2: [[28, 28], [72, 72]], 3: [[26, 26], [50, 50], [74, 74]], 4: [[28, 28], [72, 28], [28, 72], [72, 72]], 5: [[26, 26], [74, 26], [50, 50], [26, 74], [74, 74]], 6: [[28, 24], [72, 24], [28, 50], [72, 50], [28, 76], [72, 76]] };
  const dieSvg = (n) => `<svg viewBox="0 0 100 100" width="100%" height="100%"><rect x="2" y="2" width="96" height="96" rx="22" fill="${C.ivory}"/><path d="M24 2h52a22 22 0 0 1 22 22v0L2 98V24A22 22 0 0 1 24 2z" fill="${C.cream}"/><path d="M24 2h40L2 64V24A22 22 0 0 1 24 2z" fill="${C.white}"/>${PIPS[n].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="9.5" fill="${C.ebony}"/>`).join("")}</svg>`;
  // ---- slots: plain chunky shapes (placeholders until the slot art is designed)
  const SYM = {
    diamond: `<polygon points="40,8 70,34 40,72" fill="#1f8f7c"/><polygon points="40,8 10,34 40,72" fill="#5fd9c2"/><polygon points="40,8 70,34 10,34" fill="#96f4e2" opacity=".55"/>`,
    bell: `<path d="M40 10c-14 0-22 12-22 26v14l-8 10h60l-8-10V36c0-14-8-26-22-26z" fill="${C.charcoal}"/><path d="M40 10c-14 0-22 12-22 26v14l-8 10h30z" fill="${C.gray}"/><circle cx="40" cy="66" r="7" fill="${C.ebony}"/>`,
    cherry: `<path d="M34 16l20-6 4 8-18 6 2 20h-8z" fill="${C.charcoal}"/><circle cx="28" cy="54" r="14" fill="${C.ebony}"/><circle cx="54" cy="52" r="14" fill="${C.charcoal}"/><circle cx="24" cy="50" r="5" fill="${C.gray}"/>`,
    bar: `<rect x="8" y="26" width="64" height="28" rx="8" fill="${C.charcoal}"/><path d="M16 26h56L8 54V34a8 8 0 0 1 8-8z" fill="${C.gray}"/>`,
    lemon: `<ellipse cx="40" cy="42" rx="28" ry="20" fill="${C.ivory}"/><path d="M12 42a28 20 0 0 1 56 0z" fill="${C.white}"/>`,
    seven: `<path d="M12 60l6-34 14 14 8-22 8 22 14-14 6 34z" fill="#c78f06"/><path d="M12 60l6-34 14 14 8-22v42z" fill="#f5b60d"/><rect x="12" y="60" width="56" height="8" rx="3" fill="#8f6503"/>`
  };
  const symSvg = (k) => `<svg viewBox="0 0 80 80" width="100%" height="100%">${SYM[k] || ""}</svg>`;
  const FILL = ["cherry", "lemon", "bell", "bar", "cherry", "seven", "lemon", "bell", "diamond", "bar"];

  onMount(() => {
    const quiet = reducedMotion(), anims = [];
    const A = (el, kf, o) => { if (!quiet) anims.push(el.animate(kf, { fill: "both", easing: "cubic-bezier(.22,.61,.36,1)", ...o })); };
    if (game === "roulette") {
      const R = RESOLVE.roulette, iN = WHEEL.indexOf(outcome.pocket), end = 360 * 3 - iN * STEP;
      const wh = root.querySelector(".wheel"), arm = root.querySelector(".arm"), ball = root.querySelector(".ball"), pocket = root.querySelector(".pocket");
      if (quiet) { wh.style.transform = `rotate(${end}deg)`; ball.style.transform = "translate(-50%, -72px)"; return; }
      A(wh, [{ transform: "rotate(0deg)" }, { transform: `rotate(${end}deg)` }], { duration: R.spin, easing: "cubic-bezier(.12,.6,.25,1)" });
      A(arm, [{ transform: "rotate(40deg)" }, { transform: `rotate(${-360 * 4}deg)` }], { duration: R.spin, easing: "cubic-bezier(.12,.6,.25,1)" });
      A(ball, [{ transform: "translate(-50%, -84px)", offset: 0 }, { transform: "translate(-50%, -84px)", offset: 0.7 }, { transform: "translate(-50%, -66px)", offset: 0.82 }, { transform: "translate(-50%, -76px)", offset: 0.9 }, { transform: "translate(-50%, -72px)", offset: 1 }], { duration: R.spin, easing: "linear" });
      A(pocket, [{ opacity: 0, transform: "scale(1.6)" }, { opacity: 1, transform: "scale(1)" }], { duration: 380, delay: R.pop, easing: "cubic-bezier(.3,1.45,.5,1)" });
    } else if (game === "sic-bo") {
      const R = RESOLVE["sic-bo"];
      root.querySelectorAll(".die").forEach((d, i) => {
        if (quiet) return;
        const x0 = -260 - i * 40, rot = 540 + i * 200;
        A(d, [{ transform: `translate(${x0}px, -90px) rotate(${-rot}deg)`, opacity: 0, offset: 0 }, { transform: `translate(${x0 * 0.45}px, 20px) rotate(${-rot * 0.45}deg)`, opacity: 1, offset: 0.45 },
          { transform: `translate(${x0 * 0.15}px, -26px) rotate(${-rot * 0.15}deg)`, offset: 0.72 }, { transform: "translate(0,0) rotate(0deg)", offset: 1 }],
          { duration: R.tumble, delay: i * R.every, easing: "cubic-bezier(.2,.6,.35,1)" });
        // tumbling faces, then the real one as it settles
        let k = 0;
        const id = setInterval(() => { d.innerHTML = dieSvg(1 + ((k++ * 5 + i * 2) % 6)); }, 90);
        setTimeout(() => { clearInterval(id); d.innerHTML = dieSvg(outcome.dice[i]); }, i * R.every + R.tumble - 60);
        anims.push({ cancel: () => clearInterval(id) });
      });
    } else if (game === "slots") {
      const R = RESOLVE.slots;
      root.querySelectorAll(".reel .strip").forEach((s, i) => {
        if (quiet) { s.style.transform = `translateY(-${(s.children.length - 1) * 100}%)`; return; }
        const n = s.children.length;
        A(s, [{ transform: "translateY(0)" }, { transform: `translateY(-${((n - 1) / n) * 100}%)` }], { duration: R.stops[i], easing: "cubic-bezier(.15,.55,.25,1.04)" });
      });
    }
    return () => anims.forEach((a) => a.cancel());
  });
</script>

<div class="resolve" bind:this={root}>
  {#if game === "roulette"}
    <div class="wheelbox"><div class="wheel">{@html wheelSvg()}</div><div class="arm"><div class="ball"></div></div></div>
    <div class="pocket" style="background:{pocketFill(outcome.pocket)}">{outcome.pocket}</div>
  {:else if game === "sic-bo"}
    {#each outcome.dice as n, i (i)}<div class="die">{@html dieSvg(n)}</div>{/each}
  {:else if game === "slots"}
    {#each outcome.reels as r, i (i)}
      <div class="reel"><div class="strip">{#each [...FILL.slice(i, i + 7), r] as k}<div class="sym">{@html symSvg(k)}</div>{/each}</div></div>
    {/each}
  {/if}
</div>

<style>
  .resolve { display: flex; align-items: center; justify-content: center; gap: 12px; }
  .wheelbox { position: relative; width: 180px; height: 180px; }
  .wheel { position: absolute; inset: 0; line-height: 0; }
  .arm { position: absolute; left: 50%; top: 50%; width: 0; height: 0; }
  .ball { position: absolute; left: 0; top: 0; width: 12px; height: 12px; margin-top: -6px; border-radius: 50%; background: #FBF8EF; box-shadow: inset -2px -2px 0 #E1D3AD, 0 2px 3px rgba(0,0,0,.4); transform: translate(-50%, -84px); }
  .pocket { width: 64px; height: 64px; border-radius: 50%; display: grid; place-items: center; color: #FBF8EF; font-family: var(--f-display); font-weight: 800; font-size: 30px; box-shadow: 0 0 0 4px #FBF8EF, 0 8px 18px rgba(0,0,0,.35); }
  .die { width: 58px; height: 58px; line-height: 0; filter: drop-shadow(0 6px 8px rgba(0,0,0,.3)); }
  .reel { position: relative; width: 70px; height: 76px; border-radius: 14px; background: #FBF8EF; overflow: hidden; box-shadow: inset 0 8px 14px rgba(0,0,0,.18); }
  .strip { position: absolute; left: 0; top: 0; width: 100%; }
  .sym { height: 76px; display: grid; place-items: center; }
  .sym :global(svg) { width: 54px; height: 54px; }
</style>
