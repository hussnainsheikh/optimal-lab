// Vacuum and bloat over twelve hours on a 10-million-row table that is updated all day. Every
// UPDATE writes a new row version and leaves the old one dead. Autovacuum runs when dead rows
// pass autovacuum_vacuum_threshold + autovacuum_vacuum_scale_factor × rows, and can only remove
// versions no running transaction might still see. Removed versions free space for reuse, but
// the file never shrinks. Simulated minute by minute; page pruning between vacuums and index
// bloat are left out, and the VACUUM FULL speed is illustrative.

export const ROWS = 10_000_000;
export const ROWS_PER_PAGE = 60; // about 130-byte rows in 8 KB pages
export const PAGE_B = 8192;
export const THRESHOLD = 50; // autovacuum_vacuum_threshold
export const HOURS = 12;
export const LONG_TXN = { from: 2 * 60, to: 8 * 60 }; // a session left idle in transaction, 02:00–08:00
export const IDLE_TIMEOUT_MIN = 10; // idle_in_transaction_session_timeout = '10min'
export const REWRITE_MB_S = 150; // illustrative VACUUM FULL rewrite speed

export type VacOpts = { updatesPerS: number; scaleFactor: number; longTxn: boolean; idleTimeout: boolean };
export type Point = { minute: number; sizeMB: number; dead: number; vacuumed: boolean };

export const trigger = (scaleFactor: number) => THRESHOLD + scaleFactor * ROWS;
const mb = (pages: number) => (pages * PAGE_B) / 1e6;

export function simulate({ updatesPerS, scaleFactor, longTxn, idleTimeout }: VacOpts) {
  let pages = ROWS / ROWS_PER_PAGE;
  let free = 0;
  const deadByMinute: number[] = [];
  const series: Point[] = [];
  let vacuums = 0;
  let emptyVacuums = 0;
  let removedTotal = 0;
  const txnEnd = idleTimeout ? LONG_TXN.from + IDLE_TIMEOUT_MIN : LONG_TXN.to;
  for (let m = 0; m < HOURS * 60; m++) {
    const n = updatesPerS * 60;
    if (free < n) {
      const grow = Math.ceil((n - free) / ROWS_PER_PAGE);
      pages += grow;
      free += grow * ROWS_PER_PAGE;
    }
    free -= n;
    deadByMinute[m] = n;
    // The oldest snapshot still open: versions that died before it are invisible to everyone.
    const horizon = longTxn && m >= LONG_TXN.from && m < txnEnd ? LONG_TXN.from : m + 1;
    const dead = deadByMinute.reduce((a, b) => a + b, 0); // what autovacuum sees when it wakes
    let vacuumed = false;
    if (dead >= trigger(scaleFactor)) {
      vacuums++;
      vacuumed = true;
      let removed = 0;
      for (let k = 0; k < Math.min(horizon, deadByMinute.length); k++) {
        removed += deadByMinute[k];
        deadByMinute[k] = 0;
      }
      if (!removed) emptyVacuums++;
      removedTotal += removed;
      free += removed;
    }
    series.push({ minute: m, sizeMB: mb(pages), dead, vacuumed });
  }
  const minPages = ROWS / ROWS_PER_PAGE;
  const final = series[series.length - 1];
  return {
    series,
    vacuums,
    emptyVacuums,
    removedTotal,
    minMB: mb(minPages),
    finalMB: final.sizeMB,
    maxDead: Math.max(...series.map((p) => p.dead)),
    bloatPct: Math.round((1 - minPages / pages) * 100),
    vacuumFullS: Math.round(mb(pages) / REWRITE_MB_S),
  };
}

export const hhmm = (minute: number) => `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
