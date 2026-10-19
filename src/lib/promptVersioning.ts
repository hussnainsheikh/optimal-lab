// A support assistant's prompt gets a change that makes answers better formatted
// overall, and quietly breaks refund requests. How many customers meet the broken
// version depends on how the change ships: edited in place, gated by an eval of the
// average, gated by an eval per slice, and rolled out as a canary with a version you
// can roll back to. Pass rates per slice are given; everything else is computed.

export type Slice = { id: string; label: string; share: number; v1: number; v2: number };
export const SLICES: Slice[] = [
  { id: "orders", label: "Order status", share: 0.4, v1: 0.9, v2: 0.96 },
  { id: "shipping", label: "Shipping questions", share: 0.3, v1: 0.88, v2: 0.95 },
  { id: "refunds", label: "Refunds", share: 0.1, v1: 0.92, v2: 0.55 },
  { id: "other", label: "Everything else", share: 0.2, v1: 0.85, v2: 0.9 },
];
export const EVAL_CASES_PER_SLICE = 25;
export const CONVERSATIONS_PER_HOUR = 2000;
export const HOURS_TO_NOTICE_FROM_COMPLAINTS = 36;
export const CANARY_SHARE = 0.05;
export const CANARY_HOURS = 6; // the online metric (refund escalations) needs this long to show a significant rise
export const GATE_MIN_PASS = 0.85; // per slice

export type Practice = "inPlace" | "avgEval" | "sliceEval" | "canary";
export const PRACTICES: { id: Practice; label: string; one: string }[] = [
  { id: "inPlace", label: "Edit the prompt in place", one: "Change the text in the dashboard; it's live for everyone at once. No record of what it was." },
  { id: "avgEval", label: "Gate on the average score", one: "Run the eval suite; ship if the overall pass rate didn't drop." },
  { id: "sliceEval", label: "Gate on every slice", one: "Ship only if no slice of the eval falls below its bar." },
  { id: "canary", label: "Slice gate + versioned canary", one: "Pin prompt@v2, send 5% of traffic to it, watch an online metric, keep v1 one click away." },
];

export const average = (key: "v1" | "v2") => SLICES.reduce((s, x) => s + x.share * x[key], 0);

export type Result = {
  shipped: boolean; // v2 reached anyone
  caughtBy: string;
  badConversations: number; // refund conversations answered wrongly because of v2 (beyond v1's own failures)
  rollbackMinutes: number | null;
  avgV1: number;
  avgV2: number;
  failingSlices: Slice[];
};

export function run(p: Practice, regressionPresent = true): Result {
  const slices = regressionPresent ? SLICES : SLICES.map((s) => (s.id === "refunds" ? { ...s, v2: 0.93 } : s));
  const avgV1 = slices.reduce((s, x) => s + x.share * x.v1, 0);
  const avgV2 = slices.reduce((s, x) => s + x.share * x.v2, 0);
  const failingSlices = slices.filter((s) => s.v2 < GATE_MIN_PASS);
  const refunds = slices.find((s) => s.id === "refunds")!;
  const extraFailRate = Math.max(0, refunds.v1 - refunds.v2); // additional refund conversations that go wrong
  const perHour = CONVERSATIONS_PER_HOUR * refunds.share * extraFailRate;
  if (p === "inPlace") {
    return { shipped: true, caughtBy: `customer complaints after ${HOURS_TO_NOTICE_FROM_COMPLAINTS} h`, badConversations: Math.round(perHour * HOURS_TO_NOTICE_FROM_COMPLAINTS), rollbackMinutes: 90, avgV1, avgV2, failingSlices };
  }
  if (p === "avgEval") {
    const passes = avgV2 >= avgV1;
    return {
      shipped: passes,
      caughtBy: passes ? `complaints after ${HOURS_TO_NOTICE_FROM_COMPLAINTS} h: the average went up, so the gate passed` : "the average eval",
      badConversations: passes ? Math.round(perHour * HOURS_TO_NOTICE_FROM_COMPLAINTS) : 0,
      rollbackMinutes: passes ? 10 : null,
      avgV1,
      avgV2,
      failingSlices,
    };
  }
  if (p === "sliceEval") {
    const blocked = failingSlices.length > 0;
    return { shipped: !blocked, caughtBy: blocked ? `the eval: ${failingSlices.map((s) => s.label.toLowerCase()).join(", ")} below ${Math.round(GATE_MIN_PASS * 100)}%` : "nothing to catch", badConversations: 0, rollbackMinutes: null, avgV1, avgV2, failingSlices };
  }
  // canary: the slice gate runs first; if it misses something, the canary limits the damage
  const blocked = failingSlices.length > 0;
  if (blocked) return { shipped: false, caughtBy: "the eval, before any customer saw it", badConversations: 0, rollbackMinutes: null, avgV1, avgV2, failingSlices };
  return { shipped: true, caughtBy: "nothing to catch", badConversations: Math.round(perHour * CANARY_SHARE * CANARY_HOURS), rollbackMinutes: 1, avgV1, avgV2, failingSlices };
}

// The same practices when the eval set has no refund cases at all (a gap in coverage).
export function runWithoutRefundCases(p: Practice): Result {
  const base = run(p);
  if (p === "sliceEval" || p === "canary") {
    const refunds = SLICES.find((s) => s.id === "refunds")!;
    const perHour = CONVERSATIONS_PER_HOUR * refunds.share * (refunds.v1 - refunds.v2);
    if (p === "sliceEval") return { ...base, shipped: true, failingSlices: [], caughtBy: `complaints after ${HOURS_TO_NOTICE_FROM_COMPLAINTS} h: no refund cases in the eval`, badConversations: Math.round(perHour * HOURS_TO_NOTICE_FROM_COMPLAINTS), rollbackMinutes: 10 };
    return { ...base, shipped: true, failingSlices: [], caughtBy: `the canary's escalation rate after ${CANARY_HOURS} h`, badConversations: Math.round(perHour * CANARY_SHARE * CANARY_HOURS), rollbackMinutes: 1 };
  }
  return base;
}

export const PROMPT_V1 = `You are the support assistant for Northwind.
Answer in plain sentences. If the customer asks for a refund,
check the order date: refunds are allowed within 30 days.`;
export const PROMPT_V2 = `You are the support assistant for Northwind.
Answer in short bullet points with a heading.
Keep every answer under 60 words.`;
