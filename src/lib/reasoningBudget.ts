// Reasoning models and thinking budgets. A reasoning model writes hidden thinking
// tokens before its answer; the budget caps how many. Each request has a difficulty:
// easy requests are answered as well with no thinking, hard ones keep improving for
// thousands of tokens. The curves are a teaching model of that pattern (including a
// small drop on easy questions at very large budgets: overthinking); the costs and
// latencies follow from the token counts.

export type Difficulty = "easy" | "medium" | "hard";

export const LEVELS: Record<Difficulty, { label: string; base: number; max: number; need: number; thinks: number }> = {
  // base: accuracy with no thinking; max: the ceiling; need: tokens to get most of the way; thinks: tokens the model uses when the budget allows
  easy: { label: "easy", base: 0.92, max: 0.95, need: 150, thinks: 300 },
  medium: { label: "medium", base: 0.55, max: 0.9, need: 1200, thinks: 3000 },
  hard: { label: "hard", base: 0.2, max: 0.85, need: 6000, thinks: 20000 },
};

export type Request = { id: number; text: string; difficulty: Difficulty };

export const REQUESTS: Request[] = [
  { id: 1, text: "What's the capital of Portugal?", difficulty: "easy" },
  { id: 2, text: "Rewrite this sentence in the past tense.", difficulty: "easy" },
  { id: 3, text: "Convert 18:30 UTC to Lahore time.", difficulty: "easy" },
  { id: 4, text: "Summarize this paragraph in one line.", difficulty: "easy" },
  { id: 5, text: "Which of these four SQL queries has a bug?", difficulty: "medium" },
  { id: 6, text: "Plan a 3-day itinerary with these constraints.", difficulty: "medium" },
  { id: 7, text: "Why does this test pass locally but fail in CI?", difficulty: "medium" },
  { id: 8, text: "Estimate the storage for this photo app.", difficulty: "medium" },
  { id: 9, text: "Prove this inequality holds for all n.", difficulty: "hard" },
  { id: 10, text: "Find the race condition in this 200-line service.", difficulty: "hard" },
  { id: 11, text: "Schedule 12 shifts under these 9 rules.", difficulty: "hard" },
  { id: 12, text: "Derive the time complexity of this recursion.", difficulty: "hard" },
];

export const BUDGETS = [0, 500, 2000, 8000, 32000];
export const PRICE = { input: 3, output: 15 }; // $ per million tokens; thinking is billed as output
export const TOKENS = { prompt: 400, answer: 200 };
export const SPEED = 80; // thinking tokens per second

// A model given a bigger budget uses more of it, even on easy questions: it needs
// `thinks` tokens to solve the problem and spends about a quarter of the rest checking.
export const thinkingUsed = (d: Difficulty, budget: number) => Math.round(Math.min(budget, LEVELS[d].thinks + 0.25 * budget));

export function accuracy(d: Difficulty, budget: number): number {
  const l = LEVELS[d];
  const used = Math.min(budget, l.thinks);
  const gain = (l.max - l.base) * (1 - Math.exp(-used / l.need));
  // Overthinking: a long budget on an easy question lets it second-guess a right answer.
  const over = d === "easy" && budget > 2000 ? 0.02 * Math.log2(budget / 2000) : 0;
  return Math.max(0, l.base + gain - over);
}

export const costOf = (thinking: number) => (TOKENS.prompt * PRICE.input + (thinking + TOKENS.answer) * PRICE.output) / 1e6;
export const latencyOf = (thinking: number) => 0.5 + (thinking + TOKENS.answer) / SPEED;

export type Mode = "fixed" | "routed";
export const ROUTER_ACCURACY = 0.9; // how often a small classifier judges the difficulty right
export const ROUTED: Record<Difficulty, number> = { easy: 0, medium: 8000, hard: 32000 };

export type Row = { request: Request; budget: number; thinking: number; accuracy: number; cost: number; latency: number };

// Under routing, a misjudged request gets its neighbour's budget: deterministic, the
// 10% of requests the router gets wrong are the ones whose id is a multiple of 10.
export function run(mode: Mode, budget: number): Row[] {
  return REQUESTS.map((r) => {
    let b = budget;
    if (mode === "routed") {
      const wrong = r.id % 10 === 0;
      const d: Difficulty = !wrong ? r.difficulty : r.difficulty === "hard" ? "medium" : r.difficulty === "medium" ? "easy" : "medium";
      b = ROUTED[d];
    }
    const thinking = thinkingUsed(r.difficulty, b);
    return { request: r, budget: b, thinking, accuracy: accuracy(r.difficulty, b), cost: costOf(thinking), latency: latencyOf(thinking) };
  });
}

export function totals(rows: Row[]) {
  const lat = rows.map((r) => r.latency).sort((a, b) => a - b);
  return {
    accuracy: rows.reduce((s, r) => s + r.accuracy, 0) / rows.length,
    cost: rows.reduce((s, r) => s + r.cost, 0),
    thinking: rows.reduce((s, r) => s + r.thinking, 0),
    p50: lat[Math.floor(lat.length / 2)],
    max: lat[lat.length - 1],
  };
}

export const pct = (x: number) => `${Math.round(x * 100)}%`;
export const usd = (x: number) => (x >= 1 ? `$${x.toFixed(2)}` : `${(x * 100).toFixed(1)}¢`);
export const secs = (x: number) => (x >= 60 ? `${(x / 60).toFixed(1)} min` : `${x.toFixed(1)} s`);
