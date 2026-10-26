// Checkpoints and crash recovery on a small write-ahead log. Every change is a log record with
// an LSN (its position in the log); each data page remembers the LSN of the last change written
// into it. A checkpoint notes a redo point, then flushes every page that was dirty at that
// moment. After a crash, recovery starts at the last checkpoint's redo point and replays each
// record whose page doesn't already have it. The first change to a page after a checkpoint
// carries a full copy of the page (full_page_writes), so a page torn by the crash can be rebuilt.
// The replay decisions are computed; the at-scale numbers use illustrative rates.

export type Rec = { lsn: number; txn: string; page: string | null; text: string };
export const LOG: Rec[] = [
  { lsn: 10, txn: "T1", page: "A", text: "stock 5 → 4" },
  { lsn: 20, txn: "T1", page: "B", text: "order 811 added" },
  { lsn: 30, txn: "T1", page: null, text: "COMMIT" },
  { lsn: 40, txn: "T2", page: "C", text: "email changed" },
  { lsn: 50, txn: "T2", page: null, text: "COMMIT" },
  { lsn: 60, txn: "T3", page: "A", text: "stock 4 → 3" },
  { lsn: 70, txn: "T3", page: "D", text: "order 812 added" },
  { lsn: 80, txn: "T3", page: null, text: "COMMIT" },
  { lsn: 90, txn: "T4", page: "C", text: "address changed" },
  { lsn: 100, txn: "T4", page: "E", text: "invoice 77 paid" },
  { lsn: 110, txn: "T4", page: null, text: "COMMIT" },
  { lsn: 120, txn: "T5", page: "F", text: "refund queued" },
  { lsn: 130, txn: "T5", page: "B", text: "order 811 cancelled" },
];
export const PAGES = ["A", "B", "C", "D", "E", "F"];
export const BGWRITER_FLUSH = { page: "C", afterLsn: 90 }; // the background writer flushes C after record 90

export type Checkpoint = 0 | 50 | 80; // the redo point (0 = only the startup checkpoint)
export type Action = "before" | "fpi" | "skip" | "apply" | "torn" | "commit";
export type Step = { rec: Rec; action: Action; note: string };

export function recover(checkpoint: Checkpoint, crashAfter: number, fullPageWrites: boolean, tornWrite: boolean) {
  const redo = checkpoint <= crashAfter ? checkpoint : 0; // a checkpoint after the crash never happened
  const written = LOG.filter((r) => r.lsn <= crashAfter);
  // What's on disk when the power goes.
  const pageLsn: Record<string, number> = Object.fromEntries(PAGES.map((p) => [p, 0]));
  for (const r of written) if (r.page && r.lsn <= redo) pageLsn[r.page] = r.lsn; // flushed by the checkpoint
  if (crashAfter >= BGWRITER_FLUSH.afterLsn) pageLsn[BGWRITER_FLUSH.page] = BGWRITER_FLUSH.afterLsn;
  const lastData = [...written].reverse().find((r) => r.page && r.lsn > redo);
  const torn = tornWrite && lastData ? lastData.page! : null; // the crash lands mid-write of this page
  const firstAfterRedo = new Map<string, number>();
  for (const r of written) if (r.page && r.lsn > redo && !firstAfterRedo.has(r.page)) firstAfterRedo.set(r.page, r.lsn);

  const steps: Step[] = [];
  const committed = new Set<string>();
  let failed: string | null = null;
  const live: Record<string, number> = { ...pageLsn };
  const fixed = new Set<string>();
  for (const r of written) {
    if (r.lsn <= redo) {
      steps.push({ rec: r, action: "before", note: "before the redo point: already on disk" });
      if (!r.page) committed.add(r.txn);
      continue;
    }
    if (failed) break;
    if (!r.page) {
      committed.add(r.txn);
      steps.push({ rec: r, action: "commit", note: `${r.txn} is committed` });
      continue;
    }
    const first = firstAfterRedo.get(r.page) === r.lsn;
    if (r.page === torn && !fixed.has(r.page)) {
      if (first && fullPageWrites) {
        fixed.add(r.page);
        live[r.page] = r.lsn;
        steps.push({ rec: r, action: "fpi", note: `page ${r.page} was torn by the crash: rebuilt from the full-page image in this record` });
        continue;
      }
      failed = `page ${r.page} is half old, half new: with data checksums on, its checksum fails and recovery stops; without them the damage goes unnoticed`;
      steps.push({ rec: r, action: "torn", note: failed });
      break;
    }
    if (first && fullPageWrites) {
      live[r.page] = r.lsn;
      steps.push({ rec: r, action: "fpi", note: `first change to ${r.page} since the checkpoint: the record holds the whole page, copy it in` });
      continue;
    }
    if (r.lsn <= live[r.page]) {
      steps.push({ rec: r, action: "skip", note: `page ${r.page} on disk is already at LSN ${live[r.page]}` });
      continue;
    }
    steps.push({ rec: r, action: "apply", note: `page ${r.page} is at LSN ${live[r.page]}: redo it` });
    live[r.page] = r.lsn;
  }
  const txns = [...new Set(written.map((r) => r.txn))];
  const lost = failed ? [] : txns.filter((t) => !committed.has(t));
  const replayed = steps.filter((s) => s.action === "apply" || s.action === "fpi").length;
  return { redo, pageLsn, torn, steps, replayed, skipped: steps.filter((s) => s.action === "skip").length, committed: [...committed], lost, failed, live };
}

// ---- at scale -------------------------------------------------------------------------------

export const UPDATES_PER_S = 2000;
export const HOT_PAGES = 200_000; // 1.6 GB of pages being updated
export const RECORD_B = 120;
export const FPI_B = 8192;
export const REPLAY_MB_S = 100; // illustrative redo speed
export const COMPLETION_TARGET = 0.9; // checkpoint_completion_target

/** Expected distinct pages touched by n uniform random updates over P pages. */
export const distinct = (n: number, P = HOT_PAGES) => P * (1 - Math.pow(1 - 1 / P, n));

export function atScale(intervalS: number, fullPageWrites = true) {
  const n = UPDATES_PER_S * intervalS;
  const fpis = fullPageWrites ? distinct(n) : 0;
  const walPerCycle = n * RECORD_B + fpis * FPI_B;
  const walPerHourGB = (walPerCycle * (3600 / intervalS)) / 1e9;
  // Worst case: crash just before the next checkpoint finishes, so redo starts at the beginning
  // of the previous one: one interval plus the time the next one spends writing.
  const worstReplayB = walPerCycle * (1 + COMPLETION_TARGET);
  const recoveryS = worstReplayB / (REPLAY_MB_S * 1e6);
  const pagesWrittenPerHour = distinct(n) * (3600 / intervalS);
  return { intervalS, fpiShare: fpis ? (fpis * FPI_B) / walPerCycle : 0, walPerHourGB, recoveryS, checkpointWritesGBPerHour: (pagesWrittenPerHour * 8192) / 1e9 };
}
export const INTERVALS = [30, 300, 900, 3600];
