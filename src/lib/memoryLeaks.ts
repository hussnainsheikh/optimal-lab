// A service that leaks, hour by hour. Each request makes short-lived garbage; a collector that
// lets the heap grow to twice the live data before collecting (Go's default GOGC=100; the JVM
// and V8 pace differently but the shape is the same) makes memory swing between the live data
// and twice that. A leak raises the live data a little with every request, so the floor under
// the swings climbs until the container's memory limit is hit and the kernel's OOM killer
// restarts it. Native code (C, C++, Rust with unsafe) has no collector: a forgotten free() just
// adds to memory in use. Rates and sizes are illustrative; the pacing and reachability are real.

export type Leak = "none" | "cache" | "listener" | "native";
export const LEAKS: Leak[] = ["none", "cache", "listener", "native"];
export const LEAK: Record<Leak, { label: string; blurb: string; code: string; fix: string; fixCode: string; gc: boolean }> = {
  none: {
    label: "No leak",
    blurb: "Every request's objects become unreachable when it ends, and the collector frees them.",
    code: "handle(req) { const cart = load(req.session); return render(cart) }",
    fix: "Nothing to fix: the floor stays flat.",
    fixCode: "—",
    gc: true,
  },
  cache: {
    label: "Unbounded cache",
    blurb: "A map caches each new session's data and never removes anything. Every entry stays reachable, so the collector can't free it.",
    code: "sessionCache.set(req.session, loadCart(req.session))   // never deleted",
    fix: "Bound the cache: an LRU of 20,000 entries (or a TTL). It grows until full, then old entries are evicted and memory levels off.",
    fixCode: "sessionCache = new LRU({ max: 20_000 })",
    gc: true,
  },
  listener: {
    label: "Forgotten listener",
    blurb: "Each request subscribes to price updates and never unsubscribes. The emitter keeps every closure, and each closure keeps its request's context alive.",
    code: "priceFeed.on('change', (p) => update(req, p))   // never removed",
    fix: "Unsubscribe when the request ends (off / removeEventListener, or an AbortSignal). The closures become unreachable and are collected.",
    fixCode: "const off = priceFeed.on('change', h); req.onEnd(off)",
    gc: true,
  },
  native: {
    label: "Missing free()",
    blurb: "In native code, an error path returns early and skips free(). Nothing points at the buffer any more, and nothing will ever free it.",
    code: "buf = malloc(16384); if (parse(buf) < 0) return -1;   // buf leaks",
    fix: "Free on every path: one cleanup label in C, or an owner that frees in its destructor (RAII in C++, ownership in Rust).",
    fixCode: "if (parse(buf) < 0) { free(buf); return -1; }",
    gc: false,
  },
};

const MB = 1024; // KB per MB
export const LIMIT_MB = 1024; // container memory limit
export const RUNTIME_MB = 60; // code, runtime and thread stacks
export const BASE_LIVE_MB = 120; // live data a healthy instance keeps
export const HOURS = 8;
export const SAMPLE_MIN = 5;
const NEW_SESSION = 0.2; // share of requests from a session not seen before
const ENTRY_KB = 3;
const CONTEXT_KB = 1.5;
const ERROR_RATE = 0.02;
const BUF_KB = 16;
const LRU_MAX = 20_000;

// KB of leaked live data per second at `rps`, before any fix
export function leakRate(leak: Leak, rps: number) {
  if (leak === "cache") return rps * NEW_SESSION * ENTRY_KB;
  if (leak === "listener") return rps * CONTEXT_KB;
  if (leak === "native") return rps * ERROR_RATE * BUF_KB;
  return 0;
}

export type Sample = { min: number; live: number; low: number; high: number; restart: boolean };
export type Series = { samples: Sample[]; restarts: number; firstOom: number | null; mbPerHour: number; plateau: number | null };

