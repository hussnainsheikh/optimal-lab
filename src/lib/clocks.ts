// Three processes exchanging messages. Wall clocks lie; Lamport and vector clocks don't.
export type Ev = { id: string; p: number; x: number; kind: "local" | "send" | "recv"; peer?: string; wall: number };
// x = true physical order (left to right). P3's wall clock runs 40 ms slow.
export const EVENTS: Ev[] = [
  { id: "a", p: 0, x: 1, kind: "local", wall: 100 },
  { id: "b", p: 0, x: 2, kind: "send", peer: "d", wall: 110 },
  { id: "c", p: 1, x: 1.5, kind: "local", wall: 105 },
  { id: "d", p: 1, x: 3, kind: "recv", peer: "b", wall: 120 },
  { id: "e", p: 1, x: 4, kind: "send", peer: "g", wall: 130 },
  { id: "f", p: 2, x: 2.5, kind: "local", wall: 75 },
  { id: "g", p: 2, x: 5, kind: "recv", peer: "e", wall: 100 },
  { id: "h", p: 0, x: 5.5, kind: "local", wall: 150 },
];

export function lamport() {
  const L: Record<string, number> = {}, V: Record<string, number[]> = {};
  const clock = [0, 0, 0], vec = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (const e of [...EVENTS].sort((a, b) => a.x - b.x)) {
    if (e.kind === "recv") {
      clock[e.p] = Math.max(clock[e.p], L[e.peer!]) + 1;
      vec[e.p] = vec[e.p].map((v, i) => Math.max(v, V[e.peer!][i]));
    } else clock[e.p]++;
    vec[e.p][e.p]++;
    L[e.id] = clock[e.p]; V[e.id] = [...vec[e.p]];
  }
  return { L, V };
}

export const happenedBefore = (a: number[], b: number[]) => a.every((v, i) => v <= b[i]) && a.some((v, i) => v < b[i]);
