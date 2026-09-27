<script>
  // The bet games' resolve in the middle of the table (timings: resolve-anim.js): Roulette's wheel
  // spins and the ball drops into the pocket, Sic Bo's three dice tumble in, the Slots' reels stop
  // left to right. Drawn in the chess palette with the icons' upper-left light (design/moments).
  // Keyed by the round, so each result plays once; under reduced motion it simply shows the result.
  import { onMount } from "svelte";
  import { RESOLVE } from "$lib/poker/resolve-anim.js";
  import { reducedMotion } from "$lib/motion.js";
  import { WHEEL, STEP, pocketFill, wheelSvg, dieSvg, symSvg, FILL } from "$lib/poker/resolve-art.js";

  let { game, outcome } = $props();
  let root;

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
