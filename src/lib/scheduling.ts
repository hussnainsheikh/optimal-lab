// CPU scheduling on one core: four processes, three policies, and what each does to waiting time.

export type Proc = { id: string; arrive: number; burst: number };
export const PROCS: Proc[] = [
  { id: "P1", arrive: 0, burst: 8 },
  { id: "P2", arrive: 1, burst: 4 },
  { id: "P3", arrive: 2, burst: 9 },
  { id: "P4", arrive: 3, burst: 2 },
];

export type Policy = "fcfs" | "sjf" | "rr";
export type Slice = { id: string; from: number; to: number };

export function schedule(policy: Policy, quantum = 2, procs = PROCS) {
  const slices: Slice[] = [];
  const left = new Map(procs.map((p) => [p.id, p.burst]));
  const finish = new Map<string, number>();
  let t = 0;
  if (policy === "rr") {
    const queue: string[] = [];
    const arrived = new Set<string>();
    const admit = (until: number) => {
      for (const p of procs) if (p.arrive <= until && !arrived.has(p.id)) { arrived.add(p.id); queue.push(p.id); }
    };
    admit(0);
    while (finish.size < procs.length) {
      if (!queue.length) { t++; admit(t); continue; }
      const id = queue.shift()!;
      const run = Math.min(quantum, left.get(id)!);
      slices.push({ id, from: t, to: t + run });
      t += run;
      left.set(id, left.get(id)! - run);
      admit(t);
      if (left.get(id)! > 0) queue.push(id);
      else finish.set(id, t);
    }
  } else {
    const pending = [...procs];
    while (pending.length) {
      const ready = pending.filter((p) => p.arrive <= t);
      if (!ready.length) { t = Math.min(...pending.map((p) => p.arrive)); continue; }
      const next = policy === "fcfs" ? ready[0] : ready.reduce((a, b) => (b.burst < a.burst ? b : a));
      slices.push({ id: next.id, from: t, to: t + next.burst });
      t += next.burst;
      finish.set(next.id, t);
      pending.splice(pending.indexOf(next), 1);
    }
  }
  const rows = procs.map((p) => {
    const f = finish.get(p.id)!;
    return { ...p, finish: f, turnaround: f - p.arrive, waiting: f - p.arrive - p.burst };
  });
  const avg = (k: "waiting" | "turnaround") => rows.reduce((s, r) => s + r[k], 0) / rows.length;
  return { slices, rows, avgWait: avg("waiting"), avgTurnaround: avg("turnaround"), switches: slices.length - 1, end: t };
}
