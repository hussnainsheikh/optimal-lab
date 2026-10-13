// N = 3 replicas. A write waits for W acks; a read asks R replicas and takes the newest version.
export const N = 3;
export const LAGS = [0, 40, 400]; // ms until each replica has applied the write
export function run(W: number, R: number, readAt: number) {
  const has = LAGS.map((l) => readAt >= l);
  // worst case: the read contacts the R replicas most likely to be stale (slowest first)
  const order = [2, 1, 0];
  const asked = order.slice(0, R);
  const sees = asked.some((i) => has[i]);
  const ackAt = [...LAGS].sort((a, b) => a - b)[W - 1];
  return { has, asked, sees, ackAt, overlap: R + W > N };
}
