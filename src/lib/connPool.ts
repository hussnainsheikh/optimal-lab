// Connection limits from the app to Postgres, at peak, for one setup.
//
// Three limits stack up, and each one fails differently:
//   1. the pooler's client limit (max_client_conn / "pooler max clients"): extra app
//      connections are refused at the pooler.
//   2. the pool size (default_pool_size / Supavisor pool size / MaxConnectionsPercent):
//      extra work waits in the pooler's queue. No error, just latency, until a timeout.
//   3. Postgres max_connections (minus reserved slots and anything else connected):
//      extra connections are refused by the database itself.
//
// The model is a steady peak, not a time simulation: every app instance holds its pool
// open, and each has `busy` transactions in flight at any moment.
// Platform figures come from each vendor's docs (see PLATFORM notes); the workload
// numbers are the reader's to change.

export type PlatformId = "direct" | "pgbouncer" | "supabase" | "neon" | "rds-proxy";
export type PoolMode = "session" | "transaction";

export type Platform = {
  id: PlatformId;
  label: string;
  pooler: string | null; // what sits between the app and Postgres
  reserved: number; // connection slots apps can't use
  reservedNote: string;
  modes: PoolMode[]; // modes the reader can pick (one entry: fixed); the first is the default
  clientCap: "editable" | "tier" | "fixed" | "none";
  poolSize: "editable" | "percent" | "derived";
  maxConn: "editable" | "tier";
  timeoutS: number; // how long a client waits for a server connection before an error
  timeoutName: string;
  clientError: string; // what the app sees when the pooler refuses a client
  note: string;
};

export const PLATFORMS: Platform[] = [
  {
    id: "direct",
    label: "No pooler",
    pooler: null,
    reserved: 3,
    reservedNote: "superuser_reserved_connections = 3 (Postgres default)",
    modes: ["session"],
    clientCap: "none",
    poolSize: "editable",
    maxConn: "editable",
    timeoutS: 0,
    timeoutName: "",
    clientError: "",
    note: "Each app connection is a Postgres backend process. The app's own pool is the only pool.",
  },
  {
    id: "pgbouncer",
    label: "PgBouncer (self-hosted)",
    pooler: "PgBouncer",
    reserved: 3,
    reservedNote: "superuser_reserved_connections = 3 (Postgres default)",
    modes: ["session", "transaction"],
    clientCap: "editable",
    poolSize: "editable",
    maxConn: "editable",
    timeoutS: 120,
    timeoutName: "query_wait_timeout (default 120 s)",
    clientError: "ERROR: no more connections allowed (max_client_conn)",
    note: "Defaults: max_client_conn = 100, default_pool_size = 20, pool_mode = session. The pool is per user + database pair.",
  },
  {
    id: "supabase",
    label: "Supabase (Supavisor)",
    pooler: "Supavisor",
    reserved: 3,
    reservedNote: "superuser_reserved_connections = 3, plus whatever Auth, Storage and PostgREST hold (set under “Other connections”)",
    modes: ["transaction", "session"],
    clientCap: "tier",
    poolSize: "editable",
    maxConn: "tier",
    timeoutS: 60,
    timeoutName: "pooler wait queue (about a minute in session mode)",
    clientError: "FATAL: Max client connections reached",
    note: "Max connections and pooler max clients come with the compute size. Pool size is set in Database Settings; Supabase suggests up to 40% of max connections if you lean on the REST API, up to 80% otherwise. Session mode is port 5432, transaction mode 6543.",
  },
  {
    id: "neon",
    label: "Neon (PgBouncer)",
    pooler: "PgBouncer",
    reserved: 7,
    reservedNote: "7 slots reserved for the Neon superuser",
    modes: ["transaction"],
    clientCap: "fixed",
    poolSize: "derived",
    maxConn: "tier",
    timeoutS: 120,
    timeoutName: "query_wait_timeout = 120 s",
    clientError: "ERROR: no more connections allowed (max_client_conn)",
    note: "Pooling settings are fixed: transaction mode, max_client_conn = 10,000, default_pool_size = 0.9 × max_connections. max_connections grows with compute size.",
  },
  {
    id: "rds-proxy",
    label: "AWS RDS Proxy",
    pooler: "RDS Proxy",
    reserved: 3,
    reservedNote: "superuser_reserved_connections = 3, plus a few the proxy keeps for monitoring and failover",
    modes: ["transaction"],
    clientCap: "none",
    poolSize: "percent",
    maxConn: "editable",
    timeoutS: 120,
    timeoutName: "ConnectionBorrowTimeout (default 120 s)",
    clientError: "",
    note: "The proxy opens at most MaxConnectionsPercent of max_connections. It multiplexes per transaction, except for sessions that get “pinned” (SET, temp tables, prepared statements…), which keep their connection.",
  },
];

