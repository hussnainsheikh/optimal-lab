// Design a rate limiter shared by four API servers. The rule: 100 requests a minute
// per API key (fixed one-minute window). Two clients over one minute:
//   a scraper sending 30 requests a second, spread over the servers by the load balancer
//   a normal app sending 1 request a second over one keep-alive connection (one server)
// Where the counters live decides how many requests each gets through, what each
// request costs, and what happens when the counter store goes down for 15 seconds.

export const SERVERS = 4;
export const LIMIT = 100;
export const SECONDS = 60;
export const SCRAPER_RPS = 30;
export const OUTAGE: [number, number] = [30, 45];
export const STORE_RTT_MS = 1; // to Redis in the same zone

export type Design = "local" | "split" | "central" | "synced";
export const DESIGNS: { id: Design; label: string; one: string }[] = [
  { id: "local", label: "Per server", one: `Each server counts on its own and allows ${LIMIT} a minute.` },
  { id: "split", label: "Per server ÷ 4", one: `Each server counts on its own and allows ${LIMIT / SERVERS}, a quarter of the limit.` },
  { id: "central", label: "Central store", one: "Every request increments one counter in Redis (INCR + EXPIRE) and checks the result." },
  { id: "synced", label: "Local + sync", one: "Servers count locally and push their counts to Redis every few seconds, reading back the total." },
];
export const SYNCS = [1, 5, 10];
export type FailMode = "open" | "closed";

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type Req = { t: number; client: "scraper" | "app"; server: number };
export const REQUESTS: Req[] = (() => {
  const r = mulberry32(7);
  const out: Req[] = [];
  for (let s = 0; s < SECONDS; s++) {
    for (let k = 0; k < SCRAPER_RPS; k++) out.push({ t: s + k / SCRAPER_RPS, client: "scraper", server: Math.floor(r() * SERVERS) });
    out.push({ t: s + 0.05, client: "app", server: 2 });
  }
  return out.sort((a, b) => a.t - b.t);
})();

export type Outcome = { allowed: number; rejected: number; perSecond: { allowed: number; rejected: number }[] };
export type Result = { scraper: Outcome; app: Outcome; addedMs: number; storeCalls: number };

export function simulate(d: Design, opts: { sync: number; outage: boolean; fail: FailMode }): Result {
  const out = () => ({ allowed: 0, rejected: 0, perSecond: Array.from({ length: SECONDS }, () => ({ allowed: 0, rejected: 0 })) });
  const res: Result = { scraper: out(), app: out(), addedMs: d === "central" ? STORE_RTT_MS : 0, storeCalls: 0 };
  // counts are per client (API key)
  const local: Record<string, number[]> = { scraper: Array(SERVERS).fill(0), app: Array(SERVERS).fill(0) };
  const central: Record<string, number> = { scraper: 0, app: 0 };
  // synced: what each server last heard the global total was, and its own count since
  const heard: Record<string, number[]> = { scraper: Array(SERVERS).fill(0), app: Array(SERVERS).fill(0) };
  const since: Record<string, number[]> = { scraper: Array(SERVERS).fill(0), app: Array(SERVERS).fill(0) };
  let nextSync = opts.sync;
  const down = (t: number) => opts.outage && t >= OUTAGE[0] && t < OUTAGE[1];

  for (const q of REQUESTS) {
    if (d === "synced") {
      while (q.t >= nextSync) {
        if (!down(nextSync)) {
          for (const c of ["scraper", "app"]) {
            central[c] += since[c].reduce((a, b) => a + b, 0);
            since[c] = since[c].map(() => 0);
            heard[c] = heard[c].map(() => central[c]);
          }
          res.storeCalls += SERVERS;
        }
        nextSync += opts.sync;
      }
    }
    let ok: boolean;
    if (d === "local") ok = local[q.client][q.server] < LIMIT;
    else if (d === "split") ok = local[q.client][q.server] < LIMIT / SERVERS;
    else if (d === "central") {
      res.storeCalls++;
      if (down(q.t)) ok = opts.fail === "open";
      else ok = central[q.client] < LIMIT;
    } else ok = heard[q.client][q.server] + since[q.client][q.server] < LIMIT;

    if (ok) {
      local[q.client][q.server]++;
      if (d === "central" && !down(q.t)) central[q.client]++;
      if (d === "synced") since[q.client][q.server]++;
    }
    const o = res[q.client];
    const sec = o.perSecond[Math.floor(q.t)];
    if (ok) {
      o.allowed++;
      sec.allowed++;
    } else {
      o.rejected++;
      sec.rejected++;
    }
  }
  return res;
}

export const SENT = { scraper: REQUESTS.filter((r) => r.client === "scraper").length, app: REQUESTS.filter((r) => r.client === "app").length };
