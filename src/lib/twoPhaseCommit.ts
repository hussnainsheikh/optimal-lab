// Two-phase commit across two databases: the orders database and the payments
// database must both commit, or neither. A coordinator asks each to prepare (do the
// work, hold the locks, promise to commit), collects the votes, writes its decision to
// its log, then tells everyone to commit or abort. Each scenario is a fixed sequence of
// frames; what differs is who fails when, and what that costs in held locks.

export type Node = "client" | "coord" | "log" | "orders" | "payments";

export type Hop = { from: Node; to: Node; label: string; tone?: "accent" | "good" | "bad" };

export type Frame = {
  phase: "prepare" | "vote" | "decide" | "commit" | "done" | "blocked" | "recover";
  caption: string;
  hops: Hop[];
  orders: "idle" | "prepared" | "committed" | "aborted" | "down";
  payments: "idle" | "prepared" | "committed" | "aborted" | "down";
  coord: "up" | "down";
  decision: "none" | "commit" | "abort";
  locksHeldMs: number; // how long the prepared rows have been locked at this frame
};

export type ScenarioId = "happy" | "voteNo" | "participantCrash" | "coordCrash" | "coordCrashAfterLog";

export const SCENARIOS: { id: ScenarioId; label: string; what: string }[] = [
  { id: "happy", label: "Everyone's up", what: "Both prepare, both vote yes, the decision is logged, both commit." },
  { id: "voteNo", label: "Payments votes no", what: "The card is declined. One no vote aborts both." },
  { id: "participantCrash", label: "Payments crashes after voting", what: "It promised to commit, so when it comes back it must finish." },
  { id: "coordCrash", label: "Coordinator crashes before deciding", what: "Both databases have voted yes and hold their locks. Nobody can tell them what to do." },
  { id: "coordCrashAfterLog", label: "Coordinator crashes after logging", what: "The decision is on disk, so a restarted coordinator finishes the job." },
];

const STEP_MS = 20; // a network hop

