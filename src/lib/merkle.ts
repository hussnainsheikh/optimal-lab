// Two replicas compare 8 blocks via Merkle trees: only descend where hashes differ.
export const BLOCKS = ["alice", "bob", "carol", "dave", "erin", "frank", "grace", "heidi"];
export const h = (s: string) => { let x = 0x811c9dc5; for (const c of s) x = Math.imul(x ^ c.charCodeAt(0), 0x01000193) >>> 0; return x.toString(16).padStart(8, "0").slice(0, 4); };

export function tree(blocks: string[]) {
  const levels: string[][] = [blocks.map(h)];
  while (levels[0].length > 1) { const prev = levels[0]; levels.unshift(Array.from({ length: prev.length / 2 }, (_, i) => h(prev[2 * i] + prev[2 * i + 1]))); }
  return levels; // levels[0] = [root], last = leaves
}

export type Diff = "none" | "one" | "two";
export const DIFFS: { id: Diff; label: string }[] = [{ id: "none", label: "In sync" }, { id: "one", label: "1 block differs" }, { id: "two", label: "2 blocks differ" }];

export function compare(d: Diff) {
  const b = [...BLOCKS];
  if (d !== "none") b[5] = "frank2";
  if (d === "two") b[1] = "bob2";
  const A = tree(BLOCKS), B = tree(b);
  const checked: string[] = [];
  const differs: string[] = [];
  const walk = (lvl: number, i: number) => {
    const key = `${lvl}-${i}`; checked.push(key);
    if (A[lvl][i] === B[lvl][i]) return;
    differs.push(key);
    if (lvl < A.length - 1) { walk(lvl + 1, 2 * i); walk(lvl + 1, 2 * i + 1); }
  };
  walk(0, 0);
  const bad = differs.filter((k) => k.startsWith(`${A.length - 1}-`)).map((k) => Number(k.split("-")[1]));
  return { A, B, checked, differs, bad, replicaB: b };
}
