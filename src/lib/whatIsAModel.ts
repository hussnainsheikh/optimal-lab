// What a model is: a function with parameters, and the data decides the parameters.
// Delivery time against distance for 12 past orders. Three model shapes for the same
// data: a line (2 parameters), a curve (3), and a lookup table that just remembers
// the orders (no parameters to tune; it answers with the closest order it has seen).

export const DATA: { x: number; y: number }[] = [
  { x: 1, y: 14 },
  { x: 2, y: 19 },
  { x: 3, y: 21 },
  { x: 4, y: 27 },
  { x: 5, y: 29 },
  { x: 6, y: 35 },
  { x: 7, y: 38 },
  { x: 8, y: 41 },
  { x: 9, y: 47 },
  { x: 10, y: 49 },
  { x: 11, y: 55 },
  { x: 12, y: 57 },
];

export type ShapeId = "line" | "curve" | "table";
export const SHAPES: { id: ShapeId; label: string; params: number; formula: string }[] = [
  { id: "line", label: "A line", params: 2, formula: "time = a + b × km" },
  { id: "curve", label: "A curve", params: 3, formula: "time = a + b × km + c × km²" },
  { id: "table", label: "A lookup table", params: 0, formula: "time = the closest order's time" },
];

export type Params = { a: number; b: number; c: number };

export function predict(shape: ShapeId, p: Params, x: number): number {
  if (shape === "line") return p.a + p.b * x;
  if (shape === "curve") return p.a + p.b * x + p.c * x * x;
  return DATA.reduce((best, d) => (Math.abs(d.x - x) < Math.abs(best.x - x) ? d : best)).y;
}

// Mean absolute error over the 12 orders, in minutes.
export const mae = (shape: ShapeId, p: Params) => DATA.reduce((s, d) => s + Math.abs(predict(shape, p, d.x) - d.y), 0) / DATA.length;

// Least squares: the parameters that make the squared error smallest.
export function fit(shape: ShapeId): Params {
  if (shape === "table") return { a: 0, b: 0, c: 0 };
  const n = DATA.length;
  if (shape === "line") {
    const mx = DATA.reduce((s, d) => s + d.x, 0) / n;
    const my = DATA.reduce((s, d) => s + d.y, 0) / n;
    const b = DATA.reduce((s, d) => s + (d.x - mx) * (d.y - my), 0) / DATA.reduce((s, d) => s + (d.x - mx) ** 2, 0);
    return { a: my - b * mx, b, c: 0 };
  }
  // Normal equations for a + b·x + c·x², solved by Gaussian elimination.
  const S = (k: number) => DATA.reduce((s, d) => s + d.x ** k, 0);
  const Sy = (k: number) => DATA.reduce((s, d) => s + d.x ** k * d.y, 0);
  const M = [
    [n, S(1), S(2), Sy(0)],
    [S(1), S(2), S(3), Sy(1)],
    [S(2), S(3), S(4), Sy(2)],
  ];
  for (let i = 0; i < 3; i++) {
    for (let r = i + 1; r < 3; r++) {
      const f = M[r][i] / M[i][i];
      for (let c = i; c < 4; c++) M[r][c] -= f * M[i][c];
    }
  }
  const sol = [0, 0, 0];
  for (let i = 2; i >= 0; i--) sol[i] = (M[i][3] - M[i].slice(i + 1, 3).reduce((s, v, j) => s + v * sol[i + 1 + j], 0)) / M[i][i];
  return { a: sol[0], b: sol[1], c: sol[2] };
}

export const START: Params = { a: 20, b: 2, c: 0 };
export const NEW_ORDERS = [7.5, 20]; // one inside the data's range, one far outside

// How many parameters other models have. "Our XOR net" is the network in the
// neural-networks session; the rest are published sizes.
export const SIZES: { label: string; params: number }[] = [
  { label: "This line", params: 2 },
  { label: "This curve", params: 3 },
  { label: "The XOR network (neural-networks session)", params: 9 },
  { label: "GPT-2 small", params: 124e6 },
  { label: "Llama 3.3 70B", params: 70.6e9 },
];

export const fmt = (n: number) => (n >= 1e9 ? `${(n / 1e9).toFixed(1)} billion` : n >= 1e6 ? `${Math.round(n / 1e6)} million` : String(n));
