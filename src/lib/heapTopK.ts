// Top-k largest with a min-heap of size k.
export const STREAM = [5, 1, 9, 3, 7, 2, 8, 6, 4];
export type Frame = { heap: number[]; incoming: number | null; hot: number[]; text: string; result?: number[] };

export function topK(k: number): Frame[] {
  const h: number[] = [];
  const out: Frame[] = [{ heap: [], incoming: null, hot: [], text: `Keep a min-heap of the ${k} largest so far. Its root is the smallest of them: the one to beat.` }];
  const snap = (incoming: number | null, hot: number[], text: string) => out.push({ heap: [...h], incoming, hot, text });
  const swap = (a: number, b: number) => ([h[a], h[b]] = [h[b], h[a]]);
  const up = (i: number, x: number) => {
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (h[p] <= h[i]) break;
      swap(i, p); snap(x, [p, i], `${h[i]} > ${h[p]}: swap with the parent.`); i = p;
    }
  };
  const down = (i: number, x: number) => {
    for (;;) {
      const l = 2 * i + 1, r = l + 1;
      let m = i;
      if (l < h.length && h[l] < h[m]) m = l;
      if (r < h.length && h[r] < h[m]) m = r;
      if (m === i) break;
      swap(i, m); snap(x, [i, m], `Sift down: swap with the smaller child, ${h[i]}.`); i = m;
    }
  };
  for (const x of STREAM) {
    if (h.length < k) { h.push(x); snap(x, [h.length - 1], `Heap has room: add ${x} at the bottom.`); up(h.length - 1, x); }
    else if (x > h[0]) { const old = h[0]; h[0] = x; snap(x, [0], `${x} beats the root ${old}. Replace the root.`); down(0, x); }
    else snap(x, [0], `${x} ≤ root ${h[0]}: it can't be in the top ${k}. Skip it, O(1).`);
  }
  out.push({ heap: [...h], incoming: null, hot: [], text: `Done. The heap holds the top ${k}: ${[...h].sort((a, b) => b - a).join(", ")}.`, result: [...h].sort((a, b) => b - a) });
  return out;
}
