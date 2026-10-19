// One run of a support agent that took 41 seconds and cost far more than usual. A
// trace records every model call and tool call as a span with its parent, timing,
// tokens and status. The waterfall, the slowest and most expensive spans, and the
// cost of keeping traces at different sampling rates are computed from the spans.

export type Span = { id: string; parent: string | null; name: string; kind: "agent" | "llm" | "tool" | "retrieval"; start: number; ms: number; tokensIn?: number; tokensOut?: number; status: "ok" | "error"; note?: string };

export const SPANS: Span[] = [
  { id: "root", parent: null, name: "handle_ticket #4471", kind: "agent", start: 0, ms: 41200, status: "ok" },
  { id: "s1", parent: "root", name: "llm: plan", kind: "llm", start: 0, ms: 2100, tokensIn: 3200, tokensOut: 180, status: "ok" },
  { id: "s2", parent: "root", name: "retrieve: help docs", kind: "retrieval", start: 2100, ms: 450, status: "ok" },
  { id: "s3", parent: "root", name: "tool: get_order(4471)", kind: "tool", start: 2550, ms: 5000, status: "error", note: "timeout after 5 s" },
  { id: "s4", parent: "root", name: "llm: decide", kind: "llm", start: 7550, ms: 1900, tokensIn: 6800, tokensOut: 90, status: "ok" },
  { id: "s5", parent: "root", name: "tool: get_order(4471)", kind: "tool", start: 9450, ms: 5000, status: "error", note: "timeout after 5 s" },
  { id: "s6", parent: "root", name: "llm: decide", kind: "llm", start: 14450, ms: 2000, tokensIn: 7400, tokensOut: 95, status: "ok" },
  { id: "s7", parent: "root", name: "tool: get_order(4471)", kind: "tool", start: 16450, ms: 5000, status: "error", note: "timeout after 5 s" },
  { id: "s8", parent: "root", name: "llm: decide", kind: "llm", start: 21450, ms: 2100, tokensIn: 8000, tokensOut: 110, status: "ok" },
  { id: "s9", parent: "root", name: "tool: search_orders(email)", kind: "tool", start: 23550, ms: 9800, status: "ok", note: "full table scan" },
  { id: "s10", parent: "root", name: "llm: answer", kind: "llm", start: 33350, ms: 7850, tokensIn: 41000, tokensOut: 620, status: "ok", note: "tool result: 2,300 orders pasted into the prompt" },
];

export const PRICE_IN = 3 / 1e6;
export const PRICE_OUT = 15 / 1e6;
export const spanCost = (s: Span) => (s.tokensIn ?? 0) * PRICE_IN + (s.tokensOut ?? 0) * PRICE_OUT;
export const totalCost = () => SPANS.reduce((a, s) => a + spanCost(s), 0);
export const TYPICAL_COST = 0.04;
export const TYPICAL_MS = 9000;

export const FINDINGS = [
  { id: "retry", label: "The same failing call, three times", spans: ["s3", "s5", "s7"], fix: "Give get_order a 1 s timeout and stop retrying a call that timed out twice." },
  { id: "scan", label: "A fallback tool that scans every order", spans: ["s9"], fix: "Add an index on email to search_orders and cap its results." },
  { id: "bloat", label: "2,300 orders pasted into the prompt", spans: ["s10"], fix: "Return only the matching order's fields from the tool, not every row." },
];

export type View = "logs" | "trace";

// Storage for traces: spans per run × runs a day × bytes per span.
export const RUNS_PER_DAY = 200_000;
export const BYTES_PER_SPAN = 4_000; // with prompts and outputs truncated
export const SAMPLING = [
  { id: "all", label: "Keep every trace", rate: 1, errorsAlways: false },
  { id: "ten", label: "Keep 10%", rate: 0.1, errorsAlways: false },
  { id: "tail", label: "Keep 5%, plus every slow or failed run", rate: 0.05, errorsAlways: true },
] as const;
export const ERROR_OR_SLOW_SHARE = 0.03;
export function storagePerDay(rate: number, errorsAlways: boolean): { gb: number; keepsThisRun: string } {
  const kept = errorsAlways ? rate * (1 - ERROR_OR_SLOW_SHARE) + ERROR_OR_SLOW_SHARE : rate;
  const gb = (RUNS_PER_DAY * kept * SPANS.length * BYTES_PER_SPAN) / 1e9;
  const keepsThisRun = errorsAlways || rate === 1 ? "always" : `${Math.round(rate * 100)}% of the time`;
  return { gb, keepsThisRun };
}
