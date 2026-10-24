// Point-in-time recovery. A base backup is taken at 02:00 and every WAL segment after it is
// archived. At 10:42:31 someone runs DELETE FROM orders with no WHERE; the shop keeps taking
// orders until 11:30, when it's noticed. Restoring means: copy the base backup, replay archived
// WAL up to a target time, and stop. Orders are generated from a seeded stream and replayed
// for real; segment sizes, copy and replay speeds are illustrative.

export const BACKUP_AT = 2 * 3600; // 02:00
export const DELETE_AT = 10 * 3600 + 42 * 60 + 31; // 10:42:31
export const NOTICED_AT = 11 * 3600 + 30 * 60; // 11:30
export const ROWS_AT_MIDNIGHT = 12_000;
export const SEGMENT_S = 300; // archive_timeout: a segment is switched and archived at least every 5 minutes
export const GAP_AT = 9 * 3600 + 15 * 60; // the segment that a bucket lifecycle rule deleted
export const BASE_BACKUP_GB = 40;

export const clock = (s: number) => [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60].map((n) => String(n).padStart(2, "0")).join(":");

export type Ev = { t: number; kind: "insert" | "delete"; id?: number };

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

/** Orders from midnight to 11:30: quiet at night, busier from 07:00. */
export function events(seed = 42): Ev[] {
  const r = rng(seed);
  const out: Ev[] = [];
  let id = ROWS_AT_MIDNIGHT;
  for (let t = 0; t < NOTICED_AT; ) {
    const mean = t < 7 * 3600 ? 60 : 6; // seconds between orders
    t += Math.max(1, Math.round(-Math.log(1 - r()) * mean));
    if (t >= DELETE_AT && !out.some((e) => e.kind === "delete")) out.push({ t: DELETE_AT, kind: "delete" });
    if (t < NOTICED_AT) out.push({ t, kind: "insert", id: ++id });
  }
  return out;
}

/** Apply events in (from, to] to a row count. */
function replay(start: number, evs: Ev[], from: number, to: number) {
  let rows = start;
  for (const e of evs) {
    if (e.t <= from || e.t > to) continue;
    rows = e.kind === "delete" ? 0 : rows + 1;
  }
  return rows;
}

export type Source = "dump" | "pitr";
export type Where = "over" | "side";

export function restore(source: Source, target: number, gap: boolean, where: Where, evs = events()) {
  const at = (t: number) => replay(ROWS_AT_MIDNIGHT, evs, 0, t);
  const backupRows = at(BACKUP_AT);
  const segments = Math.ceil((NOTICED_AT - BACKUP_AT) / SEGMENT_S);
  const needed = source === "pitr" ? Math.ceil((target - BACKUP_AT) / SEGMENT_S) : 0;
  const gapIndex = Math.floor((GAP_AT - BACKUP_AT) / SEGMENT_S);
  let reached = source === "dump" ? BACKUP_AT : target;
  let error: string | null = null;
  if (source === "pitr" && gap && needed > gapIndex) {
    reached = BACKUP_AT + gapIndex * SEGMENT_S;
    error = `FATAL: recovery ended before configured recovery target was reached (segment for ${clock(reached)}–${clock(reached + SEGMENT_S)} is missing from the archive)`;
  }
  const restored = at(reached);
  const includesDelete = reached >= DELETE_AT;
  const insertsBetween = (a: number, b: number) => evs.filter((e) => e.kind === "insert" && e.t > a && e.t <= b).length;
  const goodNow = at(DELETE_AT - 1) + insertsBetween(DELETE_AT, NOTICED_AT); // every real order that should exist
  // Inserts after the DELETE are still in production; a side restore copies the old rows back next to them.
  const afterDeleteInProd = insertsBetween(DELETE_AT, NOTICED_AT);
  const finalRows = where === "side" ? (error || includesDelete ? afterDeleteInProd : restored + afterDeleteInProd) : error ? 0 : restored;
  const lost = Math.max(0, goodNow - finalRows);
  const replaySegments = source === "pitr" ? Math.min(needed, error ? gapIndex : needed) : 0;
  const minutes = (BASE_BACKUP_GB * 1000) / 200 / 60 + (replaySegments * 16) / 100 / 60; // copy at 200 MB/s, replay at 100 MB/s
  return { backupRows, segments, needed, replaySegments, gapIndex, reached, error, restored, includesDelete, goodNow, finalRows, lost, minutes, afterDeleteInProd };
}

/** The orders committed around the mistake, for the log excerpt. */
export function around(evs = events(), from = DELETE_AT - 60, to = DELETE_AT + 45) {
  return evs.filter((e) => e.t >= from && e.t <= to);
}
