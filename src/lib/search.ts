// Product search over a dozen listings, built the way search engines do it:
// analyse the text into terms, build an inverted index, look the query's terms up,
// filter, then rank with BM25. Everything here is computed: the index, the postings,
// the scores. The alternative, SQL LIKE '%term%', is computed too.

export type Doc = { id: number; title: string; body: string; category: "shoes" | "jackets" | "bags"; price: number; sales: number };

export const DOCS: Doc[] = [
  { id: 1, title: "Trail running shoes", body: "Lightweight shoes for running on rough trails, with a grippy sole.", category: "shoes", price: 120, sales: 340 },
  { id: 2, title: "Road runner", body: "A cushioned shoe for long runs on the road.", category: "shoes", price: 95, sales: 910 },
  { id: 3, title: "Waterproof hiking jacket", body: "Keeps rain out on long hikes; packs small.", category: "jackets", price: 180, sales: 220 },
  { id: 4, title: "Running jacket", body: "A thin windproof jacket for running in cold weather.", category: "jackets", price: 85, sales: 400 },
  { id: 5, title: "Leather boots", body: "Waterproof leather boots for walking in the city.", category: "shoes", price: 150, sales: 130 },
  { id: 6, title: "Gym bag", body: "Room for shoes, a towel and a water bottle.", category: "bags", price: 40, sales: 600 },
  { id: 7, title: "Rain shell", body: "A waterproof jacket that weighs less than a phone.", category: "jackets", price: 140, sales: 510 },
  { id: 8, title: "Running socks", body: "Socks for running that don't rub, in packs of three.", category: "shoes", price: 15, sales: 1500 },
  { id: 9, title: "Hiking backpack", body: "A 30 litre bag for day hikes, with a rain cover.", category: "bags", price: 90, sales: 280 },
  { id: 10, title: "Barefoot shoes", body: "Thin, flexible shoes; some runners swear by them for running.", category: "shoes", price: 110, sales: 75 },
  { id: 11, title: "Insulated jacket", body: "A warm jacket for winter; not waterproof.", category: "jackets", price: 160, sales: 190 },
  { id: 12, title: "Shoe cleaning kit", body: "Brushes and spray to clean running shoes and boots.", category: "shoes", price: 20, sales: 320 },
];

export const QUERIES = [
  { id: "running shoes", text: "running shoes" },
  { id: "waterproof jacket", text: "waterproof jacket" },
  { id: "waterprof jaket", text: "waterprof jaket" },
  { id: "the best jacket for rain", text: "the best jacket for rain" },
];

export const STOPWORDS = new Set(["a", "an", "and", "the", "for", "of", "on", "in", "to", "with", "that", "than", "by", "them", "some", "it", "its", "is", "out", "best", "don't", "not", "less"]);

export type Analyzer = { stem: boolean; stopwords: boolean; typos: boolean };
export type Ranking = "none" | "tf" | "bm25" | "boosted";
export type Filter = { category: Doc["category"] | "all"; maxPrice: number | null };

export const RANKINGS: { id: Ranking; label: string; one: string }[] = [
  { id: "none", label: "No ranking", one: "Matches in the order they were stored." },
  { id: "tf", label: "Term counts", one: "More occurrences of the query words, higher up." },
  { id: "bm25", label: "BM25", one: "Rare words count more, repeats count less and less, long text is discounted." },
  { id: "boosted", label: "BM25 + title + sales", one: "BM25 with matches in the title worth double, nudged by how well it sells." },
];

// A tiny stemmer: enough to join run/runs/running/runner and shoe/shoes.
export function stem(w: string): string {
  if (w.endsWith("nning")) return w.slice(0, -4); // running → run
  if (w.endsWith("nners")) return w.slice(0, -4); // runners → run
  if (w.endsWith("nner")) return w.slice(0, -3); // runner → run
  if (w.endsWith("ing") && w.length > 5) return w.slice(0, -3); // walking → walk
  if (w.endsWith("es") && w.length > 4 && !w.endsWith("ses")) return w.slice(0, -1); // shoes → shoe
  if (w.endsWith("s") && w.length > 3 && !w.endsWith("ss")) return w.slice(0, -1); // boots → boot
  return w;
}

