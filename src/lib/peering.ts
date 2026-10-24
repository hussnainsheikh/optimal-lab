// How a video service reaches viewers inside an ISP. It can buy transit, peer at an internet
// exchange, run a private cross-connect (PNI) or put caches inside the ISP; each step adds a
// route, and BGP's decision process (local preference, AS path length, MED, IGP cost) picks one.
// A month of 5-minute traffic samples is generated (evening peaks, weekends, one big live event)
// and pushed through the chosen link with its capacity. Transit is billed the way it really is:
// sort the month's samples, drop the top 5 % and pay for the next one (the 95th percentile).
// Prices, latencies and the traffic shape are illustrative.

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

export const PER_DAY = 288; // 5-minute samples
export const DAYS = 30;
export const SPIKE_DAY = 12; // a live final, 19:00 to 23:00
export const TRANSIT_PER_MBPS = 0.35; // $ per Mbps per month at the 95th percentile
export const PORT_GBPS = 100;
export const CACHE_HIT = 0.92;

export type Option = "transit" | "ixp" | "pni" | "embedded";
export type Via = "transit" | "ixp" | "pni";
export const OPTIONS: Option[] = ["transit", "ixp", "pni", "embedded"];
export const LABEL: Record<Option, string> = { transit: "Transit only", ixp: "+ peer at an exchange", pni: "+ private cross-connect", embedded: "+ caches inside the ISP" };
export const LATENCY: Record<Via | "cache", number> = { transit: 34, ixp: 11, pni: 9, cache: 3 }; // ms round trip to viewers

export type Route = { via: Via; neighbor: string; localPref: number; asPath: string[]; med: number; igp: number };
export const ROUTES: Record<Via, Route> = {
  transit: { via: "transit", neighbor: "Tier 1 (AS64500)", localPref: 100, asPath: ["64500", "64510"], med: 0, igp: 40 },
  ixp: { via: "ixp", neighbor: "HomeNet at the exchange", localPref: 200, asPath: ["64510"], med: 0, igp: 14 },
  pni: { via: "pni", neighbor: "HomeNet cross-connect", localPref: 200, asPath: ["64510"], med: 0, igp: 6 },
};

export function candidates(o: Option): Route[] {
  const r: Route[] = [ROUTES.transit];
  if (o !== "transit") r.push(ROUTES.ixp);
  if (o === "pni" || o === "embedded") r.push(ROUTES.pni);
  return r;
}

export type Decision = { winner: Route; rule: string; rounds: { rule: string; left: Via[] }[] };

// BGP best path, in order: highest local preference, shortest AS path, lowest MED (only between
// routes from the same neighbouring AS), lowest IGP cost to the exit.
export function decide(cands: Route[]): Decision {
  const rounds: Decision["rounds"] = [];
  let left = cands;
  let rule = "only route";
  const keep = (name: string, best: (r: Route) => number) => {
    if (left.length === 1) return;
    const b = Math.min(...left.map(best));
    left = left.filter((r) => best(r) === b);
    rounds.push({ rule: name, left: left.map((r) => r.via) });
    if (left.length === 1) rule = name;
  };
  keep("highest local preference", (r) => -r.localPref);
  keep("shortest AS path", (r) => r.asPath.length);
  keep("lowest MED", (r) => r.med);
  keep("lowest IGP cost to the exit", (r) => r.igp);
  return { winner: left[0], rule, rounds };
}

const demandCache = new Map<string, Float64Array>();

// Gbps per 5-minute sample. The month without the event peaks at `peak`.
export function demand(peak: number, event: boolean): Float64Array {
  const key = `${peak}-${event}`;
  const hit = demandCache.get(key);
  if (hit) return hit;
  const r = rng(7);
  const out = new Float64Array(PER_DAY * DAYS);
  for (let i = 0; i < out.length; i++) {
    const day = Math.floor(i / PER_DAY);
    const h = (i % PER_DAY) / 12;
    const wave = (1 + Math.cos((2 * Math.PI * (h - 21)) / 24)) / 2;
    const weekend = day % 7 >= 5 ? 1.08 : 1;
    const noise = 1 + (r() + r() + r() - 1.5) * 0.06;
    out[i] = (0.28 + 0.72 * wave ** 2) * weekend * noise;
  }
  let max = 0;
  for (const x of out) max = Math.max(max, x);
  for (let i = 0; i < out.length; i++) out[i] *= peak / max;
  if (event) for (let i = SPIKE_DAY * PER_DAY + 19 * 12; i < SPIKE_DAY * PER_DAY + 23 * 12; i++) out[i] *= 1.55;
  demandCache.set(key, out);
  return out;
}

