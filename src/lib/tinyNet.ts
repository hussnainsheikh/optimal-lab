// XOR: one neuron can't learn it; two hidden neurons can. Hand-set weights so you can follow the maths.
export const relu = (x: number) => Math.max(0, x);
export const NET = {
  hidden: [{ w: [1, 1], b: 0, label: "h1 ≈ OR" }, { w: [1, 1], b: -1, label: "h2 ≈ AND" }],
  out: { w: [1, -2], b: 0 },
};
export function forward(x1: number, x2: number) {
  const h = NET.hidden.map((n) => { const z = n.w[0] * x1 + n.w[1] * x2 + n.b; return { z, a: relu(z) }; });
  const y = NET.out.w[0] * h[0].a + NET.out.w[1] * h[1].a + NET.out.b;
  return { h, y };
}
// best single linear neuron (thresholded) gets at most 3 of 4
export function single(x1: number, x2: number) { return x1 + x2 - 0.5 > 0 ? 1 : 0; }
export const CASES = [[0, 0], [0, 1], [1, 0], [1, 1]];
