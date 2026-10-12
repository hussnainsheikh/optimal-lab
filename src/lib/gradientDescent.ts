// Training a model, at its smallest: fit a line y = w·x + b to some points by gradient descent.
// Each frame is one step: predict, measure the loss, find the downhill direction, step.

export type Point = { x: number; y: number };

// Roughly y = 2x + 1, with a little noise.
export const POINTS: Point[] = [
  { x: 0.5, y: 2.3 },
  { x: 1, y: 2.6 },
  { x: 1.5, y: 4.2 },
  { x: 2, y: 5.5 },
  { x: 2.5, y: 5.7 },
  { x: 3, y: 7.1 },
  { x: 3.5, y: 7.5 },
  { x: 4, y: 9.4 },
];

export const LEARNING_RATES = [
  { id: "tiny", rate: 0.005, label: "0.005", note: "Too small: it goes the right way, very slowly." },
  { id: "good", rate: 0.05, label: "0.05", note: "About right: the loss drops fast and settles." },
  { id: "bouncy", rate: 0.12, label: "0.12", note: "A bit too big: it overshoots and zig-zags, but still settles." },
  { id: "huge", rate: 0.15, label: "0.15", note: "Too big: every step overshoots further, and the loss explodes." },
] as const;

export type GdFrame = {
  step: number;
  w: number;
  b: number;
  loss: number; // mean squared error
  gradW: number; // ∂loss/∂w
  gradB: number; // ∂loss/∂b
  diverged: boolean;
};

export const STEPS = 40;

export const predict = (w: number, b: number, x: number) => w * x + b;

export function lossAndGrad(w: number, b: number, points = POINTS) {
  const n = points.length;
  let loss = 0;
  let gw = 0;
  let gb = 0;
  for (const p of points) {
    const err = predict(w, b, p.x) - p.y;
    loss += err * err;
    gw += 2 * err * p.x;
    gb += 2 * err;
  }
  return { loss: loss / n, gradW: gw / n, gradB: gb / n };
}

export function descend(rate: number, steps = STEPS, points = POINTS): GdFrame[] {
  const frames: GdFrame[] = [];
  let w = 0;
  let b = 0;
  for (let step = 0; step <= steps; step++) {
    const { loss, gradW, gradB } = lossAndGrad(w, b, points);
    const diverged = !Number.isFinite(loss) || loss > 1e4;
    frames.push({ step, w, b, loss, gradW, gradB, diverged });
    if (diverged) break;
    w -= rate * gradW;
    b -= rate * gradB;
  }
  return frames;
}

// The best possible line, from the closed-form least-squares answer, to compare against.
export function bestFit(points = POINTS) {
  const n = points.length;
  const mx = points.reduce((s, p) => s + p.x, 0) / n;
  const my = points.reduce((s, p) => s + p.y, 0) / n;
  const sxy = points.reduce((s, p) => s + (p.x - mx) * (p.y - my), 0);
  const sxx = points.reduce((s, p) => s + (p.x - mx) ** 2, 0);
  const w = sxy / sxx;
  const b = my - w * mx;
  return { w, b, loss: lossAndGrad(w, b, points).loss };
}
