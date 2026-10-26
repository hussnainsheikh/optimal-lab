// A counting semaphore in front of a backend that slows down when it's crowded. A burst of jobs
// arrives at once; each calls wait() (P) before using the backend and signal() (V) after. With
// N permits, at most N jobs are inside; the rest queue in FIFO order.
// The backend's total throughput with n jobs inside follows the Universal Scalability Law
// (Gunther): X(n) = n / (1 + σ(n−1) + κ·n(n−1)) jobs per service time. σ is contention (a shared
// lock or disk), κ is coherency (everyone coordinating with everyone). Up to a point more jobs
// help; past it they get in each other's way and the whole backend does less. Each job inside
// gets an equal share. σ, κ and the 40 ms service time are illustrative; the semaphore,
// the queue and the timing are simulated exactly.

export const SERVICE_MS = 40; // one job alone
export const SIGMA = 0.05;
export const KAPPA = 0.015;
export const JOBS = 48;
export const TIMEOUT_MS = 600; // a caller gives up after this long

export const throughput = (n: number) => (n <= 0 ? 0 : n / (1 + SIGMA * (n - 1) + KAPPA * n * (n - 1))); // relative to one job alone
export const bestN = () => Math.round(Math.sqrt((1 - SIGMA) / KAPPA));

export type Job = { id: number; start: number; end: number; wait: number; timedOut: boolean };
export type Event = { t: number; job: number; kind: "P ok" | "P blocks" | "V" | "V wakes"; count: number; queued: number; woke?: number };
export type Result = { jobs: Job[]; events: Event[]; makespan: number; p50: number; p95: number; timedOut: number; peakInside: number };

export function run(permits: number, jobs = JOBS): Result {
  let count = permits;
  const queue: number[] = [];
  const left = new Map<number, number>(); // job -> work left (1 = a whole job)
  const start = Array(jobs).fill(0);
  const end = Array(jobs).fill(0);
  const events: Event[] = [];
  let now = 0;
  let peakInside = 0;

  for (let j = 0; j < jobs; j++) {
    if (count > 0) {
      count--;
      left.set(j, 1);
      start[j] = 0;
      events.push({ t: 0, job: j, kind: "P ok", count, queued: queue.length });
    } else {
      queue.push(j);
      events.push({ t: 0, job: j, kind: "P blocks", count, queued: queue.length });
    }
  }

  while (left.size) {
    peakInside = Math.max(peakInside, left.size);
    const n = left.size;
    const each = throughput(n) / n / SERVICE_MS; // work per ms for each job inside
    const next = Math.min(...left.values()) / each;
    now += next;
    const finished: number[] = [];
    for (const [j, w] of left) {
      const rest = w - each * next;
      if (rest <= 1e-9) finished.push(j);
      else left.set(j, rest);
    }
    for (const j of finished) {
      left.delete(j);
      end[j] = now;
      const w = queue.shift();
      if (w !== undefined) {
        left.set(w, 1);
        start[w] = now;
        events.push({ t: now, job: j, kind: "V wakes", count, queued: queue.length, woke: w });
      } else {
        count++;
        events.push({ t: now, job: j, kind: "V", count, queued: queue.length });
      }
    }
  }

  const out: Job[] = start.map((s, id) => ({ id, start: s, end: end[id], wait: s, timedOut: end[id] > TIMEOUT_MS }));
  const lat = out.map((j) => j.end).sort((a, b) => a - b);
  const q = (p: number) => lat[Math.min(lat.length - 1, Math.ceil(p * lat.length) - 1)];
  return { jobs: out, events, makespan: now, p50: q(0.5), p95: q(0.95), timedOut: out.filter((j) => j.timedOut).length, peakInside };
}

export const PERMIT_CHOICES = [1, 2, 4, 8, 12, 16, 24, 48];
export const sweep = (jobs = JOBS) => PERMIT_CHOICES.map((p) => ({ permits: p, ...run(p, jobs) }));
