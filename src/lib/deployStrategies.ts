// Ship v2 (which fails 30% of requests) to 10 instances, 1,000 requests per step.
export type Strategy = "rolling" | "blue-green" | "canary";
export const STRATEGIES: { id: Strategy; label: string }[] = [
  { id: "rolling", label: "Rolling update" },
  { id: "blue-green", label: "Blue-green" },
  { id: "canary", label: "Canary with auto-rollback" },
];
const FAIL = 0.3, PER = 1000;

export function run(s: Strategy) {
  const plan = s === "rolling" ? [2, 4, 6, 8, 10, 10] : s === "blue-green" ? [0, 10, 10, 0, 0, 0] : [1, 1, 0, 0, 0, 0];
  const notes = s === "rolling" ? ["2 of 10 replaced", "4 of 10", "6 of 10", "8 of 10", "all on v2", "errors noticed by a human; rollback starts"]
    : s === "blue-green" ? ["green (v2) warmed up, no traffic", "switch the load balancer: 100% on v2", "error alert fires", "switch back to blue: instant rollback", "", ""]
    : ["1 instance (10%) gets v2", "canary error rate 30% vs 0.1% baseline", "automatic rollback", "", "", ""];
  let bad = 0;
  const steps = plan.map((v2, i) => { const b = Math.round(PER * (v2 / 10) * FAIL); bad += b; return { step: i + 1, v2, bad: b, note: notes[i] }; });
  return { steps, bad };
}
