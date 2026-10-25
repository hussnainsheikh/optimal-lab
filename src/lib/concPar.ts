// Concurrency is dealing with many tasks at once (switching to another while one waits);
// parallelism is doing several at the same instant (more cores). Four tasks, scheduled
// millisecond by millisecond on 1 to 4 cores, with or without switching on a wait:
// - without concurrency a core runs one task start to finish and sits idle while it waits;
// - with it, a core picks up another ready task whenever the current one waits on I/O.
// Then Amdahl's law: if a fraction of the work can't be split, extra cores stop helping.

export type Workload = "io" | "cpu";
export const WORKLOAD: Record<Workload, { label: string; phases: { cpu: boolean; ms: number }[]; blurb: string }> = {
  io: { label: "Fetch and process", phases: [{ cpu: true, ms: 20 }, { cpu: false, ms: 60 }, { cpu: true, ms: 20 }], blurb: "Each task computes 20 ms, waits 60 ms for the network, computes 20 ms more." },
  cpu: { label: "Pure computation", phases: [{ cpu: true, ms: 100 }], blurb: "Each task computes for 100 ms and never waits." },
};
export const TASKS = 4;

export type Seg = { from: number; to: number; task: number; what: "cpu" | "wait" | "idle" };
export type Result = { cores: Seg[][]; waits: { task: number; from: number; to: number }[]; makespan: number; busy: number; done: number[] };

export function schedule(w: Workload, cores: number, concurrent: boolean): Result {
  const phases = WORKLOAD[w].phases;
  const phase = Array(TASKS).fill(0);
  const left = Array.from({ length: TASKS }, () => phases[0].ms);
  const state: ("ready" | "running" | "waiting" | "done")[] = Array(TASKS).fill("ready");
  const owner: (number | null)[] = Array(TASKS).fill(null); // without concurrency a task keeps its core while it waits
  const on: (number | null)[] = Array(cores).fill(null);
  const cells: { task: number; what: Seg["what"] }[][] = Array.from({ length: cores }, () => []);
  const waitCells: number[][] = Array.from({ length: TASKS }, () => []);
  const done = Array(TASKS).fill(0);
  const entered = Array(TASKS).fill(-1);
  let busy = 0, now = 0;

  const advance = (t: number) => {
    phase[t]++;
    if (phase[t] >= phases.length) { state[t] = "done"; done[t] = now + 1; return; }
    left[t] = phases[phase[t]].ms;
    state[t] = phases[phase[t]].cpu ? "ready" : "waiting";
    entered[t] = now;
  };

  for (; now < 5000 && state.some((s) => s !== "done"); now++) {
    // give free cores a task: with concurrency any ready task; without, only unclaimed ones
    for (let c = 0; c < cores; c++) {
      if (on[c] !== null) continue;
      const mine = owner.findIndex((o, i) => o === c && state[i] !== "done");
      if (!concurrent && mine >= 0 && state[mine] !== "ready") continue; // its task is waiting: the core waits too
      const t = !concurrent && mine >= 0 ? mine : state.findIndex((s, i) => s === "ready" && (concurrent || owner[i] === null));
      if (t >= 0) { on[c] = t; state[t] = "running"; if (!concurrent) owner[t] = c; }
    }
    for (let c = 0; c < cores; c++) {
      const t = on[c];
      if (t === null) {
        // without concurrency, a core whose task is waiting just sits there
        const mine = owner.findIndex((o, i) => o === c && state[i] === "waiting");
        cells[c][now] = mine >= 0 ? { task: mine, what: "wait" } : { task: -1, what: "idle" };
        continue;
      }
      cells[c][now] = { task: t, what: "cpu" };
      busy++;
      if (--left[t] <= 0) { on[c] = null; advance(t); }
    }
    for (let t = 0; t < TASKS; t++) {
      if (state[t] !== "waiting" || entered[t] === now) continue; // a wait starts on the next tick
      waitCells[t][now] = 1;
      if (--left[t] <= 0) advance(t);
    }
    // without concurrency the owning core is reserved: release it only when the task is done
    if (!concurrent) for (let t = 0; t < TASKS; t++) if (state[t] === "done" && owner[t] !== null) owner[t] = null;
  }

  const runs = <T,>(row: (T | undefined)[], key: (x: T) => string) => {
    const out: { from: number; to: number; v: T }[] = [];
    row.forEach((x, i) => {
      if (x === undefined) return;
      const last = out[out.length - 1];
      if (last && last.to === i && key(last.v) === key(x)) last.to = i + 1;
      else out.push({ from: i, to: i + 1, v: x });
    });
    return out;
  };
  return {
    cores: cells.map((row) => runs(row, (x) => `${x.task}${x.what}`).map((r) => ({ from: r.from, to: r.to, task: r.v.task, what: r.v.what }))),
    waits: waitCells.flatMap((row, task) => runs(row, () => "w").map((r) => ({ task, from: r.from, to: r.to }))),
    makespan: now,
    busy: busy / (cores * now),
    done,
  };
}

// Amdahl's law: speedup on n cores when a fraction p of the work runs in parallel.
export const amdahl = (p: number, n: number) => 1 / (1 - p + p / n);
