// Why a DNS change takes time to reach everyone. 3,000 recursive resolvers each serve clients at
// their own rate (a few huge public resolvers, many small ones). A resolver caches an answer for
// its TTL and fetches again only when a client asks after it expires, so each one is a renewal
// process: fetch, hold for TTL, wait for the next query. The record changes at t = 0; a resolver
// keeps handing out the old answer until the entry it fetched before the change expires.
// Lowering the TTL beforehand only helps for entries fetched after you lowered it. The same
// machinery covers negative caching: a name looked up before it existed stays "does not exist"
// for the negative TTL from the SOA record (RFC 2308). Query rates are generated, not measured.

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

export const RESOLVERS = 3000;
export const CLAMP_SHARE = 0.05; // resolvers configured with a minimum cache time
export const CLAMP_MIN = 3600;
export const TTLS = [60, 300, 3600, 86400];
export const ROUTE53_PER_MILLION = 0.4; // $ per million standard queries

export type Scenario = "change" | "create";
export type Opts = {
  scenario: Scenario;
  ttl: number; // the record's normal TTL, seconds
  lowerTo: number; // 0 = not lowered; otherwise the TTL used from `lead` seconds before the change
  lead: number; // seconds before the change that the TTL was lowered
  negTtl: number; // SOA minimum for "create"
  clamp: boolean; // some resolvers hold every answer at least an hour
};

type Resolver = { rate: number; clamp: boolean };
let pop: Resolver[] | null = null;
function resolvers(): Resolver[] {
  if (pop) return pop;
  const r = rng(53);
  pop = Array.from({ length: RESOLVERS }, () => {
    const g = Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r());
    return { rate: 0.05 * Math.exp(2 * g), clamp: r() < CLAMP_SHARE }; // queries per second
  });
  return pop;
}

const eff = (ttl: number, x: Resolver, o: Opts) => (o.clamp && x.clamp ? Math.max(ttl, CLAMP_MIN) : ttl);

// The TTL attached to an answer fetched at time f (seconds, change at 0).
function ttlAt(f: number, o: Opts): number {
  if (o.scenario === "create") return o.negTtl;
  if (o.lowerTo && f >= -o.lead) return o.lowerTo;
  return o.ttl;
}

export type Result = {
  staleUntil: Float64Array; // per resolver, when its pre-change answer expires (≤ 0: never stale)
  rates: Float64Array;
  total: number;
  share: (t: number) => number; // share of client lookups getting the old answer at t seconds
  t50: number;
  t99: number;
  last: number; // when the last resolver lets go
  authQps: number; // queries per second reaching your nameservers after the change
};

const cache = new Map<string, Result>();

export function simulate(o: Opts): Result {
  const key = JSON.stringify(o);
  const hit = cache.get(key);
  if (hit) return hit;
  const r = rng(99);
  const pop = resolvers();
  const n = pop.length;
  const staleUntil = new Float64Array(n);
  const rates = new Float64Array(n);
  const before = o.scenario === "create" ? 0.3 : 1; // fewer people look up a name before it exists
  const exp = (rate: number) => -Math.log(1 - r()) / rate;
  const start = -(o.lowerTo ? o.lead : 0) - 1;
  for (let i = 0; i < n; i++) {
    const x = pop[i];
    const rate = x.rate * before;
    rates[i] = x.rate;
    // steady state at `start` under the TTL in force then
    const t0 = eff(ttlAt(start - 1, o), x, o);
    let f: number; // time of the latest fetch
    if (r() < t0 / (t0 + 1 / rate)) f = start - r() * t0;
    else f = start + exp(rate); // expired: the next client query fetches it again
    let last = f < 0 ? f : -Infinity;
    while (f < 0) {
      const ttl = eff(ttlAt(f, o), x, o);
      if (f >= -o.lead && -f > 20 * (ttl + 1 / rate)) {
        // the TTL no longer changes and many cycles remain: jump to the steady state at 0
        last = r() < ttl / (ttl + 1 / rate) ? -r() * ttl : -Infinity;
        break;
      }
      last = f;
      f += ttl + exp(rate);
    }
    staleUntil[i] = last === -Infinity ? 0 : last + eff(ttlAt(last, o), x, o);
  }
  let total = 0;
  for (const x of rates) total += x;
  const order = Array.from({ length: n }, (_, i) => i).sort((a, b) => staleUntil[b] - staleUntil[a]);
  const share = (t: number) => {
    let s = 0;
    for (const i of order) {
      if (staleUntil[i] <= t) break;
      s += rates[i];
    }
    return s / total;
  };
  const when = (target: number) => {
    let s = 0;
    for (const i of order) {
      s += rates[i];
      if (s / total > target) return Math.max(0, staleUntil[i]);
    }
    return 0;
  };
  const after = o.scenario === "create" ? o.ttl : o.lowerTo || o.ttl;
  let authQps = 0;
  for (const x of pop) authQps += 1 / (eff(after, x, o) + 1 / x.rate);
  const res: Result = { staleUntil, rates, total, share, t50: when(0.5), t99: when(0.01), last: Math.max(0, staleUntil[order[0]]), authQps };
  if (cache.size > 100) cache.clear();
  cache.set(key, res);
  return res;
}

// Steady-state load on your nameservers for each TTL, and what it costs at Route 53 prices.
export function loadByTtl(clamp: boolean) {
  const pop = resolvers();
  return TTLS.map((ttl) => {
    let qps = 0;
    for (const x of pop) qps += 1 / ((clamp && x.clamp ? Math.max(ttl, CLAMP_MIN) : ttl) + 1 / x.rate);
    const total = pop.reduce((s, x) => s + x.rate, 0);
    return { ttl, qps, hitRate: 1 - qps / total, monthly: ((qps * 86400 * 30) / 1e6) * ROUTE53_PER_MILLION };
  });
}

export function clientRate(): number {
  return resolvers().reduce((s, x) => s + x.rate, 0);
}

export const fmtDuration = (s: number) =>
  s <= 0 ? "0 s" : s < 120 ? `${Math.round(s)} s` : s < 7200 ? `${Math.round(s / 60)} min` : s < 172800 ? `${(s / 3600).toFixed(s < 36000 ? 1 : 0)} h` : `${(s / 86400).toFixed(1)} days`;

// "Your ISP's resolver" on the map: a busy one, so it always has the name cached.
export function busiest(): number {
  const pop = resolvers();
  let best = 0;
  for (let i = 1; i < pop.length; i++) if (pop[i].rate > pop[best].rate && !pop[i].clamp) best = i;
  return best;
}
