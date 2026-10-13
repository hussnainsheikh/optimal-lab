// One service, 20 worker threads. Payments calls start hanging for 10 s; catalog calls take 0.1 s.
export const THREADS = 20, PAY_RATE = 4, CAT_RATE = 20, HANG = 10;
export function run(bulkhead: boolean, seconds = 12) {
  const payPool = bulkhead ? 5 : THREADS, catPool = bulkhead ? 15 : THREADS;
  let busyPay: number[] = []; // finish times
  const ticks = [];
  for (let t = 0; t < seconds; t++) {
    busyPay = busyPay.filter((f) => f > t);
    let payRejected = 0;
    for (let i = 0; i < PAY_RATE; i++) {
      const used = busyPay.length;
      if (used < payPool && (bulkhead || used < THREADS)) { busyPay.push(t + HANG); } else payRejected++;
    }
    const free = bulkhead ? catPool : THREADS - busyPay.length;
    const catServed = Math.min(CAT_RATE, free * 10); // each free thread serves 10 fast calls a second
    ticks.push({ t, payThreads: busyPay.length, catServed, catFailed: CAT_RATE - catServed, payRejected });
  }
  return { ticks, catFailed: ticks.reduce((a, x) => a + x.catFailed, 0), payPool, catPool };
}
