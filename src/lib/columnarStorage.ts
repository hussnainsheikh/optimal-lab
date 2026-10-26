// Row vs columnar storage on 100,000 generated orders. The row store packs whole rows into
// 8 KB pages (Postgres-style: a 24-byte tuple header and a 4-byte line pointer each). The column
// store keeps each column apart, in row groups of 10,000 with min/max per group, and encodes
// each column chunk with whichever of plain, dictionary, run-length, delta or bit-packing comes
// out smallest. Encodings, sizes, skipped groups and bytes read are all computed from the data.

export const N = 100_000;
export const GROUP = 10_000;
export const PAGE_B = 8192;
const DAY = 86_400;
export const NOW = 1_730_000_000; // the newest order is a little before this

export type Order = { id: number; created_at: number; customer_id: number; country: string; status: string; amount_cents: number; note: string | null };
export const COLUMNS = ["id", "created_at", "customer_id", "country", "status", "amount_cents", "note"] as const;
export type Col = (typeof COLUMNS)[number];
const INT_COLS: Col[] = ["id", "created_at", "customer_id", "amount_cents"];

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
const COUNTRIES: [string, number][] = [["US", 30], ["DE", 18], ["GB", 14], ["FR", 10], ["NL", 6], ["ES", 5], ["IT", 5], ["SE", 4], ["PL", 3], ["CA", 3], ["AU", 1], ["JP", 1]];
const NOTES = ["Leave at the back door", "Gift, no invoice please", "Call on arrival", "Fragile: glass inside", "Deliver after 6 pm"];

let cache: Order[] | null = null;
/** 100,000 orders over about 30 days, oldest first. Older orders are mostly delivered. */
export function orders(): Order[] {
  if (cache) return cache;
  const r = rng(11);
  const total = COUNTRIES.reduce((a, [, w]) => a + w, 0);
  const pick = () => {
    let x = r() * total;
    for (const [c, w] of COUNTRIES) if ((x -= w) < 0) return c;
    return "US";
  };
  const out: Order[] = [];
  let t = NOW - 30 * DAY;
  for (let i = 0; i < N; i++) {
    t += 1 + Math.floor(-Math.log(1 - r()) * 25);
    const age = (NOW - t) / DAY;
    const status = age > 6 ? (r() < 0.97 ? "delivered" : "cancelled") : age > 2 ? (r() < 0.8 ? "shipped" : "delivered") : r() < 0.85 ? "pending" : "shipped";
    out.push({ id: 1_000_001 + i, created_at: t, customer_id: 1 + Math.floor(r() * 20_000), country: pick(), status, amount_cents: Math.round(Math.exp(7 + r() * 3.5)), note: r() < 0.12 ? NOTES[Math.floor(r() * NOTES.length)] : null });
  }
  return (cache = out);
}

// ---- row store ------------------------------------------------------------------------------

const align8 = (n: number) => Math.ceil(n / 8) * 8;
/** Bytes one row takes on a heap page, including its line pointer. */
export function rowBytes(o: Order) {
  const varlena = (s: string) => 1 + s.length; // short varlena header
  const data = 8 * 4 + varlena(o.country) + varlena(o.status) + (o.note ? varlena(o.note) : 0);
  return align8(24 + data) + 4;
}
let rowCache: ReturnType<typeof buildRowStore> | null = null;
export const rowStore = () => (rowCache ??= buildRowStore(orders()));
function buildRowStore(rows: Order[]) {
  const pages: number[] = []; // first row index on each page
  let used = PAGE_B;
  rows.forEach((o, i) => {
    const b = rowBytes(o);
    if (used + b > PAGE_B - 24) {
      pages.push(i);
      used = 0;
    }
    used += b;
  });
  return { pages: pages.length, bytes: pages.length * PAGE_B, avgRow: rows.reduce((a, o) => a + rowBytes(o), 0) / rows.length, rowsPerPage: rows.length / pages.length };
}

// ---- column store ---------------------------------------------------------------------------

export type Encoding = "plain" | "dictionary" | "run-length" | "delta" | "bit-packed";
const bitsFor = (range: number) => Math.max(1, Math.ceil(Math.log2(range + 1)));

function encodeChunk(col: Col, vals: (number | string | null)[]) {
  const n = vals.length;
  const options: { enc: Encoding; bytes: number }[] = [];
  const nullBitmap = vals.some((v) => v === null) ? Math.ceil(n / 8) : 0;
  const present = vals.filter((v) => v !== null);
  if (INT_COLS.includes(col)) {
    const xs = present as number[];
    options.push({ enc: "plain", bytes: 8 * xs.length });
    let min = Infinity, max = -Infinity, dmin = Infinity, dmax = -Infinity;
    xs.forEach((x, i) => {
      min = Math.min(min, x);
      max = Math.max(max, x);
      if (i) {
        dmin = Math.min(dmin, x - xs[i - 1]);
        dmax = Math.max(dmax, x - xs[i - 1]);
      }
    });
    options.push({ enc: "bit-packed", bytes: 8 + Math.ceil((xs.length * bitsFor(max - min)) / 8) });
    options.push({ enc: "delta", bytes: 16 + Math.ceil(((xs.length - 1) * bitsFor(dmax - dmin)) / 8) });
  } else {
    const ss = present as string[];
    options.push({ enc: "plain", bytes: ss.reduce((a, s) => a + 4 + s.length, 0) });
    const dict = [...new Set(ss)];
    options.push({ enc: "dictionary", bytes: dict.reduce((a, s) => a + 4 + s.length, 0) + Math.ceil((ss.length * bitsFor(dict.length - 1)) / 8) });
  }
  let runs = 1;
  for (let i = 1; i < present.length; i++) if (present[i] !== present[i - 1]) runs++;
  const valueB = INT_COLS.includes(col) ? 8 : Math.max(...present.map((s) => String(s).length)) + 4;
  options.push({ enc: "run-length", bytes: runs * (valueB + 4) });
  const best = options.reduce((a, b) => (b.bytes < a.bytes ? b : a));
  return { ...best, bytes: best.bytes + nullBitmap, plain: options[0].bytes + nullBitmap, runs };
}

