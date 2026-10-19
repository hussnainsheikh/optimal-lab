// Design a document assistant: a company's documents are synced with their
// permissions, chunked and embedded; a question retrieves only what the asker may
// read, the answer cites its sources, and each citation is checked.

// Ingestion and storage at scale.
export const DOC_COUNTS = [100_000, 1_000_000, 10_000_000];
export const CHUNKS_PER_DOC = 12;
export const TOKENS_PER_CHUNK = 400;
export const DIMS = [768, 1536, 3072];
export type Precision = "float32" | "int8";
export const EMBED_PRICE_PER_M = 0.02; // $ per million tokens embedded

export function index(docs: number, dims: number, p: Precision) {
  const chunks = docs * CHUNKS_PER_DOC;
  const bytes = chunks * dims * (p === "float32" ? 4 : 1);
  const embedCost = ((chunks * TOKENS_PER_CHUNK) / 1e6) * EMBED_PRICE_PER_M;
  return { chunks, gb: bytes / 1e9, embedCost };
}

export type Sync = "nightly" | "webhooks";
export const SYNCS: { id: Sync; label: string; staleMin: number; one: string }[] = [
  { id: "nightly", label: "Nightly crawl", staleMin: 12 * 60, one: "Re-read every source each night. Edits and permission changes wait up to a day." },
  { id: "webhooks", label: "Change events", staleMin: 1, one: "Sources send a webhook on every edit or sharing change; only that document is re-indexed." },
];

// One question against eight chunks.
export const QUESTION = "What's our refund policy for enterprise customers?";
export type Chunk = { id: string; title: string; groups: string[]; score: number; claim: string };
export const CHUNKS: Chunk[] = [
  { id: "c2", title: "Enterprise contract template, refund clause", groups: ["legal"], score: 0.88, claim: "Enterprise contracts allow a full refund within 90 days." },
  { id: "c3", title: "Support playbook: enterprise refund exceptions", groups: ["support"], score: 0.85, claim: "Support may approve exceptions up to €5,000 with a team lead." },
  { id: "c1", title: "Refund policy", groups: ["all"], score: 0.82, claim: "Refunds are available within 30 days of purchase." },
  { id: "c4", title: "Q3 refunds by customer", groups: ["finance"], score: 0.79, claim: "Q3 refunds to enterprise customers totalled €412,000." },
  { id: "c5", title: "Board notes: refund liability", groups: ["board"], score: 0.77, claim: "The board expects refund liability to double next year." },
  { id: "c6", title: "Support macro: issuing a refund", groups: ["support"], score: 0.74, claim: "Issue refunds from the billing console under Orders → Refund." },
  { id: "c8", title: "Enterprise SLA credits", groups: ["all"], score: 0.72, claim: "SLA breaches earn service credits, not refunds." },
  { id: "c7", title: "Pricing FAQ", groups: ["all"], score: 0.7, claim: "Annual plans are billed up front." },
];
export const K = 4;

export const USERS = [
  { id: "support", label: "Support agent", groups: ["support", "all"] },
  { id: "finance", label: "Finance analyst", groups: ["finance", "all"] },
  { id: "contractor", label: "Contractor", groups: ["all"] },
] as const;
export type UserId = (typeof USERS)[number]["id"];

export function retrieve(user: UserId, filter: boolean) {
  const u = USERS.find((x) => x.id === user)!;
  const can = (c: Chunk) => c.groups.some((g) => (u.groups as readonly string[]).includes(g));
  const pool = filter ? CHUNKS.filter(can) : CHUNKS;
  const context = [...pool].sort((a, b) => b.score - a.score).slice(0, K);
  return { context, leaked: context.filter((c) => !can(c)), can };
}

// The model's answer: one claim per context chunk, plus one it got wrong: it says 60
// days and cites the refund policy, which says 30.
export const WRONG = { claim: "Enterprise customers get 60 days instead of 30.", cites: "c1" };

export function answer(user: UserId, filter: boolean, verify: boolean) {
  const r = retrieve(user, filter);
  const claims = r.context.map((c) => ({ text: c.claim, cites: c.id, supported: true, leaked: r.leaked.includes(c) }));
  const wrong = { text: WRONG.claim, cites: WRONG.cites, supported: false, leaked: false };
  const all = r.context.some((c) => c.id === WRONG.cites) ? [...claims, wrong] : claims;
  const shown = verify ? all.filter((c) => c.supported) : all;
  return { ...r, claims: all, shown, unsupportedShown: shown.filter((c) => !c.supported).length, flagged: all.length - shown.length };
}

// Cost and latency per question.
export const MODELS = [
  { id: "small", label: "Small model", inPerM: 0.25, outPerM: 1.25, tokPerS: 150 },
  { id: "large", label: "Large model", inPerM: 3, outPerM: 15, tokPerS: 60 },
] as const;
export type ModelId = (typeof MODELS)[number]["id"];
export const QUESTIONS_PER_DAY = 20_000;
export const ANSWER_TOKENS = 300;
export const PROMPT_TOKENS = 500; // instructions + question
export const RETRIEVE_MS = 60;
export const RERANK_MS = 120;
export const VERIFY_MS = 400;

export function perQuestion(model: ModelId, verify: boolean) {
  const m = MODELS.find((x) => x.id === model)!;
  const inTok = PROMPT_TOKENS + K * TOKENS_PER_CHUNK;
  const cost = (inTok * m.inPerM + ANSWER_TOKENS * m.outPerM) / 1e6;
  const ms = RETRIEVE_MS + RERANK_MS + (ANSWER_TOKENS / m.tokPerS) * 1000 + (verify ? VERIFY_MS : 0);
  return { inTok, cost, monthly: cost * QUESTIONS_PER_DAY * 30, ms };
}
