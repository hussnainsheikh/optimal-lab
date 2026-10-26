// Optimistic vs pessimistic locking. First, two people edit the same product in a back office:
// with no check one save silently undoes the other; a version column turns that into a
// conflict the app can handle; SELECT … FOR UPDATE makes the second person wait. Then a seeded
// simulation of many clients updating a few hot rows: optimistic attempts that lose the race
// are thrown away and retried; pessimistic clients queue for the row's lock. Durations are
// illustrative; the conflicts, retries and waits are counted.

export type Strategy = "none" | "optimistic" | "pessimistic";
export type Product = { id: number; name: string; priceCents: number; stock: number; version: number };
export const LOADED: Product = { id: 42, name: "Desk lamp", priceCents: 2000, stock: 5, version: 7 };
export const ANA = { loadsAt: 0, savesAt: 30, change: { priceCents: 1800 } }; // seconds
export const BEN = { loadsAt: 5, savesAt: 40, change: { stock: 3 } };

export type Line = { t: number; who: "Ana" | "Ben" | "App"; sql: string; result: string; bad?: boolean };
const money = (c: number) => `$${(c / 100).toFixed(2)}`;

export function editors(strategy: Strategy, lockTimeoutS: number | null) {
  let row = { ...LOADED };
  const lines: Line[] = [];
  const full = (p: Product, v?: string) =>
    `UPDATE products SET price = ${money(p.priceCents)}, stock = ${p.stock}${v ? `, version = ${p.version + 1}` : ""} WHERE id = 42${v ?? ""}`;
  if (strategy === "pessimistic") {
    lines.push({ t: 0, who: "Ana", sql: "BEGIN; SELECT … FROM products WHERE id = 42 FOR UPDATE", result: "row locked while Ana edits" });
    const wait = ANA.savesAt - BEN.loadsAt;
    if (lockTimeoutS !== null && lockTimeoutS < wait) {
      lines.push({ t: BEN.loadsAt, who: "Ben", sql: "BEGIN; SELECT … FOR UPDATE", result: `waits, then ERROR after ${lockTimeoutS} s: lock timeout. Ben's page shows an error`, bad: true });
      row = { ...row, ...ANA.change, version: row.version + 1 };
      lines.push({ t: ANA.savesAt, who: "Ana", sql: "UPDATE …; COMMIT", result: `price ${money(row.priceCents)}` });
      return { lines, final: row, lost: [] as string[], benWaitedS: lockTimeoutS, benFailed: true, connectionsHeldS: ANA.savesAt };
    }
    lines.push({ t: BEN.loadsAt, who: "Ben", sql: "BEGIN; SELECT … FOR UPDATE", result: `Ben's page hangs for ${wait} s, holding a connection` });
    row = { ...row, ...ANA.change, version: row.version + 1 };
    lines.push({ t: ANA.savesAt, who: "Ana", sql: "UPDATE …; COMMIT", result: `price ${money(row.priceCents)}; lock released` });
    lines.push({ t: ANA.savesAt, who: "Ben", sql: "(SELECT returns)", result: `Ben's form finally loads with price ${money(row.priceCents)}` });
    const benSaves = ANA.savesAt + (BEN.savesAt - BEN.loadsAt);
    row = { ...row, ...BEN.change, version: row.version + 1 };
    lines.push({ t: benSaves, who: "Ben", sql: "UPDATE …; COMMIT", result: `stock ${row.stock}` });
    return { lines, final: row, lost: [] as string[], benWaitedS: wait, benFailed: false, connectionsHeldS: ANA.savesAt + benSaves - BEN.loadsAt };
  }

  // Both load the form; each holds their own copy of the row.
  const anaCopy = { ...row, ...ANA.change };
  const benCopy = { ...row, ...BEN.change };
  lines.push({ t: ANA.loadsAt, who: "Ana", sql: "SELECT … WHERE id = 42", result: `price ${money(row.priceCents)}, stock ${row.stock}${strategy === "none" ? "" : `, version ${row.version}`}` });
  lines.push({ t: BEN.loadsAt, who: "Ben", sql: "SELECT … WHERE id = 42", result: `price ${money(row.priceCents)}, stock ${row.stock}${strategy === "none" ? "" : `, version ${row.version}`}` });
  const v = strategy === "optimistic" ? ` AND version = ${LOADED.version}` : undefined;
  // Ana saves first.
  row = { ...anaCopy, version: row.version + 1 };
  lines.push({ t: ANA.savesAt, who: "Ana", sql: full(anaCopy, v), result: "UPDATE 1" });
  if (strategy === "none") {
    row = { ...benCopy, version: row.version + 1 };
    lines.push({ t: BEN.savesAt, who: "Ben", sql: full(benCopy), result: "UPDATE 1: Ben's form still had the old price", bad: true });
    return { lines, final: row, lost: [`Ana's price change (${money(ANA.change.priceCents)} → back to ${money(row.priceCents)})`], benWaitedS: 0, benFailed: false, connectionsHeldS: 0 };
  }
  lines.push({ t: BEN.savesAt, who: "Ben", sql: full(benCopy, v), result: `UPDATE 0: version is now ${row.version}, not ${LOADED.version}`, bad: true });
  lines.push({ t: BEN.savesAt, who: "App", sql: "SELECT … WHERE id = 42", result: `reload: price ${money(row.priceCents)}, version ${row.version}; reapply Ben's stock change` });
  const merged = { ...row, ...BEN.change };
  lines.push({ t: BEN.savesAt, who: "App", sql: full(merged, ` AND version = ${row.version}`), result: "UPDATE 1" });
  row = { ...merged, version: row.version + 1 };
  return { lines, final: row, lost: [] as string[], benWaitedS: 0, benFailed: false, connectionsHeldS: 0 };
}

