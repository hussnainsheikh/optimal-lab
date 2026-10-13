// Three developers over two weeks under different branching strategies. Illustrative.
export type Strategy = "trunk" | "feature" | "longlived";
export const STRATEGIES: { id: Strategy; label: string; days: number }[] = [
  { id: "trunk", label: "Trunk-based (merge daily)", days: 1 },
  { id: "feature", label: "Short feature branches (3 days)", days: 3 },
  { id: "longlived", label: "Long-lived branches (2 weeks)", days: 10 },
];
export function simulate(s: Strategy) {
  const d = STRATEGIES.find((x) => x.id === s)!.days;
  const devs = ["Ana", "Ben", "Cy"].map((name, i) => {
    const merges: number[] = [];
    for (let t = d + (i % 2); t <= 10; t += d) merges.push(t);
    if (!merges.length || merges[merges.length - 1] < 10) merges.push(10);
    return { name, merges };
  });
  const conflictLines = Math.round(12 * d * d);
  const leadTimeDays = d / 2 + 0.5;
  const integrations = devs.reduce((a, x) => a + x.merges.length, 0);
  return { devs, conflictLines, leadTimeDays, integrations };
}
