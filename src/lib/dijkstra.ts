// Dijkstra on a small weighted graph.
export const NODES = [
  { id: "A", x: 40, y: 110 }, { id: "B", x: 150, y: 40 }, { id: "C", x: 150, y: 180 },
  { id: "D", x: 270, y: 40 }, { id: "E", x: 270, y: 180 }, { id: "F", x: 370, y: 110 },
];
export const EDGES: [string, string, number][] = [["A", "B", 4], ["A", "C", 1], ["C", "B", 2], ["B", "D", 5], ["C", "E", 8], ["B", "E", 6], ["D", "F", 3], ["E", "F", 1], ["D", "E", 1]];
export type Frame = { dist: Record<string, number>; prev: Record<string, string | null>; done: string[]; cur: string | null; edge: [string, string] | null; queue: [string, number][]; text: string };

export function run(src = "A"): Frame[] {
  const dist: Record<string, number> = Object.fromEntries(NODES.map((n) => [n.id, Infinity]));
  const prev: Record<string, string | null> = Object.fromEntries(NODES.map((n) => [n.id, null]));
  dist[src] = 0;
  const done: string[] = [];
  const out: Frame[] = [];
  const queue = () => NODES.filter((n) => !done.includes(n.id) && dist[n.id] < Infinity).map((n) => [n.id, dist[n.id]] as [string, number]).sort((a, b) => a[1] - b[1]);
  const snap = (cur: string | null, edge: [string, string] | null, text: string) => out.push({ dist: { ...dist }, prev: { ...prev }, done: [...done], cur, edge, queue: queue(), text });
  snap(null, null, `Distance to ${src} is 0; everything else is ∞. Always settle the closest unsettled node next.`);
  while (queue().length) {
    const [u, d] = queue()[0];
    done.push(u);
    snap(u, null, `Closest unsettled node is ${u} at ${d}. Its distance is now final.`);
    for (const [a, b, w] of EDGES) {
      const v = a === u ? b : b === u ? a : null;
      if (!v || done.includes(v)) continue;
      if (d + w < dist[v]) { const old = dist[v]; dist[v] = d + w; prev[v] = u; snap(u, [u, v], `${u}→${v}: ${d} + ${w} = ${d + w}, better than ${old === Infinity ? "∞" : old}. Update.`); }
      else snap(u, [u, v], `${u}→${v}: ${d} + ${w} = ${d + w}, not better than ${dist[v]}.`);
    }
  }
  snap(null, null, `All settled. Shortest A→F is ${dist.F}: follow the highlighted edges back.`);
  return out;
}

export function pathTo(prev: Record<string, string | null>, t: string) { const p = [t]; while (prev[p[0]]) p.unshift(prev[p[0]]!); return p; }
