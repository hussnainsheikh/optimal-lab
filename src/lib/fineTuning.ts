// Fine-tuning: train a model on your own examples, and when that beats prompting or RAG.
// A teaching model of the usual pattern. Fine-tuning is excellent at format and tone,
// slow to teach a new skill, and poor at adding facts (which RAG does well). Too many
// epochs on a small set overfit, and every epoch of narrow data costs a little general
// ability. The costs use typical hosted prices.

export type GoalId = "format" | "tone" | "facts" | "skill";

export type Goal = {
  id: GoalId;
  label: string;
  what: string;
  ceiling: number; // the best fine-tuning can reach
  n0: number; // examples needed to get most of the way there
  prompt: number; // score with instructions only
  fewShot: number; // instructions plus a few examples in the prompt
  rag: number; // retrieval of the relevant documents
};

export const GOALS: Goal[] = [
  { id: "format", label: "Always answer in our JSON schema", what: "A shape the model has to reproduce every time.", ceiling: 0.98, n0: 40, prompt: 0.82, fewShot: 0.93, rag: 0.82 },
  { id: "tone", label: "Write in our brand voice", what: "A style: short sentences, no exclamation marks, British spelling.", ceiling: 0.94, n0: 150, prompt: 0.7, fewShot: 0.8, rag: 0.7 },
  { id: "facts", label: "Know our product catalogue", what: "Thousands of facts that change every month.", ceiling: 0.6, n0: 2000, prompt: 0.2, fewShot: 0.25, rag: 0.92 },
  { id: "skill", label: "Solve our scheduling puzzles", what: "A new kind of reasoning the base model is bad at.", ceiling: 0.8, n0: 1500, prompt: 0.35, fewShot: 0.42, rag: 0.36 },
];

export const EXAMPLE_COUNTS = [20, 200, 2000];
export const EPOCH_COUNTS = [1, 3, 10];
export const GENERAL_BASE = 0.9; // the base model's score on a general benchmark

// Overfitting: with few examples and many epochs the model memorizes them.
export function overfit(n: number, epochs: number): number {
  return Math.max(0, epochs - 2) * (120 / (n + 120)) * 0.04;
}

export function taskScore(goal: Goal, n: number, epochs: number): number {
  const seen = n * Math.min(epochs, 4); // passes beyond 4 don't teach anything new
  return goal.ceiling * (1 - Math.exp(-seen / (goal.n0 * 2))) * (1 - overfit(n, epochs));
}

// Catastrophic forgetting: narrow training pushes general ability down a little per epoch.
export function generalScore(epochs: number, mixGeneral: boolean): number {
  const drop = 0.012 * epochs;
  return Math.max(0, GENERAL_BASE - (mixGeneral ? drop * 0.25 : drop));
}

// Training and held-out loss after each epoch, 1..10.
export function lossCurves(goal: Goal, n: number): { train: number[]; held: number[] } {
  const rate = n / (goal.n0 * 2);
  const train: number[] = [];
  const held: number[] = [];
  for (let e = 1; e <= 10; e++) {
    train.push(0.25 + 1.4 * Math.exp(-rate * e) * (1 - 0.6 * (1 - Math.exp(-e / 4))));
    held.push(0.4 + 1.3 * Math.exp(-rate * Math.min(e, 4)) + overfit(n, e) * 6);
  }
  return { train, held };
}

export const PRICE = {
  train: 25, // $ per million training tokens
  input: 3, // $ per million input tokens, base model
  tunedInput: 3.75, // fine-tuned models usually cost a little more to run
  output: 15,
  tunedOutput: 18.75,
};
export const TOKENS = { example: 300, request: 400, answer: 150, fewShot: 600, rag: 1500 };

export const trainingCost = (n: number, epochs: number) => (n * epochs * TOKENS.example * PRICE.train) / 1e6;

// Cost of one million requests with each approach.
export function servingCost(method: "prompt" | "fewShot" | "rag" | "tuned"): number {
  const extra = method === "fewShot" ? TOKENS.fewShot : method === "rag" ? TOKENS.rag : 0;
  const inPrice = method === "tuned" ? PRICE.tunedInput : PRICE.input;
  const outPrice = method === "tuned" ? PRICE.tunedOutput : PRICE.output;
  return ((TOKENS.request + extra) * inPrice + TOKENS.answer * outPrice);
}

export const usd = (x: number) => (x >= 1000 ? `$${Math.round(x).toLocaleString("en-US")}` : x >= 10 ? `$${x.toFixed(0)}` : `$${x.toFixed(2)}`);
export const pct = (x: number) => `${Math.round(x * 100)}%`;