// ---- contention ----------------------------------------------------------------------------

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const DB_MS = 2; // one read or one write
export type Load = { clients: number; rows: number; workMs: number; windowMs?: number };
export type LoadResult = { commits: number; perSec: number; retries: number; wastedMs: number; waitMs: number; worstAttempts: number; lockHeldMs: number; openTxns: number };

/** Every client loops: pick a row, read it, do workMs of app work, write it back. */
export function contention(strategy: "optimistic" | "pessimistic", { clients, rows, workMs, windowMs = 5000 }: Load, seed = 7): LoadResult {
  const rand = rng(seed);
  const version = Array(rows).fill(0);
  const lockedBy: (number | null)[] = Array(rows).fill(null);
  const queue: number[][] = Array.from({ length: rows }, () => []);
  type C = { row: number; phase: "start" | "wait" | "busy"; until: number; seen: number; attempts: number; since: number };
  const cs: C[] = Array.from({ length: clients }, () => ({ row: 0, phase: "start", until: 0, seen: 0, attempts: 0, since: 0 }));
  let commits = 0, retries = 0, wastedMs = 0, waitMs = 0, worstAttempts = 0, lockHeldMs = 0;
  const cycle = DB_MS + workMs + DB_MS;
  for (let now = 0; now < windowMs; now++) {
    cs.forEach((c, i) => {
      if (c.phase === "start") {
        c.row = Math.floor(rand() * rows);
        c.attempts = 1;
        if (strategy === "optimistic") {
          c.seen = version[c.row];
          c.phase = "busy";
          c.until = now + cycle;
        } else if (lockedBy[c.row] === null && queue[c.row].length === 0) {
          lockedBy[c.row] = i;
          c.phase = "busy";
          c.until = now + cycle;
        } else {
          queue[c.row].push(i);
          c.phase = "wait";
          c.since = now;
        }
        return;
      }
      if (c.phase === "wait") {
        if (lockedBy[c.row] === null && queue[c.row][0] === i) {
          queue[c.row].shift();
          lockedBy[c.row] = i;
          waitMs += now - c.since;
          c.phase = "busy";
          c.until = now + cycle;
        }
        return;
      }
      if (now < c.until) return;
      // The write.
      if (strategy === "optimistic" && version[c.row] !== c.seen) {
        retries++;
        wastedMs += cycle;
        c.attempts++;
        c.seen = version[c.row];
        c.until = now + cycle;
        return;
      }
      version[c.row]++;
      commits++;
      worstAttempts = Math.max(worstAttempts, c.attempts);
      if (strategy === "pessimistic") {
        lockedBy[c.row] = null;
        lockHeldMs += cycle;
      }
      c.phase = "start";
    });
  }
  // Transactions open on average: optimistic reads and writes are two short transactions per
  // attempt; a pessimistic client keeps its transaction (and connection) open while it waits
  // and while it works.
  const openTxns = strategy === "optimistic" ? ((commits + retries) * 2 * DB_MS) / windowMs : (lockHeldMs + waitMs) / windowMs;
  return { commits, perSec: Math.round((commits * 1000) / windowMs), retries, wastedMs, waitMs, worstAttempts, lockHeldMs, openTxns };
}
