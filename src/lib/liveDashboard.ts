// A trading-style dashboard: 400 rows updated over a WebSocket. Render cost per strategy is
// arithmetic on illustrative per-row costs. The reconnect part replays a real message stream:
// each message carries a sequence number and a symbol, a 5-second drop loses some, and rows
// that changed during the gap stay wrong until something resyncs them. Reconnect timing for
// many clients is computed with and without random jitter (seeded, so it's repeatable).

export const ROWS = 400;
export const COST = { row: 0.02, commit: 0.35 }; // ms to render one row; fixed ms per React commit
export type Strategy = "every" | "memo" | "frame" | "throttle";
export const STRATEGIES: { id: Strategy; label: string; what: string }[] = [
  { id: "every", label: "Re-render the table per message", what: "each message sets state at the top; all 400 rows render" },
  { id: "memo", label: "Per message, changed row only", what: "rows are memoised and keyed, so only the changed one renders, but there's still a commit per message" },
  { id: "frame", label: "Batch per animation frame", what: "messages go into a buffer; once per frame, the latest value per row is committed" },
  { id: "throttle", label: "Batch, 4 updates a second", what: "the buffer is flushed four times a second: still live to the eye, far less work" },
];

export function renderLoad(s: Strategy, rate: number, hidden: boolean, pauseHidden: boolean) {
  if (hidden && pauseHidden) return { commitsPerSec: 0, msPerSec: 0, busy: 0, dropped: 0 };
  const distinctPer = (n: number) => Math.min(ROWS, n); // rows touched in a batch of n messages (at most all of them)
  let commits = 0;
  let ms = 0;
  if (s === "every") {
    commits = rate;
    ms = rate * (COST.commit + ROWS * COST.row);
  } else if (s === "memo") {
    commits = rate;
    ms = rate * (COST.commit + COST.row);
  } else {
    const flushes = s === "frame" ? 60 : 4;
    commits = Math.min(rate, flushes);
    ms = commits * (COST.commit + distinctPer(Math.ceil(rate / commits)) * COST.row);
  }
  const busy = Math.min(100, Math.round((ms / 1000) * 100));
  // Past about 70% main-thread use, frames start to miss their 16.7 ms slot.
  const dropped = busy > 70 ? Math.round(((busy - 70) / 30) * 60) : 0;
  return { commitsPerSec: Math.round(commits), msPerSec: Math.round(ms), busy, dropped };
}

// ---- gaps ------------------------------------------------------------------------------

// Like a real feed, a few rows are busy: 40 hot symbols get most messages, the other 360 are quiet.
const symbolOf = (seq: number) => (seq % 7 === 0 ? 40 + ((seq * 7919) % 360) : (seq * 13) % 40);

/** 200 msg/s for 10 s; the socket drops from 3 s to 8 s. */
export function reconnect(detectGaps: boolean) {
  const rate = 200;
  const total = rate * 10;
  const gapFrom = rate * 3;
  const gapTo = rate * 8;
  const truth = new Map<number, number>();
  const shown = new Map<number, number>();
  for (let seq = 1; seq <= total; seq++) {
    const sym = symbolOf(seq);
    truth.set(sym, seq);
    const lost = seq > gapFrom && seq <= gapTo;
    if (!lost) shown.set(sym, seq);
  }
  // The first message after reconnecting has seq gapTo+1, but the client last saw gapFrom.
  if (detectGaps) for (const [sym, seq] of truth) shown.set(sym, seq); // snapshot fetched on the gap
  const stale = [...truth].filter(([sym, seq]) => shown.get(sym) !== seq).length;
  return { missed: gapTo - gapFrom, stale, firstSeqAfter: gapTo + 1, lastSeen: gapFrom };
}

// ---- reconnect storms --------------------------------------------------------------------

/** 10,000 clients lose the server at once and reconnect: the busiest second. */
export function stampede(jitter: boolean) {
  const clients = 10000;
  let s = 42;
  const rand = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
  const perSecond = new Array(40).fill(0);
  for (let c = 0; c < clients; c++) {
    // Every client retries after 1 s; with "full jitter", at a random moment in the first 4 s.
    const at = jitter ? rand() * 4 : 1;
    perSecond[Math.min(39, Math.floor(at))]++;
  }
  return { peak: Math.max(...perSecond), clients };
}
