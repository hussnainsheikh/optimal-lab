// Benchmarks: five made-up models on three made-up benchmarks, each showing one way
// a leaderboard misleads.
//  - noise:          a score from n questions has a 95% interval of ±1.96·√(p(1−p)/n),
//                    so close scores on a small test are a tie.
//  - saturation:     an old benchmark everyone scores ~90% on. About 6.5% of MMLU's
//                    questions have errors (Gema et al. 2024, "Are We Done with MMLU?"),
//                    so the top few points measure noise in the labels, not skill.
//  - contamination:  one model saw the test questions in training. Rephrase the
//                    questions and its score drops; the others barely move.

export const MODELS = ["Model A", "Model B", "Model C", "Model D", "Model E"] as const;
export type ModelName = (typeof MODELS)[number];

export type BenchId = "fresh" | "saturated" | "leaked";

export type Bench = {
  id: BenchId;
  label: string;
  what: string;
  questions: number; // the real size of the test
  ceiling: number | null; // best possible score, given label errors
  scores: Record<ModelName, number>;
  rephrased?: Record<ModelName, number>; // same questions, new wording
  leaked?: ModelName;
};

export const BENCHES: Bench[] = [
  {
    id: "fresh",
    label: "New and hard",
    what: "Released this year, questions kept private. Scores are spread out and still far from the top.",
    questions: 400,
    ceiling: null,
    scores: { "Model A": 0.41, "Model B": 0.48, "Model C": 0.35, "Model D": 0.52, "Model E": 0.44 },
  },
  {
    id: "saturated",
    label: "Old and saturated",
    what: "Released years ago, now in every training mix. Every model scores about 90%.",
    questions: 14042, // the size of MMLU's test set
    ceiling: 0.935,
    scores: { "Model A": 0.898, "Model B": 0.906, "Model C": 0.901, "Model D": 0.91, "Model E": 0.903 },
  },
  {
    id: "leaked",
    label: "Leaked into training",
    what: "Its questions were copied onto the web, and one model's training data scraped them.",
    questions: 1000,
    ceiling: null,
    scores: { "Model A": 0.71, "Model B": 0.76, "Model C": 0.88, "Model D": 0.79, "Model E": 0.73 },
    rephrased: { "Model A": 0.7, "Model B": 0.745, "Model C": 0.66, "Model D": 0.775, "Model E": 0.72 },
    leaked: "Model C",
  },
];

export const SIZES = [50, 200, 1000, 5000, 14042];

// Half-width of the 95% interval for a score p measured on n questions.
export const margin = (p: number, n: number) => 1.96 * Math.sqrt((p * (1 - p)) / n);

export type Row = { model: ModelName; score: number; lo: number; hi: number; rank: number; tiedWith: ModelName[] };

// Ranked rows. Two models are tied when their intervals overlap.
export function leaderboard(bench: Bench, n: number, rephrased = false): Row[] {
  const s = rephrased && bench.rephrased ? bench.rephrased : bench.scores;
  const rows = MODELS.map((model) => {
    const m = margin(s[model], n);
    return { model, score: s[model], lo: s[model] - m, hi: s[model] + m };
  }).sort((a, b) => b.score - a.score);
  return rows.map((r, i) => ({
    ...r,
    rank: i + 1,
    tiedWith: rows.filter((o) => o.model !== r.model && o.lo <= r.hi && r.lo <= o.hi).map((o) => o.model),
  }));
}

// How many of the 10 pairs of models can be told apart: their intervals don't overlap.
export function separablePairs(rows: Row[]): { apart: number; pairs: number } {
  let apart = 0;
  let pairs = 0;
  for (let i = 0; i < rows.length; i++)
    for (let j = i + 1; j < rows.length; j++) {
      pairs++;
      if (rows[j].hi < rows[i].lo) apart++;
    }
  return { apart, pairs };
}

export const pct = (x: number, d = 0) => `${(x * 100).toFixed(d)}%`;
