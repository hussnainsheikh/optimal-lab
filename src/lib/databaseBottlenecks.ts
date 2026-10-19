// Database bottlenecks: one database behind a few app servers, and the four usual
// ways it falls over. Little's law does the work: connections busy = queries/s × query
// time. When that exceeds what the database can run at once, queries queue and latency
// climbs; when it exceeds max_connections, new connections are refused outright.

export const CORES = 8; // the database can run this many queries at once
export const MAX_CONNECTIONS = 100;
export const SERVERS = 6; // app servers, each with its own pool
export const POOL = 20; // connections per app server
export const READ_SHARE = 0.9; // share of queries that are reads

export const ITEMS_PER_PAGE = 10; // the N in N+1

export type Fixes = { join: boolean; index: boolean; replicas: number; pooler: boolean };
export const NONE: Fixes = { join: false, index: false, replicas: 0, pooler: false };

export const TRAFFIC = [20, 50, 100, 200]; // page loads per second
export const REPLICA_CHOICES = [0, 2, 4];

// Query times in ms. Without an index the items query scans the table.
export const FAST_MS = 3;
export const SLOW_MS = 60;

export type Result = {
  queriesPerPage: number;
  queriesPerSec: number;
  avgQueryMs: number;
  busy: number; // connections busy on the primary (Little's law)
  wanted: number; // connections the app servers open
  utilization: number; // of the primary's cores
  queued: boolean;
  overloaded: boolean; // demand beyond the cores: queues grow without bound
  refused: number; // connections refused per second, if the pool exceeds max_connections
  latencyMs: number; // one page load
  primaryQps: number;
  replicaQps: number;
};

export function run(pages: number, f: Fixes): Result {
  // N+1: one query for the page and one per item, or one join.
  const queriesPerPage = f.join ? 2 : 1 + ITEMS_PER_PAGE;
  // The items query is the slow one without an index; the page query is always fast.
  const itemsMs = f.index ? FAST_MS : SLOW_MS;
  const perPageMs = f.join ? FAST_MS + itemsMs : FAST_MS + ITEMS_PER_PAGE * itemsMs;
  const avgQueryMs = perPageMs / queriesPerPage;
  const queriesPerSec = pages * queriesPerPage;
  // Reads can go to replicas; writes and the rest stay on the primary.
  const replicaQps = f.replicas > 0 ? queriesPerSec * READ_SHARE : 0;
  const primaryQps = queriesPerSec - replicaQps;
  const busy = (primaryQps * avgQueryMs) / 1000;
  const utilization = busy / CORES;
  const queued = utilization >= 0.7;
  const overloaded = utilization >= 1;
  // Queueing: below the cores, an M/M/c-style rise as utilization nears 1; past them,
  // queues grow without bound, so the latency is capped and shown as overloaded.
  const wait = overloaded ? 10000 : (avgQueryMs * utilization ** 2) / (1 - utilization) / 2;
  const latencyMs = Math.min(10000, perPageMs + wait * queriesPerPage);
  // Pools open their connections up front, so every server wants its full pool.
  const wanted = SERVERS * POOL;
  const limit = f.pooler ? SERVERS * POOL : MAX_CONNECTIONS;
  const refused = wanted > limit ? Math.round(((wanted - limit) / wanted) * pages) : 0;
  return { queriesPerPage, queriesPerSec, avgQueryMs, busy, wanted, utilization, queued, overloaded, refused, latencyMs, primaryQps, replicaQps };
}

export type Bottleneck = { id: keyof Fixes; label: string; symptom: string; fix: string };

export const BOTTLENECKS: Bottleneck[] = [
  { id: "join", label: "N+1 queries", symptom: "One page load fires 11 queries: one for the page, then one per item.", fix: "Fetch the items in one query with a JOIN or an IN list." },
  { id: "index", label: "A slow query", symptom: "The items query scans the whole table: 60 ms each, every time.", fix: "An index on the column the query filters by: 3 ms." },
  { id: "pooler", label: "Too many connections", symptom: "Six servers × 20 pooled connections want 120; the database allows 100.", fix: "A connection pooler (PgBouncer) in front of the database shares a small set of real connections." },
  { id: "replicas", label: "One machine for every read", symptom: "Nine in ten queries are reads, and they all hit the primary's 8 cores.", fix: "Read replicas take the reads; the primary keeps the writes." },
];

export const ms = (x: number) => (x >= 1000 ? `${(x / 1000).toFixed(1)} s` : `${Math.round(x)} ms`);
export const pct = (x: number) => `${Math.round(x * 100)}%`;
