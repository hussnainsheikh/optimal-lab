// A small row-lock manager, ticked one millisecond at a time. Transactions run a script of
// lock requests; each request uses one of Postgres's four row-lock modes and the real conflict
// table between them. A request that conflicts waits in a queue behind earlier waiters; it can
// fail at once (NOWAIT), give up after lock_timeout, or be picked as a deadlock victim when the
// wait-for graph has a cycle and it has waited deadlock_timeout. Locks are held until the
// transaction ends. Work times are illustrative; who waits for whom is computed.

export type Mode = "keyShare" | "share" | "noKeyUpdate" | "update";
export const MODE_SQL: Record<Mode, string> = {
  keyShare: "FOR KEY SHARE",
  share: "FOR SHARE",
  noKeyUpdate: "FOR NO KEY UPDATE",
  update: "FOR UPDATE",
};
/** Postgres's row-level lock conflict table (explicit-locking docs, table 13.3). */
export const CONFLICTS: Record<Mode, Mode[]> = {
  keyShare: ["update"],
  share: ["noKeyUpdate", "update"],
  noKeyUpdate: ["share", "noKeyUpdate", "update"],
  update: ["keyShare", "share", "noKeyUpdate", "update"],
};
export const conflicts = (a: Mode, b: Mode) => CONFLICTS[a].includes(b);

export type LockStep = { row: string; mode: Mode; work: number; sql: string };
export type Txn = { id: string; start: number; steps: LockStep[] };
export type Policy = "wait" | "nowait" | "timeout";
export type LockOpts = { policy: Policy; lockTimeout: number; deadlockTimeout: number; retry: boolean; retryDelay: number; maxAttempts?: number };
export const DEFAULT_OPTS: LockOpts = { policy: "wait", lockTimeout: 500, deadlockTimeout: 1000, retry: false, retryDelay: 50 };

export type Seg = { txn: string; from: number; to: number; kind: "work" | "wait" | "fail"; label: string };
export type LogLine = { t: number; txn: string; text: string; bad?: boolean };
export type Outcome = { txn: string; committedAt: number | null; attempts: number; error: string | null; waited: number };
export type Deadlock = { at: number; victim: string; cycle: string[]; edges: [string, string, string][] };

type State = {
  t: Txn;
  phase: "pending" | "request" | "work" | "wait" | "done" | "failed";
  step: number;
  until: number;
  since: number;
  held: Map<string, Mode>;
  attempt: number;
  restartAt: number;
  segStart: number;
  waited: number;
  checked: boolean;
};

