// A small heap. Roots point into it; one pair of objects only reference each other.
export const NODES = [
  { id: "root", x: 30, y: 80, root: true },
  { id: "user", x: 120, y: 40 }, { id: "cart", x: 120, y: 120 },
  { id: "items", x: 210, y: 120 }, { id: "prefs", x: 210, y: 40 },
  { id: "oldTab", x: 300, y: 40 }, { id: "oldView", x: 300, y: 120 },
  { id: "tmp", x: 210, y: 180 },
];
export const EDGES: [string, string][] = [["root", "user"], ["root", "cart"], ["user", "prefs"], ["cart", "items"], ["oldTab", "oldView"], ["oldView", "oldTab"]];
export type Mode = "refcount" | "mark-sweep";
export type Frame = { marked: string[]; freed: string[]; cur: string | null; text: string; counts?: Record<string, number> };

export function run(mode: Mode): Frame[] {
  const out: Frame[] = [];
  const objs = NODES.filter((n) => !n.root).map((n) => n.id);
  if (mode === "refcount") {
    const counts: Record<string, number> = Object.fromEntries(objs.map((o) => [o, EDGES.filter(([, b]) => b === o).length]));
    out.push({ marked: [], freed: [], cur: null, counts: { ...counts }, text: "Reference counting: each object counts how many pointers point at it. Free it when the count hits 0." });
    const freed = objs.filter((o) => counts[o] === 0);
    out.push({ marked: [], freed, cur: "tmp", counts: { ...counts }, text: "tmp has count 0, so it's freed immediately. Nice: no pauses." });
    out.push({ marked: [], freed, cur: "oldTab", counts: { ...counts }, text: "oldTab and oldView point at each other, so each has count 1, forever. Nothing can reach them, but they're never freed: a leak." });
    return out;
  }
  out.push({ marked: [], freed: [], cur: null, text: "Mark and sweep starts from the roots: globals, the stack, registers." });
  const marked: string[] = [];
  const q = ["root"];
  while (q.length) {
    const u = q.shift()!;
    if (u !== "root") marked.push(u);
    out.push({ marked: [...marked], freed: [], cur: u, text: u === "root" ? "Mark everything reachable from the roots…" : `Mark ${u} as reachable, then follow its pointers.` });
    for (const [a, b] of EDGES) if (a === u && !marked.includes(b) && !q.includes(b)) q.push(b);
  }
  const garbage = objs.filter((o) => !marked.includes(o));
  out.push({ marked: [...marked], freed: garbage, cur: null, text: `Sweep: free everything unmarked: ${garbage.join(", ")}. The oldTab ↔ oldView cycle goes too, because nothing reachable points at it.` });
  return out;
}