// memory in MB over HOURS hours, one sample every SAMPLE_MIN minutes
export function series(leak: Leak, rps: number, fixed: boolean): Series {
  const rate = leakRate(leak, rps); // KB/s
  const gc = LEAK[leak].gc;
  const inFlight = 20; // MB of buffers for requests being served right now (native)
  const samples: Sample[] = [];
  let up = 0; // seconds since the last (re)start
  let restarts = 0;
  let firstOom: number | null = null;
  const cap = leak === "cache" ? (LRU_MAX * ENTRY_KB) / MB : 0;
  for (let min = 0; min <= HOURS * 60; min += SAMPLE_MIN) {
    let leaked = (rate * up) / MB;
    if (fixed) leaked = leak === "cache" ? Math.min(leaked, cap) : 0;
    const live = BASE_LIVE_MB + leaked;
    const low = RUNTIME_MB + live;
    const high = gc ? RUNTIME_MB + 2 * live : RUNTIME_MB + live + inFlight;
    let restart = false;
    if (high >= LIMIT_MB) {
      restart = true;
      restarts++;
      if (firstOom === null) firstOom = min;
      up = 0;
    }
    samples.push({ min, live, low: Math.min(low, LIMIT_MB), high: Math.min(high, LIMIT_MB), restart });
    up += SAMPLE_MIN * 60;
  }
  const grows = fixed ? 0 : (rate * 3600) / MB;
  return { samples, restarts, firstOom, mbPerHour: grows, plateau: fixed && leak === "cache" ? BASE_LIVE_MB + cap : null };
}

// When does the first OOM kill happen, in minutes (exact, not sampled)?
export function minutesToOom(leak: Leak, rps: number) {
  const rate = leakRate(leak, rps) / MB; // MB/s
  if (!rate) return null;
  const head = LEAK[leak].gc ? (LIMIT_MB - RUNTIME_MB) / 2 - BASE_LIVE_MB : LIMIT_MB - RUNTIME_MB - BASE_LIVE_MB - 20;
  return head / rate / 60;
}

// Two heap snapshots (each taken right after a forced collection, so garbage isn't counted)
export type Row = { what: string; countA: number; countB: number; kbA: number; kbB: number; leak: boolean };

export function diff(leak: Leak, rps: number, aMin: number, bMin: number): Row[] {
  const n = (m: number, perSec: number) => Math.round(perSec * m * 60);
  const steady: Row[] = LEAK[leak].gc
    ? [
        { what: "string", countA: 412_300, countB: 412_870, kbA: 18_200, kbB: 18_230, leak: false },
        { what: "Object (config, routes)", countA: 8_410, countB: 8_410, kbA: 2_900, kbB: 2_900, leak: false },
        { what: "Buffer (open sockets)", countA: 260, countB: 254, kbA: 16_640, kbB: 16_260, leak: false },
      ]
    : [
        { what: "main → load_config → malloc", countA: 1_204, countB: 1_204, kbA: 2_900, kbB: 2_900, leak: false },
        { what: "accept_loop → conn_new → malloc", countA: 260, countB: 254, kbA: 16_640, kbB: 16_260, leak: false },
      ];
  if (leak === "none") return steady;
  if (leak === "cache") {
    const per = rps * NEW_SESSION;
    return [
      { what: "Object (session entry)", countA: n(aMin, per), countB: n(bMin, per), kbA: n(aMin, per) * 1.2, kbB: n(bMin, per) * 1.2, leak: true },
      { what: "Array (cart items)", countA: n(aMin, per), countB: n(bMin, per), kbA: n(aMin, per) * 1.6, kbB: n(bMin, per) * 1.6, leak: true },
      { what: "string (session id)", countA: n(aMin, per), countB: n(bMin, per), kbA: n(aMin, per) * 0.2, kbB: n(bMin, per) * 0.2, leak: true },
      ...steady,
    ];
  }
  if (leak === "listener") {
    return [
      { what: "Function (closure in handle)", countA: n(aMin, rps), countB: n(bMin, rps), kbA: n(aMin, rps) * 0.1, kbB: n(bMin, rps) * 0.1, leak: true },
      { what: "Object (request context)", countA: n(aMin, rps), countB: n(bMin, rps), kbA: n(aMin, rps) * 1.4, kbB: n(bMin, rps) * 1.4, leak: true },
      ...steady,
    ];
  }
  const per = rps * ERROR_RATE;
  return [{ what: "handle → parse_body → malloc(16384)", countA: n(aMin, per), countB: n(bMin, per), kbA: n(aMin, per) * BUF_KB, kbB: n(bMin, per) * BUF_KB, leak: true }, ...steady];
}

