// A help centre's search index: 100,000 documents of ~10 chunks each. Every day 1%
// of documents are edited (usually one paragraph), 0.2% are added and 0.1% deleted.
// Keep the vector index current by rebuilding it nightly, by re-embedding changed
// documents from change events, or by re-embedding only the chunks whose content
// hash changed. Embedding calls, cost, staleness and deleted documents still served
// are computed from these rates.

export const DOCS = 100_000;
export const CHUNKS_PER_DOC = 10;
export const EDIT_RATE = 0.01;
export const ADD_RATE = 0.002;
export const DELETE_RATE = 0.001;
export const CHUNKS_CHANGED_PER_EDIT = 1.5; // an edit usually touches one or two paragraphs
export const TOKENS_PER_CHUNK = 400;
export const COST_PER_M_TOKENS = 0.02; // $ for a small embedding model
export const EMBED_CHUNKS_PER_SEC = 500;
export const QUERIES_PER_DAY = 50_000;
export const QUERIES_HITTING_DELETED = 0.3; // share of queries about a deleted doc that would retrieve it if it's still indexed

export type Strategy = "nightly" | "perDoc" | "perChunk";
export const STRATEGIES: { id: Strategy; label: string; one: string }[] = [
  { id: "nightly", label: "Rebuild every night", one: "Re-chunk and re-embed everything at 02:00, then swap the new index in." },
  { id: "perDoc", label: "Re-embed changed documents", one: "Each create, update or delete event re-embeds that whole document, or removes it, within a minute." },
  { id: "perChunk", label: "Re-embed changed chunks", one: "On an update, hash each chunk and re-embed only the chunks whose hash changed." },
];

export type Result = {
  chunksPerDay: number;
  tokensPerDay: number;
  costPerDay: number;
  costPerMonth: number;
  buildHours: number; // time the embedding work takes per day
  avgStalenessHours: number; // how old a change is, on average, before search sees it
  deletedStillServed: number; // queries a day answered from a deleted document
};

export function run(s: Strategy, deletesHandled = true): Result {
  const edited = DOCS * EDIT_RATE;
  const added = DOCS * ADD_RATE;
  const deleted = DOCS * DELETE_RATE;
  let chunksPerDay: number;
  let avgStalenessHours: number;
  if (s === "nightly") {
    chunksPerDay = DOCS * CHUNKS_PER_DOC;
    avgStalenessHours = 12; // a change during the day waits for the night's build: half a day on average
  } else if (s === "perDoc") {
    chunksPerDay = (edited + added) * CHUNKS_PER_DOC;
    avgStalenessHours = 1 / 60;
  } else {
    chunksPerDay = edited * CHUNKS_CHANGED_PER_EDIT + added * CHUNKS_PER_DOC;
    avgStalenessHours = 1 / 60;
  }
  const tokensPerDay = chunksPerDay * TOKENS_PER_CHUNK;
  const costPerDay = (tokensPerDay / 1e6) * COST_PER_M_TOKENS;
  // deleted docs: a nightly rebuild drops them by morning; event-driven only if deletes are handled
  const deletedFraction = deleted / DOCS;
  const servedFromDeleted =
    s === "nightly" ? QUERIES_PER_DAY * deletedFraction * 10 * QUERIES_HITTING_DELETED * 0.5 : deletesHandled ? 0 : QUERIES_PER_DAY * deletedFraction * 10 * QUERIES_HITTING_DELETED * 30; // without delete handling, a month of deletes piles up
  return {
    chunksPerDay,
    tokensPerDay,
    costPerDay,
    costPerMonth: costPerDay * 30,
    buildHours: chunksPerDay / EMBED_CHUNKS_PER_SEC / 3600,
    avgStalenessHours,
    deletedStillServed: Math.round(servedFromDeleted),
  };
}

// Content hashing on one document: which chunks change when one paragraph is edited.
export const SAMPLE = [
  "Reset your password from the sign-in page.",
  "Click “Forgot password” and enter your email.",
  "We send a link that works for 30 minutes.",
  "If the email doesn't arrive, check your spam folder.",
];
export const SAMPLE_EDITED = [
  "Reset your password from the sign-in page.",
  "Click “Forgot password” and enter your email.",
  "We send a link that works for 15 minutes.",
  "If the email doesn't arrive, check your spam folder.",
];
export function hash(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

export const money = (v: number) => (v < 1 ? `$${v.toFixed(2)}` : `$${Math.round(v).toLocaleString("en-US")}`);
export const n = (v: number) => Math.round(v).toLocaleString("en-US");
