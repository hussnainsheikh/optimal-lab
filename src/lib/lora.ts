// LoRA: instead of changing a big weight matrix W (d × d), freeze it and learn two thin
// matrices, B (d × r) and A (r × d). Their product B·A has the same shape as W, so it can be
// added to it, but only 2·d·r numbers are trained instead of d².

export const MODEL = {
  name: "a 7B model",
  params: 6.7e9,
  layers: 32,
  d: 4096, // hidden size
  adapted: 2, // matrices adapted per layer (the query and value projections)
};

export const RANKS = [1, 2, 4, 8, 16, 32, 64];

export function counts(r: number, m = MODEL) {
  const full = m.layers * m.adapted * m.d * m.d; // fine-tune those matrices fully
  const lora = m.layers * m.adapted * 2 * m.d * r;
  return {
    full,
    lora,
    shareOfModel: lora / m.params,
    shareOfFull: lora / full,
    adapterMB: (lora * 2) / 1024 ** 2, // fp16
    fullFineTuneGB: (m.params * 2) / 1024 ** 3, // a full copy of the model, fp16
  };
}

// A tiny worked example: d = 8, so the numbers fit on screen.
export const TOY_D = 8;

// Fixed small values so the picture is stable. Row i of B and column j of A.
const B_COLS = [
  [0.9, -0.4, 0.7, 0.1, -0.8, 0.5, 0.3, -0.6],
  [0.2, 0.8, -0.5, 0.6, 0.1, -0.7, 0.9, 0.3],
  [-0.6, 0.3, 0.2, -0.9, 0.4, 0.8, -0.1, 0.5],
  [0.4, -0.7, -0.3, 0.2, 0.9, -0.2, 0.6, -0.8],
];
const A_ROWS = [
  [0.5, 0.8, -0.3, 0.1, -0.6, 0.9, 0.2, -0.4],
  [-0.7, 0.2, 0.6, -0.5, 0.3, 0.1, -0.9, 0.8],
  [0.3, -0.6, 0.9, 0.4, -0.2, -0.8, 0.5, 0.1],
  [0.6, 0.4, -0.1, -0.7, 0.8, 0.2, -0.3, -0.5],
];
// The toy stops at rank 2: at d = 8, rank 4 would train as many numbers as W has.
export const TOY_MAX_RANK = 2;

// ΔW = B·A for the first r columns of B and rows of A.
export function toyDelta(r: number) {
  const out: number[][] = [];
  for (let i = 0; i < TOY_D; i++) {
    const row: number[] = [];
    for (let j = 0; j < TOY_D; j++) {
      let v = 0;
      for (let k = 0; k < r; k++) v += B_COLS[k][i] * A_ROWS[k][j];
      row.push(v);
    }
    out.push(row);
  }
  return { delta: out, B: B_COLS.slice(0, r), A: A_ROWS.slice(0, r) };
}

export const fmtCount = (n: number) =>
  n >= 1e9 ? `${(n / 1e9).toFixed(2)}B` : n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}K` : String(n);
