// Container requests and limits. Memory over the limit gets the container killed (OOMKilled);
// CPU over the limit gets it slowed down (throttled), never killed.

export function memory(limitMi: number) {
  // usage grows 40 MiB per minute from 200 MiB (a slow leak)
  const points: { min: number; used: number; killed: boolean }[] = [];
  let restarts = 0;
  let base = 0;
  for (let m = 0; m <= 30; m++) {
    const used = 200 + (m - base) * 40;
    const killed = used > limitMi;
    if (killed) { restarts++; base = m; }
    points.push({ min: m, used: killed ? limitMi : used, killed });
  }
  return { points, restarts };
}

export function cpu(limitCores: number) {
  // a request needs 0.8 CPU-seconds of work; with a limit of L cores it takes 0.8 / min(L, 2) s
  const work = 0.8;
  const cores = Math.min(limitCores, 2);
  return { seconds: work / cores, throttled: limitCores < 2 };
}
