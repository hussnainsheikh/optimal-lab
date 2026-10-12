// Dynamic programming, shown with coin change: the fewest coins that add up to an amount.
//   best[0] = 0
//   best[a] = 1 + min(best[a - c]) over every coin c <= a
// The table fills from small amounts to large ones, so every answer it needs is already there.

export const COINS = [1, 3, 4];
export const AMOUNTS = [6, 10, 12];

export type Candidate = { coin: number; from: number; fromBest: number | null; total: number | null };

export type DpFrame = {
  amount: number; // the cell being filled
  candidates: Candidate[]; // one per coin that fits
  best: number | null; // null = this amount can't be made
  via: number | null; // the coin that gave the best answer
  table: (number | null)[]; // filled so far; undefined cells are not yet filled
};

export function coinChangeTrace(target: number, coins = COINS): DpFrame[] {
  const best: (number | null)[] = [0];
  const via: (number | null)[] = [null];
  const frames: DpFrame[] = [{ amount: 0, candidates: [], best: 0, via: null, table: [0] }];

  for (let a = 1; a <= target; a++) {
    const candidates: Candidate[] = coins
      .filter((c) => c <= a)
      .map((c) => {
        const fromBest = best[a - c];
        return { coin: c, from: a - c, fromBest, total: fromBest === null ? null : fromBest + 1 };
      });
    let pick: Candidate | null = null;
    for (const cand of candidates) if (cand.total !== null && (pick === null || cand.total < pick.total!)) pick = cand;
    best[a] = pick ? pick.total : null;
    via[a] = pick ? pick.coin : null;
    frames.push({ amount: a, candidates, best: best[a], via: via[a], table: [...best] });
  }
  return frames;
}

// Walk the "via" coins back from the target to read off which coins were used.
export function coinsUsed(frames: DpFrame[]): number[] {
  const via = frames.map((f) => f.via);
  const out: number[] = [];
  let a = frames.length - 1;
  while (a > 0 && via[a] !== null) {
    out.push(via[a]!);
    a -= via[a]!;
  }
  return out;
}

// Always take the biggest coin that fits. Fast, and sometimes wrong.
export function greedyCoins(target: number, coins = COINS): number[] | null {
  const sorted = [...coins].sort((x, y) => y - x);
  const out: number[] = [];
  let left = target;
  for (const c of sorted) {
    while (c <= left) {
      out.push(c);
      left -= c;
    }
  }
  return left === 0 ? out : null;
}

// Calls made by plain recursion with no memory: f(a) calls f(a - c) for every coin that fits.
export function naiveCalls(target: number, coins = COINS): number {
  const calls: number[] = [];
  for (let a = 0; a <= target; a++) {
    calls[a] = 1 + coins.filter((c) => c <= a).reduce((s, c) => s + calls[a - c], 0);
  }
  return calls[target];
}
