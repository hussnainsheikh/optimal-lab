// ACID on one bank transfer: move money from Alice to Bob in two UPDATEs. Each letter can be
// switched off to see what it was protecting: a crash between the two UPDATEs (atomicity), an
// overdraft against a CHECK constraint (consistency), a report that reads while the transfer
// runs (isolation, evaluated over real row versions), and a power cut after COMMIT returned
// (durability). Balances are computed; the fsync timings follow Postgres's documented defaults.

export type Accounts = { alice: number; bob: number; carol: number };
export const START: Accounts = { alice: 300, bob: 200, carol: 500 };
export const TOTAL = START.alice + START.bob + START.carol;
const sum = (a: Accounts) => a.alice + a.bob + a.carol;

export const TRANSFER_SQL = (amount: number) => [
  "BEGIN;",
  `UPDATE accounts SET balance = balance - ${amount} WHERE name = 'alice';`,
  `UPDATE accounts SET balance = balance + ${amount} WHERE name = 'bob';`,
  "COMMIT;",
];

/** A: the server crashes after the first UPDATE and restarts. */
export function atomicity(on: boolean, amount: number) {
  const after: Accounts = on ? { ...START } : { ...START, alice: START.alice - amount };
  return {
    after,
    total: sum(after),
    note: on
      ? "recovery finds no COMMIT record for the transfer, so its first UPDATE is never visible"
      : `the debit survived the crash and the credit never ran: $${amount} has vanished`,
  };
}

/** C: Alice tries to send more than she has. The constraint is only there if you declared it. */
export function consistency(check: boolean, amount: number) {
  const overdraft = START.alice - amount < 0;
  if (overdraft && check) {
    return { after: { ...START }, error: 'new row for relation "accounts" violates check constraint "balance_nonnegative"', note: "the UPDATE fails, the transaction is rolled back, nothing changes" };
  }
  const after = { ...START, alice: START.alice - amount, bob: START.bob + amount };
  return { after, error: null, note: overdraft ? `Alice is at −$${-after.alice}: no rule said she couldn't be` : "the transfer is valid either way" };
}

// I: a report sums all three balances while the transfer runs. Each row has versions with the
// transaction that wrote them; a read at a given time and isolation level picks a version.
export type Level = "dirty" | "readCommitted" | "repeatableRead";
export type Outcome = "commit" | "rollback";
type Version = { value: number; at: number; committed: boolean };
export type Event = { t: number; who: "transfer" | "report"; text: string };

export function isolation(level: Level, outcome: Outcome, amount = 100) {
  const commitAt = 4;
  const versions: Record<keyof Accounts, Version[]> = {
    alice: [{ value: START.alice, at: 0, committed: true }, { value: START.alice - amount, at: 1, committed: outcome === "commit" }],
    bob: [{ value: START.bob, at: 0, committed: true }, { value: START.bob + amount, at: 3, committed: outcome === "commit" }],
    carol: [{ value: START.carol, at: 0, committed: true }],
  };
  const events: Event[] = [
    { t: 1, who: "transfer", text: `UPDATE alice − ${amount}` },
    { t: 2, who: "report", text: "SELECT balance … 'alice'" },
    { t: 3, who: "transfer", text: `UPDATE bob + ${amount}` },
    { t: commitAt, who: "transfer", text: outcome === "commit" ? "COMMIT" : "ROLLBACK (card check failed)" },
    { t: 5, who: "report", text: "SELECT balance … 'bob', 'carol'" },
  ];
  const snapshotAt = 2; // REPEATABLE READ takes its snapshot at the report's first query
  const read = (row: keyof Accounts, t: number) => {
    const vs = versions[row].filter((v) => v.at <= t && (v.committed || t < commitAt)); // a rollback discards its versions
    if (level === "dirty") return vs[vs.length - 1].value; // the newest, committed or not
    const asOf = level === "repeatableRead" ? snapshotAt : t;
    // A version is visible if it was committed by the time of the snapshot.
    const visible = vs.filter((v) => v.at === 0 || (v.committed && commitAt <= asOf));
    return visible[visible.length - 1].value;
  };
  const seen: Accounts = { alice: read("alice", 2), bob: read("bob", 5), carol: read("carol", 5) };
  const total = sum(seen);
  return { events, seen, total, wrongBy: total - TOTAL };
}

export const LEVEL_LABEL: Record<Level, string> = {
  dirty: "Dirty reads (READ UNCOMMITTED in some databases)",
  readCommitted: "READ COMMITTED (Postgres default)",
  repeatableRead: "REPEATABLE READ",
};

// D: COMMIT has returned; then the power goes out.
export type Sync = "on" | "off" | "fsyncOff";
export const WAL_WRITER_DELAY = 200; // ms, Postgres default
export const DIRTY_EXPIRE_MS = 30_000; // Linux's default dirty_expire_centisecs = 3000
export const COMMIT_OFFSET = 130; // the commit lands 130 ms into the WAL writer's cycle

/** When the commit's WAL record actually reaches the disk, in ms after COMMIT returned. */
export function flushedAfter(sync: Sync) {
  if (sync === "on") return 0; // COMMIT waits for the fsync before returning
  if (sync === "off") return WAL_WRITER_DELAY - COMMIT_OFFSET; // the WAL writer's next wake-up
  return DIRTY_EXPIRE_MS; // nobody calls fsync: the OS writes dirty pages when it gets to them
}
export function durability(sync: Sync, cutAfterMs: number) {
  const flushed = flushedAfter(sync);
  const survives = cutAfterMs >= flushed;
  const note =
    sync === "on"
      ? "COMMIT only returned after the WAL record was on disk: the transfer is there after restart"
      : survives
        ? `the record was flushed ${flushed.toLocaleString("en-US")} ms after COMMIT returned, before the power went`
        : sync === "off"
          ? `COMMIT returned, but the record was still in memory: the transfer is gone (the app already told the user it worked). Worst case is 3 × wal_writer_delay = ${3 * WAL_WRITER_DELAY} ms of commits`
          : "nothing was fsynced: committed work is lost, and pages written half-way can leave the database unable to start";
  return { flushed, survives, corruptionRisk: sync === "fsyncOff" && !survives, note };
}
