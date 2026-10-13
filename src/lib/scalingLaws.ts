// Chinchilla-style loss: L(N, D) = E + A/N^α + B/D^β, with compute C ≈ 6·N·D.
const E = 1.69, A = 406.4, B = 410.7, ALPHA = 0.34, BETA = 0.28;
export const loss = (N: number, D: number) => E + A / N ** ALPHA + B / D ** BETA;
export const COMPUTES = [1e19, 1e20, 1e21, 1e22, 1e23, 1e24];
export function curve(C: number) {
  const pts = [];
  for (let e = 7; e <= 12.5; e += 0.125) { const N = 10 ** e, D = C / (6 * N); if (D < 1e6) continue; pts.push({ N, D, L: loss(N, D) }); }
  const best = pts.reduce((a, b) => (b.L < a.L ? b : a));
  return { pts, best };
}
export const fmt = (n: number) => (n >= 1e12 ? `${(n / 1e12).toFixed(1)}T` : n >= 1e9 ? `${(n / 1e9).toFixed(1)}B` : `${(n / 1e6).toFixed(0)}M`);
