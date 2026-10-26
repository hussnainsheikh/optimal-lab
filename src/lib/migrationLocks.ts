// Running a schema change on a busy Postgres table. Every statement takes a table-level lock;
// the lock queue is first in, first out, so an ALTER TABLE waiting for ACCESS EXCLUSIVE behind
// one long query makes every query after it wait too. Simulated a millisecond at a time with
// Postgres's table-lock conflict table: 100 app queries a second, a 6-second report already
// running, and the migration at t = 1 s, with or without lock_timeout and retries. Which lock
// each DDL statement takes and whether it rewrites or scans the table follow the Postgres docs;
// durations are illustrative.

export type Lock = "ACCESS SHARE" | "ROW EXCLUSIVE" | "SHARE UPDATE EXCLUSIVE" | "SHARE" | "SHARE ROW EXCLUSIVE" | "ACCESS EXCLUSIVE";
/** Postgres table-level lock conflicts (explicit-locking docs, table 13.2), for the modes used here. */
export const CONFLICTS: Record<Lock, Lock[]> = {
  "ACCESS SHARE": ["ACCESS EXCLUSIVE"],
  "ROW EXCLUSIVE": ["SHARE", "SHARE ROW EXCLUSIVE", "ACCESS EXCLUSIVE"],
  "SHARE UPDATE EXCLUSIVE": ["SHARE UPDATE EXCLUSIVE", "SHARE", "SHARE ROW EXCLUSIVE", "ACCESS EXCLUSIVE"],
  SHARE: ["ROW EXCLUSIVE", "SHARE UPDATE EXCLUSIVE", "SHARE ROW EXCLUSIVE", "ACCESS EXCLUSIVE"],
  "SHARE ROW EXCLUSIVE": ["ROW EXCLUSIVE", "SHARE UPDATE EXCLUSIVE", "SHARE", "SHARE ROW EXCLUSIVE", "ACCESS EXCLUSIVE"],
  "ACCESS EXCLUSIVE": ["ACCESS SHARE", "ROW EXCLUSIVE", "SHARE UPDATE EXCLUSIVE", "SHARE", "SHARE ROW EXCLUSIVE", "ACCESS EXCLUSIVE"],
};
const conflicts = (a: Lock, b: Lock) => CONFLICTS[a].includes(b);

