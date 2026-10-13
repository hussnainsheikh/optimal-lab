// A deadlock: thread 1 holds lock A and wants B; thread 2 holds B and wants A. Neither can
// continue. Taking locks in one global order (always A, then B) makes the cycle impossible.

export type DlFrame = { text: string; holds: Record<"T1" | "T2", string[]>; waits: Record<"T1" | "T2", string | null>; stuck: boolean; done: boolean };

export function runDeadlock(ordered: boolean): DlFrame[] {
  const f: DlFrame[] = [];
  const holds = { T1: [] as string[], T2: [] as string[] };
  const waits: DlFrame["waits"] = { T1: null, T2: null };
  const p = (text: string, stuck = false, done = false) => f.push({ text, holds: { T1: [...holds.T1], T2: [...holds.T2] }, waits: { ...waits }, stuck, done });
  p(ordered ? "Both threads take locks in the same order: A, then B." : "T1 needs A then B. T2 needs B then A.");
  holds.T1.push("A");
  p("T1 takes A.");
  if (!ordered) {
    holds.T2.push("B");
    p("T2 takes B.");
    waits.T1 = "B";
    p("T1 asks for B: T2 holds it. T1 waits.");
    waits.T2 = "A";
    p("T2 asks for A: T1 holds it. T2 waits. Each waits for the other, forever.", true);
  } else {
    waits.T2 = "A";
    p("T2 asks for A first: T1 holds it, so T2 waits without holding anything.");
    holds.T1.push("B");
    p("T1 takes B, does its work, and releases both.");
    holds.T1 = [];
    waits.T2 = null;
    holds.T2.push("A", "B");
    p("T2 gets A, then B. It finishes too.", false, true);
  }
  return f;
}