export function platform(id: PlatformId): Platform {
  return PLATFORMS.find((p) => p.id === id) ?? PLATFORMS[0];
}

// Supabase compute sizes: [label, max connections, pooler max clients]
export const SUPABASE_TIERS: [string, number, number][] = [
  ["Micro", 60, 200],
  ["Small", 90, 400],
  ["Medium", 120, 600],
  ["Large", 160, 800],
  ["XL", 240, 1000],
  ["2XL", 380, 1500],
  ["4XL", 480, 3000],
  ["8XL", 490, 6000],
  ["12XL", 500, 9000],
  ["16XL", 500, 12000],
];

// Neon compute sizes: [label, max_connections]
export const NEON_TIERS: [string, number][] = [
  ["0.25 CU", 104],
  ["0.5 CU", 209],
  ["1 CU", 419],
  ["2 CU", 839],
  ["4 CU", 1678],
  ["8 CU", 3357],
];
export const NEON_MAX_CLIENTS = 10000;

// App-side pool defaults from each library's docs.
export type LibraryId = "node-postgres" | "prisma" | "hikari" | "sqlalchemy" | "custom";
export const LIBRARIES: { id: LibraryId; label: string; pool: number; note: string }[] = [
  { id: "node-postgres", label: "node-postgres", pool: 10, note: "new Pool(): max defaults to 10." },
  { id: "prisma", label: "Prisma", pool: 5, note: "connection_limit defaults to 2 × physical CPUs + 1: 5 on a 2-CPU instance." },
  { id: "hikari", label: "HikariCP", pool: 10, note: "maximumPoolSize defaults to 10." },
  { id: "sqlalchemy", label: "SQLAlchemy", pool: 15, note: "pool_size 5 + max_overflow 10: up to 15 under load." },
  { id: "custom", label: "Custom", pool: 10, note: "Set the pool size per instance yourself." },
];

export type Input = {
  platform: PlatformId;
  mode: PoolMode;
  maxConnections: number; // Postgres max_connections
  otherConnections: number; // admin tools, migrations, other services connecting directly
  maxClients: number; // pooler client cap (ignored when the platform has none)
  poolSize: number; // server connections per pool (pgbouncer/supabase), ignored for neon/rds
  maxConnPercent: number; // RDS Proxy only
  otherPools: number; // other user/database pairs, each with its own pool, all busy
  instances: number; // app servers, containers or function instances
  appPool: number; // connections each instance opens (its library pool size)
  busy: number; // transactions in flight per instance at peak
  queryMs: number; // time one transaction holds a connection
  pinnedPct: number; // RDS Proxy only: share of client connections pinned
};

