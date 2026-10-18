// Three ways to learn, each a real small algorithm run to a fixed number of frames.
//  - Supervised: a perceptron learns a line between late and on-time deliveries from
//    labelled examples.
//  - Unsupervised: k-means groups the same deliveries with no labels at all.
//  - Reinforcement: Q-learning finds a route across a small grid from rewards alone.

export type Point = { x: number; y: number; late: boolean };

// Distance (km, 0–10) and order size (items, 0–10). Big, far orders tend to be late.
export const POINTS: Point[] = [
  { x: 1, y: 2, late: false },
  { x: 2, y: 1, late: false },
  { x: 2.5, y: 4, late: false },
  { x: 3, y: 2.5, late: false },
  { x: 4, y: 1.5, late: false },
  { x: 1.5, y: 6, late: false },
  { x: 5, y: 3, late: false },
  { x: 3.5, y: 5, late: false },
  { x: 6, y: 1, late: false },
  { x: 4.5, y: 6.5, late: false },
  { x: 7, y: 7, late: true },
  { x: 8, y: 5, late: true },
  { x: 6.5, y: 8.5, late: true },
  { x: 9, y: 3.5, late: true },
  { x: 8.5, y: 8, late: true },
  { x: 7.5, y: 4.5, late: true },
  { x: 9.5, y: 6, late: true },
  { x: 5.5, y: 9, late: true },
  { x: 8, y: 9.5, late: true },
  { x: 9, y: 8.5, late: true },
];

export const FRAMES = 8;

// --- Supervised: perceptron -------------------------------------------------
// Features are scaled to 0–1 (divided by 10) so one epoch of updates moves the line a
// sensible amount. The line is w·(x/10, y/10) + b = 0.
export type SupFrame = { w: [number, number]; b: number; accuracy: number; updates: number };

const sign = (v: number) => (v >= 0 ? 1 : -1);
export const SCALE = 10;
export const score = (w: [number, number], b: number, p: { x: number; y: number }) => w[0] * (p.x / SCALE) + w[1] * (p.y / SCALE) + b;

export function perceptron(): SupFrame[] {
  let w: [number, number] = [0, 0];
  let b = 0;
  const lr = 0.1;
  const frames: SupFrame[] = [];
  const acc = () => POINTS.filter((p) => sign(score(w, b, p)) === (p.late ? 1 : -1)).length / POINTS.length;
  frames.push({ w, b, accuracy: acc(), updates: 0 });
  for (let epoch = 1; epoch < FRAMES; epoch++) {
    let updates = 0;
    for (const p of POINTS) {
      const target = p.late ? 1 : -1;
      if (sign(score(w, b, p)) !== target) {
        w = [w[0] + (lr * target * p.x) / SCALE, w[1] + (lr * target * p.y) / SCALE];
        b += lr * target;
        updates++;
      }
    }
    frames.push({ w, b, accuracy: acc(), updates });
  }
  return frames;
}

// --- Unsupervised: k-means --------------------------------------------------
export type Centroid = { x: number; y: number };
export type UnsupFrame = { centroids: Centroid[]; assign: number[]; moved: number };

export function kmeans(k: number): UnsupFrame[] {
  // Start from the first k points, spread by index so the start is deterministic.
  let centroids: Centroid[] = Array.from({ length: k }, (_, i) => ({ x: POINTS[i * 3].x, y: POINTS[i * 3].y }));
  const frames: UnsupFrame[] = [];
  const nearest = (p: Point) => centroids.reduce((best, c, i) => ((p.x - c.x) ** 2 + (p.y - c.y) ** 2 < (p.x - centroids[best].x) ** 2 + (p.y - centroids[best].y) ** 2 ? i : best), 0);
  let assign = POINTS.map(nearest);
  frames.push({ centroids, assign, moved: 0 });
  for (let it = 1; it < FRAMES; it++) {
    const next = centroids.map((c, i) => {
      const mine = POINTS.filter((_, j) => assign[j] === i);
      return mine.length ? { x: mine.reduce((s, p) => s + p.x, 0) / mine.length, y: mine.reduce((s, p) => s + p.y, 0) / mine.length } : c;
    });
    const moved = Math.sqrt(next.reduce((s, c, i) => s + (c.x - centroids[i].x) ** 2 + (c.y - centroids[i].y) ** 2, 0));
    centroids = next;
    assign = POINTS.map(nearest);
    frames.push({ centroids, assign, moved });
  }
  return frames;
}

// How well the groups line up with the hidden labels (never used in training).
export function agreement(f: UnsupFrame): number {
  const k = f.centroids.length;
  let right = 0;
  for (let g = 0; g < k; g++) {
    const members = POINTS.filter((_, j) => f.assign[j] === g);
    const late = members.filter((p) => p.late).length;
    right += Math.max(late, members.length - late);
  }
  return right / POINTS.length;
}

// --- Reinforcement: Q-learning on a 4 × 4 grid --------------------------------
export const GRID = 4;
export const START = 0; // top-left
export const GOAL = 15; // bottom-right
export const PIT = 6; // row 1, col 2
export const ACTIONS = ["↑", "→", "↓", "←"] as const;
export const EPISODES_PER_FRAME = 25;

export type RlFrame = { q: number[][]; episodes: number; successes: number; policy: (number | null)[] };

function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function step(s: number, a: number): number {
  const r = Math.floor(s / GRID);
  const c = s % GRID;
  const nr = Math.max(0, Math.min(GRID - 1, r + (a === 0 ? -1 : a === 2 ? 1 : 0)));
  const nc = Math.max(0, Math.min(GRID - 1, c + (a === 1 ? 1 : a === 3 ? -1 : 0)));
  return nr * GRID + nc;
}

export const reward = (s: number) => (s === GOAL ? 10 : s === PIT ? -10 : -1);

export function qlearning(): RlFrame[] {
  const rand = rng(42);
  const q: number[][] = Array.from({ length: GRID * GRID }, () => [0, 0, 0, 0]);
  const alpha = 0.5;
  const gamma = 0.9;
  const frames: RlFrame[] = [];
  const policy = () => q.map((row, s) => (s === GOAL || s === PIT ? null : row.some((v) => v !== 0) ? row.indexOf(Math.max(...row)) : null));
  frames.push({ q: q.map((r) => [...r]), episodes: 0, successes: 0, policy: policy() });
  let episodes = 0;
  for (let f = 1; f < FRAMES; f++) {
    let successes = 0;
    for (let e = 0; e < EPISODES_PER_FRAME; e++) {
      const eps = Math.max(0.05, 0.5 - episodes * 0.003); // explore less over time
      let s = START;
      for (let t = 0; t < 40; t++) {
        const a = rand() < eps ? Math.floor(rand() * 4) : q[s].indexOf(Math.max(...q[s]));
        const s2 = step(s, a);
        const r = reward(s2);
        const done = s2 === GOAL || s2 === PIT;
        q[s][a] += alpha * (r + (done ? 0 : gamma * Math.max(...q[s2])) - q[s][a]);
        s = s2;
        if (done) {
          if (s === GOAL) successes++;
          break;
        }
      }
      episodes++;
    }
    frames.push({ q: q.map((r) => [...r]), episodes, successes, policy: policy() });
  }
  return frames;
}

// Follow the greedy policy from the start; how many steps to the goal, or null.
export function greedyPath(policy: (number | null)[]): number[] | null {
  const path = [START];
  let s = START;
  for (let t = 0; t < 20; t++) {
    const a = policy[s];
    if (a === null) return null;
    s = step(s, a);
    path.push(s);
    if (s === GOAL) return path;
    if (s === PIT) return null;
  }
  return null;
}