// Reachability: mark from the roots, the way a collector or LeakSanitizer does.
export type GNode = { id: string; label: string; root?: boolean; leak?: boolean };
export type Graph = { nodes: GNode[]; edges: [string, string][] };
export type Verdict = "root" | "in use" | "still reachable" | "definitely lost" | "garbage";

export function graph(leak: Leak): Graph {
  const common: Graph = {
    nodes: [
      { id: "globals", label: "globals", root: true },
      { id: "stack", label: "stack (current request)", root: true },
      { id: "config", label: "config" },
      { id: "req", label: "request #90412" },
      { id: "body", label: "body buffer" },
    ],
    edges: [["globals", "config"], ["stack", "req"], ["req", "body"]],
  };
  if (leak === "none" || leak === "native") {
    const nodes = [...common.nodes, { id: "old", label: LEAK[leak].gc ? "request #90411's cart" : "buf from request #90391", leak: !LEAK[leak].gc }];
    if (leak === "native") nodes.push({ id: "old2", label: "buf from request #90205", leak: true });
    return { nodes, edges: common.edges };
  }
  if (leak === "cache") {
    return {
      nodes: [...common.nodes, { id: "map", label: "sessionCache (Map)" }, { id: "e1", label: "entry “s:48121”", leak: true }, { id: "c1", label: "cart [3 items]", leak: true }, { id: "e2", label: "entry “s:48122”", leak: true }, { id: "c2", label: "cart [1 item]", leak: true }],
      edges: [...common.edges, ["globals", "map"], ["map", "e1"], ["e1", "c1"], ["map", "e2"], ["e2", "c2"]],
    };
  }
  return {
    nodes: [...common.nodes, { id: "feed", label: "priceFeed (emitter)" }, { id: "l1", label: "closure from request #3", leak: true }, { id: "x1", label: "request #3 context", leak: true }, { id: "l2", label: "closure from request #4", leak: true }, { id: "x2", label: "request #4 context", leak: true }],
    edges: [...common.edges, ["globals", "feed"], ["feed", "l1"], ["l1", "x1"], ["feed", "l2"], ["l2", "x2"]],
  };
}

export function mark(g: Graph, gc: boolean) {
  const parent = new Map<string, string | null>();
  const queue = g.nodes.filter((n) => n.root).map((n) => n.id);
  for (const r of queue) parent.set(r, null);
  while (queue.length) {
    const at = queue.shift()!;
    for (const [from, to] of g.edges) if (from === at && !parent.has(to)) { parent.set(to, at); queue.push(to); }
  }
  const path = (id: string) => {
    const out: string[] = [];
    for (let at: string | null | undefined = id; at; at = parent.get(at)) out.unshift(at);
    return out;
  };
  return g.nodes.map((n) => {
    const reached = parent.has(n.id);
    const verdict: Verdict = n.root ? "root" : reached ? (n.leak ? "still reachable" : "in use") : gc ? "garbage" : "definitely lost";
    return { ...n, verdict, path: reached ? path(n.id) : [] };
  });
}

export const fmtMB = (mb: number) => (mb >= 1024 ? `${(mb / 1024).toFixed(2)} GB` : `${Math.round(mb)} MB`);
export const fmtMin = (m: number) => (m >= 60 ? `${Math.floor(m / 60)} h ${Math.round(m % 60)} min` : `${Math.round(m)} min`);
