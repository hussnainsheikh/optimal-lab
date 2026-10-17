// Which index type can answer which query, on six blog posts.
// B-tree: sorted keys (=, <, >, ranges). Hash: buckets (= only). GIN: an inverted list of
// elements or words (@>, @@). GiST: nested bounding boxes (&&, <->, nearest neighbour).

export type Post = { id: number; email: string; day: string; tags: string[]; title: string; words: string[]; at: [number, number] };

export const POSTS: Post[] = [
  { id: 1, email: "ada@x.io", day: "09-12", tags: ["sql", "index"], title: "Indexes make reads fast", words: ["index", "make", "read", "fast"], at: [2, 3] },
  { id: 2, email: "bo@x.io", day: "09-20", tags: ["sql", "joins"], title: "Joins row by row", words: ["join", "row"], at: [8, 1] },
  { id: 3, email: "cy@x.io", day: "10-02", tags: ["index", "gist"], title: "GiST for maps", words: ["gist", "map"], at: [7, 8] },
  { id: 4, email: "di@x.io", day: "10-05", tags: ["sql", "index", "tuning"], title: "Tuning a slow index scan", words: ["tune", "slow", "index", "scan"], at: [3, 7] },
  { id: 5, email: "eli@x.io", day: "10-09", tags: ["joins"], title: "Fast hash joins", words: ["fast", "hash", "join"], at: [9, 9] },
  { id: 6, email: "fay@x.io", day: "10-14", tags: ["gist", "maps"], title: "Nearest cafe queries", words: ["nearest", "cafe", "queri"], at: [1, 1] },
];

export type QueryId = "eq" | "range" | "tags" | "text" | "near";
export type IndexType = "btree" | "hash" | "gin" | "gist";

export const QUERIES: { id: QueryId; label: string; sql: string; op: string; column: string }[] = [
  { id: "eq", label: "email = …", sql: "WHERE email = 'di@x.io'", op: "=", column: "email" },
  { id: "range", label: "day >= …", sql: "WHERE day >= '10-01'", op: ">=", column: "day" },
  { id: "tags", label: "tags @> …", sql: "WHERE tags @> '{sql,index}'", op: "@>", column: "tags" },
  { id: "text", label: "full text @@", sql: "WHERE to_tsvector('english', title)\n   @@ to_tsquery('index & fast')", op: "@@", column: "to_tsvector(title)" },
  { id: "near", label: "nearest to (2,2)", sql: "ORDER BY at <-> point(2,2) LIMIT 2", op: "<->", column: "at" },
];

export const INDEXES: { id: IndexType; label: string; using: string }[] = [
  { id: "btree", label: "B-tree", using: "btree" },
  { id: "hash", label: "Hash", using: "hash" },
  { id: "gin", label: "GIN", using: "gin" },
  { id: "gist", label: "GiST", using: "gist" },
];

/** Exact answer for each query, computed from POSTS. */
export function answer(q: QueryId): number[] {
  switch (q) {
    case "eq":
      return POSTS.filter((p) => p.email === "di@x.io").map((p) => p.id);
    case "range":
      return POSTS.filter((p) => p.day >= "10-01").map((p) => p.id);
    case "tags":
      return POSTS.filter((p) => ["sql", "index"].every((t) => p.tags.includes(t))).map((p) => p.id);
    case "text":
      return POSTS.filter((p) => p.words.includes("index") && p.words.includes("fast")).map((p) => p.id);
    case "near":
      return [...POSTS].sort((a, b) => dist(a.at) - dist(b.at)).slice(0, 2).map((p) => p.id);
  }
}

export const ORIGIN: [number, number] = [2, 2];
export function dist([x, y]: [number, number]) {
  return Math.hypot(x - ORIGIN[0], y - ORIGIN[1]);
}

/** A tiny hash: sum of character codes, 4 buckets. Real databases use a much better hash. */
export function bucket(s: string, buckets = 4) {
  let h = 0;
  for (const ch of s) h += ch.charCodeAt(0);
  return h % buckets;
}

export type Verdict = { ok: boolean; how: string; reads?: string };

export function verdict(q: QueryId, ix: IndexType): Verdict {
  const table: Record<QueryId, Record<IndexType, Verdict>> = {
    eq: {
      btree: { ok: true, how: "Walk down the sorted keys to 'di@x.io'.", reads: "root, one leaf, one row" },
      hash: { ok: true, how: "Hash 'di@x.io', open that one bucket, check its entries.", reads: "one bucket, one row" },
      gin: { ok: false, how: "GIN indexes the elements inside a value. A plain text column has no elements, so this needs the btree_gin extension." },
      gist: { ok: false, how: "GiST has no plain-equality support for text without the btree_gist extension." },
    },
    range: {
      btree: { ok: true, how: "Find '10-01' in the sorted keys, then read forward to the end.", reads: "one leaf, 4 rows" },
      hash: { ok: false, how: "Hashing scatters the keys. '10-01' and '10-02' land in unrelated buckets, so there is no order to scan." },
      gin: { ok: false, how: "GIN answers 'contains', not 'greater than'." },
      gist: { ok: false, how: "Possible with the btree_gist extension, but a B-tree is the normal choice." },
    },
    tags: {
      btree: { ok: false, how: "A B-tree compares whole arrays. It can find tags = '{sql,index}' exactly, but not arrays that contain both." },
      hash: { ok: false, how: "A hash of the whole array only matches the identical array." },
      gin: { ok: true, how: "Look up 'sql' and 'index' in the inverted list and intersect the two row lists.", reads: "2 posting lists" },
      gist: { ok: false, how: "Not for plain arrays (the intarray extension adds it for integer arrays)." },
    },
    text: {
      btree: { ok: false, how: "A B-tree sorts whole titles. It can't find a word in the middle." },
      hash: { ok: false, how: "A hash of the whole title can't find a word in it." },
      gin: { ok: true, how: "Each word points to the rows that contain it. Intersect 'index' and 'fast'.", reads: "2 posting lists" },
      gist: { ok: true, how: "Works, but GiST stores a lossy summary of the words, so it rechecks rows. GIN is usually faster to read." },
    },
    near: {
      btree: { ok: false, how: "Points have no single sort order that keeps nearby points together." },
      hash: { ok: false, how: "A hash has no idea of distance." },
      gin: { ok: false, how: "GIN has no idea of distance." },
      gist: { ok: true, how: "Visit boxes nearest to (2,2) first. Box B can't hold anything closer than the 2 points already found, so it is skipped.", reads: "1 of 2 leaf boxes" },
    },
  };
  return table[q][ix];
}

/** GIN: every element (tag or word) → the posts that contain it. */
export function postings(kind: "tags" | "words") {
  const map = new Map<string, number[]>();
  for (const p of POSTS) for (const t of p[kind]) map.set(t, [...(map.get(t) ?? []), p.id]);
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
}

/** GiST: two leaf boxes, each the bounding box of its points. */
export const BOXES = [
  { name: "A", ids: [1, 4, 6] },
  { name: "B", ids: [2, 3, 5] },
].map((b) => {
  const pts = b.ids.map((id) => POSTS.find((p) => p.id === id)!.at);
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const box = { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
  const dx = Math.max(box.x0 - ORIGIN[0], 0, ORIGIN[0] - box.x1);
  const dy = Math.max(box.y0 - ORIGIN[1], 0, ORIGIN[1] - box.y1);
  return { ...b, ...box, minDist: Math.hypot(dx, dy) };
});
