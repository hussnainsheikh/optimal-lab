// One traced request: GET /checkout, broken into spans.
export type Scenario = "normal" | "slow" | "nplus1";
export const SCENARIOS: { id: Scenario; label: string }[] = [
  { id: "normal", label: "Normal" },
  { id: "slow", label: "Slow payment provider" },
  { id: "nplus1", label: "N+1 queries" },
];
export type Span = { name: string; service: string; start: number; ms: number; depth: number; error?: boolean };
export function trace(s: Scenario): Span[] {
  const spans: Span[] = [
    { name: "GET /checkout", service: "gateway", start: 0, ms: 0, depth: 0 },
    { name: "verify token", service: "auth", start: 2, ms: 8, depth: 1 },
    { name: "load cart", service: "checkout", start: 11, ms: 0, depth: 1 },
  ];
  let t = 12;
  if (s === "nplus1") { for (let i = 0; i < 12; i++) { spans.push({ name: `SELECT product WHERE id=${i + 1}`, service: "postgres", start: t, ms: 4, depth: 2 }); t += 5; } }
  else { spans.push({ name: "SELECT … WHERE id IN (…)", service: "postgres", start: t, ms: 6, depth: 2 }); t += 7; }
  spans[2].ms = t - spans[2].start;
  const pay = s === "slow" ? 1400 : 120;
  spans.push({ name: "charge card", service: "payments", start: t + 1, ms: pay, depth: 1, error: s === "slow" });
  spans.push({ name: "POST /charges", service: "stripe (external)", start: t + 3, ms: pay - 4, depth: 2, error: s === "slow" });
  const end = t + 1 + pay + 2;
  spans.push({ name: "publish OrderPlaced", service: "kafka", start: end, ms: 3, depth: 1 });
  spans[0].ms = end + 5;
  return spans;
}
