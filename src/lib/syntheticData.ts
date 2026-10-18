// Synthetic data: a model generates training examples, a new model trains on them,
// and the new model generates the next batch. Two things go wrong over generations:
//  - diversity shrinks: the rare topics are never sampled, so the next model never
//    learns them, and a model also favours its common outputs (sharpening);
//  - errors compound: wrong examples teach the next model to be wrong more often.
// This is model collapse (Shumailov et al. 2024). The fixes are mixing real data back
// in, and verifying examples before training on them.

export const TOPICS = 40;
export const GENERATIONS = 8;

// Real data: 40 support topics with a long tail (Zipf-like).
export const REAL: number[] = (() => {
  const w = Array.from({ length: TOPICS }, (_, i) => 1 / (i + 1));
  const s = w.reduce((a, b) => a + b, 0);
  return w.map((v) => v / s);
})();
export const REAL_ERROR = 0.02; // share of real examples that are wrong (mislabelled)

export const SAMPLE_COUNTS = [200, 2000, 20000];
export const MIX_CHOICES = [0, 0.25, 0.5];
export const SHARPEN = 1.3; // a model samples its common outputs a bit more than their share

export type Settings = { n: number; mix: number; verify: boolean; sharpen: boolean };

export type Frame = { gen: number; dist: number[]; distinct: number; top5: number; error: number };

function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function draw(rand: () => number, p: number[]): number {
  let u = rand();
  for (let i = 0; i < p.length; i++) {
    u -= p[i];
    if (u <= 0) return i;
  }
  return p.length - 1;
}

export function simulate(s: Settings): Frame[] {
  const rand = rng(99);
  const frames: Frame[] = [];
  let dist = [...REAL];
  let error = REAL_ERROR;
  const stats = (gen: number): Frame => ({
    gen,
    dist,
    distinct: dist.filter((v) => v > 0).length,
    top5: dist.slice(0, 5).reduce((a, b) => a + b, 0),
    error,
  });
  frames.push(stats(0));
  for (let g = 1; g <= GENERATIONS; g++) {
    // The current model generates n examples; sharpening favours what it says most.
    let gen = s.sharpen ? dist.map((v) => v ** SHARPEN) : [...dist];
    const z = gen.reduce((a, b) => a + b, 0);
    gen = gen.map((v) => v / z);
    const counts = new Array(TOPICS).fill(0);
    for (let i = 0; i < s.n; i++) counts[draw(rand, gen)]++;
    // Generated examples inherit the model's error rate, and teach it onward.
    // Verifying keeps only the examples that pass a check.
    let genError = Math.min(0.6, error * 1.6);
    if (s.verify) genError = Math.min(genError, 0.03);
    // Mix real data back in.
    const synth = counts.map((c) => c / s.n);
    dist = synth.map((v, i) => (1 - s.mix) * v + s.mix * REAL[i]);
    error = (1 - s.mix) * genError + s.mix * REAL_ERROR;
    frames.push(stats(g));
  }
  return frames;
}

export const pct = (x: number) => `${Math.round(x * 100)}%`;