export function analyze(text: string, a: Analyzer): string[] {
  const words = text.toLowerCase().match(/[a-z']+/g) ?? [];
  return words.filter((w) => !a.stopwords || !STOPWORDS.has(w)).map((w) => (a.stem ? stem(w) : w));
}

export type Index = { postings: Map<string, Map<number, { title: number; body: number }>>; len: Map<number, { title: number; body: number }>; avg: { title: number; body: number } };

export function buildIndex(a: Analyzer): Index {
  const postings: Index["postings"] = new Map();
  const len: Index["len"] = new Map();
  for (const d of DOCS) {
    const t = analyze(d.title, a);
    const b = analyze(d.body, a);
    len.set(d.id, { title: t.length, body: b.length });
    for (const [field, terms] of [["title", t], ["body", b]] as const)
      for (const term of terms) {
        if (!postings.has(term)) postings.set(term, new Map());
        const p = postings.get(term)!;
        const cur = p.get(d.id) ?? { title: 0, body: 0 };
        cur[field]++;
        p.set(d.id, cur);
      }
  }
  const avg = { title: 0, body: 0 };
  for (const l of len.values()) {
    avg.title += l.title / DOCS.length;
    avg.body += l.body / DOCS.length;
  }
  return { postings, len, avg };
}

function editDistance(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++) dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length][b.length];
}

export const K1 = 1.2;
export const B = 0.75;

export type Hit = { doc: Doc; score: number; matched: string[] };
export type SearchResult = {
  terms: string[];
  expanded: Record<string, string[]>; // query term → index terms it matched (typo tolerance)
  candidates: number; // docs containing any query term
  filteredOut: number;
  hits: Hit[];
  postingsRead: number;
  likeMatches: number[]; // ids SQL LIKE '%word%' (all words) would return
  likeRowsScanned: number;
};

export function search(query: string, a: Analyzer, ranking: Ranking, f: Filter): SearchResult {
  const index = buildIndex(a);
  const terms = [...new Set(analyze(query, a))];
  const expanded: Record<string, string[]> = {};
  for (const t of terms) {
    const exact = index.postings.has(t) ? [t] : [];
    const fuzzy = a.typos && t.length >= 4 ? [...index.postings.keys()].filter((k) => k !== t && Math.abs(k.length - t.length) <= 1 && editDistance(k, t) === 1) : [];
    expanded[t] = [...exact, ...fuzzy];
  }
  const N = DOCS.length;
  const scores = new Map<number, { score: number; matched: Set<string>; tf: number }>();
  let postingsRead = 0;
  for (const t of terms)
    for (const it of expanded[t]) {
      const p = index.postings.get(it)!;
      postingsRead += p.size;
      const idf = Math.log(1 + (N - p.size + 0.5) / (p.size + 0.5));
      for (const [id, c] of p) {
        const l = index.len.get(id)!;
        const bm = (tf: number, dl: number, avg: number) => (tf === 0 ? 0 : (idf * tf * (K1 + 1)) / (tf + K1 * (1 - B + (B * dl) / avg)));
        const titleW = ranking === "boosted" ? 2 : 1;
        const s = titleW * bm(c.title, l.title, index.avg.title) + bm(c.body, l.body, index.avg.body);
        const cur = scores.get(id) ?? { score: 0, matched: new Set<string>(), tf: 0 };
        cur.score += s;
        cur.tf += c.title + c.body;
        cur.matched.add(t);
        scores.set(id, cur);
      }
    }
  const candidates = scores.size;
  let hits: Hit[] = [...scores.entries()].map(([id, v]) => {
    const doc = DOCS.find((d) => d.id === id)!;
    const score = ranking === "none" ? 0 : ranking === "tf" ? v.tf : ranking === "boosted" ? v.score * (1 + 0.1 * Math.log10(doc.sales)) : v.score;
    return { doc, score, matched: [...v.matched] };
  });
  const before = hits.length;
  hits = hits.filter((h) => (f.category === "all" || h.doc.category === f.category) && (f.maxPrice === null || h.doc.price <= f.maxPrice));
  const filteredOut = before - hits.length;
  hits.sort((x, y) => (ranking === "none" ? x.doc.id - y.doc.id : y.score - x.score || x.doc.id - y.doc.id));

  // SQL: WHERE (title || body) LIKE '%w1%' AND … LIKE '%wn%', on the raw words of the query
  const raw = (query.toLowerCase().match(/[a-z']+/g) ?? []).filter((w) => !STOPWORDS.has(w));
  const likeMatches = DOCS.filter((d) => raw.every((w) => `${d.title} ${d.body}`.toLowerCase().includes(w))).map((d) => d.id);
  return { terms, expanded, candidates, filteredOut, hits, postingsRead, likeMatches, likeRowsScanned: DOCS.length };
}

export const TOTAL_INDEX_TERMS = (a: Analyzer) => buildIndex(a).postings.size;