export type Result = {
  usable: number; // max_connections minus reserved minus other direct connections
  serverLimit: number; // the most the app's pool may open to Postgres (pool size)
  clientsWanted: number; // instances × appPool
  clientsAccepted: number;
  clientsRefused: number; // refused by the pooler
  serverWanted: number; // server connections the app needs right now
  serverOpen: number; // server connections the app actually holds
  dbRefused: number; // connection attempts Postgres refused
  otherPoolConns: number; // held by other pools
  waiting: number; // transactions or clients queued for a server connection
  waitMs: number; // average queue wait per transaction (Infinity: until timeout)
  pinned: number; // RDS Proxy: client connections pinned to their own server connection
  inFlight: number; // transactions in flight across all instances
  served: number; // of those, running on a server connection now
  failedPct: number; // share of in-flight work that errors out
  binding: "none" | "app-pool" | "client-cap" | "pool-size" | "max-connections";
  errors: Problem[]; // most important first
};

export type Problem = { where: "app" | "pooler log"; text: string; exact: boolean };

const PG_FULL = "FATAL: remaining connection slots are reserved for roles with the SUPERUSER attribute";

export function poolLimit(i: Input): number {
  const p = platform(i.platform);
  if (p.poolSize === "derived") return Math.floor(0.9 * i.maxConnections);
  if (p.poolSize === "percent") return Math.floor((i.maxConnPercent / 100) * i.maxConnections);
  return i.poolSize;
}

export function clientCap(i: Input): number {
  const p = platform(i.platform);
  if (p.clientCap === "none") return Infinity;
  if (p.clientCap === "fixed") return NEON_MAX_CLIENTS;
  return i.maxClients;
}

