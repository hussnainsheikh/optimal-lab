// Small and on-device models vs bigger hosted ones, task by task.
// Quality scores are a teaching model of a common pattern: small models are close on
// narrow tasks (and closer still after fine-tuning), far behind on reasoning, and an
// on-device model can't take a long document at all. Latency and cost are computed
// from each task's token counts and each model's speed and price.

export type TierId = "device" | "small" | "frontier";

export type Tier = {
  id: TierId;
  label: string;
  where: string;
  overhead: number; // seconds of network and queueing before the first token
  prefill: number; // input tokens read per second
  decode: number; // output tokens written per second
  context: number; // longest input it takes, in tokens
  priceIn: number; // $ per million input tokens
  priceOut: number; // $ per million output tokens
};

export const TIERS: Tier[] = [
  { id: "device", label: "On-device 3B", where: "Runs on the user's phone or laptop, 4-bit", overhead: 0, prefill: 400, decode: 20, context: 8192, priceIn: 0, priceOut: 0 },
  { id: "small", label: "Small hosted", where: "A provider's fast, cheap tier", overhead: 0.3, prefill: 5000, decode: 150, context: 128000, priceIn: 0.1, priceOut: 0.4 },
  { id: "frontier", label: "Frontier hosted", where: "A provider's largest model", overhead: 0.5, prefill: 3000, decode: 60, context: 200000, priceIn: 3, priceOut: 15 },
];

export type Task = {
  id: string;
  label: string;
  input: number; // tokens in
  output: number; // tokens out
  quality: Record<TierId, number>; // share of answers that are right
  tuned: number; // the on-device model after fine-tuning on this task
};

export const TASKS: Task[] = [
  { id: "classify", label: "Tag support tickets", input: 150, output: 5, quality: { device: 0.82, small: 0.9, frontier: 0.94 }, tuned: 0.93 },
  { id: "extract", label: "Pull fields from invoices", input: 800, output: 60, quality: { device: 0.78, small: 0.88, frontier: 0.95 }, tuned: 0.94 },
  { id: "summarize", label: "Summarize an email", input: 600, output: 80, quality: { device: 0.8, small: 0.87, frontier: 0.93 }, tuned: 0.88 },
  { id: "sql", label: "Write a SQL query", input: 300, output: 60, quality: { device: 0.45, small: 0.68, frontier: 0.9 }, tuned: 0.6 },
  { id: "plan", label: "Plan a multi-step trip", input: 400, output: 300, quality: { device: 0.25, small: 0.5, frontier: 0.88 }, tuned: 0.3 },
  { id: "longdoc", label: "Answer from a 100-page contract", input: 60000, output: 100, quality: { device: 0, small: 0.6, frontier: 0.9 }, tuned: 0 },
];

export const tier = (id: TierId) => TIERS.find((t) => t.id === id)!;

export const fits = (task: Task, t: Tier) => task.input + task.output <= t.context;

export function quality(task: Task, id: TierId, tuned: boolean): number {
  if (!fits(task, tier(id))) return 0;
  return id === "device" && tuned ? task.tuned : task.quality[id];
}

export function latency(task: Task, id: TierId): number {
  const t = tier(id);
  return t.overhead + task.input / t.prefill + task.output / t.decode;
}

export const costPer = (task: Task, id: TierId) => (task.input * tier(id).priceIn + task.output * tier(id).priceOut) / 1e6;

export type Choice = Record<string, TierId>;

export const PRESETS: { id: string; label: string; pick: (task: Task, tuned: boolean) => TierId }[] = [
  { id: "frontier", label: "Frontier for everything", pick: () => "frontier" },
  {
    id: "cheapest",
    label: "Cheapest within 4 points",
    pick: (task, tuned) => {
      const score = (id: TierId) => Math.round(quality(task, id, tuned) * 100);
      const best = Math.max(...TIERS.map((t) => score(t.id)));
      return TIERS.find((t) => score(t.id) >= best - 4)!.id;
    },
  },
  { id: "device", label: "On-device where it fits", pick: (task) => (fits(task, tier("device")) ? "device" : "small") },
];

export const choose = (presetId: string, tuned: boolean): Choice =>
  Object.fromEntries(TASKS.map((task) => [task.id, PRESETS.find((p) => p.id === presetId)!.pick(task, tuned)]));

// Totals for a choice, with every task getting the same number of requests a month.
export function totals(choice: Choice, tuned: boolean, perTaskMonthly: number) {
  const rows = TASKS.map((task) => ({ task, tier: choice[task.id], q: quality(task, choice[task.id], tuned), s: latency(task, choice[task.id]), cost: costPer(task, choice[task.id]) * perTaskMonthly }));
  return {
    rows,
    quality: rows.reduce((s, r) => s + r.q, 0) / rows.length,
    cost: rows.reduce((s, r) => s + r.cost, 0),
    onDevice: rows.filter((r) => r.tier === "device").length,
  };
}

export const VOLUMES = [10_000, 100_000, 1_000_000];
export const usd = (x: number) => (x >= 100 ? `$${Math.round(x).toLocaleString("en-US")}` : `$${x.toFixed(2)}`);
export const secs = (x: number) => (x < 1 ? `${Math.round(x * 1000)} ms` : `${x.toFixed(1)} s`);
export const pct = (x: number) => `${Math.round(x * 100)}%`;
