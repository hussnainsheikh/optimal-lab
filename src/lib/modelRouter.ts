// Routing requests across model providers, with an outage on the main one.
export type Policy = "single" | "fallback" | "cost";
export const POLICIES: { id: Policy; label: string }[] = [
  { id: "single", label: "One provider" },
  { id: "fallback", label: "Fallback chain" },
  { id: "cost", label: "Route by difficulty" },
];
export const MODELS = {
  big: { label: "Big model, provider A", price: 10 },
  alt: { label: "Big model, provider B", price: 12 },
  small: { label: "Small model", price: 1 },
} as const;
export type ModelId = keyof typeof MODELS;
export const REQUESTS = ["simple", "complex", "simple", "simple", "complex", "simple", "simple", "complex", "simple", "simple", "simple", "complex"] as const;
const DOWN = (i: number) => i >= 3 && i <= 6;

export function run(p: Policy) {
  const rows = REQUESTS.map((kind, i) => {
    const chain: ModelId[] = p === "single" ? ["big"] : p === "fallback" ? ["big", "alt"] : kind === "simple" ? ["small", "big", "alt"] : ["big", "alt"];
    const tried: ModelId[] = [];
    for (const m of chain) {
      tried.push(m);
      if (!(m === "big" && DOWN(i))) return { i, kind, served: m as ModelId | null, tried, down: DOWN(i) };
    }
    return { i, kind, served: null, tried, down: DOWN(i) };
  });
  const cost = rows.reduce((a, r) => a + (r.served ? MODELS[r.served].price : 0), 0);
  return { rows, cost, errors: rows.filter((r) => !r.served).length };
}
