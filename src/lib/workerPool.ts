// A fixed pool of worker threads pulling tasks from a queue, on a machine with a few cores.
// Tasks arrive at random (Poisson) for 5 seconds. Each needs some CPU time, then waits on I/O
// (a database or an API) without using a core. Threads in their CPU part share the cores
// equally; past the core count, each extra runnable thread adds a little switching overhead.
// A full queue rejects new tasks. "A thread per task" creates a thread for every task instead,
// with no queue and no limit. Simulated millisecond by millisecond; the switching overhead,
// thread memory and creation cost are illustrative.

export const CORES = 4;
export const DURATION = 5000; // ms of arrivals
export const STACK_MB = 1; // resident memory per thread (illustrative; 8 MB is reserved on Linux)
const CREATE_MS = 0.1; // CPU to create a thread
const SWITCH_COST = 0.003; // lost per extra runnable thread past the cores
export const MAX_THREADS = 1000; // 1 GB of thread stacks: past this, creating a thread fails

export type Workload = "cpu" | "io";
export const WORKLOAD: Record<Workload, { label: string; cpu: number; io: number; blurb: string }> = {
  cpu: { label: "CPU-bound (resize images)", cpu: 20, io: 0, blurb: "Each task computes for 20 ms and never waits." },
  io: { label: "I/O-bound (call an API)", cpu: 5, io: 45, blurb: "Each task computes for 5 ms, then waits 45 ms for an API." },
};

export const POOL_SIZES = [1, 2, 4, 8, 16, 32, 64, 128];
export const UNLIMITED = 0; // pool size meaning "a thread per task"

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Goetz's rule for a pool that keeps every core busy: cores × (1 + wait / compute)
export const suggested = (w: Workload) => Math.round(CORES * (1 + WORKLOAD[w].io / WORKLOAD[w].cpu));
export const capacityPerSec = (w: Workload) => (CORES * 1000) / WORKLOAD[w].cpu; // CPU limit

export type Config = { workload: Workload; rate: number; pool: number; queue: number }; // queue: max waiting (Infinity = unbounded)
export type Result = {
  arrived: number; done: number; rejected: number; unfinished: number;
  crashedAt: number | null; // a thread per task: ms when thread stacks ran out of memory
  p50: number; p99: number; perSec: number;
  cpuUse: number; // share of core time doing useful work
  peakQueue: number; peakThreads: number; memMB: number;
};

type Task = { arrive: number; cpu: number; io: number; end: number };

export function simulate(c: Config, seed = 11): Result {
  const r = rng(seed);
  const W = WORKLOAD[c.workload];
  const unlimited = c.pool === UNLIMITED;
  const arrivals: number[] = [];
  for (let t = -Math.log(1 - r()) * (1000 / c.rate); t < DURATION; t += -Math.log(1 - r()) * (1000 / c.rate)) arrivals.push(t);

  const tasks: Task[] = [];
  let workers: Task[] = []; // tasks being run, one per busy thread
  const queue: Task[] = [];
  let qHead = 0;
  let rejected = 0, useful = 0, peakQueue = 0, peakThreads = unlimited ? 0 : c.pool;
  let crashedAt: number | null = null;
  let next = 0;
  let now = 0;
  const end = DURATION + 3000; // let the backlog drain a little

  for (; now < end; now++) {
    while (next < arrivals.length && arrivals[next] < now + 1) {
      const task: Task = { arrive: arrivals[next++], cpu: W.cpu, io: W.io, end: -1 };
      tasks.push(task);
      if (unlimited) { task.cpu += CREATE_MS; workers.push(task); }
      else if (workers.length < c.pool) workers.push(task);
      else if (queue.length - qHead < c.queue) queue.push(task);
      else { rejected++; task.end = -2; }
    }
    if (unlimited && workers.length > MAX_THREADS) { crashedAt = now; break; }
    let n = 0;
    for (const t of workers) if (t.cpu > 0) n++;
    const share = n ? Math.min(1, CORES / n) / (1 + SWITCH_COST * Math.max(0, n - CORES)) : 0;
    useful += share * n;
    const still: Task[] = [];
    for (const t of workers) {
      if (t.cpu > 0) t.cpu = Math.max(0, t.cpu - share);
      else t.io -= 1;
      if (t.cpu <= 1e-9 && t.io <= 0) {
        t.end = now + 1;
        if (!unlimited && qHead < queue.length) still.push(queue[qHead++]); // the freed thread takes the next task
      } else still.push(t);
    }
    workers = still;
    peakQueue = Math.max(peakQueue, queue.length - qHead);
    peakThreads = Math.max(peakThreads, workers.length);
    if (now >= DURATION && next >= arrivals.length && !workers.length && qHead >= queue.length) { now++; break; }
  }

  const fin = tasks.filter((t) => t.end >= 0).map((t) => t.end - t.arrive).sort((a, b) => a - b);
  const q = (p: number) => (fin.length ? fin[Math.min(fin.length - 1, Math.ceil(p * fin.length) - 1)] : 0);
  return {
    arrived: tasks.length,
    done: fin.length,
    rejected,
    unfinished: tasks.length - fin.length - rejected,
    crashedAt,
    p50: q(0.5),
    p99: q(0.99),
    perSec: fin.length / (Math.max(now, 1) / 1000),
    cpuUse: useful / (CORES * Math.max(now, 1)),
    peakQueue,
    peakThreads,
    memMB: peakThreads * STACK_MB,
  };
}

export const sweep = (w: Workload, rate: number, queue: number) => POOL_SIZES.map((pool) => ({ pool, ...simulate({ workload: w, rate, pool, queue }) }));