export function simulate(txns: Txn[], opts: LockOpts, horizon = 8000) {
  const maxAttempts = opts.maxAttempts ?? 3;
  const st: State[] = txns.map((t) => ({ t, phase: "pending", step: 0, until: 0, since: 0, held: new Map(), attempt: 1, restartAt: t.start, segStart: 0, waited: 0, checked: false }));
  const queue = new Map<string, State[]>(); // row -> waiters, oldest first
  const segs: Seg[] = [];
  const log: LogLine[] = [];
  const outcomes = new Map<string, Outcome>(txns.map((t) => [t.id, { txn: t.id, committedAt: null, attempts: 1, error: null, waited: 0 }]));
  const deadlocks: Deadlock[] = [];

  const holders = (row: string, except: State) => st.filter((s) => s !== except && s.held.has(row));
  const blockers = (s: State) => {
    const step = s.t.steps[s.step];
    const hs = holders(step.row, s).filter((h) => conflicts(step.mode, h.held.get(step.row)!));
    // A transaction that already holds the row only waits for conflicting holders; anyone
    // else also queues behind earlier conflicting waiters.
    const q = s.held.has(step.row) ? [] : (queue.get(step.row) ?? []);
    const idx = q.indexOf(s);
    const ahead = (idx < 0 ? q : q.slice(0, idx)).filter((w) => conflicts(step.mode, w.t.steps[w.step].mode));
    return [...new Set([...hs, ...ahead])];
  };
  const dequeue = (s: State) => {
    for (const [row, q] of queue) queue.set(row, q.filter((w) => w !== s));
  };
  const release = (s: State) => {
    s.held.clear();
    dequeue(s);
  };
  const fail = (s: State, now: number, error: string) => {
    segs.push({ txn: s.t.id, from: s.segStart, to: now, kind: "wait", label: "waiting" });
    segs.push({ txn: s.t.id, from: now, to: now + 30, kind: "fail", label: error });
    log.push({ t: now, txn: s.t.id, text: `ERROR: ${error}`, bad: true });
    release(s);
    const o = outcomes.get(s.t.id)!;
    if (opts.retry && s.attempt < maxAttempts) {
      s.attempt++;
      o.attempts = s.attempt;
      s.phase = "pending";
      s.step = 0;
      s.restartAt = now + opts.retryDelay;
      log.push({ t: now, txn: s.t.id, text: `ROLLBACK, retry in ${opts.retryDelay} ms (attempt ${s.attempt})` });
    } else {
      s.phase = "failed";
      o.error = error;
    }
  };
  // Depth-first search of the wait-for graph from s: does it lead back to s?
  const cycleFrom = (s: State): State[] | null => {
    const path: State[] = [];
    const seen = new Set<State>();
    const dfs = (u: State): boolean => {
      path.push(u);
      seen.add(u);
      for (const v of u.phase === "wait" ? blockers(u) : []) {
        if (v === s) return true;
        if (!seen.has(v) && dfs(v)) return true;
      }
      path.pop();
      return false;
    };
    return dfs(s) ? path : null;
  };

  for (let now = 0; now <= horizon; now++) {
    for (const s of st) {
      if (s.phase === "pending" && now >= s.restartAt) {
        s.phase = "request";
        log.push({ t: now, txn: s.t.id, text: s.attempt > 1 ? "BEGIN (retry)" : "BEGIN" });
      }
      if (s.phase === "work" && now >= s.until) {
        segs.push({ txn: s.t.id, from: s.segStart, to: now, kind: "work", label: s.t.steps[s.step].sql });
        s.step++;
        if (s.step >= s.t.steps.length) {
          s.phase = "done";
          release(s);
          outcomes.get(s.t.id)!.committedAt = now;
          log.push({ t: now, txn: s.t.id, text: "COMMIT: locks released" });
          continue;
        }
        s.phase = "request";
      }
      if (s.phase === "request" || s.phase === "wait") {
        const step = s.t.steps[s.step];
        const blocked = blockers(s);
        if (!blocked.length) {
          if (s.phase === "wait") {
            segs.push({ txn: s.t.id, from: s.segStart, to: now, kind: "wait", label: `waiting for ${step.row}` });
            log.push({ t: now, txn: s.t.id, text: `got ${step.row} after ${now - s.since} ms` });
            dequeue(s);
          } else log.push({ t: now, txn: s.t.id, text: `${step.sql}: got ${step.row}` });
          s.held.set(step.row, step.mode);
          s.phase = "work";
          s.until = now + step.work;
          s.segStart = now;
          continue;
        }
        if (s.phase === "request") {
          if (opts.policy === "nowait") {
            s.segStart = now;
            fail(s, now, `could not obtain lock on row ${step.row}`);
            continue;
          }
          s.phase = "wait";
          s.since = now;
          s.segStart = now;
          s.checked = false;
          queue.set(step.row, [...(queue.get(step.row) ?? []), s]);
          log.push({ t: now, txn: s.t.id, text: `${step.sql}: ${step.row} is held by ${blocked.map((b) => b.t.id).join(", ")}, waiting` });
          continue;
        }
        const waited = now - s.since;
        if (opts.policy === "timeout" && waited >= opts.lockTimeout) {
          outcomes.get(s.t.id)!.waited += waited;
          fail(s, now, "canceling statement due to lock timeout");
          continue;
        }
        if (!s.checked && waited >= opts.deadlockTimeout) {
          s.checked = true;
          const cyc = cycleFrom(s);
          if (cyc) {
            const edges: [string, string, string][] = cyc.map((u) => {
              const v = blockers(u).find((b) => cyc.includes(b))!;
              return [u.t.id, v.t.id, u.t.steps[u.step].row];
            });
            deadlocks.push({ at: now, victim: s.t.id, cycle: cyc.map((c) => c.t.id), edges });
            log.push({ t: now, txn: s.t.id, text: `deadlock check after ${waited} ms: cycle ${[...cyc.map((c) => c.t.id), s.t.id].join(" → ")}`, bad: true });
            outcomes.get(s.t.id)!.waited += waited;
            fail(s, now, "deadlock detected");
            continue;
          }
          log.push({ t: now, txn: s.t.id, text: `deadlock check after ${waited} ms: no cycle, keep waiting` });
        }
      }
    }
    if (st.every((s) => s.phase === "done" || s.phase === "failed")) break;
  }
  for (const s of st) {
    if (s.phase === "wait") {
      segs.push({ txn: s.t.id, from: s.segStart, to: horizon, kind: "wait", label: "still waiting" });
      outcomes.get(s.t.id)!.error = "still waiting";
    }
  }
  // Total time spent waiting, from the wait segments.
  for (const o of outcomes.values()) o.waited = segs.filter((g) => g.txn === o.txn && g.kind === "wait").reduce((a, g) => a + g.to - g.from, 0);
  const end = Math.max(0, ...segs.map((g) => g.to));
  return { segs, log: log.sort((a, b) => a.t - b.t), outcomes: [...outcomes.values()], deadlocks, end };
}

