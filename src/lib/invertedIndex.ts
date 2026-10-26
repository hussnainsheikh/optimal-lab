// An inverted index over 3,000 generated support tickets, built the way Lucene-family engines
// do: analyze text into terms (lowercase, drop stop words, strip suffixes), keep a sorted
// posting list of document ids per term, answer AND queries by intersecting lists (with or
// by walking both lists or leapfrogging through the longer one, rarest list first), compress lists as varint-encoded gaps, and write
// the index as immutable segments that are merged later, with deletes as tombstones until then.
// Every count and byte here is computed from the generated tickets.

const SUBJECTS = ["Payment", "Login", "Password reset", "Invoice", "Refund", "Shipping label", "Account", "Export", "Mobile app", "Email receipt", "Checkout", "Coupon"];
const VERBS = ["fails", "failed", "keeps failing", "crashes", "crashed", "keeps crashing", "won't load", "loads slowly", "shows errors", "errored"];
const CONTEXTS = ["after the update", "on iPhone", "on Android", "in Safari", "in Chrome", "since yesterday", "for all users", "for one customer", "with a saved card", "with PayPal", "on the web"];
const EXTRAS = ["Customer is upset.", "Tried clearing the cache.", "Happens every time.", "Card was declined twice.", "Error code 502.", "Worked last week.", "Refund requested."];
export const STOP = new Set(["the", "a", "an", "on", "in", "for", "with", "since", "after", "is", "it", "to", "and", "of", "was", "won't", "every", "one", "all", "last", "keeps"]);

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

export const N_DOCS = 3_000;
let docsCache: string[] | null = null;
export function docs(): string[] {
  if (docsCache) return docsCache;
  const r = rng(8);
  const pick = <T>(xs: T[], skew = 1) => xs[Math.floor(Math.pow(r(), skew) * xs.length)];
  docsCache = Array.from({ length: N_DOCS }, () => `${pick(SUBJECTS, 1.6)} ${pick(VERBS)} ${pick(CONTEXTS, 1.3)}.${r() < 0.5 ? ` ${pick(EXTRAS)}` : ""}${r() < 0.012 ? " Escalated to legal." : ""}`);
  return docsCache;
}

/** A tiny suffix-stripping stemmer: failing, failed, fails → fail; crashes → crash. */
export function stem(w: string) {
  if (w.length > 5 && w.endsWith("ing")) return w.slice(0, -3);
  if (w.length > 4 && w.endsWith("ed")) return w.slice(0, -2);
  if (/(ch|sh|ss|x)es$/.test(w)) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss")) return w.slice(0, -1);
  return w;
}
export function analyze(text: string) {
  const tokens = text.toLowerCase().match(/[a-z0-9']+/g) ?? [];
  const kept = tokens.filter((t) => !STOP.has(t));
  return { tokens, kept, terms: kept.map(stem) };
}

// ---- the index ---------------------------------------------------------------------------------

export type Index = Map<string, number[]>;
let indexCache: Index | null = null;
export function index(): Index {
  if (indexCache) return indexCache;
  const ix: Index = new Map();
  docs().forEach((d, id) => {
    for (const t of new Set(analyze(d).terms)) {
      if (!ix.has(t)) ix.set(t, []);
      ix.get(t)!.push(id); // ids arrive in order, so every list is already sorted
    }
  });
  return (indexCache = ix);
}

export type QueryId = "paymentFailed" | "legalCrash" | "loginCrashSafari";
export const QUERIES: Record<QueryId, string> = {
  paymentFailed: "payment failed",
  legalCrash: "legal crashed",
  loginCrashSafari: "login crashing safari",
};

/**
 * Intersect sorted lists, rarest first. "merge" walks both lists one id at a time. "leapfrog"
 * takes each id of the shorter list and calls advance(target) on the longer one, which jumps
 * ahead by galloping (1, 2, 4, 8… then binary search), the effect Lucene gets from its
 * multi-level skip lists. Every comparison is counted.
 */
export function intersect(lists: number[][], leapfrog: boolean) {
  let comparisons = 0;
  const merge = (a: number[], b: number[]) => {
    const out: number[] = [];
    let i = 0, j = 0;
    while (i < a.length && j < b.length) {
      comparisons++;
      if (a[i] === b[j]) {
        out.push(a[i]);
        i++;
        j++;
      } else if (a[i] < b[j]) i++;
      else j++;
    }
    return out;
  };
  const gallop = (short: number[], long: number[]) => {
    const out: number[] = [];
    let lo = 0;
    for (const target of short) {
      // advance(target): find the first position in `long` whose id is >= target.
      let step = 1, hi = lo;
      while (hi < long.length && (comparisons++, long[hi] < target)) {
        lo = hi + 1;
        hi += step;
        step *= 2;
      }
      hi = Math.min(hi, long.length);
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        comparisons++;
        if (long[mid] < target) lo = mid + 1;
        else hi = mid;
      }
      if (lo >= long.length) break;
      comparisons++;
      if (long[lo] === target) out.push(target);
    }
    return out;
  };
  const sorted = [...lists].sort((x, y) => x.length - y.length);
  let acc = sorted[0] ?? [];
  for (const l of sorted.slice(1)) acc = leapfrog ? gallop(acc, l) : merge(acc, l);
  return { ids: acc, comparisons };
}

export function search(q: QueryId, leapfrog: boolean) {
  const ix = index();
  const terms = [...new Set(analyze(QUERIES[q]).terms)];
  const lists = terms.map((t) => ix.get(t) ?? []);
  const r = intersect(lists, leapfrog);
  const scanAll = docs().reduce((a, d) => a + analyze(d).terms.length, 0); // reading every ticket's terms instead
  return { terms, sizes: lists.map((l) => l.length), ...r, scanAll, results: r.ids.slice(0, 4).map((id) => ({ id, text: docs()[id] })) };
}

// ---- compression ---------------------------------------------------------------------------------

export const varintBytes = (n: number) => (n < 128 ? 1 : n < 16_384 ? 2 : n < 2_097_152 ? 3 : 4);
export function compressed(list: number[]) {
  let bytes = 0;
  list.forEach((id, i) => (bytes += varintBytes(i ? id - list[i - 1] : id)));
  return { raw: list.length * 4, packed: bytes };
}
export function indexBytes() {
  let raw = 0, packed = 0;
  for (const l of index().values()) {
    const c = compressed(l);
    raw += c.raw;
    packed += c.packed;
  }
  return { raw, packed, terms: index().size, postings: [...index().values()].reduce((a, l) => a + l.length, 0) };
}

// ---- segments ------------------------------------------------------------------------------------

export const SEGMENT_DOCS = 100; // documents buffered before a segment is flushed
/** Segments on disk after a merge policy that merges `factor` equal segments into one. */
export function segments(factor: number, deletedPct: number, merged: boolean) {
  // Tiered merging: count segments by level, like a counter in base `factor`.
  let flushes = Math.ceil(N_DOCS / SEGMENT_DOCS);
  const counts: number[] = [];
  while (flushes > 0) {
    counts.push(flushes % factor);
    flushes = Math.floor(flushes / factor);
  }
  const count = merged ? 1 : counts.reduce((a, b) => a + b, 0);
  const postings = indexBytes().postings;
  const dead = merged ? 0 : Math.round((postings * deletedPct) / 100);
  return { count, levels: counts, lookupsPerTerm: count, dead, live: postings - Math.round((postings * deletedPct) / 100) };
}
