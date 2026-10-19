// Preference tuning two ways, on the same preference pairs.
// Eight candidate answers to one prompt, each with two features: how helpful it is and
// how long it is. People preferred the more helpful answer in most pairs, but in two
// pairs they picked the longer one: real preference data carries a length bias.
//  - RLHF: fit a reward model r(x) = w·features to the pairs (Bradley–Terry), then push
//    the policy toward high reward with a KL penalty to the reference (policy gradient).
//  - DPO: skip the reward model. Push the policy's log-odds of chosen over rejected
//    directly: loss = −log σ(β · ((log π(c) − log π_ref(c)) − (log π(r) − log π_ref(r)))).
// The policy is a softmax over the eight answers with logits θ·features; the reference
// policy has θ = 0 (uniform). Everything below is run for real on those definitions.

export type Answer = { id: string; text: string; help: number; length: number };

export const ANSWERS: Answer[] = [
  { id: "a", text: "Two-line fix with the exact command.", help: 0.9, length: 0.2 },
  { id: "b", text: "Short, but the command is slightly wrong.", help: 0.4, length: 0.2 },
  { id: "c", text: "Correct, with a paragraph of context.", help: 0.8, length: 0.5 },
  { id: "d", text: "Long, thorough, correct, repeats itself.", help: 0.7, length: 0.9 },
  { id: "e", text: "Long and confidently wrong.", help: 0.1, length: 0.9 },
  { id: "f", text: "Vague advice to check the docs.", help: 0.2, length: 0.3 },
  { id: "g", text: "Correct answer plus three unrelated tips.", help: 0.6, length: 0.8 },
  { id: "h", text: "Asks a clarifying question instead.", help: 0.3, length: 0.1 },
];

// (chosen, rejected). Pairs 5 and 6 are the ones where people picked the longer answer.
export const PAIRS: [string, string][] = [
  ["a", "b"],
  ["c", "f"],
  ["a", "h"],
  ["c", "e"],
  ["d", "a"],
  ["g", "c"],
];

export const STEPS = 10;
export const BETA = 0.5;
const LR_RM = 2;
const LR_POLICY = 6;
const LR_DPO = 24; // the DPO gradient carries a factor β·(1 − σ), so it needs a larger step

const answer = (id: string) => ANSWERS.find((x) => x.id === id)!;
const feats = (a: Answer) => [a.help, a.length];
const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));

export function softmaxPolicy(theta: [number, number]): number[] {
  const logits = ANSWERS.map((a) => theta[0] * a.help + theta[1] * a.length);
  const m = Math.max(...logits);
  const e = logits.map((l) => Math.exp(l - m));
  const s = e.reduce((x, y) => x + y, 0);
  return e.map((v) => v / s);
}

export const kl = (p: number[]) => p.reduce((s, v) => s + (v > 0 ? v * Math.log(v * ANSWERS.length) : 0), 0);
export const meanOf = (p: number[], key: "help" | "length") => p.reduce((s, v, i) => s + v * ANSWERS[i][key], 0);
export const favourite = (p: number[]) => ANSWERS[p.indexOf(Math.max(...p))];

// --- RLHF --------------------------------------------------------------------
export type RlhfFrame = { stage: "reward" | "policy"; w: [number, number]; rmAccuracy: number; theta: [number, number]; p: number[]; reward: number; kl: number };

