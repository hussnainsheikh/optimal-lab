// Three ways to serve many connections that mostly wait: an OS thread per connection, an async
// event loop per core, and lightweight (green) threads scheduled by the runtime, like goroutines
// or Java's virtual threads. Connections are mostly idle, like a chat app: each sends a message
// every 30 s, which computes for 0.1 ms and waits 100 ms on a database. The cost model gives
// memory and switching overhead by connection count. The stall simulation runs one core: light requests every 5 ms, and one
// handler that computes for 200 ms. Cooperative scheduling (an event loop) runs each handler
// until it yields; preemptive scheduling (OS threads, goroutines) slices the core every 4 ms.
// Per-connection memory and switch costs are illustrative orders of magnitude.

export type Model = "threads" | "async" | "green";
export const MODELS: Model[] = ["threads", "async", "green"];
export const MODEL_LABEL: Record<Model, string> = { threads: "Thread per connection", async: "Async event loop", green: "Green threads" };

export const CORES = 8;
export const RAM_GB = 16;
export const BASE_GB = 1; // the process, before any connections
export const PER_CONN_KB: Record<Model, number> = { threads: 128, async: 6, green: 12 }; // stack and kernel structures / task state and buffers / small growable stack
export const SWITCH_US: Record<Model, number> = { threads: 3, async: 0.2, green: 0.3 }; // kernel context switch vs a function returning to the loop vs a runtime switch
export const SWITCHES_PER_REQ = 2; // park on the database call, resume when it answers
export const CPU_MS = 0.1;
export const EVERY_S = 30;
export const WAIT_MS = 100;
export const PREEMPTIVE: Record<Model, boolean> = { threads: true, async: false, green: true };

export function cost(model: Model, conns: number) {
  const memGB = BASE_GB + (conns * PER_CONN_KB[model]) / (1024 * 1024);
  const perSec = conns / EVERY_S;
  const switchCoreSec = (perSec * SWITCHES_PER_REQ * SWITCH_US[model]) / 1e6; // core-seconds per second
  const workCoreSec = (perSec * CPU_MS) / 1000;
  const cpuShare = (switchCoreSec + workCoreSec) / CORES;
  const maxConns = Math.floor(((RAM_GB - BASE_GB) * 1024 * 1024) / PER_CONN_KB[model]);
  return { memGB, fits: memGB <= RAM_GB, perSec, switchShare: switchCoreSec / CORES, cpuShare, maxConns, overloaded: cpuShare > 1 };
}

// One core: light requests (1 ms of CPU) every 5 ms for 400 ms, and a heavy one (200 ms of CPU)
// arriving at 50 ms. Returns each light request's latency.
export const SLICE = 4;
export type Job = { id: number; arrive: number; need: number; heavy: boolean; done: number };

export function stall(preemptive: boolean, heavy = true) {
  const jobs: Job[] = [];
  for (let t = 0, id = 0; t < 400; t += 5) jobs.push({ id: id++, arrive: t, need: 1, heavy: false, done: -1 });
  if (heavy) jobs.push({ id: 999, arrive: 50, need: 200, heavy: true, done: -1 });
  jobs.sort((a, b) => a.arrive - b.arrive);
  const left = new Map(jobs.map((j) => [j, j.need]));
  const queue: Job[] = [];
  let next = 0;
  let cur: Job | null = null;
  let slice = 0;
  for (let now = 0; now < 2000 && (next < jobs.length || queue.length || cur); now++) {
    while (next < jobs.length && jobs[next].arrive <= now) queue.push(jobs[next++]);
    if (cur && preemptive && slice >= SLICE && queue.length) { queue.push(cur); cur = null; }
    if (!cur && queue.length) { cur = queue.shift()!; slice = 0; }
    if (!cur) continue;
    left.set(cur, left.get(cur)! - 1);
    slice++;
    if (left.get(cur)! <= 0) { cur.done = now + 1; cur = null; }
  }
  const light = jobs.filter((j) => !j.heavy).map((j) => j.done - j.arrive).sort((a, b) => a - b);
  const q = (p: number) => light[Math.min(light.length - 1, Math.ceil(p * light.length) - 1)];
  const heavyJob = jobs.find((j) => j.heavy);
  return { p50: q(0.5), p99: q(0.99), max: light[light.length - 1], heavyDone: heavyJob ? heavyJob.done - heavyJob.arrive : 0, delayed: light.filter((l) => l > 10).length, total: light.length };
}

export const CONN_STEPS = [100, 1_000, 10_000, 50_000, 100_000, 250_000, 1_000_000];
