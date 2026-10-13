// A 4-core machine in four situations, as top would show it.
export const CORES = 4;
export type Case = "healthy" | "cpu" | "queue" | "io";
export const CASES: { id: Case; label: string }[] = [
  { id: "healthy", label: "Normal day" },
  { id: "cpu", label: "Busy but OK" },
  { id: "queue", label: "Overloaded CPU" },
  { id: "io", label: "Stuck on disk" },
];
export function snapshot(c: Case) {
  return {
    healthy: { load: [0.8, 0.9, 1.1], us: 18, sy: 4, wa: 1, id: 77, running: 1, blocked: 0, verdict: "Load under 1 on 4 cores: lots of spare capacity.", ok: true },
    cpu: { load: [3.8, 3.6, 3.2], us: 88, sy: 8, wa: 0, id: 4, running: 4, blocked: 0, verdict: "Load ≈ cores: every core busy, nobody waiting long. Fully used but healthy.", ok: true },
    queue: { load: [11.2, 9.5, 6.0], us: 92, sy: 7, wa: 0, id: 0, running: 11, blocked: 0, verdict: "Load ~11 on 4 cores: 7 runnable tasks are queueing for a CPU at any moment. Requests get slower. Add CPU or reduce work.", ok: false },
    io: { load: [9.4, 8.8, 7.1], us: 6, sy: 3, wa: 84, id: 7, running: 1, blocked: 9, verdict: "High load but the CPU is mostly idle! Linux counts tasks blocked on disk I/O (state D) in the load. The disk is the bottleneck.", ok: false },
  }[c];
}
