// Fit polynomials of increasing degree to 10 noisy points; check error on 10 held-out points.
const truth = (x: number) => Math.sin(2.5 * x);
const NOISE = [0.12, -0.18, 0.05, 0.2, -0.1, -0.15, 0.17, -0.05, 0.1, -0.2];
export const TRAIN = Array.from({ length: 10 }, (_, i) => { const x = -1 + (2 * i) / 9; return { x, y: truth(x) + NOISE[i] }; });
export const VAL = Array.from({ length: 10 }, (_, i) => { const x = -0.9 + (1.8 * i) / 9 + 0.05; return { x, y: truth(x) + NOISE[(i + 3) % 10] * 0.8 }; });

function solve(A: number[][], b: number[]) {
  const n = b.length, M = A.map((r, i) => [...r, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    for (let r = 0; r < n; r++) if (r !== c) { const f = M[r][c] / M[c][c]; for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k]; }
  }
  return M.map((r, i) => r[n] / r[i]);
}
export function fit(degree: number) {
  const d = degree + 1;
  const A = Array.from({ length: d }, (_, i) => Array.from({ length: d }, (_, j) => TRAIN.reduce((s, p) => s + p.x ** (i + j), 0) + (i === j ? 1e-9 : 0)));
  const b = Array.from({ length: d }, (_, i) => TRAIN.reduce((s, p) => s + p.y * p.x ** i, 0));
  const w = solve(A, b);
  const f = (x: number) => w.reduce((s, c, i) => s + c * x ** i, 0);
  const mse = (pts: { x: number; y: number }[]) => pts.reduce((s, p) => s + (f(p.x) - p.y) ** 2, 0) / pts.length;
  return { f, train: mse(TRAIN), val: mse(VAL) };
}
export const truthFn = truth;
