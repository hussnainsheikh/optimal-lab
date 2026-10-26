// A real HNSW (Hierarchical Navigable Small World) index, as in Malkov & Yashunin (2016), over
// 800 points in 2-D so the graph can be drawn. Each point gets a random top layer
// (floor(-ln(U) · mL), mL = 1/ln(M)); inserts descend greedily from the top and link to the
// nearest neighbours found with a beam of efConstruction. Searches descend the upper layers
// greedily, then run a beam of efSearch on layer 0. Recall is measured against brute force,
// and every distance computation is counted. Real embeddings have hundreds of dimensions; the
// graph mechanics are the same.

export type Pt = [number, number];
export const N = 800;
export const EF_CONSTRUCTION = 64;

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

let ptsCache: Pt[] | null = null;
/** Points in clusters, like embeddings of documents on a handful of topics. */
export function points(): Pt[] {
  if (ptsCache) return ptsCache;
  const r = rng(99);
  const centres: Pt[] = Array.from({ length: 9 }, () => [0.1 + r() * 0.8, 0.1 + r() * 0.8]);
  const gauss = () => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r());
  ptsCache = Array.from({ length: N }, (_, i) => {
    if (i % 7 === 0) return [r(), r()] as Pt; // some points between topics
    const c = centres[Math.floor(r() * centres.length)];
    return [Math.min(1, Math.max(0, c[0] + gauss() * 0.06)), Math.min(1, Math.max(0, c[1] + gauss() * 0.06))] as Pt;
  });
  return ptsCache;
}

const d2 = (a: Pt, b: Pt) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2;

export type Hnsw = { M: number; levels: number[]; links: number[][][]; entry: number; top: number; buildDistances: number };

type Cand = { i: number; d: number };
/** Insert into an array kept sorted by distance. */
function insert(xs: Cand[], c: Cand) {
  let lo = 0, hi = xs.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (xs[mid].d < c.d) lo = mid + 1;
    else hi = mid;
  }
  xs.splice(lo, 0, c);
}

/** Beam search on one layer: keep the `ef` closest seen so far, expand the closest unexpanded. */
function searchLayer(pts: Pt[], links: number[][][], q: Pt, entries: number[], ef: number, layer: number, count: { n: number }, visitedOut?: number[]) {
  const visited = new Set(entries);
  const dist = (i: number) => {
    count.n++;
    return d2(pts[i], q);
  };
  const cand: Cand[] = [];
  const best: Cand[] = [];
  for (const i of entries) {
    const c = { i, d: dist(i) };
    insert(cand, c);
    insert(best, c);
  }
  while (cand.length) {
    const c = cand.shift()!;
    if (best.length >= ef && c.d > best[best.length - 1].d) break;
    visitedOut?.push(c.i);
    for (const n of links[c.i][layer] ?? []) {
      if (visited.has(n)) continue;
      visited.add(n);
      const dn = dist(n);
      if (best.length < ef || dn < best[best.length - 1].d) {
        const e = { i: n, d: dn };
        insert(cand, e);
        insert(best, e);
        if (best.length > ef) best.pop();
      }
    }
  }
  return best;
}

const builds = new Map<number, Hnsw>();
export function build(M: number): Hnsw {
  if (builds.has(M)) return builds.get(M)!;
  const pts = points();
  const r = rng(1234);
  const mL = 1 / Math.log(M);
  const levels: number[] = [];
  const links: number[][][] = [];
  let entry = 0, top = -1;
  const count = { n: 0 };
  const maxLinks = (layer: number) => (layer === 0 ? 2 * M : M);
  for (let i = 0; i < pts.length; i++) {
    const level = Math.floor(-Math.log(1 - r()) * mL);
    levels.push(level);
    links.push(Array.from({ length: level + 1 }, () => []));
    if (top < 0) {
      entry = i;
      top = level;
      continue;
    }
    let ep = [entry];
    for (let l = top; l > level; l--) ep = [searchLayer(pts, links, pts[i], ep, 1, l, count)[0].i];
    for (let l = Math.min(top, level); l >= 0; l--) {
      const found = searchLayer(pts, links, pts[i], ep, EF_CONSTRUCTION, l, count);
      const nbrs = found.slice(0, M).map((x) => x.i);
      links[i][l] = nbrs;
      for (const n of nbrs) {
        links[n][l].push(i);
        if (links[n][l].length > maxLinks(l)) {
          // Keep the closest ones.
          links[n][l] = links[n][l]
            .map((x) => ({ x, d: d2(pts[x], pts[n]) }))
            .sort((a, b) => a.d - b.d)
            .slice(0, maxLinks(l))
            .map((y) => y.x);
        }
      }
      ep = found.map((x) => x.i);
    }
    if (level > top) {
      top = level;
      entry = i;
    }
  }
  const h = { M, levels, links, entry, top, buildDistances: count.n };
  builds.set(M, h);
  return h;
}

export type Trace = { layer: number; visited: number[]; best: number };
export function search(h: Hnsw, q: Pt, k: number, efSearch: number) {
  const pts = points();
  const count = { n: 0 };
  const trace: Trace[] = [];
  let ep = [h.entry];
  for (let l = h.top; l > 0; l--) {
    const visited: number[] = [];
    const res = searchLayer(pts, h.links, q, ep, 1, l, count, visited);
    trace.push({ layer: l, visited, best: res[0].i });
    ep = [res[0].i];
  }
  const visited: number[] = [];
  const res = searchLayer(pts, h.links, q, ep, Math.max(efSearch, k), 0, count, visited);
  trace.push({ layer: 0, visited, best: res[0].i });
  return { ids: res.slice(0, k).map((x) => x.i), distances: count.n, trace };
}

export function bruteForce(q: Pt, k: number) {
  const pts = points();
  return pts
    .map((p, i) => ({ i, d: d2(p, q) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, k)
    .map((x) => x.i);
}

let queriesCache: Pt[] | null = null;
export function testQueries(): Pt[] {
  if (queriesCache) return queriesCache;
  const r = rng(7);
  return (queriesCache = Array.from({ length: 60 }, () => [r(), r()] as Pt));
}

/** Average recall@k and distance computations over 60 random queries. */
export function evaluate(M: number, efSearch: number, k = 10) {
  const h = build(M);
  let recall = 0, dist = 0;
  for (const q of testQueries()) {
    const truth = new Set(bruteForce(q, k));
    const got = search(h, q, k, efSearch);
    recall += got.ids.filter((i) => truth.has(i)).length / k;
    dist += got.distances;
  }
  const n = testQueries().length;
  return { recall: recall / n, distances: dist / n };
}

export const layerCounts = (h: Hnsw) => Array.from({ length: h.top + 1 }, (_, l) => h.levels.filter((x) => x >= l).length);
/** Bytes per vector: a 768-dimension float32 embedding, 2M layer-0 links, and M links on each
 * upper layer it reaches (1/(M-1) upper layers on average). */
export const bytesPerVector = (M: number, dims = 768) => dims * 4 + 2 * M * 4 + (M * 4) / (M - 1);
