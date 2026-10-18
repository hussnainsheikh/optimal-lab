// Diffusion, step by step, on a 16 × 16 grayscale image.
// Forward process (training): x_t = √ᾱ_t · x_0 + √(1 − ᾱ_t) · ε, with the standard
// linear schedule (β from 0.0001 to 0.02 over T = 1000 steps).
// Sampling (DDIM): start from pure noise, and at each step predict the clean image,
// work out the noise that implies, and move to a less noisy timestep.
// A real model is a trained network that predicts the noise. Here an oracle stands in
// for it: it knows the target picture for each prompt and, like a real model, can only
// make out the overall shape when the input is very noisy and the details when it is
// nearly clean. Classifier-free guidance pushes the prediction away from the
// no-prompt guess: guided = uncond + g · (cond − uncond).

export const SIZE = 16;
export const T = 1000;

const ART: Record<string, string[]> = {
  house: [
    "................",
    ".......##.......",
    "......####......",
    ".....######.....",
    "....########....",
    "...##########...",
    "..############..",
    "...++++++++++...",
    "...++--++++++...",
    "...++--++--++...",
    "...++++++--++...",
    "...++++++--++...",
    "...++++++--++...",
    "----------------",
    "----------------",
    "----------------",
  ],
  cat: [
    "................",
    "..#.........#...",
    "..##.......##...",
    "..###+++++###...",
    "..+++++++++++...",
    ".++++++++++++...",
    ".++##+++++##++..",
    ".++##+++++##++..",
    ".+++++++++++++..",
    ".++++++#++++++..",
    ".+++-+++++-+++..",
    "..++-------+++..",
    "..+++++++++++...",
    "...+++++++++....",
    ".....+++++......",
    "................",
  ],
  tree: [
    "................",
    "......####......",
    "....########....",
    "...###++####....",
    "..#####++####...",
    "..##++#######...",
    "..###########...",
    "...#########....",
    "....#######.....",
    "......--........",
    "......--........",
    "......--........",
    "......--........",
    ".....----.......",
    "++++++++++++++++",
    "++++++++++++++++",
  ],
};

const LEVEL: Record<string, number> = { ".": -1, "-": -1 / 3, "+": 1 / 3, "#": 1 };

export const PROMPTS = [
  { id: "house", label: "a house" },
  { id: "cat", label: "a cat" },
  { id: "tree", label: "a tree" },
] as const;
export type PromptId = (typeof PROMPTS)[number]["id"];

export type Img = number[]; // SIZE × SIZE values in [-1, 1]

export const target = (id: PromptId): Img => ART[id].join("").split("").map((c) => LEVEL[c]);

// The no-prompt guess: the average of every picture, blurred. Shape without identity.
function blur(img: Img): Img {
  return img.map((_, i) => {
    const x = i % SIZE;
    const y = Math.floor(i / SIZE);
    let s = 0;
    let n = 0;
    for (let dy = -2; dy <= 2; dy++)
      for (let dx = -2; dx <= 2; dx++) {
        const xx = x + dx;
        const yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= SIZE || yy >= SIZE) continue;
        s += img[yy * SIZE + xx];
        n++;
      }
    return s / n;
  });
}
const ALL = PROMPTS.map((p) => target(p.id));
export const AVERAGE: Img = blur(ALL[0].map((_, i) => ALL.reduce((s, img) => s + img[i], 0) / ALL.length));

// Linear β schedule and ᾱ_t = Π (1 − β).
export const ALPHA_BAR: number[] = (() => {
  const out: number[] = [];
  let prod = 1;
  for (let t = 0; t < T; t++) {
    prod *= 1 - (1e-4 + ((0.02 - 1e-4) * t) / (T - 1));
    out.push(prod);
  }
  return out;
})();

// How strongly the prompt shows in a single prediction, before guidance.
// Without guidance a model's pictures come out faint and generic.
export const PROMPT_PULL = 0.14;

function predict(id: PromptId, t: number, guidance: number): Img {
  const sigma2 = 1 - ALPHA_BAR[t]; // how noisy the input is, 0 → 1
  const goal = target(id);
  return AVERAGE.map((a, i) => {
    const cond = a + (goal[i] - a) * PROMPT_PULL * (1 - sigma2);
    const guided = a + guidance * (cond - a);
    return Math.max(-1, Math.min(1, guided));
  });
}

function noise(seed: number): Img {
  let s = seed;
  const rand = () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  // Box–Muller: Gaussian noise.
  return Array.from({ length: SIZE * SIZE }, () => Math.sqrt(-2 * Math.log(1 - rand())) * Math.cos(2 * Math.PI * rand()));
}

export type Frame = { t: number; x: Img; predicted: Img };

// Evenly spaced timesteps from T − 1 down, one frame per step, plus the final image.
export function sample(id: PromptId, steps: number, guidance: number, seed = 7): Frame[] {
  const ts = Array.from({ length: steps }, (_, i) => Math.round(((steps - i) * T) / steps) - 1);
  let x = noise(seed);
  const frames: Frame[] = [{ t: T - 1, x, predicted: predict(id, ts[0], guidance) }];
  for (let i = 0; i < steps; i++) {
    const t = ts[i];
    const ab = ALPHA_BAR[t];
    const x0 = predict(id, t, guidance);
    const eps = x.map((v, j) => (v - Math.sqrt(ab) * x0[j]) / Math.sqrt(1 - ab));
    const prev = i + 1 < steps ? ALPHA_BAR[ts[i + 1]] : 1;
    x = x0.map((v, j) => Math.sqrt(prev) * v + Math.sqrt(1 - prev) * eps[j]);
    frames.push({ t: i + 1 < steps ? ts[i + 1] : 0, x, predicted: x0 });
  }
  return frames;
}

const err = (img: Img, id: PromptId) => img.reduce((s, v, i) => s + Math.abs(v - target(id)[i]), 0);

// How much of the prompt's picture came through: 0 = the blurry no-prompt average, 1 = the picture.
export const match = (img: Img, id: PromptId) => Math.max(0, 1 - err(img, id) / err(AVERAGE, id));

// Share of the picture's grey (shaded) pixels pushed to pure black or white: guidance set too high.
export function clipped(img: Img, id: PromptId) {
  const goal = target(id);
  const mids = goal.map((v, i) => (Math.abs(v) < 0.5 ? i : -1)).filter((i) => i >= 0);
  return mids.filter((i) => Math.abs(img[i]) > 0.999).length / mids.length;
}

export const STEP_CHOICES = [1, 5, 10, 25, 50];
export const GUIDANCE_CHOICES = [1, 3, 7, 15];
