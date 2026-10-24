// A social graph of 3,000 people grown by preferential attachment (popular people attract more
// friends), plus one celebrity with 1,200 followers-turned-friends. Friend-of-friend queries
// and shortest paths really run as breadth-first walks over adjacency lists, the way a graph
// database stores edges next to each node. The relational comparison counts the B-tree probes a
// friendships(user_id, friend_id) table would need for the same walk; page counts are estimates.

export const PEOPLE = 3_000;
export const HOBBIES = ["climbing", "chess", "jazz", "running", "baking", "cycling", "film", "go", "poetry", "surfing"];
export const CELEB = 0;
export const ANA = 1_877;

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

export type Graph = { adj: number[][]; likes: Set<string>[]; edges: number };
let cache: Graph | null = null;
export function graph(): Graph {
  if (cache) return cache;
  const r = rng(21);
  const adj: Set<number>[] = Array.from({ length: PEOPLE }, () => new Set());
  const ends: number[] = []; // every edge endpoint: picking from it favours well-connected people
  const link = (a: number, b: number) => {
    if (a === b || adj[a].has(b)) return;
    adj[a].add(b);
    adj[b].add(a);
    ends.push(a, b);
  };
  for (let i = 1; i <= 6; i++) for (let j = i + 1; j <= 6; j++) link(i, j);
  for (let v = 7; v < PEOPLE; v++) for (let k = 0; k < 5; k++) link(v, ends[Math.floor(r() * ends.length)]);
  for (let k = 0; k < 1_200; k++) link(CELEB, 1 + Math.floor(r() * (PEOPLE - 1)));
  link(CELEB, ANA); // Ana is one of them
  const likes = Array.from({ length: PEOPLE }, () => new Set(HOBBIES.filter(() => r() < 0.18)));
  const edges = adj.reduce((a, s) => a + s.size, 0) / 2;
  return (cache = { adj: adj.map((s) => [...s]), likes, edges });
}

export const degree = (v: number) => graph().adj[v].length;

/** Walk out `depth` hops from `start`. Optionally don't expand people with more than `cap` friends. */
export function walk(start: number, depth: number, cap: number | null) {
  const g = graph();
  const dist = new Map<number, number>([[start, 0]]);
  let frontier = [start];
  let edgesRead = 0, expanded = 0;
  const perHop: { reached: number; edges: number }[] = [];
  for (let d = 1; d <= depth; d++) {
    const next: number[] = [];
    let e = 0;
    for (const u of frontier) {
      if (cap !== null && u !== start && g.adj[u].length > cap) continue;
      expanded++;
      for (const v of g.adj[u]) {
        e++;
        if (!dist.has(v)) {
          dist.set(v, d);
          next.push(v);
        }
      }
    }
    edgesRead += e;
    perHop.push({ reached: next.length, edges: e });
    frontier = next;
  }
  return { dist, edgesRead, expanded, perHop };
}

/** People exactly two hops away who like `hobby`, ranked by mutual friends. */
export function suggestions(start: number, hobby: string, cap: number | null) {
  const g = graph();
  const w = walk(start, 2, cap);
  const friends = new Set(g.adj[start]);
  const out = [...w.dist]
    .filter(([v, d]) => d === 2 && g.likes[v].has(hobby))
    .map(([v]) => ({ id: v, mutual: g.adj[v].filter((x) => friends.has(x)).length }))
    .sort((a, b) => b.mutual - a.mutual || a.id - b.id);
  return { list: out, edgesRead: w.edgesRead, expanded: w.expanded };
}

/** Relational cost of the same walk: one index probe per person expanded, plus leaf pages for their friends. */
export function relationalCost(expanded: number, edgesRead: number) {
  const g = graph();
  const rows = g.edges * 2;
  const depth = Math.max(1, Math.ceil(Math.log(rows) / Math.log(300))); // ~300 keys per B-tree page
  return { probes: expanded, pages: expanded * depth + Math.ceil(edgesRead / 200), rowsBeforeDistinct: edgesRead, btreeDepth: depth };
}

/** Shortest path by BFS from one side, or from both ends at once. */
export function shortestPath(a: number, b: number, bidirectional: boolean) {
  const g = graph();
  let edges = 0;
  if (!bidirectional) {
    const prev = new Map<number, number>([[a, -1]]);
    let frontier = [a];
    while (frontier.length && !prev.has(b)) {
      const next: number[] = [];
      for (const u of frontier)
        for (const v of g.adj[u]) {
          edges++;
          if (!prev.has(v)) {
            prev.set(v, u);
            next.push(v);
          }
        }
      frontier = next;
    }
    const path: number[] = [];
    for (let v = b; v !== -1 && prev.has(v); v = prev.get(v)!) path.unshift(v);
    return { path, edges };
  }
  const pa = new Map<number, number>([[a, -1]]), pb = new Map<number, number>([[b, -1]]);
  let fa = [a], fb = [b];
  let meet = -1;
  while (fa.length && fb.length && meet < 0) {
    // Expand the smaller side.
    const fromA = fa.length <= fb.length;
    const [mine, other, front] = fromA ? [pa, pb, fa] : [pb, pa, fb];
    const next: number[] = [];
    for (const u of front) {
      for (const v of g.adj[u]) {
        edges++;
        if (!mine.has(v)) {
          mine.set(v, u);
          next.push(v);
          if (other.has(v) && meet < 0) meet = v;
        }
      }
    }
    if (fromA) fa = next;
    else fb = next;
  }
  const path: number[] = [];
  for (let v = meet; v !== -1; v = pa.get(v)!) path.unshift(v);
  for (let v = pb.get(meet)!; v !== -1 && v !== undefined; v = pb.get(v)!) path.push(v);
  return { path, edges };
}

/** Someone far from Ana, for the path query. */
export function farPerson() {
  const w = walk(ANA, 6, null);
  let best = ANA, bd = 0;
  for (const [v, d] of w.dist) {
    if (d < bd || (d === bd && v > best)) continue;
    best = v;
    bd = d;
  }
  return best;
}

export const NAMES = ["Ari", "Ben", "Chen", "Dara", "Eli", "Femi", "Gus", "Hana", "Ivo", "Jade", "Kai", "Lena", "Mo", "Nia", "Omar", "Pia", "Raj", "Sol", "Tess", "Uma", "Vik", "Wren", "Yara", "Zed"];
export const nameOf = (v: number) => (v === ANA ? "Ana" : v === CELEB ? "The celebrity" : `${NAMES[v % NAMES.length]} #${v}`);
