// Bias and fairness at one decision threshold. Loan applicants from two groups get a
// score from 0 to 100. The score is calibrated: at any score, the same share of people
// repay, whichever group they are in. But the groups' score distributions differ
// (group B's are lower on average), so one threshold treats them differently.
// Everything here is computed from the distributions; nothing is hand-set.

export const BINS = 20; // scores 0–4, 5–9, …, 95–99
export type GroupId = "A" | "B";
export const GROUPS: { id: GroupId; label: string; size: number; mean: number; sd: number }[] = [
  { id: "A", label: "Group A", size: 1000, mean: 62, sd: 15 },
  { id: "B", label: "Group B", size: 1000, mean: 50, sd: 15 },
];

// Share who repay at a given score: the same for both groups (calibration).
export const repayRate = (score: number) => 1 / (1 + Math.exp(-(score - 50) / 9));

function gaussian(x: number, mean: number, sd: number) {
  return Math.exp(-((x - mean) ** 2) / (2 * sd * sd));
}

export type Bin = { score: number; count: number; repay: number };

export function bins(g: GroupId): Bin[] {
  const grp = GROUPS.find((x) => x.id === g)!;
  const raw = Array.from({ length: BINS }, (_, i) => gaussian(i * 5 + 2.5, grp.mean, grp.sd));
  const z = raw.reduce((a, b) => a + b, 0);
  return raw.map((v, i) => {
    const score = i * 5 + 2.5;
    const count = (v / z) * grp.size;
    return { score, count, repay: count * repayRate(score) };
  });
}

export type Outcome = {
  approved: number; // share of the group approved
  tpr: number; // share of would-repay applicants who were approved (equal opportunity)
  fpr: number; // share of would-default applicants who were approved
  precision: number; // share of approved who repay
  missed: number; // would-repay applicants turned down
  defaults: number; // approved who default
};

export function outcome(g: GroupId, threshold: number): Outcome {
  const bs = bins(g);
  const total = bs.reduce((s, b) => s + b.count, 0);
  const repayers = bs.reduce((s, b) => s + b.repay, 0);
  const approved = bs.filter((b) => b.score >= threshold);
  const nApproved = approved.reduce((s, b) => s + b.count, 0);
  const tp = approved.reduce((s, b) => s + b.repay, 0);
  const fp = nApproved - tp;
  return {
    approved: nApproved / total,
    tpr: tp / repayers,
    fpr: fp / (total - repayers),
    precision: nApproved ? tp / nApproved : 0,
    missed: repayers - tp,
    defaults: fp,
  };
}

export const baseRate = (g: GroupId) => bins(g).reduce((s, b) => s + b.repay, 0) / GROUPS.find((x) => x.id === g)!.size;

export const THRESHOLDS = Array.from({ length: BINS + 1 }, (_, i) => i * 5);

// The threshold for group B that makes a measure match group A's at threshold tA.
export function matchThreshold(tA: number, measure: "approved" | "tpr"): number {
  const target = outcome("A", tA)[measure];
  return THRESHOLDS.reduce((best, t) => (Math.abs(outcome("B", t)[measure] - target) < Math.abs(outcome("B", best)[measure] - target) ? t : best), 50);
}

// Bank profit: a repaid loan earns 1, a default loses 4.
export const profit = (o: Outcome, g: GroupId) => {
  const size = GROUPS.find((x) => x.id === g)!.size;
  const tp = o.tpr * baseRate(g) * size;
  return tp - 4 * o.defaults;
};

export const pct = (x: number) => `${Math.round(x * 100)}%`;
