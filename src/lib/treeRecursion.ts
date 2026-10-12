// Recursion on a binary tree, shown with maximum depth:
//   maxDepth(empty) = 0
//   maxDepth(node)  = 1 + max(maxDepth(left), maxDepth(right))
// Each frame is one moment of the recursion: a call going in, or a call returning its answer.

export type TreeNode = { id: number; left?: TreeNode; right?: TreeNode };

export type TreePreset = { id: string; label: string; root: TreeNode };

const n = (id: number, left?: TreeNode, right?: TreeNode): TreeNode => ({ id, left, right });

export const TREE_PRESETS: TreePreset[] = [
  { id: "balanced", label: "Balanced (7 nodes)", root: n(1, n(2, n(4), n(5)), n(3, n(6), n(7))) },
  { id: "uneven", label: "Uneven", root: n(8, n(3, n(1), n(6, n(4), n(7))), n(10, undefined, n(14, n(13)))) },
  { id: "chain", label: "Leaning (a chain)", root: n(1, n(2, n(3, n(4, n(5)))), n(6)) },
];

export type TreeFrame = {
  phase: "call" | "return" | "done";
  node: number | null; // the call this frame is about
  stack: number[]; // open calls, bottom first
  results: Record<number, number>; // answers returned so far
  left: number | null; // the children's answers, on a return (0 = empty child)
  right: number | null;
  value: number | null; // what this call returns
  leaf: boolean;
  calls: number; // calls made so far
};

export function maxDepthTrace(root: TreeNode): TreeFrame[] {
  const frames: TreeFrame[] = [];
  const stack: number[] = [];
  const results: Record<number, number> = {};
  let calls = 0;

  const snap = (f: Omit<TreeFrame, "stack" | "results" | "calls">) =>
    frames.push({ ...f, stack: [...stack], results: { ...results }, calls });

  const visit = (node: TreeNode): number => {
    calls++;
    stack.push(node.id);
    const leaf = !node.left && !node.right;
    snap({ phase: "call", node: node.id, left: null, right: null, value: null, leaf });
    const l = node.left ? visit(node.left) : 0;
    const r = node.right ? visit(node.right) : 0;
    const value = 1 + Math.max(l, r);
    results[node.id] = value;
    snap({ phase: "return", node: node.id, left: l, right: r, value, leaf });
    stack.pop();
    return value;
  };

  const depth = visit(root);
  snap({ phase: "done", node: root.id, left: null, right: null, value: depth, leaf: false });
  return frames;
}

export type PlacedNode = { id: number; x: number; y: number; depth: number; parent: number | null };

// x from the in-order position, y from the depth, both in a 100 × 100 box.
export function placeTree(root: TreeNode): PlacedNode[] {
  const out: PlacedNode[] = [];
  let order = 0;
  let maxDepth = 0;
  const walk = (node: TreeNode, depth: number, parent: number | null) => {
    if (node.left) walk(node.left, depth + 1, node.id);
    out.push({ id: node.id, x: order++, y: depth, depth, parent });
    maxDepth = Math.max(maxDepth, depth);
    if (node.right) walk(node.right, depth + 1, node.id);
  };
  walk(root, 0, null);
  const cols = Math.max(1, order - 1);
  return out.map((p) => ({
    ...p,
    x: 8 + (p.x / cols) * 84,
    y: maxDepth === 0 ? 50 : 12 + (p.y / maxDepth) * 76,
  }));
}

export const countNodes = (node?: TreeNode): number => (node ? 1 + countNodes(node.left) + countNodes(node.right) : 0);
