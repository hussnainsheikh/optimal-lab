// A company assistant searches every team's documents. Each document has an access
// list. When Dev from support asks a question, retrieval must only return what Dev
// may open. Four ways to enforce that are run on the same query; what leaks, what's
// lost, and how long a revoked permission keeps working are computed.

export type Doc = { id: string; title: string; groups: string[]; score: number };
// Similarity to the query "what is the refund policy for enterprise customers?", already computed.
export const DOCS: Doc[] = [
  { id: "d1", title: "Enterprise contract template (legal)", groups: ["legal"], score: 0.91 },
  { id: "d2", title: "Q3 enterprise discounts and margins (finance)", groups: ["finance"], score: 0.89 },
  { id: "d3", title: "Refund policy: enterprise plans", groups: ["all"], score: 0.87 },
  { id: "d4", title: "Board notes: refund liabilities (exec)", groups: ["exec"], score: 0.85 },
  { id: "d5", title: "Support macro: enterprise refunds", groups: ["support"], score: 0.84 },
  { id: "d6", title: "Salary bands 2026 (HR)", groups: ["hr"], score: 0.62 },
  { id: "d7", title: "Refund FAQ for customers", groups: ["all"], score: 0.8 },
  { id: "d8", title: "Escalation runbook: refunds over €10k", groups: ["support"], score: 0.78 },
  { id: "d9", title: "Acme Corp account notes (sales)", groups: ["sales"], score: 0.76 },
  { id: "d10", title: "Refund fraud cases (security)", groups: ["security"], score: 0.74 },
];
export const USER = { name: "Dev", groups: ["support", "all"] };
export const K = 5;

export type Strategy = "none" | "prompt" | "post" | "pre";
export const STRATEGIES: { id: Strategy; label: string; one: string }[] = [
  { id: "none", label: "No filter", one: "Search everything; send the top 5 to the model." },
  { id: "prompt", label: "Tell the model", one: "Search everything; the prompt says which documents the user may see and asks the model not to use the others." },
  { id: "post", label: "Filter after search", one: "Take the top 5, then drop the ones the user can't open." },
  { id: "pre", label: "Filter inside the search", one: "Store each document's groups as metadata; the vector search only considers documents the user may open." },
];

const allowed = (d: Doc) => d.groups.some((g) => USER.groups.includes(g));

export type Result = { inContext: Doc[]; leaked: Doc[]; missedAllowed: Doc[]; note: string };

export function run(s: Strategy): Result {
  const ranked = [...DOCS].sort((a, b) => b.score - a.score);
  const visibleTop = ranked.filter(allowed).slice(0, K);
  let inContext: Doc[];
  let note: string;
  if (s === "none") {
    inContext = ranked.slice(0, K);
    note = "The model gets contract templates, margins and board notes, and quotes them.";
  } else if (s === "prompt") {
    inContext = ranked.slice(0, K);
    note = "The forbidden documents are in the context. A rule in the prompt is a request, not a control: one rephrased question and the margins come out.";
  } else if (s === "post") {
    inContext = ranked.slice(0, K).filter(allowed);
    note = `Nothing leaks, but only ${inContext.length} of 5 slots survive; better allowed documents ranked 6th and lower were never fetched.`;
  } else {
    inContext = visibleTop;
    note = "The search only ever sees documents Dev may open, so the top 5 are the 5 best of those.";
  }
  const leaked = inContext.filter((d) => !allowed(d));
  const missedAllowed = visibleTop.filter((d) => !inContext.includes(d));
  return { inContext, leaked, missedAllowed, note };
}

// Revocation: Dev leaves the support group at 10:00. How long can Dev still retrieve support documents?
export const SYNC = [
  { id: "nightly", label: "Re-index permissions nightly", minutes: 14 * 60 },
  { id: "hourly", label: "Sync permissions hourly", minutes: 30 },
  { id: "event", label: "Update on group-change events", minutes: 1 },
  { id: "query", label: "Check the source of truth at query time", minutes: 0 },
] as const;
