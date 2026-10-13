// Two prompt versions. B is truly a bit better (65% vs 62% thumbs-up). How many users before you can tell?
const seq = (seed: number) => () => (seed = (seed * 48271) % 2147483647) / 2147483647;
export const TRUE_A = 0.62, TRUE_B = 0.65;
export function simulate(n: number, seed = 7) {
  const r = seq(seed);
  let a = 0, b = 0;
  for (let i = 0; i < n; i++) { if (r() < TRUE_A) a++; if (r() < TRUE_B) b++; }
  const pa = a / n, pb = b / n;
  const p = (a + b) / (2 * n);
  const se = Math.sqrt(p * (1 - p) * (2 / n));
  const z = se ? (pb - pa) / se : 0;
  const ciHalf = 1.96 * Math.sqrt((pa * (1 - pa)) / n + (pb * (1 - pb)) / n);
  return { pa, pb, diff: pb - pa, ciLow: pb - pa - ciHalf, ciHigh: pb - pa + ciHalf, z, significant: Math.abs(z) > 1.96 };
}
export const SIZES = [50, 200, 1000, 5000, 20000];
