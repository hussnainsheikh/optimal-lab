// Why agents fail: small per-step error rates compound over a long task.
// Every step succeeds with probability p. A step that slips fails in one of four
// ways; each safeguard catches one kind of slip some of the time, and a caught
// slip costs one extra step to redo. Success over n steps is q^n, where q is the
// chance a step ends well, slips that were caught included.

export type FailKind = "tool" | "args" | "drift" | "loop";

export const FAILS: { id: FailKind; label: string; share: number; what: string }[] = [
  { id: "tool", label: "Wrong tool", share: 0.3, what: "Calls search when it should call the booking API." },
  { id: "args", label: "Bad arguments", share: 0.3, what: "Passes a date as “next Friday” or a made-up booking id." },
  { id: "drift", label: "Lost the goal", share: 0.2, what: "After many steps it optimizes for a side detail and forgets the task." },
  { id: "loop", label: "Stuck in a loop", share: 0.2, what: "Repeats the same call, gets the same result, tries again." },
];

export type GuardId = "validate" | "recap" | "loopCap";

export const GUARDS: { id: GuardId; label: string; catches: FailKind[]; rate: number; what: string }[] = [
  {
    id: "validate",
    label: "Validate every tool call",
    catches: ["tool", "args"],
    rate: 0.8,
    what: "Check arguments against the schema and return tool errors to the model as observations, so it can retry.",
  },
  {
    id: "recap",
    label: "Keep a plan and re-read it",
    catches: ["drift"],
    rate: 0.6,
    what: "The agent keeps a short to-do list in its context and checks each step against it.",
  },
  {
    id: "loopCap",
    label: "Loop detector and step cap",
    catches: ["loop"],
    rate: 0.7,
    what: "Spot the same call with the same arguments twice, tell the model, and stop the run at a hard step limit.",
  },
];

export type Guards = Record<GuardId, boolean>;
export const NO_GUARDS: Guards = { validate: false, recap: false, loopCap: false };

export const MAX_STEPS = 40; // the hard cap, and what a loop burns without one

// Chance a slip of this kind is caught and redone.
export function catchRate(kind: FailKind, guards: Guards): number {
  const g = GUARDS.find((x) => x.catches.includes(kind))!;
  return guards[g.id] ? g.rate : 0;
}

// Chance one step ends well: it works, or it slips and the slip is caught.
export function stepOk(p: number, guards: Guards): number {
  return p + (1 - p) * FAILS.reduce((s, f) => s + f.share * catchRate(f.id, guards), 0);
}

export const success = (p: number, n: number, guards: Guards) => stepOk(p, guards) ** n;

export type Cell = "ok" | "caught" | FailKind | "after";
export type Run = { cells: Cell[]; ok: boolean; failedAt: number | null; kind: FailKind | null; stepsUsed: number; burned: number };

function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// One seeded batch of runs. The same random numbers are used whatever the settings,
// so turning a safeguard on changes only the runs it can actually save.
export function simulate(p: number, n: number, guards: Guards, runs = 20): Run[] {
  return Array.from({ length: runs }, (_, r) => {
    const rand = rng(1000 + r * 7919);
    const cells: Cell[] = [];
    let stepsUsed = 0;
    for (let s = 0; s < n; s++) {
      const slip = rand();
      const which = rand();
      const caught = rand();
      stepsUsed++;
      if (slip < p) {
        cells.push("ok");
        continue;
      }
      let acc = 0;
      const kind = FAILS.find((f) => (acc += f.share) > which)?.id ?? "loop";
      if (caught < catchRate(kind, guards)) {
        cells.push("caught");
        stepsUsed++; // redo the step
        continue;
      }
      cells.push(kind);
      // A loop with no cap burns steps until the run is killed from outside;
      // with a detector it is stopped after two repeats.
      const burned = kind !== "loop" ? 0 : guards.loopCap ? 2 : MAX_STEPS - stepsUsed;
      stepsUsed += burned;
      while (cells.length < n) cells.push("after");
      return { cells, ok: false, failedAt: s, kind, stepsUsed, burned };
    }
    return { cells, ok: true, failedAt: null, kind: null, stepsUsed, burned: 0 };
  });
}

export const pct = (x: number) => `${Math.round(x * 100)}%`;
export const STEP_CHOICES = [1, 5, 10, 20, 30];
