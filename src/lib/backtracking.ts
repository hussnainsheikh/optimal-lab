// Subsets of NUMS that sum to TARGET: a choose/skip decision tree, with optional pruning.
export const NUMS = [3, 1, 2];
export const TARGET = 3;
// Node ids: level-order in a full binary tree. Left child = take, right child = skip.
export type Frame = { node: number; sum: number; path: number[]; visited: number[]; pruned: number[]; found: string[]; text: string };

export function run(prune: boolean): Frame[] {
  const out: Frame[] = [];
  const visited: number[] = [], pruned: number[] = [], found: string[] = [];
  const go = (id: number, depth: number, sum: number, path: number[]) => {
    visited.push(id);
    const snap = (text: string) => out.push({ node: id, sum, path: [...path], visited: [...visited], pruned: [...pruned], found: [...found], text });
    if (prune && depth < NUMS.length && sum >= TARGET) {
      pruned.push(id);
      if (sum === TARGET) { found.push(`{${path.join(", ")}}`); snap(`Sum hit ${TARGET} early: record {${path.join(", ")}}. Every number is positive, so going deeper can only overshoot. Prune.`); }
      else snap(`Sum ${sum} is already over ${TARGET}. Prune: nothing below can work.`);
      return;
    }
    if (depth === NUMS.length) {
      if (sum === TARGET) { found.push(`{${path.join(", ")}}`); snap(`Sum is ${TARGET}: record {${path.join(", ")}}.`); }
      else snap(`End of the list with sum ${sum}. Not a match; go back.`);
      return;
    }
    snap(depth === 0 ? "Start empty. At each level, decide: take this number or skip it." : `Path {${path.join(", ") || "∅"}}, sum ${sum}. Next decide on ${NUMS[depth]}.`);
    go(2 * id + 1, depth + 1, sum + NUMS[depth], [...path, NUMS[depth]]);
    go(2 * id + 2, depth + 1, sum, path);
  };
  go(0, 0, 0, []);
  out.push({ node: -1, sum: 0, path: [], visited: [...visited], pruned: [...pruned], found: [...found], text: `Visited ${visited.length} of 15 nodes and found ${found.join(" and ")}.` });
  return out;
}
