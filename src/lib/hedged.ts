// 40 requests to a backend where ~1 in 10 is slow. Hedging sends a backup copy if the first is slow.
const seq = (seed: number) => () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
const rnd = seq(42);
const sample = () => (rnd() < 0.1 ? 400 + Math.round(rnd() * 400) : 15 + Math.round(rnd() * 25));
export const FIRST = Array.from({ length: 40 }, sample);
export const SECOND = Array.from({ length: 40 }, sample);
export type Mode = "none" | "hedge";

export function run(mode: Mode, after: number) {
  const reqs = FIRST.map((a, i) => {
    if (mode === "none" || a <= after) return { a, b: null as number | null, total: a, hedged: false };
    const b = after + SECOND[i];
    return { a, b, total: Math.min(a, b), hedged: true };
  });
  const sorted = reqs.map((r) => r.total).sort((x, y) => x - y);
  const pct = (p: number) => sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)];
  return { reqs, p50: pct(50), p95: pct(95), p99: pct(99), extra: reqs.filter((r) => r.hedged).length };
}
