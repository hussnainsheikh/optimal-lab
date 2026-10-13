// One server, five client connections whose requests arrive at different times (in ms).
export type Model = "blocking" | "threads" | "epoll";
export const MODELS: { id: Model; label: string }[] = [
  { id: "blocking", label: "One thread, blocking reads" },
  { id: "threads", label: "A thread per connection" },
  { id: "epoll", label: "One thread + epoll" },
];
export const ARRIVE = [60, 10, 20, 80, 30];
export function run(m: Model) {
  let t = 0;
  const rows = ARRIVE.map((a, i) => {
    let served: number;
    if (m === "blocking") { t = Math.max(t, a) + 2; served = t; } else served = a + 2;
    return { conn: i + 1, arrive: a, served, wait: served - a };
  });
  if (m === "epoll") {
    // one thread still handles events one at a time, in arrival order
    let tt = 0;
    [...rows].sort((x, y) => x.arrive - y.arrive).forEach((r) => { tt = Math.max(tt, r.arrive) + 2; r.served = tt; r.wait = tt - r.arrive; });
  }
  const threads = m === "threads" ? ARRIVE.length : 1;
  return { rows, threads, memoryMb: threads * 8, maxWait: Math.max(...rows.map((r) => r.wait)) };
}
