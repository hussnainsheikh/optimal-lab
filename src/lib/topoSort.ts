// Kahn's algorithm: take courses whose prerequisites are all done.
export const COURSES = [
  { id: "Intro", x: 50, y: 100 }, { id: "Data", x: 160, y: 40 }, { id: "Web", x: 160, y: 160 },
  { id: "Algo", x: 280, y: 40 }, { id: "APIs", x: 280, y: 160 }, { id: "Systems", x: 390, y: 100 },
];
const BASE: [string, string][] = [["Intro", "Data"], ["Intro", "Web"], ["Data", "Algo"], ["Web", "APIs"], ["Data", "APIs"], ["Algo", "Systems"], ["APIs", "Systems"]];
export const edges = (cycle: boolean): [string, string][] => (cycle ? [...BASE, ["Systems", "Data"]] : BASE);
export type Frame = { indeg: Record<string, number>; queue: string[]; order: string[]; cur: string | null; text: string; stuck?: boolean };

export function run(cycle: boolean): Frame[] {
  const E = edges(cycle);
  const indeg: Record<string, number> = Object.fromEntries(COURSES.map((c) => [c.id, 0]));
  for (const [, b] of E) indeg[b]++;
  const queue = COURSES.filter((c) => indeg[c.id] === 0).map((c) => c.id);
  const order: string[] = [];
  const out: Frame[] = [{ indeg: { ...indeg }, queue: [...queue], order: [], cur: null, text: `Count prerequisites for each course. Courses with 0 can start: ${queue.join(", ") || "none"}.` }];
  while (queue.length) {
    const u = queue.shift()!;
    order.push(u);
    const freed: string[] = [];
    for (const [a, b] of E) if (a === u) { indeg[b]--; if (indeg[b] === 0) { queue.push(b); freed.push(b); } }
    out.push({ indeg: { ...indeg }, queue: [...queue], order: [...order], cur: u, text: `Take ${u}. Its dependents each lose one prerequisite${freed.length ? `; ${freed.join(" and ")} can now start` : ""}.` });
  }
  const stuck = order.length < COURSES.length;
  out.push({ indeg: { ...indeg }, queue: [], order: [...order], cur: null, stuck, text: stuck ? `Queue empty but ${COURSES.length - order.length} courses still wait on each other: a cycle. No valid order exists.` : `Order found: ${order.join(" → ")}.` });
  return out;
}
