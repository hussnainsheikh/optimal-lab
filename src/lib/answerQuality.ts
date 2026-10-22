// A RAG assistant over a product's docs, evaluated on eight questions with known
// answers and known relevant chunks. Each bad answer has a cause in one stage:
// retrieval missed the chunk, the chunk was retrieved but ranked too low, or the
// model had the right context and didn't use it (or added things not in it). The
// stage-level metrics and the diagnosis per question are computed from the runs below.

export type Run = {
  q: string;
  relevant: string; // the chunk id that answers it
  retrieved: string[]; // top 10 from the vector search, in order
  reranked: string[]; // the same after a cross-encoder reranker
  useOf: "uses" | "ignores" | "adds"; // what the model does when the relevant chunk is in its context
  strictUse?: "uses" | "ignores" | "adds"; // with a stricter, citation-requiring prompt
};

export const RUNS: Run[] = [
  { q: "How do I rotate an API key?", relevant: "keys-2", retrieved: ["keys-2", "keys-1", "auth-3", "billing-1", "auth-1", "keys-4", "sso-2", "x1", "x2", "x3"], reranked: ["keys-2", "keys-1", "keys-4", "auth-3", "auth-1", "billing-1", "sso-2", "x1", "x2", "x3"], useOf: "uses" },
  { q: "What's the rate limit on the free plan?", relevant: "limits-1", retrieved: ["pricing-2", "pricing-1", "plans-3", "billing-2", "limits-3", "limits-1", "x1", "x2", "x3", "x4"], reranked: ["limits-1", "pricing-2", "limits-3", "pricing-1", "plans-3", "billing-2", "x1", "x2", "x3", "x4"], useOf: "uses" },
  { q: "Can I export data to BigQuery?", relevant: "export-4", retrieved: ["export-1", "export-2", "integr-1", "export-3", "x1", "x2", "x3", "x4", "x5", "x6"], reranked: ["export-1", "export-2", "export-3", "integr-1", "x1", "x2", "x3", "x4", "x5", "x6"], useOf: "uses" },
  { q: "Does SSO work with Okta?", relevant: "sso-1", retrieved: ["sso-1", "sso-2", "auth-1", "x1", "x2", "x3", "x4", "x5", "x6", "x7"], reranked: ["sso-1", "sso-2", "auth-1", "x1", "x2", "x3", "x4", "x5", "x6", "x7"], useOf: "adds", strictUse: "uses" },
  { q: "How long are logs kept?", relevant: "retention-2", retrieved: ["logs-1", "logs-2", "retention-1", "retention-2", "x1", "x2", "x3", "x4", "x5", "x6"], reranked: ["retention-2", "retention-1", "logs-1", "logs-2", "x1", "x2", "x3", "x4", "x5", "x6"], useOf: "ignores", strictUse: "uses" },
  { q: "What regions is data stored in?", relevant: "regions-1", retrieved: ["regions-1", "security-2", "x1", "x2", "x3", "x4", "x5", "x6", "x7", "x8"], reranked: ["regions-1", "security-2", "x1", "x2", "x3", "x4", "x5", "x6", "x7", "x8"], useOf: "uses" },
  { q: "How do I delete my account?", relevant: "account-5", retrieved: ["account-1", "account-2", "billing-3", "account-3", "x1", "x2", "x3", "x4", "x5", "x6"], reranked: ["account-1", "account-2", "account-3", "billing-3", "x1", "x2", "x3", "x4", "x5", "x6"], useOf: "uses" },
  { q: "Is there a webhook for failed payments?", relevant: "webhooks-3", retrieved: ["billing-1", "webhooks-1", "webhooks-2", "payments-2", "x1", "x2", "webhooks-3", "x3", "x4", "x5"], reranked: ["webhooks-3", "webhooks-1", "billing-1", "webhooks-2", "payments-2", "x1", "x2", "x3", "x4", "x5"], useOf: "adds", strictUse: "uses" },
];

export type Settings = { k: number; rerank: boolean; strict: boolean; chunking: boolean };
export const START: Settings = { k: 3, rerank: false, strict: false, chunking: false };
export const KS = [3, 5, 10];

export type Stage = "ok" | "retrieval" | "ranking" | "generation-ignored" | "generation-added";
export const STAGE_LABEL: Record<Stage, string> = {
  ok: "correct",
  retrieval: "retrieval: not in the top 10",
  ranking: "ranking: found, but below the top k",
  "generation-ignored": "generation: had it, didn't use it",
  "generation-added": "generation: added claims not in the context",
};

// Better chunking makes the two chunks that were never found retrievable.
const FIXED_BY_CHUNKING: Record<string, string[]> = {
  "export-4": ["export-4", "export-1", "export-2", "integr-1", "x1", "x2", "x3", "x4", "x5", "x6"],
  "account-5": ["account-1", "account-5", "account-2", "account-3", "x1", "x2", "x3", "x4", "x5", "x6"],
};

export function diagnose(r: Run, s: Settings): { stage: Stage; rank: number | null } {
  let list = s.rerank ? r.reranked : r.retrieved;
  if (s.chunking && FIXED_BY_CHUNKING[r.relevant]) list = FIXED_BY_CHUNKING[r.relevant];
  const rank = list.indexOf(r.relevant);
  if (rank < 0) return { stage: "retrieval", rank: null };
  if (rank >= s.k) return { stage: "ranking", rank: rank + 1 };
  const use = s.strict && r.strictUse ? r.strictUse : r.useOf;
  if (use === "ignores") return { stage: "generation-ignored", rank: rank + 1 };
  if (use === "adds") return { stage: "generation-added", rank: rank + 1 };
  return { stage: "ok", rank: rank + 1 };
}

export type Metrics = { recallAtK: number; precisionAtK: number; faithfulness: number; correctness: number; byStage: Record<Stage, number> };
export function metrics(s: Settings): Metrics {
  const d = RUNS.map((r) => diagnose(r, s));
  const inTopK = d.filter((x) => x.rank !== null && x.rank <= s.k).length;
  const faithful = d.filter((x) => x.rank !== null && x.rank <= s.k && x.stage !== "generation-added").length;
  const byStage = { ok: 0, retrieval: 0, ranking: 0, "generation-ignored": 0, "generation-added": 0 } as Record<Stage, number>;
  for (const x of d) byStage[x.stage]++;
  return {
    recallAtK: inTopK / RUNS.length,
    precisionAtK: inTopK / (RUNS.length * s.k), // one relevant chunk per question
    faithfulness: inTopK ? faithful / inTopK : 0,
    correctness: byStage.ok / RUNS.length,
    byStage,
  };
}
