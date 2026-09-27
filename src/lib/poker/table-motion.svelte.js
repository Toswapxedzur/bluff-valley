// The table's moving parts, one of each per table: the Dealer (cards dealt / shuffled on the
// DeckLayer, flop poker — see deal-anim.js) and the Bank (coins on the MoneyLayer, every game — see
// bank.svelte.js). Both turn view changes into flights; the DOM hands / board / badges read them to
// know what is still in the air. Call tableMotion(src) once while the page component initialises;
// src is a live getter object { view, mySeatNo, privates }. The badges and pots find the Bank through
// the "bank" context.
import { untrack, setContext } from "svelte";
import { Dealer } from "./dealer.svelte.js";
import { Bank, moneyKind } from "./bank.svelte.js";
import { animatesTable } from "./deal-anim.js";
import { CardMotion } from "./card-motion.js";
import { tableLayout } from "./games.js";
import { detectMoment } from "./moments.js";
import { reducedMotion } from "$lib/motion.js";

class TableMotion {
  dealer = $state(null);
  bank = $state(null);
  cards = $state(null);     // the other card games' motion (CardLayer): not Hold'em, which has the dealer
  cardShuffling = $state(false);   // CardLayer is playing a shuffle: the table blurs behind it
  moment = $state(null);    // a full-screen moment playing (moments.js): { kind, ms, id, ... }
}

export function tableMotion(src) {
  const m = new TableMotion();
  setContext("bank", { get current() { return m.bank; } });

  let dealerFor = null, dealerPrev = null;
  $effect(() => {
    const v = src.view;
    const on = animatesTable(v) && !reducedMotion();
    untrack(() => {
      if (!on) { m.dealer = null; dealerFor = null; dealerPrev = null; return; }
      if (dealerFor !== v.id || !m.dealer) {
        m.dealer = new Dealer({ variant: v.config.variant, mySeat: src.mySeatNo });
        m.dealer.init(v);
        dealerFor = v.id; dealerPrev = v;
        return;
      }
      m.dealer.mySeat = src.mySeatNo;
      const prev = dealerPrev; dealerPrev = v;
      if (prev !== v) m.dealer.onView(prev, v, src.privates);
    });
  });

  $effect(() => {
    const v = src.view;
    const on = !!v && !reducedMotion() && tableLayout(v.game || v.config?.variant) !== "poker";
    untrack(() => {
      if (!on) { m.cards = null; m.cardShuffling = false; return; }
      if (!m.cards) m.cards = new CardMotion();
      m.cards.onView(v);
    });
  });

  // a hand / round just ended on a big event: its full-screen moment (everyone at the table at once)
  let momentPrev = null;
  $effect(() => {
    const v = src.view;
    untrack(() => {
      const prev = momentPrev;
      momentPrev = v;
      if (!v || !prev || prev.id !== v.id || reducedMotion() || prev.result || !v.result) return;
      const mo = detectMoment(v);
      if (!mo) return;
      const id = `${v.id}:${v.handNo}`;
      m.moment = { ...mo, id };
      setTimeout(() => { if (m.moment?.id === id) m.moment = null; }, mo.ms + 60);
    });
  });

  let bankFor = null, bankPrev = null;
  $effect(() => {
    const v = src.view;
    const kind = v && !reducedMotion() ? moneyKind(v) : null;
    untrack(() => {
      if (!kind) { m.bank = null; bankFor = null; bankPrev = null; return; }
      if (bankFor !== v.id || !m.bank || m.bank.kind !== kind) {
        m.bank = new Bank(kind);
        m.bank.init(v);
        bankFor = v.id; bankPrev = v;
        return;
      }
      const prev = bankPrev; bankPrev = v;
      if (prev !== v) m.bank.onView(prev, v);
    });
  });

  return m;
}