export function rlhf(): RlhfFrame[] {
  const frames: RlhfFrame[] = [];
  let w: [number, number] = [0, 0];
  const score = (a: Answer) => w[0] * a.help + w[1] * a.length;
  const acc = () => PAIRS.filter(([c, r]) => score(answer(c)) > score(answer(r))).length / PAIRS.length;
  let theta: [number, number] = [0, 0];
  const snap = (stage: RlhfFrame["stage"]): RlhfFrame => {
    const p = softmaxPolicy(theta);
    return { stage, w, rmAccuracy: acc(), theta, p, reward: p.reduce((s, v, i) => s + v * score(ANSWERS[i]), 0), kl: kl(p) };
  };
  frames.push(snap("reward"));
  // Stage 1: five steps of logistic regression on the pairs.
  for (let t = 0; t < STEPS / 2; t++) {
    const g = [0, 0];
    for (const [c, r] of PAIRS) {
      const d = [answer(c).help - answer(r).help, answer(c).length - answer(r).length];
      const miss = 1 - sigmoid(w[0] * d[0] + w[1] * d[1]);
      g[0] += miss * d[0];
      g[1] += miss * d[1];
    }
    w = [w[0] + (LR_RM * g[0]) / PAIRS.length, w[1] + (LR_RM * g[1]) / PAIRS.length];
    frames.push(snap("reward"));
  }
  // Stage 2: five policy-gradient steps on E[r] − β·KL (exact gradient over the eight answers).
  for (let t = 0; t < STEPS / 2; t++) {
    const p = softmaxPolicy(theta);
    const adv = ANSWERS.map((a, i) => score(a) - BETA * Math.log(p[i] * ANSWERS.length));
    const mean = adv.reduce((s, v, i) => s + p[i] * v, 0);
    const g = [0, 0];
    ANSWERS.forEach((a, i) => {
      const f = feats(a);
      const fbar = [meanOf(p, "help"), meanOf(p, "length")];
      g[0] += p[i] * (adv[i] - mean) * (f[0] - fbar[0]);
      g[1] += p[i] * (adv[i] - mean) * (f[1] - fbar[1]);
    });
    theta = [theta[0] + LR_POLICY * g[0], theta[1] + LR_POLICY * g[1]];
    frames.push(snap("policy"));
  }
  return frames;
}

// --- DPO ---------------------------------------------------------------------
export type DpoFrame = { theta: [number, number]; p: number[]; loss: number; margin: number; pairsRight: number; kl: number; logpChosen: number };

export function dpo(): DpoFrame[] {
  const frames: DpoFrame[] = [];
  let theta: [number, number] = [0, 0];
  const snap = (): DpoFrame => {
    const p = softmaxPolicy(theta);
    const ref = 1 / ANSWERS.length;
    const implicit = (id: string) => BETA * Math.log(p[ANSWERS.findIndex((a) => a.id === id)] / ref);
    const margins = PAIRS.map(([c, r]) => implicit(c) - implicit(r));
    return {
      theta,
      p,
      loss: margins.reduce((s, m) => s - Math.log(sigmoid(m)), 0) / PAIRS.length,
      margin: margins.reduce((s, m) => s + m, 0) / PAIRS.length,
      pairsRight: margins.filter((m) => m > 0).length,
      kl: kl(p),
      logpChosen: PAIRS.reduce((s, [c]) => s + Math.log(p[ANSWERS.findIndex((a) => a.id === c)]), 0) / PAIRS.length,
    };
  };
  frames.push(snap());
  for (let t = 0; t < STEPS; t++) {
    const p = softmaxPolicy(theta);
    const g = [0, 0];
    for (const [c, r] of PAIRS) {
      const C = answer(c);
      const R = answer(r);
      const m = BETA * (Math.log(p[ANSWERS.indexOf(C)] * ANSWERS.length) - Math.log(p[ANSWERS.indexOf(R)] * ANSWERS.length));
      const weight = 1 - sigmoid(m); // how wrong the pair still is
      // d/dθ of log π(c) − log π(r) = (f(c) − f̄) − (f(r) − f̄) = f(c) − f(r)
      g[0] += BETA * weight * (C.help - R.help);
      g[1] += BETA * weight * (C.length - R.length);
    }
    theta = [theta[0] + (LR_DPO * g[0]) / PAIRS.length, theta[1] + (LR_DPO * g[1]) / PAIRS.length];
    frames.push(snap());
  }
  return frames;
}

export const MEMORY = {
  rlhf: ["policy", "reference policy", "reward model", "value model"],
  dpo: ["policy", "reference policy"],
};

export const pct = (x: number) => `${Math.round(x * 100)}%`;
