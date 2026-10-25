// Threads that do some private work, then update shared data inside a critical section, over
// and over. Simulated microsecond by microsecond on a few cores with a round-robin scheduler,
// so a thread can be preempted at any point, even while it holds the lock.
// - No lock: two threads can be inside at once. Each critical section reads the counter at the
//   start and writes it back +1 at the end, so overlaps lose updates for real.
// - Spinlock: a waiter keeps the core and retries every microsecond. Fast hand-over, but the
//   spinning is wasted CPU, and if the holder is preempted the spinners burn whole time slices.
// - Mutex (futex): a waiter sleeps in the kernel and gives the core away. Unlock wakes one
//   sleeper, which takes a few microseconds to run again and may lose the lock to a thread that
//   just arrived (barging), as with Linux futexes.
// Striping splits one lock into 16, picked per update (like a hash map with a lock per bucket).
// Costs are illustrative, in microseconds; the scheduling and locking are simulated exactly.

export type Kind = "none" | "spin" | "mutex";
export const KINDS: Kind[] = ["none", "spin", "mutex"];
export const KIND_LABEL: Record<Kind, string> = { none: "No lock", spin: "Spinlock", mutex: "Mutex (sleeps)" };

export const DURATION = 4000; // µs simulated
export const QUANTUM = 200; // µs time slice
export const SWITCH = 2; // µs to switch a core to another thread
export const WAKE = 5; // µs from futex wake to runnable
export const STRIPES = 16;
export const TRACE = 600; // µs of timeline kept for the picture

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

type Phase = "work" | "acquire" | "spin" | "sleep" | "waking" | "critical";
// what a thread is doing in one microsecond, for the timeline
export type Cell = "work" | "crit" | "spin" | "sleep" | "ready" | "switch" | "overlap";
export type Seg = { from: number; to: number; cell: Cell };

export type Config = { kind: Kind; threads: number; cores: number; crit: number; work: number; striped: boolean };
export type Result = {
  done: number; // critical sections completed
  perMs: number;
  lost: number; // updates lost to overlap (no lock only)
  cpu: { work: number; crit: number; spin: number; switch: number; idle: number }; // core-µs
  avgWait: number; // µs from wanting the lock to holding it
  maxWait: number;
  switches: number;
  sleeps: number;
  timeline: Seg[][]; // per thread, first TRACE µs
  holderPreempted: number; // µs a lock holder sat off-core while others wanted the lock
};

