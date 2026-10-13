// Blocking the event loop. Node runs your JavaScript on one main thread. A request that does
// 200 ms of CPU work holds that thread, and every other request waits behind it, even ones
// that need 2 ms. Moving the heavy work to a worker thread frees the main thread.

export type Mode = "main" | "worker";
export type Req = { id: number; kind: "fast" | "report"; arrive: number; cpu: number };

export const REQUESTS: Req[] = [
  ...Array.from({ length: 10 }, (_, i) => ({ id: i + 1, kind: "fast" as const, arrive: i * 20, cpu: 2 })),
  { id: 11, kind: "report" as const, arrive: 15, cpu: 200 },
].sort((a, b) => a.arrive - b.arrive || a.id - b.id);

export type Done = Req & { start: number; finish: number; latency: number };
export type Slice = { lane: "main" | "worker"; from: number; to: number; req: Req };

export function simulate(mode: Mode) {
  let mainFree = 0;
  const done: Done[] = [];
  const slices: Slice[] = [];
  for (const r of REQUESTS) {
    const start = Math.max(r.arrive, mainFree);
    if (r.kind === "report" && mode === "worker") {
      // 1 ms on the main thread to hand off; the worker does the 200 ms; the reply comes back.
      mainFree = start + 1;
      slices.push({ lane: "main", from: start, to: start + 1, req: r });
      slices.push({ lane: "worker", from: start + 1, to: start + 1 + r.cpu, req: r });
      const finish = start + 1 + r.cpu + 1;
      done.push({ ...r, start, finish, latency: finish - r.arrive });
    } else {
      mainFree = start + r.cpu;
      slices.push({ lane: "main", from: start, to: mainFree, req: r });
      done.push({ ...r, start, finish: mainFree, latency: mainFree - r.arrive });
    }
  }
  const fast = done.filter((d) => d.kind === "fast").map((d) => d.latency);
  return { done, slices, worstFast: Math.max(...fast), avgFast: fast.reduce((a, b) => a + b, 0) / fast.length, end: Math.max(...done.map((d) => d.finish)) };
}
