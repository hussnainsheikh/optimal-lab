// Head-of-line blocking at two layers. Six files share one link, one packet per millisecond.
// HTTP/1.1 on one connection sends responses one after another, so a slow response holds up the
// ones queued behind it (application layer). HTTP/2 interleaves the files on one TCP connection,
// but TCP hands bytes to the app strictly in order, so one lost packet holds up every file until
// it is retransmitted (transport layer). Six TCP connections only hold up the file whose packet
// was lost; QUIC orders bytes per stream, so it does the same on one connection. Losses are
// detected by three later packets on the same connection (fast retransmit) or, near the end of
// a connection, by a retransmission timeout. Each run is seeded; many runs give p50 and p95.

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

export type Transport = "h1one" | "h1six" | "h2" | "h3";
export const TRANSPORTS: Transport[] = ["h1one", "h1six", "h2", "h3"];
export const LABEL: Record<Transport, string> = { h1one: "HTTP/1.1, one connection", h1six: "HTTP/1.1, six connections", h2: "HTTP/2 over TCP", h3: "HTTP/3 over QUIC" };
export const FILES = ["app.css", "/api/feed", "app.js", "hero.jpg", "font.woff2", "logo.svg"];
export const STREAMS = FILES.length;
export const PKTS = 25; // packets per file
export const SLOW = 150; // ms the slow response takes on the server
export const MIN_RTO = 200;

export type Pkt = { stream: number; idx: number; conn: number; seq: number; send: number; arrive: number; deliver: number; lost: number; rto: boolean };
export type Run = { pkts: Pkt[]; done: number[]; mean: number; page: number; held: number; losses: number; rtos: number };

export function runOnce(t: Transport, loss: number, rtt: number, slow: boolean, seed: number): Run {
  const r = rng(seed);
  const ready = FILES.map((_, i) => (slow && i === 1 ? SLOW : 0));
  const left = FILES.map(() => PKTS);
  const pkts: Pkt[] = [];
  const connSeq = new Array(STREAMS).fill(0);
  let now = 0;
  let cur = 0; // for one-connection HTTP/1.1: the response being sent
  let rr = 0;
  while (pkts.length < STREAMS * PKTS) {
    let s = -1;
    if (t === "h1one") {
      while (left[cur] === 0) cur++;
      if (ready[cur] <= now) s = cur;
    } else {
      for (let k = 0; k < STREAMS; k++) {
        const c = (rr + k) % STREAMS;
        if (left[c] > 0 && ready[c] <= now) {
          s = c;
          rr = c + 1;
          break;
        }
      }
    }
    if (s < 0) {
      now++;
      continue;
    }
    const conn = t === "h1six" ? s : 0;
    pkts.push({ stream: s, idx: PKTS - left[s], conn, seq: connSeq[conn]++, send: now, arrive: 0, deliver: 0, lost: 0, rto: false });
    left[s]--;
    now++;
  }
  const rto = Math.max(MIN_RTO, 3 * rtt);
  const half = rtt / 2;
  const byConn = new Map<number, Pkt[]>();
  for (const p of pkts) {
    const list = byConn.get(p.conn);
    if (list) list.push(p);
    else byConn.set(p.conn, [p]);
  }
  let losses = 0;
  let rtos = 0;
  for (const list of byConn.values()) {
    list.forEach((p, i) => {
      let at = p.send + half;
      if (r() < loss) {
        losses++;
        p.lost = 1;
        // three later packets on this connection arrive and their duplicate ACKs come back
        const third = list[i + 3];
        let resend: number;
        if (third) resend = third.send + rtt;
        else {
          resend = p.send + rto;
          p.rto = true;
          rtos++;
        }
        at = resend + half;
        while (r() < loss) {
          // a lost retransmission is only found by the timeout
          losses++;
          p.lost++;
          rtos++;
          at += rto;
        }
      }
      p.arrive = at;
    });
  }
  // what the app can read, and when
  let held = 0;
  const lastBy = new Map<string, number>();
  const order = [...pkts].sort((a, b) => a.conn - b.conn || a.seq - b.seq);
  for (const p of order) {
    const key = t === "h3" ? `s${p.stream}` : `c${p.conn}`;
    p.deliver = Math.max(p.arrive, lastBy.get(key) ?? 0);
    lastBy.set(key, p.deliver);
    if (p.deliver > p.arrive) held++; // arrived, but waits for an earlier packet
  }
  const done = FILES.map(() => 0);
  for (const p of pkts) done[p.stream] = Math.max(done[p.stream], p.deliver);
  return { pkts, done, mean: done.reduce((a, b) => a + b, 0) / STREAMS, page: Math.max(...done), held, losses, rtos };
}

const pct = (xs: number[], q: number) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(q * s.length))];
};

export type Stats = { p50: number; p95: number; meanP50: number; meanP95: number; heldP50: number };
const statCache = new Map<string, Stats>();
export const TRIALS = 200;

export function stats(t: Transport, loss: number, rtt: number, slow: boolean): Stats {
  const key = `${t}-${loss}-${rtt}-${slow}`;
  const hit = statCache.get(key);
  if (hit) return hit;
  const pages: number[] = [];
  const means: number[] = [];
  const held: number[] = [];
  for (let i = 0; i < TRIALS; i++) {
    const run = runOnce(t, loss, rtt, slow, 1000 + i);
    pages.push(run.page);
    means.push(run.mean);
    held.push(run.held);
  }
  const s = { p50: pct(pages, 0.5), p95: pct(pages, 0.95), meanP50: pct(means, 0.5), meanP95: pct(means, 0.95), heldP50: pct(held, 0.5) };
  if (statCache.size > 400) statCache.clear();
  statCache.set(key, s);
  return s;
}

export const LOSSES = [0, 0.005, 0.01, 0.02, 0.03, 0.05];