// ---- row-locks scenarios ---------------------------------------------------------------

export type Scenario = "ticket" | "fk" | "queue";
export function ticketTxns(hold: number): Txn[] {
  return [
    { id: "A", start: 0, steps: [{ row: "seat 14C", mode: "update", work: hold, sql: "SELECT … FOR UPDATE; charge card" }] },
    { id: "B", start: 60, steps: [{ row: "seat 14C", mode: "update", work: 120, sql: "SELECT … FOR UPDATE" }] },
    { id: "C", start: 140, steps: [{ row: "seat 14C", mode: "noKeyUpdate", work: 40, sql: "UPDATE seats SET viewed = …" }] },
  ];
}
/** An order insert checks its foreign key with FOR KEY SHARE on the customer row. */
export function fkTxns(hold: number, adminMode: Mode): Txn[] {
  return [
    { id: "A", start: 0, steps: [{ row: "customer 7", mode: adminMode, work: hold, sql: adminMode === "update" ? "SELECT … FOR UPDATE (admin)" : "UPDATE customers SET email = …" }] },
    { id: "B", start: 50, steps: [{ row: "customer 7", mode: "keyShare", work: 60, sql: "INSERT INTO orders (customer_id = 7)" }] },
    { id: "C", start: 90, steps: [{ row: "customer 7", mode: "keyShare", work: 60, sql: "INSERT INTO orders (customer_id = 7)" }] },
  ];
}

