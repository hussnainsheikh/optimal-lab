// Finding slow queries in an hour of traffic. 60,000 query executions are generated from nine
// shapes with literal values filled in, normalized the way pg_stat_statements does (constants
// become $1, $2 …), and aggregated into calls, total, mean and max time. A slow-query log
// threshold shows which executions get logged; fixes change a shape's timing and the totals are
// recomputed. Durations are drawn from seeded log-normal distributions around illustrative means.

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

export type Fix = "ordersIndex" | "lowerEmailIndex" | "trigramIndex" | "reportReplica";
type Shape = { id: string; share: number; ms: number; sigma?: number; fixedMs?: number; fix?: Fix; make: (r: () => number) => string };
const int = (r: () => number, n: number) => 1 + Math.floor(r() * n);
const word = (r: () => number) => ["lamp", "desk", "mug", "cable", "chair", "pen", "bag"][Math.floor(r() * 7)];
export const SHAPES: Shape[] = [
  { id: "session", share: 0.4, ms: 0.35, make: (r) => `SELECT * FROM sessions WHERE token = '${Math.floor(r() * 1e12).toString(36)}'` },
  { id: "product", share: 0.25, ms: 0.3, make: (r) => `SELECT * FROM products WHERE id = ${int(r, 50_000)}` },
  { id: "openOrders", share: 0.1, ms: 14, fixedMs: 0.4, fix: "ordersIndex", make: (r) => `SELECT count(*) FROM orders WHERE customer_id = ${int(r, 200_000)} AND status = 'open'` },
  { id: "cart", share: 0.08, ms: 0.9, make: (r) => `UPDATE carts SET updated_at = now(), total = ${int(r, 900)}.${int(r, 99)} WHERE id = ${int(r, 90_000)}` },
  { id: "events", share: 0.08, ms: 0.5, make: (r) => `INSERT INTO events (user_id, kind) VALUES (${int(r, 200_000)}, 'view')` },
  { id: "orderPage", share: 0.06, ms: 2.1, make: (r) => `SELECT o.*, i.* FROM orders o JOIN order_items i ON i.order_id = o.id WHERE o.id = ${int(r, 2_000_000)}` },
  { id: "search", share: 0.015, ms: 48, fixedMs: 3, fix: "trigramIndex", make: (r) => `SELECT id, name FROM products WHERE name ILIKE '%${word(r)}%' LIMIT 20` },
  { id: "login", share: 0.0149, ms: 31, fixedMs: 0.4, fix: "lowerEmailIndex", make: (r) => `SELECT * FROM users WHERE lower(email) = 'user${int(r, 200_000)}@example.com'` },
  { id: "report", share: 0.0001, ms: 4_200, sigma: 0.15, fixedMs: 4_200, fix: "reportReplica", make: (r) => `SELECT date_trunc('day', created_at), sum(total) FROM orders WHERE created_at > now() - interval '${int(r, 3) * 30} days' GROUP BY 1` },
];
export const FIXES: Record<Fix, { label: string; sql: string; shape: string }> = {
  ordersIndex: { label: "Index orders (customer_id, status)", sql: "CREATE INDEX CONCURRENTLY ON orders (customer_id, status);", shape: "openOrders" },
  lowerEmailIndex: { label: "Index lower(email)", sql: "CREATE INDEX CONCURRENTLY ON users (lower(email));", shape: "login" },
  trigramIndex: { label: "Trigram index for ILIKE", sql: "CREATE INDEX CONCURRENTLY ON products USING gin (name gin_trgm_ops);", shape: "search" },
  reportReplica: { label: "Send the report to a replica", sql: "-- route the nightly report to a read replica", shape: "report" },
};

export const CALLS = 60_000;

/** Replace literals with $1, $2 … the way pg_stat_statements groups queries. */
export function normalize(sql: string) {
  let n = 0;
  return sql.replace(/'(?:[^']|'')*'|\b\d+(?:\.\d+)?\b/g, () => `$${++n}`);
}

