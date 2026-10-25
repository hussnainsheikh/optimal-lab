// Why an edge network makes things faster, beyond caching. A request is timed phase by phase:
// TCP and TLS handshakes cost round trips to whoever terminates them, so ending them at a nearby
// edge saves most of the wait even on a cache miss. A new TCP connection starts in slow start
// (10 packets, doubling each round trip), so a long path pays several round trips to send a few
// hundred kilobytes; an edge that keeps warm connections to the origin skips both the handshakes
// and slow start on the long leg. The second part runs an hour of requests through 30 edge
// locations with TTL caching, with and without an origin shield (one regional tier the edges
// ask before the origin), and counts what reaches the origin. Round trips, sizes and request
// mix are illustrative.

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

export type City = "sydney" | "saopaulo" | "frankfurt" | "ashburn";
export const CITY: Record<City, { name: string; toOrigin: number; toEdge: number }> = {
  sydney: { name: "Sydney", toOrigin: 200, toEdge: 6 },
  saopaulo: { name: "São Paulo", toOrigin: 120, toEdge: 8 },
  frankfurt: { name: "Frankfurt", toOrigin: 90, toEdge: 5 },
  ashburn: { name: "Ashburn", toOrigin: 4, toEdge: 3 },
};
export type Obj = "image" | "api" | "deploy";
export const OBJ: Record<Obj, { name: string; kb: number; cacheable: boolean; server: number; hit: boolean }> = {
  image: { name: "hero.jpg, 500 KB", kb: 500, cacheable: true, server: 2, hit: true },
  api: { name: "/api/cart, 8 KB", kb: 8, cacheable: false, server: 30, hit: false },
  deploy: { name: "index.html after a deploy, 40 KB", kb: 40, cacheable: true, server: 15, hit: false },
};

const MSS = 1460;
const INIT_CWND = 10;
const ACCESS_MBPS = 50; // the user's last mile
const BACKBONE_MBPS = 1000; // edge to origin

// Round trips to send `bytes` from a window of `cwnd` packets that doubles each round trip,
// capped by the path's bandwidth-delay product.
export function rounds(bytes: number, rtt: number, mbps: number, cwnd = INIT_CWND): number {
  const bdp = Math.max(MSS, (mbps * 1e6 * (rtt / 1000)) / 8);
  let sent = 0;
  let w = cwnd * MSS;
  let n = 0;
  while (sent < bytes) {
    sent += Math.min(w, bdp);
    w *= 2;
    n++;
  }
  return n;
}

export type Phase = { label: string; ms: number; leg: "user" | "long" | "server" };

export function direct(city: City, obj: Obj): Phase[] {
  const c = CITY[city];
  const o = OBJ[obj];
  const r = rounds(o.kb * 1000, c.toOrigin, ACCESS_MBPS);
  return [
    { label: "TCP handshake to the origin", ms: c.toOrigin, leg: "long" },
    { label: "TLS handshake to the origin", ms: c.toOrigin, leg: "long" },
    { label: "request, server work, first byte", ms: c.toOrigin + o.server, leg: "long" },
    { label: `slow start: ${r - 1} more round trip${r - 1 === 1 ? "" : "s"}`, ms: (r - 1) * c.toOrigin, leg: "long" },
  ];
}

export function viaEdge(city: City, obj: Obj, warm: boolean): Phase[] {
  const c = CITY[city];
  const o = OBJ[obj];
  const bytes = o.kb * 1000;
  const lastMile = rounds(bytes, c.toEdge, ACCESS_MBPS);
  const phases: Phase[] = [
    { label: "TCP handshake to the edge", ms: c.toEdge, leg: "user" },
    { label: "TLS handshake to the edge", ms: c.toEdge, leg: "user" },
  ];
  if (o.hit) {
    phases.push({ label: "request, cache hit", ms: c.toEdge + 1, leg: "user" });
    phases.push({ label: `send from the edge: ${lastMile - 1} more round trip${lastMile - 1 === 1 ? "" : "s"}`, ms: (lastMile - 1) * c.toEdge, leg: "user" });
    return phases;
  }
  phases.push({ label: o.cacheable ? "request, cache miss" : "request, not cacheable", ms: c.toEdge, leg: "user" });
  if (!warm) {
    phases.push({ label: "edge opens TCP to the origin", ms: c.toOrigin, leg: "long" });
    phases.push({ label: "edge's TLS handshake to the origin", ms: c.toOrigin, leg: "long" });
  }
  phases.push({ label: "origin request and server work", ms: c.toOrigin + o.server, leg: "server" });
  // a warm connection already has a large window; a new one starts in slow start
  const long = warm ? rounds(bytes, c.toOrigin, BACKBONE_MBPS, 4096) : rounds(bytes, c.toOrigin, BACKBONE_MBPS);
  const longMs = (long - 1) * c.toOrigin;
  const shortMs = (lastMile - 1) * c.toEdge;
  phases.push({ label: long > 1 ? `origin to edge: ${long - 1} more round trip${long - 1 === 1 ? "" : "s"}` : "edge streams it on to you", ms: Math.max(longMs, shortMs), leg: long > 1 ? "long" : "user" });
  return phases;
}

export const total = (p: Phase[]) => p.reduce((s, x) => s + x.ms, 0);

// ── An hour across 30 edges ──────────────────────────────────────────────────

export const POPS = 30;
export const OBJECTS = 4000;
export const REQUESTS = 300_000;
export const AVG_KB = 180;

type Req = { t: number; pop: number; obj: number };
let reqs: Req[] | null = null;
function requests(): Req[] {
  if (reqs) return reqs;
  const r = rng(77);
  // Zipf popularity with s = 0.9, sampled by inverting the cumulative weights
  const cum: number[] = [];
  let sum = 0;
  for (let i = 1; i <= OBJECTS; i++) cum.push((sum += 1 / i ** 0.9));
  const popW: number[] = [];
  let ps = 0;
  for (let i = 1; i <= POPS; i++) popW.push((ps += 1 / i ** 0.7)); // a few big locations, many small ones
  const pick = (c: number[], total: number) => {
    const x = r() * total;
    let lo = 0, hi = c.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (c[mid] < x) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  };
  reqs = Array.from({ length: REQUESTS }, (_, i) => ({ t: (i / REQUESTS) * 3600, pop: pick(popW, ps), obj: pick(cum, sum) }));
  return reqs;
}

export type Load = { edgeHits: number; shieldHits: number; origin: number; originGb: number };
const loadCache = new Map<string, Load>();

export function hour(ttl: number, shield: boolean): Load {
  const key = `${ttl}-${shield}`;
  const hit = loadCache.get(key);
  if (hit) return hit;
  const edge = new Float64Array(POPS * OBJECTS).fill(-Infinity); // when each copy expires
  const tier = new Float64Array(OBJECTS).fill(-Infinity);
  let edgeHits = 0, shieldHits = 0, origin = 0;
  for (const q of requests()) {
    const k = q.pop * OBJECTS + q.obj;
    if (edge[k] > q.t) {
      edgeHits++;
      continue;
    }
    if (shield) {
      if (tier[q.obj] > q.t) {
        shieldHits++;
        edge[k] = tier[q.obj]; // the copy keeps the shield's remaining TTL
        continue;
      }
      tier[q.obj] = q.t + ttl;
    }
    origin++;
    edge[k] = q.t + ttl;
  }
  const res = { edgeHits, shieldHits, origin, originGb: (origin * AVG_KB) / 1e6 };
  loadCache.set(key, res);
  return res;
}
