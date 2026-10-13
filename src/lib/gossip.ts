// Rumour spreading: each round, every node that knows the news tells `fanout` random peers.
export const NODES = 32;
const rng = (seed: number) => () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
export function spread(fanout: number) {
  const r = rng(11 + fanout);
  const round = Array(NODES).fill(-1);
  round[0] = 0;
  const rounds: number[][] = [[0]];
  for (let k = 1; k < 20 && round.includes(-1); k++) {
    const knowers = round.map((v, i) => (v >= 0 && v < k ? i : -1)).filter((i) => i >= 0);
    const fresh: number[] = [];
    for (let k2 = 0; k2 < knowers.length; k2++) for (let f = 0; f < fanout; f++) { const p = Math.floor(r() * NODES); if (round[p] < 0) { round[p] = k; fresh.push(p); } }
    rounds.push(fresh);
  }
  return { round, rounds, total: rounds.length - 1 };
}
