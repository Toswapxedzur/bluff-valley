// The all-in run-out's win chances (the full-screen all-in showdown shows them after every street):
// for each stage of the board from where everyone went all-in to the river, each player's share of the
// pot-winning outcomes — exact over every remaining card from the flop on, sampled before it (too many).
import { RANKS, SUITS } from "./cards.js";
import { bestHand, compareRank } from "./evaluator.js";

const DECK = [...RANKS].flatMap((r) => [...SUITS].map((s) => r + s));
const SAMPLES = 2000;

/** Each player's chance (0..100) with `board` known: hands = [{ seat, holeCards }]. */
export function equities(hands, board, rand = Math.random) {
  const used = new Set([...board, ...hands.flatMap((h) => h.holeCards)]);
  const rest = DECK.filter((c) => !used.has(c)), need = 5 - board.length;
  const score = new Map(hands.map((h) => [h.seat, 0]));
  let runs = 0;
  const judge = (full) => {
    const ranks = hands.map((h) => ({ seat: h.seat, r: bestHand([...h.holeCards, ...full]) }));
    let best = ranks[0].r;
    for (const x of ranks) if (compareRank(x.r, best) > 0) best = x.r;
    const top = ranks.filter((x) => compareRank(x.r, best) === 0);
    for (const x of top) score.set(x.seat, score.get(x.seat) + 1 / top.length);
    runs++;
  };
  if (need === 0) judge(board);
  else if (need === 1) for (const a of rest) judge([...board, a]);
  else if (need === 2) for (let i = 0; i < rest.length; i++) for (let j = i + 1; j < rest.length; j++) judge([...board, rest[i], rest[j]]);
  else for (let k = 0; k < SAMPLES; k++) {
    const pick = rest.slice();
    for (let i = 0; i < need; i++) { const j = i + Math.floor(rand() * (pick.length - i)); [pick[i], pick[j]] = [pick[j], pick[i]]; }
    judge([...board, ...pick.slice(0, need)]);
  }
  return Object.fromEntries([...score].map(([s, v]) => [s, Math.round((v / runs) * 100)]));
}

/** The run-out: { from (board cards when all-in), stages: [{ board: n, pct: { seat: % } }] } up to the river. */
export function runoutOf(hands, board, from) {
  const stages = [];
  for (const n of [from, 3, 4, 5].filter((n, i, a) => n >= from && a.indexOf(n) === i)) stages.push({ board: n, pct: equities(hands, board.slice(0, n)) });
  return { from, stages };
}
