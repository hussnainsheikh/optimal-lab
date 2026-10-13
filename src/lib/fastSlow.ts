// Floyd's cycle detection on a linked list of 8 nodes.
export const N = 8;
export const CYCLE_TO = 3;
export type Frame = { slow: number | null; fast: number | null; phase: 1 | 2; text: string; done?: boolean };

export function run(cycle: boolean): Frame[] {
  const next = (i: number | null) => (i === null ? null : i + 1 < N ? i + 1 : cycle ? CYCLE_TO : null);
  let slow: number | null = 0, fast: number | null = 0;
  const out: Frame[] = [{ slow, fast, phase: 1, text: "Both start at the head. Slow moves 1 step, fast moves 2." }];
  for (let i = 0; i < 20; i++) {
    slow = next(slow); fast = next(next(fast));
    if (fast === null || slow === null) { out.push({ slow, fast, phase: 1, text: "Fast fell off the end: there is no cycle.", done: true }); return out; }
    if (slow === fast) { out.push({ slow, fast, phase: 1, text: `They meet at node ${slow}. Fast caught up from behind, so there's a cycle.` }); break; }
    out.push({ slow, fast, phase: 1, text: `slow → ${slow}, fast → ${fast}.` });
  }
  let a: number | null = 0;
  let b: number | null = slow;
  out.push({ slow: a, fast: b, phase: 2, text: "To find where the cycle starts: move one pointer back to the head. Now both move 1 step." });
  while (a !== b) { a = next(a); b = next(b); out.push({ slow: a, fast: b, phase: 2, text: a === b ? `They meet at node ${a}: the start of the cycle.` : `${a} and ${b}.`, done: a === b }); }
  return out;
}
