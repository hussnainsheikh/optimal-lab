// Redis in front of Postgres, cache-aside. A seeded stream of product-page requests follows a
// Zipf distribution over 100,000 products (a few are very popular, most are rarely viewed),
// and the hit ratio of an LRU cache of any size is computed exactly from it, including how a
// cold cache warms up. TTL staleness and the stampede when a hot key expires are arithmetic.
// Request rates, value sizes and query times are illustrative.

export const PRODUCTS = 100_000;
export const REQUESTS = 200_000;
export const ZIPF_S = 1;
export const VALUE_B = 2_000; // one product page's JSON
export const KEY_OVERHEAD_B = 70; // Redis per-key bookkeeping, roughly
export const RPS = 5_000; // product-page requests a second
export const DB_MS = 8; // a cache miss: the query behind it
export const CACHE_MS = 0.5;
export const DB_CAPACITY_QPS = 1_500; // what the database can serve before queueing

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

let trace: Int32Array | null = null;
/** Product ids requested, in order. Product 0 is the most popular. */
export function requests(): Int32Array {
  if (trace) return trace;
  const cdf = new Float64Array(PRODUCTS);
  let sum = 0;
  for (let i = 0; i < PRODUCTS; i++) cdf[i] = sum += 1 / Math.pow(i + 1, ZIPF_S);
  const r = rng(5);
  const out = new Int32Array(REQUESTS);
  for (let k = 0; k < REQUESTS; k++) {
    const x = r() * sum;
    let lo = 0, hi = PRODUCTS - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (cdf[mid] < x) lo = mid + 1;
      else hi = mid;
    }
    out[k] = lo;
  }
  return (trace = out);
}

let dists: Int32Array | null = null;
/**
 * LRU stack distance of every request (Mattson's algorithm): how many other products were
 * requested since this one was last requested, or -1 the first time. An LRU cache of C keys
 * hits exactly when the distance is below C, so one pass answers every cache size. Counting
 * the distinct products in between uses a Fenwick tree over request positions.
 */
export function stackDistances(): Int32Array {
  if (dists) return dists;
  const reqs = requests();
  const n = reqs.length;
  const tree = new Int32Array(n + 1);
  const add = (i: number, v: number) => {
    for (i++; i <= n; i += i & -i) tree[i] += v;
  };
  const sum = (i: number) => {
    let r = 0;
    for (i++; i > 0; i -= i & -i) r += tree[i];
    return r;
  };
  const last = new Int32Array(PRODUCTS).fill(-1);
  const out = new Int32Array(n);
  for (let k = 0; k < n; k++) {
    const id = reqs[k];
    const prev = last[id];
    if (prev >= 0) {
      out[k] = sum(k - 1) - sum(prev); // products whose latest request falls between prev and now
      add(prev, -1);
    } else out[k] = -1;
    add(k, 1);
    last[id] = k;
  }
  return (dists = out);
}

/** An LRU cache of `capacity` keys over the request stream, starting empty. */
export function lru(capacity: number) {
  const d = stackDistances();
  let hits = 0;
  const windows: number[] = []; // hit ratio per 10,000 requests
  let wHits = 0;
  for (let k = 0; k < d.length; k++) {
    if (d[k] >= 0 && d[k] < capacity) {
      hits++;
      wHits++;
    }
    if ((k + 1) % 10_000 === 0) {
      windows.push(wHits / 10_000);
      wHits = 0;
    }
  }
  // Steady state: the last half of the stream, once the cache has filled.
  const warm = windows.slice(windows.length / 2);
  return { hitRatio: hits / d.length, warmHitRatio: warm.reduce((a, b) => a + b, 0) / warm.length, windows };
}

export const SIZES = [100, 500, 1_000, 2_500, 5_000, 10_000, 25_000, 50_000];

export function load(hitRatio: number) {
  const dbQps = RPS * (1 - hitRatio);
  const util = dbQps / DB_CAPACITY_QPS;
  // Average latency, with the database's queueing growing as it nears capacity (M/M/1).
  const dbMs = util < 1 ? DB_MS / (1 - util) : Infinity;
  const avgMs = hitRatio * CACHE_MS + (1 - hitRatio) * (CACHE_MS + dbMs);
  return { dbQps, util, avgMs, overloaded: util >= 1 };
}
export const memoryMB = (keys: number) => (keys * (VALUE_B + KEY_OVERHEAD_B)) / 1e6;

// ---- freshness and stampedes -----------------------------------------------------------------

/** How stale a price can be after it changes in the database. */
export function staleness(ttlS: number, deleteOnWrite: boolean) {
  if (deleteOnWrite) return { maxS: 0, note: "the write path deletes the key after updating the row, so the next read refills it" };
  return { maxS: ttlS, note: `nothing tells the cache, so readers see the old price until the TTL runs out: up to ${ttlS} s` };
}

export type Guard = "none" | "lock" | "early";
export const HOT_RPS = 2_000; // requests a second for the home page's product list
export const REBUILD_MS = 250; // the query that builds it

/** The hot key expires: how many requests run the expensive rebuild query at once? */
export function stampede(guard: Guard) {
  const arriving = Math.ceil((HOT_RPS * REBUILD_MS) / 1000); // requests that miss while the first rebuild runs
  if (guard === "none") return { dbQueries: arriving, waiting: 0, note: `all ${arriving} requests that arrive during the ${REBUILD_MS} ms rebuild miss and run the same query` };
  if (guard === "lock") return { dbQueries: 1, waiting: arriving - 1, note: `the first miss takes a lock (SET key:lock NX PX ${REBUILD_MS * 4}); the other ${arriving - 1} wait briefly or get the stale copy` };
  return { dbQueries: 1, waiting: 0, note: "one request refreshes the value a little before it expires, chosen at random, so it never expires under load" };
}