export type Op = "addColumn" | "addVolatileDefault" | "setNotNull" | "addForeignKey" | "createIndex" | "changeType";
export type OpInfo = { label: string; sql: string; safeSql: string; safeLabel: string; lock: Lock; safeLock: Lock; work: "none" | "rewrite" | "scan" | "build"; safeWork: "none" | "rewrite" | "scan" | "build"; safeNote: string };
export const OPS: Record<Op, OpInfo> = {
  addColumn: { label: "Add a nullable column", sql: "ALTER TABLE orders ADD COLUMN gift_note text;", safeSql: "SET lock_timeout = '2s';\nALTER TABLE orders ADD COLUMN gift_note text;", safeLabel: "same statement", lock: "ACCESS EXCLUSIVE", safeLock: "ACCESS EXCLUSIVE", work: "none", safeWork: "none", safeNote: "only the catalog changes: the lock is held for milliseconds, if it can get it" },
  addVolatileDefault: { label: "Add a column with a volatile default", sql: "ALTER TABLE orders ADD COLUMN ref uuid DEFAULT gen_random_uuid();", safeSql: "ALTER TABLE orders ADD COLUMN ref uuid;\n-- backfill in batches, then:\nALTER TABLE orders ALTER COLUMN ref SET DEFAULT gen_random_uuid();", safeLabel: "add empty, backfill, then set the default", lock: "ACCESS EXCLUSIVE", safeLock: "ACCESS EXCLUSIVE", work: "rewrite", safeWork: "none", safeNote: "a constant default is stored once; a volatile one (like a random uuid) makes Postgres rewrite every row" },
  setNotNull: { label: "Make a column NOT NULL", sql: "ALTER TABLE orders ALTER COLUMN customer_id SET NOT NULL;", safeSql: "ALTER TABLE orders ADD CONSTRAINT cid_nn CHECK (customer_id IS NOT NULL) NOT VALID;\nALTER TABLE orders VALIDATE CONSTRAINT cid_nn;\nALTER TABLE orders ALTER COLUMN customer_id SET NOT NULL; -- uses the valid check, no scan", safeLabel: "NOT VALID check, VALIDATE, then SET NOT NULL", lock: "ACCESS EXCLUSIVE", safeLock: "SHARE UPDATE EXCLUSIVE", work: "scan", safeWork: "scan", safeNote: "VALIDATE scans under SHARE UPDATE EXCLUSIVE, which doesn't block reads or writes" },
  addForeignKey: { label: "Add a foreign key", sql: "ALTER TABLE orders ADD FOREIGN KEY (customer_id) REFERENCES customers;", safeSql: "ALTER TABLE orders ADD FOREIGN KEY (customer_id) REFERENCES customers NOT VALID;\nALTER TABLE orders VALIDATE CONSTRAINT orders_customer_id_fkey;", safeLabel: "NOT VALID, then VALIDATE", lock: "SHARE ROW EXCLUSIVE", safeLock: "SHARE UPDATE EXCLUSIVE", work: "scan", safeWork: "scan", safeNote: "the constraint applies to new rows at once; old rows are checked without blocking writes" },
  createIndex: { label: "Create an index", sql: "CREATE INDEX orders_created_idx ON orders (created_at);", safeSql: "CREATE INDEX CONCURRENTLY orders_created_idx ON orders (created_at);", safeLabel: "CREATE INDEX CONCURRENTLY", lock: "SHARE", safeLock: "SHARE UPDATE EXCLUSIVE", work: "build", safeWork: "build", safeNote: "CONCURRENTLY builds in two passes, slower, but writes keep flowing; it can't run inside a transaction" },
  changeType: { label: "Change int to bigint", sql: "ALTER TABLE orders ALTER COLUMN id TYPE bigint;", safeSql: "ALTER TABLE orders ADD COLUMN id_new bigint;\n-- trigger copies new writes, backfill old rows in batches,\n-- then swap the columns in one short transaction", safeLabel: "new column, backfill, swap", lock: "ACCESS EXCLUSIVE", safeLock: "ACCESS EXCLUSIVE", work: "rewrite", safeWork: "none", safeNote: "the rewrite moves to batched UPDATEs; the swap is a quick catalog change" },
};

export const ROWS_PER_S = { rewrite: 400_000, scan: 2_000_000, build: 600_000 }; // illustrative
export function workMs(work: OpInfo["work"], rows: number, concurrently = false) {
  if (work === "none") return 5;
  return Math.round((rows / ROWS_PER_S[work]) * 1000 * (concurrently ? 2.5 : 1));
}
export const blocks = (l: Lock) => ({ reads: conflicts("ACCESS SHARE", l), writes: conflicts("ROW EXCLUSIVE", l) });

// ---- the lock queue ---------------------------------------------------------------------------

export const REPORT_MS = 6_000; // a report that started just before the migration
export const MIGRATE_AT = 1_000;
export const QUERY_MS = 20;
export const QUERY_EVERY = 10; // 100 queries a second, alternating reads and writes
export const HORIZON = 14_000;

type Req = { id: number; lock: Lock; at: number; hold: number; kind: "app" | "report" | "ddl"; started?: number; done?: number; failed?: number };