export function frames(id: ScenarioId): Frame[] {
  const f: Frame[] = [];
  const base = { coord: "up" as const, decision: "none" as const };
  f.push({ phase: "prepare", caption: "The client asks the coordinator to place the order and charge the card as one unit.", hops: [{ from: "client", to: "coord", label: "order + charge" }], orders: "idle", payments: "idle", ...base, locksHeldMs: 0 });
  f.push({ phase: "prepare", caption: "Phase 1: PREPARE. Each database writes the change to its own log, takes locks on the rows, and gets ready to commit.", hops: [{ from: "coord", to: "orders", label: "prepare" }, { from: "coord", to: "payments", label: "prepare" }], orders: "prepared", payments: "prepared", ...base, locksHeldMs: STEP_MS });

  if (id === "voteNo") {
    f.push({ phase: "vote", caption: "Orders votes yes. Payments votes no: the card was declined.", hops: [{ from: "orders", to: "coord", label: "yes", tone: "good" }, { from: "payments", to: "coord", label: "no", tone: "bad" }], orders: "prepared", payments: "idle", ...base, locksHeldMs: 2 * STEP_MS });
    f.push({ phase: "decide", caption: "One no is enough: the decision is ABORT, written to the coordinator's log.", hops: [{ from: "coord", to: "log", label: "abort", tone: "bad" }], orders: "prepared", payments: "idle", coord: "up", decision: "abort", locksHeldMs: 3 * STEP_MS });
    f.push({ phase: "commit", caption: "Phase 2: orders rolls back and releases its locks. Nothing was charged, nothing was ordered.", hops: [{ from: "coord", to: "orders", label: "abort", tone: "bad" }], orders: "aborted", payments: "aborted", coord: "up", decision: "abort", locksHeldMs: 4 * STEP_MS });
    f.push({ phase: "done", caption: "Done: consistent, with nothing done. The client is told the card was declined.", hops: [{ from: "coord", to: "client", label: "declined", tone: "bad" }], orders: "idle", payments: "idle", coord: "up", decision: "abort", locksHeldMs: 0 });
    return f;
  }

  f.push({ phase: "vote", caption: "Both vote yes. From now on each one must be able to commit, whatever happens to it.", hops: [{ from: "orders", to: "coord", label: "yes", tone: "good" }, { from: "payments", to: "coord", label: "yes", tone: "good" }], orders: "prepared", payments: "prepared", ...base, locksHeldMs: 2 * STEP_MS });

  if (id === "coordCrash") {
    f.push({ phase: "blocked", caption: "The coordinator crashes before writing a decision. Both databases are prepared, locks held, and neither may decide alone: the other might have been told to abort.", hops: [], orders: "prepared", payments: "prepared", coord: "down", decision: "none", locksHeldMs: 3 * STEP_MS });
    f.push({ phase: "blocked", caption: "Seconds pass. Every other transaction that needs those rows waits behind the locks. This is the blocking problem of 2PC.", hops: [], orders: "prepared", payments: "prepared", coord: "down", decision: "none", locksHeldMs: 5000 });
    f.push({ phase: "blocked", caption: "Still blocked. The participants can only wait for the coordinator to come back; a timeout would risk one committing and one aborting.", hops: [], orders: "prepared", payments: "prepared", coord: "down", decision: "none", locksHeldMs: 30000 });
    f.push({ phase: "recover", caption: "The coordinator restarts, finds no decision in its log, and aborts: the safe choice. Locks are released after 45 seconds.", hops: [{ from: "coord", to: "log", label: "no decision" }, { from: "coord", to: "orders", label: "abort", tone: "bad" }, { from: "coord", to: "payments", label: "abort", tone: "bad" }], orders: "aborted", payments: "aborted", coord: "up", decision: "abort", locksHeldMs: 45000 });
    f.push({ phase: "done", caption: "Consistent again, 45 seconds later, with the order lost. The client saw a timeout and will retry.", hops: [{ from: "coord", to: "client", label: "timeout", tone: "bad" }], orders: "idle", payments: "idle", coord: "up", decision: "abort", locksHeldMs: 0 });
    return f;
  }

  f.push({ phase: "decide", caption: "The coordinator writes COMMIT to its own log. This write is the moment the transaction commits: everything after it is just delivering the news.", hops: [{ from: "coord", to: "log", label: "commit", tone: "good" }], orders: "prepared", payments: "prepared", coord: "up", decision: "commit", locksHeldMs: 3 * STEP_MS });

  if (id === "coordCrashAfterLog") {
    f.push({ phase: "blocked", caption: "The coordinator crashes right after logging. The databases are still prepared and locked, but the decision exists on disk.", hops: [], orders: "prepared", payments: "prepared", coord: "down", decision: "commit", locksHeldMs: 2000 });
    f.push({ phase: "recover", caption: "It restarts, reads COMMIT from its log, and re-sends the commit to both. Locks held for 2 seconds instead of 80 ms.", hops: [{ from: "coord", to: "log", label: "read: commit" }, { from: "coord", to: "orders", label: "commit", tone: "good" }, { from: "coord", to: "payments", label: "commit", tone: "good" }], orders: "committed", payments: "committed", coord: "up", decision: "commit", locksHeldMs: 2100 });
    f.push({ phase: "done", caption: "Both committed. The log is what makes the coordinator's crash survivable.", hops: [{ from: "coord", to: "client", label: "OK", tone: "good" }], orders: "committed", payments: "committed", coord: "up", decision: "commit", locksHeldMs: 0 });
    return f;
  }

  if (id === "participantCrash") {
    f.push({ phase: "commit", caption: "Phase 2: COMMIT. Orders commits. Payments crashes before it can.", hops: [{ from: "coord", to: "orders", label: "commit", tone: "good" }, { from: "coord", to: "payments", label: "commit", tone: "good" }], orders: "committed", payments: "down", coord: "up", decision: "commit", locksHeldMs: 4 * STEP_MS });
    f.push({ phase: "recover", caption: "Payments restarts, finds a prepared transaction in its log, asks the coordinator what was decided, and commits. Its yes vote was a promise.", hops: [{ from: "payments", to: "coord", label: "decision?" }, { from: "coord", to: "payments", label: "commit", tone: "good" }], orders: "committed", payments: "committed", coord: "up", decision: "commit", locksHeldMs: 3000 });
    f.push({ phase: "done", caption: "Both committed, a few seconds late. The order was visible before the charge was: readers could see one without the other for a moment.", hops: [{ from: "coord", to: "client", label: "OK", tone: "good" }], orders: "committed", payments: "committed", coord: "up", decision: "commit", locksHeldMs: 0 });
    return f;
  }

  f.push({ phase: "commit", caption: "Phase 2: COMMIT. Both databases commit and release their locks.", hops: [{ from: "coord", to: "orders", label: "commit", tone: "good" }, { from: "coord", to: "payments", label: "commit", tone: "good" }], orders: "committed", payments: "committed", coord: "up", decision: "commit", locksHeldMs: 4 * STEP_MS });
  f.push({ phase: "done", caption: "Done: four network hops and two log writes per database, with locks held for about 80 ms. That is the price of atomicity across machines.", hops: [{ from: "coord", to: "client", label: "OK", tone: "good" }], orders: "committed", payments: "committed", coord: "up", decision: "commit", locksHeldMs: 0 });
  return f;
}

export const ms = (x: number) => (x >= 1000 ? `${(x / 1000).toFixed(x >= 10000 ? 0 : 1)} s` : `${x} ms`);
