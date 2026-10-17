// Switching one CPU core from thread A to thread B.
// Costs are typical orders of magnitude for Linux on a modern x86 core, not measurements:
// a switch between threads of the same process skips the page-table change.

export type Kind = "thread" | "process";
export const KINDS: { id: Kind; label: string }[] = [
  { id: "thread", label: "B is a thread in the same process" },
  { id: "process", label: "B is in another process" },
];

/** Direct cost of one switch in µs: save, pick, (switch page table), restore. */
export const COST_US: Record<Kind, number> = { thread: 2, process: 4 };
export const SLICES_MS = [0.05, 0.1, 0.5, 1, 4, 10];

export type Regs = { pc: string; sp: string; rax: string; table: string };
export const REGS: Record<"A" | "B", Regs> = {
  A: { pc: "0x4011a0", sp: "0x7ffd1230", rax: "42", table: "process 1" },
  B: { pc: "0x401c80", sp: "0x7ffc9a10", rax: "7", table: "process 1" },
};
export const regsB = (k: Kind): Regs => ({ ...REGS.B, table: k === "process" ? "process 2" : "process 1" });

export function overhead(sliceMs: number, kind: Kind) {
  const cost = COST_US[kind];
  const sliceUs = sliceMs * 1000;
  const perSecond = Math.round(1000 / sliceMs);
  return {
    cost,
    perSecond,
    pct: (cost / (sliceUs + cost)) * 100,
    lostMsPerSecond: (perSecond * cost) / 1000,
  };
}

/** A window of A, switch, B, switch, … for the timeline. Times in µs. */
export function timeline(sliceMs: number, kind: Kind, windowMs = 2) {
  const cost = COST_US[kind];
  const out: { who: "A" | "B" | "switch"; from: number; to: number }[] = [];
  let t = 0;
  let who: "A" | "B" = "A";
  const end = windowMs * 1000;
  while (t < end && out.length < 600) {
    const run = Math.min(sliceMs * 1000, end - t);
    out.push({ who, from: t, to: t + run });
    t += run;
    if (t >= end) break;
    out.push({ who: "switch", from: t, to: Math.min(end, t + cost) });
    t += cost;
    who = who === "A" ? "B" : "A";
  }
  return out;
}