/** Three workers each claim "the oldest pending job" in a loop until six jobs are done. */
export function jobQueue(skipLocked: boolean, jobMs: number, workers = 3, jobs = 6) {
  const done: boolean[] = Array(jobs).fill(false);
  const lockedBy: (number | null)[] = Array(jobs).fill(null);
  type W = { id: string; phase: "claim" | "work" | "wait" | "idle"; job: number; until: number; segStart: number; emptyPolls: number };
  const ws: W[] = Array.from({ length: workers }, (_, i) => ({ id: `W${i + 1}`, phase: "claim", job: -1, until: 0, segStart: 0, emptyPolls: 0 }));
  const segs: Seg[] = [];
  const POLL = 50; // an empty claim sleeps before polling again
  let now = 0;
  for (; now < 20000; now++) {
    for (const [wi, w] of ws.entries()) {
      if (w.phase === "work" && now >= w.until) {
        segs.push({ txn: w.id, from: w.segStart, to: now, kind: "work", label: `job ${w.job + 1}` });
        done[w.job] = true;
        lockedBy[w.job] = null;
        w.phase = "claim";
      }
      if (w.phase === "idle" && now >= w.until) w.phase = "claim";
      if (w.phase === "wait") {
        // Woken when the holder commits. The row no longer says pending, so under READ
        // COMMITTED it's filtered out on recheck and the LIMIT 1 query returns nothing.
        if (lockedBy[w.job] === null) {
          segs.push({ txn: w.id, from: w.segStart, to: now, kind: "wait", label: `waiting for job ${w.job + 1}` });
          w.emptyPolls++;
          w.phase = "idle";
          w.until = now + POLL;
        }
        continue;
      }
      if (w.phase === "claim") {
        const oldest = done.findIndex((d, j) => !d && (skipLocked ? lockedBy[j] === null : true));
        if (oldest < 0) {
          w.phase = "idle";
          w.until = done.every(Boolean) ? Infinity : now + POLL;
          if (w.until !== Infinity) w.emptyPolls++;
          continue;
        }
        if (lockedBy[oldest] !== null && lockedBy[oldest] !== wi) {
          w.phase = "wait";
          w.job = oldest;
          w.segStart = now;
          continue;
        }
        lockedBy[oldest] = wi;
        w.phase = "work";
        w.job = oldest;
        w.until = now + jobMs;
        w.segStart = now;
      }
    }
    if (done.every(Boolean)) break;
  }
  const waited = segs.filter((s) => s.kind === "wait").reduce((a, s) => a + s.to - s.from, 0);
  return { segs, end: now, waited, emptyPolls: ws.reduce((a, w) => a + w.emptyPolls, 0), perWorker: ws.map((w) => ({ id: w.id, jobs: segs.filter((s) => s.txn === w.id && s.kind === "work").length })) };
}

// ---- deadlock scenarios -----------------------------------------------------------------

export type DeadlockScenario = "transfers" | "three" | "upgrade";
export function deadlockTxns(scenario: DeadlockScenario, sorted: boolean): Txn[] {
  const ord = (rows: string[]) => (sorted ? [...rows].sort() : rows);
  const lock = (row: string, sql: string, work = 100): LockStep => ({ row, mode: "noKeyUpdate", work, sql });
  if (scenario === "transfers") {
    return [
      { id: "T1", start: 0, steps: ord(["acct 1", "acct 2"]).map((r) => lock(r, `UPDATE accounts … WHERE id = ${r.slice(5)}`)) },
      { id: "T2", start: 20, steps: ord(["acct 2", "acct 1"]).map((r) => lock(r, `UPDATE accounts … WHERE id = ${r.slice(5)}`)) },
    ];
  }
  if (scenario === "three") {
    return [
      { id: "T1", start: 0, steps: ord(["acct 1", "acct 2"]).map((r) => lock(r, `UPDATE … id = ${r.slice(5)}`)) },
      { id: "T2", start: 15, steps: ord(["acct 2", "acct 3"]).map((r) => lock(r, `UPDATE … id = ${r.slice(5)}`)) },
      { id: "T3", start: 30, steps: ord(["acct 3", "acct 1"]).map((r) => lock(r, `UPDATE … id = ${r.slice(5)}`)) },
    ];
  }
  // Both read the row FOR SHARE (shared locks don't conflict), then both try to update it:
  // each update conflicts with the other's share lock. Sorting can't help with one row;
  // taking the stronger lock up front (FOR NO KEY UPDATE) does.
  const upgrade = (id: string, start: number): Txn => ({
    id,
    start,
    steps: sorted
      ? [{ row: "acct 1", mode: "noKeyUpdate", work: 60, sql: "SELECT … FOR NO KEY UPDATE" }, { row: "acct 1", mode: "noKeyUpdate", work: 80, sql: "UPDATE accounts SET balance = …" }]
      : [{ row: "acct 1", mode: "share", work: 60, sql: "SELECT … FOR SHARE" }, { row: "acct 1", mode: "noKeyUpdate", work: 80, sql: "UPDATE accounts SET balance = …" }],
  });
  return [upgrade("T1", 0), upgrade("T2", 20)];
}