export type Exec = { sql: string; shape: string; ms: number };
let cache: Exec[] | null = null;
export function executions(): Exec[] {
  if (cache) return cache;
  const r = rng(2024);
  const out: Exec[] = [];
  const cum: number[] = [];
  let s = 0;
  for (const sh of SHAPES) cum.push((s += sh.share));
  for (let k = 0; k < CALLS; k++) {
    const x = r() * s;
    const sh = SHAPES[cum.findIndex((c) => x < c)];
    const gauss = Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r());
    const sigma = sh.sigma ?? 0.6;
    out.push({ sql: sh.make(r), shape: sh.id, ms: sh.ms * Math.exp(sigma * gauss - (sigma * sigma) / 2) }); // mean stays at sh.ms
  }
  return (cache = out);
}

export type Stat = { query: string; shape: string; calls: number; total: number; mean: number; max: number; fixed: boolean };
/** pg_stat_statements: group by normalized text. Fixed shapes run at their new speed (scaled per call). */
export function stats(fixes: Set<Fix>): Stat[] {
  const by = new Map<string, Stat>();
  for (const e of executions()) {
    const sh = SHAPES.find((x) => x.id === e.shape)!;
    const fixed = sh.fix !== undefined && fixes.has(sh.fix) && sh.fix !== "reportReplica";
    const ms = fixed ? (e.ms * sh.fixedMs!) / sh.ms : e.ms;
    if (sh.fix === "reportReplica" && fixes.has("reportReplica")) continue; // no longer on the primary
    const q = normalize(e.sql);
    const st = by.get(q) ?? { query: q, shape: e.shape, calls: 0, total: 0, mean: 0, max: 0, fixed };
    st.calls++;
    st.total += ms;
    st.max = Math.max(st.max, ms);
    by.set(q, st);
  }
  for (const st of by.values()) st.mean = st.total / st.calls;
  return [...by.values()];
}

export type Sort = "total" | "mean" | "calls";
export const sorted = (xs: Stat[], by: Sort) => [...xs].sort((a, b) => b[by] - a[by]);

/** With log_min_duration_statement = threshold, which executions are logged, and what share of database time they are. */
export function slowLog(thresholdMs: number) {
  const all = executions();
  const logged = all.filter((e) => e.ms >= thresholdMs);
  const total = all.reduce((a, e) => a + e.ms, 0);
  const byShape = new Map<string, number>();
  for (const e of logged) byShape.set(e.shape, (byShape.get(e.shape) ?? 0) + 1);
  return { lines: logged.length, share: logged.reduce((a, e) => a + e.ms, 0) / total, byShape, sample: logged.slice(0, 3) };
}

export const PLANS: Record<string, { before: string; after: string }> = {
  openOrders: {
    before: "Aggregate  (actual time=13.9 ms)\n  ->  Seq Scan on orders  (rows=2 loops=1)\n        Filter: customer_id = $1 AND status = 'open'\n        Rows Removed by Filter: 1,999,998",
    after: "Aggregate  (actual time=0.04 ms)\n  ->  Index Only Scan using orders_customer_id_status_idx on orders  (rows=2)\n        Index Cond: (customer_id = $1 AND status = 'open')",
  },
  login: {
    before: "Seq Scan on users  (actual time=30.8 ms rows=1)\n  Filter: lower(email) = $1\n  Rows Removed by Filter: 199,999\n  -- the index on email can't be used for lower(email)",
    after: "Index Scan using users_lower_idx on users  (actual time=0.03 ms rows=1)\n  Index Cond: (lower(email) = $1)",
  },
  search: {
    before: "Limit  ->  Seq Scan on products  (actual time=47.6 ms rows=20)\n  Filter: name ~~* '%lamp%'\n  -- a leading % rules out a B-tree index",
    after: "Limit  ->  Bitmap Heap Scan on products  (actual time=2.9 ms rows=20)\n  ->  Bitmap Index Scan on products_name_trgm_idx\n        Index Cond: name ~~* '%lamp%'",
  },
  report: {
    before: "HashAggregate  (actual time=4,180 ms rows=90)\n  ->  Seq Scan on orders  (rows=1,950,000)\n  -- legitimately big: it reads a quarter of the table",
    after: "(runs on a read replica; the primary no longer pays for it)",
  },
};
