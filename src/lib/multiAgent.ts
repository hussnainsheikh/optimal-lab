// "Write a market report on four competitors." One agent does it all, an
// orchestrator hands each competitor to a worker and merges the results, or peers
// hand off to each other and edit one shared document. Tokens, wall-clock time,
// coordination messages and conflicting edits are computed from the sizes below.

export const COMPETITORS = 4;
export const RESEARCH_TOKENS = 30_000; // tool results read per competitor
export const WRITE_TOKENS = 1_500; // section written per competitor
export const INSTRUCTIONS = 2_000; // system prompt and task
export const MINUTES_PER_COMPETITOR = 6;
export const MERGE_MINUTES = 3;
export const TOKEN_PRICE = 3 / 1e6; // $ per input token

export type Design = "single" | "orchestrator" | "peers";
export const DESIGNS: { id: Design; label: string; one: string }[] = [
  { id: "single", label: "One agent", one: "One loop researches all four competitors in turn and writes the report." },
  { id: "orchestrator", label: "Orchestrator and workers", one: "A lead agent splits the job, runs four workers in parallel, each with a clean context, and merges their sections." },
  { id: "peers", label: "Peers on a shared doc", one: "Four agents each take a competitor, read and edit one shared document directly, and hand off to each other by message." },
];

export type Result = {
  inputTokens: number; // total read across all model calls
  peakContext: number; // largest single context window
  minutes: number;
  messages: number; // coordination messages between agents
  conflicts: number; // overlapping edits to the same part of the shared doc
  cost: number;
  quality: string;
};

export function run(d: Design, locking: boolean): Result {
  if (d === "single") {
    // context grows as each competitor's research piles up; each turn rereads everything so far
    let total = 0;
    let ctx = INSTRUCTIONS;
    for (let i = 0; i < COMPETITORS; i++) {
      ctx += RESEARCH_TOKENS;
      total += ctx;
      ctx += WRITE_TOKENS;
    }
    total += ctx; // final write-up
    return { inputTokens: total, peakContext: ctx, minutes: COMPETITORS * MINUTES_PER_COMPETITOR + MERGE_MINUTES, messages: 0, conflicts: 0, cost: total * TOKEN_PRICE, quality: "Coherent voice; by the fourth competitor the context holds 120k tokens of old research, and details from the first get muddled." };
  }
  if (d === "orchestrator") {
    const worker = INSTRUCTIONS + RESEARCH_TOKENS;
    const lead = INSTRUCTIONS * 2 + COMPETITORS * WRITE_TOKENS;
    const total = COMPETITORS * worker + lead;
    return { inputTokens: total, peakContext: Math.max(worker, lead), minutes: MINUTES_PER_COMPETITOR + MERGE_MINUTES, messages: COMPETITORS * 2, conflicts: 0, cost: total * TOKEN_PRICE, quality: "Each worker sees only its competitor; the lead merges four sections and has to even out the style." };
  }
  // peers: each reads the shared doc as it grows, plus its research; handoffs between them
  const doc = COMPETITORS * WRITE_TOKENS;
  const each = INSTRUCTIONS + RESEARCH_TOKENS + doc;
  const total = COMPETITORS * each * 1.5; // rereads after others' edits
  const conflicts = locking ? 0 : 3; // the summary table and intro edited by several agents at once
  return { inputTokens: total, peakContext: each, minutes: MINUTES_PER_COMPETITOR + (locking ? 4 : 1), messages: COMPETITORS * (COMPETITORS - 1), conflicts, cost: total * TOKEN_PRICE, quality: locking ? "Sections are locked while one agent edits them; agents wait their turn on shared parts." : "Three agents rewrote the summary table at the same moment; the last write won and two competitors vanished from it." };
}

export const k = (v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(Math.round(v)));
