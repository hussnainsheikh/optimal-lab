// Moving 2 million chunks from embedding model A to model B. Vectors from different
// models live in different spaces: comparing a query embedded with one model to
// documents embedded with the other finds nothing useful. Recall during the
// migration, extra storage and the cut-over are computed day by day.

export const CHUNKS = 2_000_000;
export const BACKFILL_PER_DAY = 400_000; // re-embedding throughput, throttled to protect production
export const DAYS = Math.ceil(CHUNKS / BACKFILL_PER_DAY) + 1;
export const RECALL_A = 0.82; // recall@10 on the eval set, old model
export const RECALL_B = 0.9; // new model
export const RECALL_MIXED = 0.03; // a query from one model against vectors from the other: essentially random
export const BYTES_A = 768 * 4;
export const BYTES_B = 1024 * 4;
export const COST_PER_M_TOKENS = 0.02;
export const TOKENS_PER_CHUNK = 400;

export type Plan = "inPlace" | "dual" | "dualShadow";
export const PLANS: { id: Plan; label: string; one: string }[] = [
  { id: "inPlace", label: "Overwrite in place", one: "Re-embed chunks one by one into the same index, and switch queries to model B on day one." },
  { id: "dual", label: "Second index, then switch", one: "Build a separate index with model B alongside; keep querying A; switch every query to B when the backfill is done." },
  { id: "dualShadow", label: "Second index, shadow, then switch", one: "As above, but also send a copy of real queries to B and compare results before switching, so a worse model never ships." },
];

export type Day = { day: number; migrated: number; recall: number; storageGB: number; serving: "A" | "B" | "mixed" };

export function timeline(plan: Plan, newModelWorse = false): Day[] {
  const recallB = newModelWorse ? 0.76 : RECALL_B;
  const out: Day[] = [];
  for (let day = 0; day <= DAYS; day++) {
    const migrated = Math.min(1, (day * BACKFILL_PER_DAY) / CHUNKS);
    let recall: number;
    let serving: Day["serving"];
    let storage: number;
    if (plan === "inPlace") {
      // queries use B from day 1; a share `migrated` of the index is B, the rest still A
      serving = migrated >= 1 ? "B" : day === 0 ? "A" : "mixed";
      recall = day === 0 ? RECALL_A : migrated * recallB + (1 - migrated) * RECALL_MIXED;
      storage = CHUNKS * (migrated * BYTES_B + (1 - migrated) * BYTES_A);
    } else {
      const switched = migrated >= 1 && (plan === "dual" || !newModelWorse);
      serving = switched ? "B" : "A";
      recall = switched ? recallB : RECALL_A;
      const keepA = !switched || day === DAYS; // A is kept until the day after the switch, for rollback
      storage = CHUNKS * (migrated * BYTES_B + (keepA ? BYTES_A : 0));
    }
    out.push({ day, migrated, recall, storageGB: storage / 1e9, serving });
  }
  return out;
}

export const embedCost = () => (CHUNKS * TOKENS_PER_CHUNK * COST_PER_M_TOKENS) / 1e6;
export const minRecall = (plan: Plan, worse = false) => Math.min(...timeline(plan, worse).map((d) => d.recall));
export const finalRecall = (plan: Plan, worse = false) => timeline(plan, worse)[DAYS].recall;
export const peakGB = (plan: Plan) => Math.max(...timeline(plan).map((d) => d.storageGB));

// Why mixing fails: cosine similarity between the same sentence's vectors from two models is near zero.
export const SAME_TEXT_SIMILARITY = { sameModel: 1, crossModel: 0.04 };
