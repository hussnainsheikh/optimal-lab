// A coding agent's session runs for 60 turns. Some turns carry facts the agent needs
// later (a file path, a decision, an error message); many are bulky tool output. The
// prompt has a budget. Four ways to fit the history: drop the oldest turns, summarise
// as you go, retrieve relevant turns, or compact tool output and keep decisions.
// Which facts survive to the end, and the tokens used, are computed turn by turn.

export type Turn = { n: number; kind: "user" | "assistant" | "tool"; tokens: number; fact?: { id: string; text: string; detail: boolean } };

const FACT_TURNS: Record<number, { id: string; text: string; detail: boolean }> = {
  2: { id: "goal", text: "Goal: make checkout tests pass without changing the API", detail: false },
  6: { id: "path", text: "Config lives in services/billing/config/prod.yaml", detail: true },
  11: { id: "decision", text: "Decided: don't touch the legacy tax module", detail: false },
  19: { id: "error", text: "Failing test: test_refund_rounding expects 10.05, gets 10.04", detail: true },
  33: { id: "user", text: "User: the release is Friday; keep the diff small", detail: false },
  47: { id: "cause", text: "Cause: banker's rounding in money.py line 88", detail: true },
};

export const TURNS: Turn[] = Array.from({ length: 60 }, (_, i) => {
  const n = i + 1;
  const kind: Turn["kind"] = n % 3 === 1 ? "user" : n % 3 === 2 ? "assistant" : "tool";
  const tokens = kind === "tool" ? 1800 : kind === "user" ? 120 : 260;
  return { n, kind, tokens, fact: FACT_TURNS[n] };
});

export const BUDGETS = [8000, 16000, 32000];
export type Strategy = "truncate" | "summary" | "retrieve" | "compact";
export const STRATEGIES: { id: Strategy; label: string; one: string }[] = [
  { id: "truncate", label: "Drop the oldest", one: "Keep the most recent turns that fit; everything before is gone." },
  { id: "summary", label: "Rolling summary", one: "When the budget fills, summarise the oldest half into a short paragraph and keep going." },
  { id: "retrieve", label: "Retrieve relevant turns", one: "Store every turn; for each request, fetch the turns most similar to it plus the recent ones." },
  { id: "compact", label: "Compact tool output, pin decisions", one: "Replace old tool output with a one-line result, and pin the goal, decisions and constraints at the top." },
];

export const SUMMARY_TOKENS = 600;
export const COMPACT_TOOL_TOKENS = 60;
export const PINNED_TOKENS = 30; // per pinned fact

export type Result = { tokens: number; kept: string[]; lost: string[]; turnsKept: number };

export function compress(s: Strategy, budget: number): Result {
  const all = TURNS;
  const facts = all.filter((t) => t.fact).map((t) => t.fact!);
  const recentFrom = (fit: number) => {
    let used = 0;
    let from = all.length;
    for (let i = all.length - 1; i >= 0; i--) {
      if (used + all[i].tokens > fit) break;
      used += all[i].tokens;
      from = i;
    }
    return { from, used };
  };
  if (s === "truncate") {
    const { from, used } = recentFrom(budget);
    const kept = all.slice(from).filter((t) => t.fact).map((t) => t.fact!.id);
    return { tokens: used, kept, lost: facts.filter((f) => !kept.includes(f.id)).map((f) => f.id), turnsKept: all.length - from };
  }
  if (s === "summary") {
    // recent turns in half the budget, the rest summarised; a summary keeps the gist (non-detail facts) of what it covers
    const { from, used } = recentFrom(budget - SUMMARY_TOKENS);
    const recent = all.slice(from).filter((t) => t.fact).map((t) => t.fact!);
    const summarised = all.slice(0, from).filter((t) => t.fact && !t.fact.detail).map((t) => t.fact!);
    const kept = [...recent, ...summarised].map((f) => f.id);
    return { tokens: used + SUMMARY_TOKENS, kept, lost: facts.filter((f) => !kept.includes(f.id)).map((f) => f.id), turnsKept: all.length - from };
  }
  if (s === "retrieve") {
    // recent turns in half the budget, plus the top retrieved older turns; retrieval finds turns that share words with the request,
    // which here are the error and the cause (the request is about the failing test), not the goal or constraints
    const { from, used } = recentFrom(budget / 2);
    const recent = all.slice(from).filter((t) => t.fact).map((t) => t.fact!.id);
    const retrievedIds = ["error", "cause", "path"].filter((id) => !recent.includes(id));
    let extra = 0;
    const got: string[] = [];
    for (const id of retrievedIds) {
      const turn = all.find((t) => t.fact?.id === id)!;
      if (used + extra + turn.tokens > budget) continue;
      extra += turn.tokens;
      got.push(id);
    }
    const kept = [...recent, ...got];
    return { tokens: used + extra, kept, lost: facts.filter((f) => !kept.includes(f.id)).map((f) => f.id), turnsKept: all.length - from + got.length };
  }
  // compact: every tool output older than the last 6 turns shrinks to a one-liner; facts are pinned
  const pinned = facts.length * PINNED_TOKENS;
  let used = pinned;
  let count = 0;
  for (let i = all.length - 1; i >= 0; i--) {
    const t = all[i];
    const size = t.kind === "tool" && i < all.length - 6 ? COMPACT_TOOL_TOKENS : t.tokens;
    if (used + size > budget) break;
    used += size;
    count++;
  }
  return { tokens: used, kept: facts.map((f) => f.id), lost: [], turnsKept: count };
}

export const FACTS = Object.values(FACT_TURNS);
export const factText = (id: string) => FACTS.find((f) => f.id === id)!.text;
export const TOTAL_TOKENS = TURNS.reduce((s, t) => s + t.tokens, 0);
