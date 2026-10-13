// An 8×8 int array read row by row or column by column, through a cache of 4 lines × 4 ints (LRU).
export const N = 8, LINE = 4, LINES = 4;
export type Order = "row" | "col";
export function run(order: Order) {
  const cache: number[] = []; // line ids, most recent first
  const steps: { r: number; c: number; hit: boolean; cache: number[] }[] = [];
  for (let a = 0; a < N; a++) for (let b = 0; b < N; b++) {
    const [r, c] = order === "row" ? [a, b] : [b, a];
    const line = Math.floor((r * N + c) / LINE);
    const i = cache.indexOf(line);
    const hit = i >= 0;
    if (hit) cache.splice(i, 1); else if (cache.length === LINES) cache.pop();
    cache.unshift(line);
    steps.push({ r, c, hit, cache: [...cache] });
  }
  return { steps, misses: steps.filter((s) => !s.hit).length };
}
