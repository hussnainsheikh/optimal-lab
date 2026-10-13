// Union-find with union by size and path compression.
export const N = 8;
export const EDGES: [number, number][] = [[0, 1], [2, 3], [1, 3], [4, 5], [6, 7], [5, 7], [0, 2], [4, 6]];
export type Frame = { parent: number[]; edge: [number, number] | null; text: string; components: number };

export function run(compress: boolean): Frame[] {
  const parent = Array.from({ length: N }, (_, i) => i);
  const size = Array(N).fill(1);
  let comps = N;
  const find = (x: number): number => {
    let r = x;
    while (parent[r] !== r) r = parent[r];
    if (compress) while (parent[x] !== r) { const nx = parent[x]; parent[x] = r; x = nx; }
    return r;
  };
  const out: Frame[] = [{ parent: [...parent], edge: null, text: "Every node starts as its own group: its parent is itself.", components: comps }];
  for (const [a, b] of EDGES) {
    const ra = find(a), rb = find(b);
    if (ra === rb) { out.push({ parent: [...parent], edge: [a, b], text: `${a} and ${b} already share root ${ra}: this edge would make a cycle. Skip.`, components: comps }); continue; }
    const [big, small] = size[ra] >= size[rb] ? [ra, rb] : [rb, ra];
    parent[small] = big; size[big] += size[small]; comps--;
    out.push({ parent: [...parent], edge: [a, b], text: `Roots ${ra} and ${rb} differ. Attach the smaller group under ${big}.${compress ? " Nodes we walked now point straight at their root." : ""}`, components: comps });
  }
  return out;
}

export function rootOf(parent: number[], x: number) { while (parent[x] !== x) x = parent[x]; return x; }
export function depth(parent: number[], x: number) { let d = 0; while (parent[x] !== x) { x = parent[x]; d++; } return d; }
