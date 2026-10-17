// One process splits 800 ms of CPU work evenly across T threads and runs them on C cores.
// The scheduler hands out 50 ms time slices, round robin, to at most C threads at a time.

export const WORK_MS = 800;
export const SLICE_MS = 50;
/** glibc's default thread stack on Linux follows `ulimit -s`, usually 8 MB (virtual). */
export const STACK_MB = 8;

export type Tick = {
  t0: number; // start of this slice, ms
  t1: number; // end of this slice, ms
  running: number[]; // thread index per core (-1 = idle core)
  left: number[]; // ms of work left per thread after this slice
};

export function simulate(threads: number, cores: number) {
  const left = Array.from({ length: threads }, () => WORK_MS / threads);
  const ticks: Tick[] = [];
  let t = 0;
  let next = 0; // round-robin pointer
  for (let guard = 0; guard < 1000 && left.some((x) => x > 1e-9); guard++) {
    const running: number[] = [];
    for (let k = 0; k < threads && running.length < cores; k++) {
      const i = (next + k) % threads;
      if (left[i] > 1e-9) running.push(i);
    }
    next = (running[running.length - 1] + 1) % threads;
    const dt = Math.min(SLICE_MS, ...running.map((i) => left[i]));
    running.forEach((i) => (left[i] -= dt));
    ticks.push({ t0: t, t1: t + dt, running: [...running, ...Array<number>(cores - running.length).fill(-1)], left: [...left] });
    t += dt;
  }
  const wall = t;
  return { ticks, wall, speedup: WORK_MS / wall, perThread: WORK_MS / threads, stacksMb: threads * STACK_MB };
}