export function model(i: Input): Result {
  const p = platform(i.platform);
  const mode: PoolMode = p.modes.includes(i.mode) ? i.mode : p.modes[0];
  const usable = Math.max(0, i.maxConnections - p.reserved - i.otherConnections);
  const perInstanceActive = Math.min(i.busy, i.appPool); // the app's own pool caps concurrency
  const appQueued = Math.max(0, i.busy - i.appPool) * i.instances; // wait inside the app's pool
  const clientsWanted = i.instances * i.appPool;
  const errors: Problem[] = [];
  const appWait = queueWait(i.busy, i.appPool, i.queryMs); // callers queued inside the app's own pool

  if (!p.pooler) {
    // Each app connection is a real backend. Instances that start later find no slots.
    const open = Math.min(clientsWanted, usable);
    const dbRefused = clientsWanted - open;
    // Fill instance by instance: full pools first, then a partial one, then none.
    const full = Math.floor(open / i.appPool);
    const partial = open - full * i.appPool;
    const served = full * perInstanceActive + Math.min(perInstanceActive, partial);
    const inFlight = i.instances * i.busy;
    const failed = i.instances * perInstanceActive - served;
    if (dbRefused > 0) errors.push({ where: "app", text: PG_FULL, exact: true });
    return {
      usable,
      serverLimit: clientsWanted,
      clientsWanted,
      clientsAccepted: open,
      clientsRefused: 0,
      serverWanted: clientsWanted,
      serverOpen: open,
      dbRefused,
      otherPoolConns: 0,
      waiting: appQueued,
      waitMs: appWait,
      pinned: 0,
      inFlight,
      served,
      failedPct: pct(failed, inFlight),
      binding: dbRefused > 0 ? "max-connections" : appQueued > 0 ? "app-pool" : "none",
      errors,
    };
  }

  const cap = clientCap(i);
  const clientsAccepted = Math.min(clientsWanted, cap);
  const clientsRefused = clientsWanted - clientsAccepted;
  if (clientsRefused > 0 && p.clientError) errors.push({ where: "app", text: p.clientError, exact: true });

  // Work that reaches the pooler: in-flight transactions on accepted connections only.
  const acceptedShare = clientsWanted ? clientsAccepted / clientsWanted : 0;
  const activeTx = Math.round(i.instances * perInstanceActive * acceptedShare);
  const pinned = p.id === "rds-proxy" ? Math.round((clientsAccepted * i.pinnedPct) / 100) : 0;

  // Server connections the app needs at once.
  // Session mode: every connected client holds one for as long as it stays connected.
  // Transaction mode: only clients mid-transaction need one. Pinned RDS sessions act like session mode.
  const unpinnedTx = Math.round(activeTx * (1 - (pinned / Math.max(1, clientsAccepted))));
  const serverWanted = mode === "session" ? clientsAccepted : pinned + unpinnedTx;

  const limit = poolLimit(i);
  const otherPoolConns = Math.min(usable, i.otherPools * limit);
  const room = Math.max(0, usable - otherPoolConns); // what Postgres has left for this pool
  const want = Math.min(serverWanted, limit);
  const serverOpen = Math.min(want, room);
  const dbRefused = want - serverOpen; // the pooler tried to grow past max_connections
  if (dbRefused > 0) errors.push({ where: "pooler log", text: PG_FULL, exact: true });

  // Who is waiting for a server connection, and for how long.
  let waiting: number;
  let waitMs: number;
  let served: number;
  let failed = i.instances * perInstanceActive - activeTx; // work on refused clients fails
  let stuck = 0;
  if (mode === "session") {
    // Clients without a server connection sit in the queue until someone disconnects.
    // App pools never disconnect, so they wait out the timeout and error.
    waiting = clientsAccepted - serverOpen;
    const shareServed = clientsAccepted ? serverOpen / clientsAccepted : 0;
    served = Math.round(activeTx * shareServed);
    failed += activeTx - served;
    waitMs = waiting > 0 ? Infinity : 0;
  } else {
    // Transactions take turns: a closed loop of N callers on S connections.
    // Pinned clients each hold a connection of their own and serve only their own transactions.
    const pinnedTx = activeTx - unpinnedTx;
    const pinnedHeld = Math.min(pinned, serverOpen);
    stuck = pinned - pinnedHeld; // pinned clients with no connection: they wait out the timeout
    const pinnedTxFail = pinned ? Math.round((pinnedTx * stuck) / pinned) : 0;
    const shared = serverOpen - pinnedHeld;
    if (unpinnedTx > 0 && shared === 0) {
      waiting = unpinnedTx + stuck;
      served = pinnedTx - pinnedTxFail;
      failed += unpinnedTx + pinnedTxFail;
      waitMs = Infinity;
    } else {
      waiting = Math.max(0, unpinnedTx - shared) + stuck;
      served = Math.min(unpinnedTx, shared) + pinnedTx - pinnedTxFail;
      failed += pinnedTxFail;
      waitMs = queueWait(unpinnedTx, shared, i.queryMs);
    }
  }
  if (((waitMs === Infinity && waiting > 0) || stuck > 0) && p.timeoutS) {
    errors.push({ where: "app", text: `Queries hang, then fail after ${p.timeoutS} s: ${p.timeoutName}`, exact: false });
  }

  const inFlight = i.instances * i.busy;
  const binding: Result["binding"] =
    clientsRefused > 0
      ? "client-cap"
      : dbRefused > 0
        ? "max-connections"
        : waiting > 0 && serverWanted > limit
          ? "pool-size"
          : appQueued > 0
            ? "app-pool"
            : "none";

  return {
    usable,
    serverLimit: limit,
    clientsWanted,
    clientsAccepted,
    clientsRefused,
    serverWanted,
    serverOpen,
    dbRefused,
    otherPoolConns,
    waiting: waiting + appQueued,
    waitMs: waitMs + appWait,
    pinned,
    inFlight,
    served,
    failedPct: Math.min(100, pct(Math.max(0, failed), inFlight)),
    binding,
    errors,
  };
}

// N callers looping over S connections, each transaction holding one for t ms:
// a round takes N / S × t, so each waits (N / S − 1) × t on average.
function queueWait(callers: number, conns: number, t: number): number {
  if (callers <= 0 || callers <= conns) return 0;
  if (conns <= 0) return Infinity;
  return Math.round((callers / conns - 1) * t);
}

function pct(a: number, b: number) {
  return b > 0 ? Math.round((a / b) * 100) : 0;
}