export function simulate(c: Config, seed = 1): Result {
  const r = rng(seed);
  const T = c.threads;
  const locks = c.striped ? STRIPES : 1;
  const draw = (base: number) => Math.max(1, Math.round(base * (0.6 + 0.8 * r())));
  const phase: Phase[] = Array(T).fill("work");
  const left = Array.from({ length: T }, () => draw(c.work) * (0.2 + r())); // stagger the start
  const want = Array(T).fill(0); // which lock
  const since = Array(T).fill(0); // when it started wanting the lock
  const read = Array(T).fill(0); // counter value read at the start of the critical section
  const owner: (number | null)[] = Array(locks).fill(null);
  const sleepers: number[][] = Array.from({ length: locks }, () => []);
  const counter = Array(locks).fill(0);
  let done = 0, waitSum = 0, maxWait = 0, switches = 0, sleeps = 0, holderPreempted = 0;
  const cpu = { work: 0, crit: 0, spin: 0, switch: 0, idle: 0 };
  // cores: which thread, how long it has had the core, and switch time still to pay
  const core: { t: number | null; used: number; pay: number }[] = Array.from({ length: c.cores }, () => ({ t: null, used: 0, pay: 0 }));
  const queue: number[] = []; // runnable threads without a core, round robin
  const cells: Cell[][] = Array.from({ length: T }, () => []);
  const needsCore = (t: number) => phase[t] === "work" || phase[t] === "acquire" || phase[t] === "spin" || phase[t] === "critical";
  for (let t = 0; t < T; t++) queue.push(t);

  const tryLock = (t: number, now: number) => {
    const l = want[t];
    if (c.kind === "none" || owner[l] === null) {
      if (c.kind !== "none") owner[l] = t;
      const w = now - since[t];
      waitSum += w;
      maxWait = Math.max(maxWait, w);
      phase[t] = "critical";
      left[t] = draw(c.crit);
      read[t] = counter[l];
      return true;
    }
    return false;
  };

  for (let now = 0; now < DURATION; now++) {
    // wakers become runnable
    for (let t = 0; t < T; t++) if (phase[t] === "waking" && --left[t] <= 0) { phase[t] = "acquire"; queue.push(t); }
    // cores give up threads that blocked, or whose slice is over while others wait
    for (const k of core) {
      if (k.t !== null && !needsCore(k.t)) { k.t = null; }
      else if (k.t !== null && k.used >= QUANTUM && queue.length) { queue.push(k.t); k.t = null; }
    }
    for (const k of core) {
      if (k.t === null && queue.length) {
        const t = queue.shift()!;
        if (!needsCore(t)) continue;
        k.t = t; k.used = 0; k.pay = SWITCH; switches++;
      }
    }
    const onCore = new Set(core.map((k) => k.t).filter((t): t is number => t !== null));
    // a lock holder that is off-core while someone else wants that lock
    for (let l = 0; l < locks; l++) {
      const h = owner[l];
      if (h !== null && !onCore.has(h) && (sleepers[l].length || [...onCore].some((t) => phase[t] === "spin" && want[t] === l))) holderPreempted++;
    }
    const inCrit = phase.filter((p) => p === "critical").length;

    for (const k of core) {
      if (k.t === null) { cpu.idle++; continue; }
      const t = k.t;
      k.used++;
      if (k.pay > 0) { k.pay--; cpu.switch++; if (now < TRACE) cells[t][now] = "switch"; continue; }
      if (phase[t] === "work") {
        cpu.work++;
        if (now < TRACE) cells[t][now] = "work";
        if (--left[t] <= 0) { phase[t] = "acquire"; want[t] = c.striped ? Math.floor(r() * STRIPES) : 0; since[t] = now; }
      } else if (phase[t] === "acquire" || phase[t] === "spin") {
        if (tryLock(t, now)) { cpu.crit++; if (now < TRACE) cells[t][now] = "crit"; left[t]--; }
        else if (c.kind === "spin") { phase[t] = "spin"; cpu.spin++; if (now < TRACE) cells[t][now] = "spin"; }
        else { phase[t] = "sleep"; sleepers[want[t]].push(t); sleeps++; cpu.switch++; if (now < TRACE) cells[t][now] = "switch"; }
      } else if (phase[t] === "critical") {
        cpu.crit++;
        if (now < TRACE) cells[t][now] = c.kind === "none" && inCrit > 1 ? "overlap" : "crit";
        if (--left[t] <= 0) {
          const l = want[t];
          counter[l] = read[t] + 1; // write back what was read, plus one
          done++;
          if (c.kind !== "none") {
            owner[l] = null;
            const s = sleepers[l].shift();
            if (s !== undefined) { phase[s] = "waking"; left[s] = WAKE; }
          }
          phase[t] = "work";
          left[t] = draw(c.work);
        }
      }
    }
    if (now < TRACE) for (let t = 0; t < T; t++) if (cells[t][now] === undefined) cells[t][now] = phase[t] === "sleep" ? "sleep" : phase[t] === "waking" ? "ready" : needsCore(t) ? "ready" : "sleep";
  }

  const timeline = cells.map((row) => {
    const segs: Seg[] = [];
    row.forEach((cell, i) => {
      const last = segs[segs.length - 1];
      if (last && last.cell === cell && last.to === i) last.to = i + 1;
      else segs.push({ from: i, to: i + 1, cell });
    });
    return segs;
  });
  const total = counter.reduce((a, b) => a + b, 0);
  return { done, perMs: done / (DURATION / 1000), lost: done - total, cpu, avgWait: done ? waitSum / done : 0, maxWait, switches, sleeps, timeline, holderPreempted };
}

// The most a single lock can ever allow: one critical section at a time.
export const ceilingPerMs = (crit: number) => 1000 / crit;
