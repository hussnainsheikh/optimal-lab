// A B+ tree index next to a full table scan. The table holds 27 rows in insertion order
// (3 per page); the index keeps the same ids sorted in a three-level tree.

export const LEAF_KEYS = [2, 5, 8, 11, 14, 17, 20, 23, 26, 29, 32, 35, 38, 41, 44, 47, 50, 53, 56, 59, 62, 65, 68, 71, 74, 77, 80];
export const ROWS_PER_PAGE = 3;

// Rows as they sit on disk: in the order they were inserted, not sorted.
export const HEAP = [41, 8, 74, 23, 59, 2, 68, 35, 14, 50, 77, 5, 29, 62, 20, 44, 11, 71, 56, 32, 80, 17, 47, 26, 65, 38, 53];

export type BNode = { id: string; keys: number[]; children?: BNode[] };

function build(): BNode {
  const leaves: BNode[] = [];
  for (let i = 0; i < LEAF_KEYS.length; i += 3) leaves.push({ id: `L${i / 3}`, keys: LEAF_KEYS.slice(i, i + 3) });
  const inner: BNode[] = [];
  for (let i = 0; i < leaves.length; i += 3) {
    const kids = leaves.slice(i, i + 3);
    inner.push({ id: `I${i / 3}`, keys: kids.slice(1).map((k) => k.keys[0]), children: kids });
  }
  return { id: "R", keys: inner.slice(1).map((n) => n.children![0].keys[0]), children: inner };
}

export const ROOT = build();
export const LEVELS: BNode[][] = [[ROOT], ROOT.children!, ROOT.children!.flatMap((n) => n.children!)];

export type Hop = { node: BNode; level: number; choice: number | null; note: string };

export function lookup(key: number): { hops: Hop[]; found: boolean } {
  const hops: Hop[] = [];
  let node = ROOT;
  let level = 0;
  while (node.children) {
    const i = node.keys.filter((k) => key >= k).length;
    const note =
      i === 0 ? `${key} < ${node.keys[0]}: go left` : i === node.keys.length ? `${key} ≥ ${node.keys[i - 1]}: go right` : `${node.keys[i - 1]} ≤ ${key} < ${node.keys[i]}: go middle`;
    hops.push({ node, level, choice: i, note });
    node = node.children[i];
    level++;
  }
  const found = node.keys.includes(key);
  hops.push({ node, level, choice: null, note: found ? `${key} is in this leaf` : `${key} is not in this leaf, so it isn't in the table` });
  return { hops, found };
}

export const HEAP_PAGES = Math.ceil(HEAP.length / ROWS_PER_PAGE);

// A full scan reads every page: it can't know there isn't another match further on.
export function scanPages() {
  return HEAP_PAGES;
}

// Page reads at real sizes: ~8 KB pages hold ~100 rows; an index node points to ~300 children.
export function atScale(rows: number) {
  const scan = Math.ceil(rows / 100);
  const depth = Math.max(1, Math.ceil(Math.log(rows / 100) / Math.log(300)) + 1);
  return { scan, index: depth + 1 }; // tree levels, plus one read for the row itself
}