export type Sort = "created_at" | "country";
export type Chunk = { col: Col; group: number; enc: Encoding; bytes: number; plain: number; min: number | string; max: number | string };

const colCache = new Map<Sort, ReturnType<typeof buildColumnStore>>();
export function columnStore(sort: Sort) {
  if (!colCache.has(sort)) colCache.set(sort, buildColumnStore(sort));
  return colCache.get(sort)!;
}
function buildColumnStore(sort: Sort) {
  const rows = [...orders()];
  // Rows are generated oldest first and sort() is stable, so sorting by country keeps time order within a country.
  if (sort === "country") rows.sort((a, b) => (a.country < b.country ? -1 : a.country > b.country ? 1 : 0));
  const chunks: Chunk[] = [];
  for (let g = 0; g * GROUP < rows.length; g++) {
    const part = rows.slice(g * GROUP, (g + 1) * GROUP);
    for (const col of COLUMNS) {
      const vals = part.map((o) => o[col]);
      const e = encodeChunk(col, vals);
      const nn = vals.filter((v) => v !== null) as (number | string)[];
      const min = nn.reduce((a, b) => (b < a ? b : a));
      const max = nn.reduce((a, b) => (b > a ? b : a));
      chunks.push({ col, group: g, enc: e.enc, bytes: e.bytes, plain: e.plain, min, max });
    }
  }
  const perCol = COLUMNS.map((col) => {
    const cs = chunks.filter((c) => c.col === col);
    const encs = [...new Set(cs.map((c) => c.enc))];
    return { col, bytes: cs.reduce((a, c) => a + c.bytes, 0), plain: cs.reduce((a, c) => a + c.plain, 0), enc: encs.join(", ") };
  });
  return { rows, chunks, perCol, groups: Math.ceil(rows.length / GROUP), bytes: perCol.reduce((a, c) => a + c.bytes, 0), plain: perCol.reduce((a, c) => a + c.plain, 0) };
}

// ---- queries --------------------------------------------------------------------------------

export type Query = "lastWeek" | "total" | "byId" | "insert";
export const QUERIES: Record<Query, { sql: string; cols: Col[] }> = {
  lastWeek: { sql: "SELECT country, SUM(amount_cents) FROM orders WHERE created_at >= now() - interval '7 days' GROUP BY country", cols: ["created_at", "country", "amount_cents"] },
  total: { sql: "SELECT SUM(amount_cents) FROM orders", cols: ["amount_cents"] },
  byId: { sql: "SELECT * FROM orders WHERE id = 1048213", cols: [...COLUMNS] },
  insert: { sql: "INSERT INTO orders VALUES (…one row…)", cols: [...COLUMNS] },
};
export const CUTOFF = NOW - 7 * DAY;
export const LOOKUP_ID = 1_048_213;

export function runQuery(q: Query, sort: Sort) {
  const rs = rowStore();
  const cs = columnStore(sort);
  const { cols } = QUERIES[q];
  // Which row groups might hold matching rows, from the min/max of the filter column.
  const keep = (g: number) => {
    if (q === "lastWeek") return (cs.chunks.find((c) => c.group === g && c.col === "created_at")!.max as number) >= CUTOFF;
    if (q === "byId") {
      const c = cs.chunks.find((c) => c.group === g && c.col === "id")!;
      return (c.min as number) <= LOOKUP_ID && LOOKUP_ID <= (c.max as number);
    }
    return true;
  };
  const groups = [...Array(cs.groups).keys()];
  const read = q === "insert" ? [] : groups.filter(keep);
  const colBytes = read.reduce((a, g) => a + cs.chunks.filter((c) => c.group === g && cols.includes(c.col)).reduce((x, c) => x + c.bytes, 0), 0);
  // Row store: a sequential scan for the analytics queries; an index lookup (3 index pages +
  // 1 heap page) for the point query; one heap page for the insert.
  const rowPages = q === "byId" ? 4 : q === "insert" ? 1 : rs.pages;
  const matches = q === "lastWeek" ? cs.rows.filter((o) => o.created_at >= CUTOFF).length : q === "byId" ? 1 : q === "insert" ? 1 : N;
  return {
    rowBytes: rowPages * PAGE_B,
    rowPages,
    colBytes: q === "insert" ? null : colBytes,
    chunksTouched: q === "insert" ? cols.length : read.length * cols.length,
    groupsRead: read.length,
    groupsSkipped: cs.groups - read.length,
    matches,
  };
}