export function simulate(lock: Lock, holdMs: number, lockTimeout: number | null, retryAfter = 1_000) {
  const reqs: Req[] = [{ id: 0, lock: "ACCESS SHARE", at: 0, hold: REPORT_MS, kind: "report" }];
  let id = 1;
  for (let t = 0; t < HORIZON; t += QUERY_EVERY) reqs.push({ id: id++, lock: id % 2 ? "ACCESS SHARE" : "ROW EXCLUSIVE", at: t, hold: QUERY_MS, kind: "app" });
  let ddl: Req | null = { id: id++, lock, at: MIGRATE_AT, hold: holdMs, kind: "ddl" };
  let ddlQueued = false;
  let ddlDone: number | null = null;
  const attempts: { at: number; result: string; ok: boolean }[] = [];
  const queue: Req[] = [];
  const held: Req[] = [];
  let next = 0;
  const waitingSeries: number[] = [];
  const heldModes = new Map<Lock, number>(Object.keys(CONFLICTS).map((m) => [m as Lock, 0]));
  const modes = [...heldModes.keys()];
  for (let now = 0; now <= HORIZON; now++) {
    let changed = false;
    for (let i = held.length - 1; i >= 0; i--) {
      const h = held[i];
      if (now >= h.started! + h.hold) {
        h.done = now;
        if (h.kind === "ddl") ddlDone = now;
        held.splice(i, 1);
        heldModes.set(h.lock, heldModes.get(h.lock)! - 1);
        changed = true;
      }
    }
    while (next < reqs.length && reqs[next].at <= now) {
      queue.push(reqs[next++]);
      changed = true;
    }
    if (ddl && !ddlQueued && now >= ddl.at) {
      queue.push(ddl);
      ddlQueued = true;
      changed = true;
    }
    // lock_timeout: the DDL gives up, leaves the queue, and tries again later.
    if (ddl && ddlQueued && ddl.started === undefined && lockTimeout !== null && now - ddl.at >= lockTimeout) {
      queue.splice(queue.indexOf(ddl), 1);
      attempts.push({ at: ddl.at, result: `lock timeout after ${lockTimeout.toLocaleString("en-US")} ms, retry in ${retryAfter.toLocaleString("en-US")} ms`, ok: false });
      ddl = { id: id++, lock, at: now + retryAfter, hold: holdMs, kind: "ddl" };
      ddlQueued = false;
      changed = true;
    }
    // Grant in order: a request waits if it conflicts with a holder or with anyone ahead of it.
    const ahead = new Set<Lock>();
    for (let i = 0; changed && i < queue.length; ) {
      if (ahead.has("ACCESS EXCLUSIVE")) break; // nothing behind it can be granted
      const r = queue[i];
      const blocked = modes.some((m) => heldModes.get(m)! > 0 && conflicts(r.lock, m)) || [...ahead].some((m) => conflicts(r.lock, m));
      if (blocked) {
        ahead.add(r.lock);
        i++;
        continue;
      }
      r.started = now;
      held.push(r);
      heldModes.set(r.lock, heldModes.get(r.lock)! + 1);
      queue.splice(i, 1);
      if (r.kind === "ddl") {
        attempts.push({ at: r.at, result: `got the lock after ${(now - r.at).toLocaleString("en-US")} ms and held it ${r.hold.toLocaleString("en-US")} ms`, ok: true });
        ddl = null;
      }
    }
    if (now % 100 === 0) waitingSeries.push(queue.filter((q) => q.kind === "app").length);
  }
  // Requests still queued when the window ends count as waiting until then.
  const app = reqs.filter((r) => r.kind === "app");
  const waits = app.map((r) => (r.started ?? HORIZON) - r.at);
  return { waitingSeries, maxWait: Math.max(...waits), over1s: waits.filter((w) => w > 1_000).length, total: app.length, stillWaiting: app.filter((r) => r.started === undefined).length, attempts, ddlDone };
}

// ---- backfill --------------------------------------------------------------------------------

export function backfill(rows: number, batch: number | null) {
  const perRowMs = 0.02; // illustrative UPDATE cost per row
  if (batch === null) return { statements: 1, longestTxnS: (rows * perRowMs) / 1000, rowsLockedAtOnce: rows, totalS: (rows * perRowMs) / 1000 };
  const statements = Math.ceil(rows / batch);
  const pause = 0.05; // seconds between batches, to let replicas and vacuum keep up
  return { statements, longestTxnS: (batch * perRowMs) / 1000, rowsLockedAtOnce: batch, totalS: (rows * perRowMs) / 1000 + statements * pause };
}