export function p95(samples: ArrayLike<number>): number {
  const s = Float64Array.from(samples).sort();
  const drop = Math.floor(s.length * 0.05); // the top 5 % are free
  return s[s.length - 1 - drop] ?? 0;
}

export type Opts = { option: Option; peak: number; event: boolean; stuck: boolean; spill: boolean };

export type Month = {
  route: Decision;
  capacity: number; // Gbps of the peering link, 0 for transit only
  transit: Float64Array; // Gbps on transit per sample
  peered: Float64Array; // Gbps on the exchange or cross-connect
  dropped: Float64Array; // Gbps that didn't fit and wasn't spilled
  p95Transit: number;
  bill: { transit: number; ports: number; caches: number; total: number };
  latency: number; // byte-weighted ms
  congestedHours: number;
  lostShare: number;
  pb: number; // petabytes delivered in the month
};

const monthCache = new Map<string, Month>();

export function month(o: Opts): Month {
  const key = `${o.option}-${o.peak}-${o.event}-${o.stuck}-${o.spill}`;
  const hit = monthCache.get(key);
  if (hit) return hit;
  const m = compute(o);
  if (monthCache.size > 200) monthCache.clear();
  monthCache.set(key, m);
  return m;
}

function compute(o: Opts): Month {
  const d = demand(o.peak, o.event);
  const route = decide(candidates(o.option));
  const via = route.winner.via;
  const share = o.option === "embedded" ? 1 - CACHE_HIT : 1;
  const sized = Math.max(PORT_GBPS, Math.ceil((o.peak * share * 1.25) / PORT_GBPS) * PORT_GBPS);
  const capacity = via === "transit" ? 0 : o.stuck ? PORT_GBPS : sized;
  const n = d.length;
  const transit = new Float64Array(n);
  const peered = new Float64Array(n);
  const dropped = new Float64Array(n);
  let bytes = 0, lost = 0, congested = 0, msWeighted = 0;
  for (let i = 0; i < n; i++) {
    const total = d[i];
    const out = total * share;
    const inside = total - out;
    bytes += total;
    msWeighted += inside * LATENCY.cache;
    if (via === "transit") {
      transit[i] = out;
      msWeighted += out * LATENCY.transit;
      continue;
    }
    const fits = Math.min(out, capacity);
    const over = out - fits;
    peered[i] = fits;
    msWeighted += fits * LATENCY[via];
    if (over > 0) {
      congested++;
      if (o.spill) {
        transit[i] = over;
        msWeighted += over * LATENCY.transit;
      } else {
        dropped[i] = over;
        lost += over;
      }
    }
  }
  const p95Transit = p95(transit);
  const ports = via === "transit" ? 0 : (capacity / PORT_GBPS) * (via === "ixp" ? 2_400 : 1_900);
  const caches = o.option === "embedded" ? Math.ceil((o.peak * CACHE_HIT) / 80) * 2_600 : 0;
  const transitBill = p95Transit * 1000 * TRANSIT_PER_MBPS;
  return {
    route,
    capacity,
    transit,
    peered,
    dropped,
    p95Transit,
    bill: { transit: transitBill, ports, caches, total: transitBill + ports + caches },
    latency: msWeighted / Math.max(bytes - lost, 1e-9),
    congestedHours: (congested * 5) / 60,
    lostShare: lost / bytes,
    pb: (bytes * 300) / 8 / 1e6, // Gbps × seconds → GB → PB
  };
}

export function day(m: ArrayLike<number>, dayIndex: number): number[] {
  return Array.from({ length: PER_DAY }, (_, i) => m[dayIndex * PER_DAY + i]);
}

// The month's transit samples sorted high to low, thinned for a chart.
export function sortedCurve(samples: ArrayLike<number>, points = 120): number[] {
  const s = Float64Array.from(samples).sort().reverse();
  return Array.from({ length: points }, (_, i) => s[Math.floor((i / (points - 1)) * (s.length - 1))]);
}
