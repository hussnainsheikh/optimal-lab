// Cache-aside with a price change at t=15s. Which reads return the old price?
export type Strategy = "ttl" | "delete" | "race" | "write-through";
export const STRATEGIES: { id: Strategy; label: string }[] = [
  { id: "ttl", label: "TTL only (60 s)" },
  { id: "delete", label: "Delete key on write" },
  { id: "race", label: "Delete on write, slow reader" },
  { id: "write-through", label: "Write-through" },
];
export const WRITE_AT = 15;
export const READS = [0, 10, 20, 30, 40, 50, 60, 70, 80];

export function run(s: Strategy) {
  let db = 10;
  let cache: { v: number; exp: number } | null = null;
  const log: { t: number; text: string; kind: "write" | "race" | "info" }[] = [];
  const reads: { t: number; v: number; from: "cache" | "db"; stale: boolean }[] = [];
  const events = [...READS.map((t) => ({ t, k: "read" })), { t: WRITE_AT, k: "write" }, ...(s === "race" ? [{ t: 16, k: "slow" }] : [])].sort((a, b) => a.t - b.t);
  for (const e of events) {
    if (cache && e.t >= cache.exp) cache = null;
    if (e.k === "write") {
      db = 12;
      if (s === "delete" || s === "race") { cache = null; log.push({ t: e.t, text: "UPDATE price = 12, then DEL price", kind: "write" }); }
      else if (s === "write-through") { cache = { v: 12, exp: e.t + 60 }; log.push({ t: e.t, text: "UPDATE price = 12, SET cache = 12", kind: "write" }); }
      else log.push({ t: e.t, text: "UPDATE price = 12 (cache untouched)", kind: "write" });
    } else if (e.k === "slow") {
      cache = { v: 10, exp: e.t + 60 };
      log.push({ t: 14, text: "slow reader misses the cache and reads 10 from the DB…", kind: "race" });
      log.push({ t: e.t, text: "…then SETs cache = 10 after the delete. Stale again.", kind: "race" });
    } else {
      if (cache) reads.push({ t: e.t, v: cache.v, from: "cache", stale: cache.v !== db });
      else { cache = { v: db, exp: e.t + 60 }; reads.push({ t: e.t, v: db, from: "db", stale: false }); }
    }
  }
  return { reads, log, staleCount: reads.filter((r) => r.stale).length };
}
