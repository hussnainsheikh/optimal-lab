// Count-min sketch: approximate counts in fixed memory. 3 hash rows × 8 counters.
export const ROWS = 3, WIDTH = 8;
export const STREAM: [string, number][] = [["cat", 9], ["dog", 7], ["owl", 5], ["fox", 3], ["bee", 2], ["elk", 2], ["ant", 1], ["yak", 1], ["emu", 1], ["gnu", 1]];
const hash = (s: string, seed: number) => { let h = 2166136261 ^ seed; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return ((h >>> 0) % WIDTH); };
export const cells = (word: string) => Array.from({ length: ROWS }, (_, r) => hash(word, r * 7919 + 13));
export function build() {
  const grid = Array.from({ length: ROWS }, () => Array(WIDTH).fill(0));
  for (const [w, n] of STREAM) cells(w).forEach((c, r) => (grid[r][c] += n));
  return grid;
}
export function estimate(grid: number[][], word: string) { const cs = cells(word); return Math.min(...cs.map((c, r) => grid[r][c])); }
