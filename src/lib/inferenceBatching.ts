// One GPU serving a chat model. Each decode step generates one token for every
// sequence in the batch; a step takes longer with more sequences, but not much,
// because decoding is limited by reading the weights from memory. Requests arrive
// at a steady rate with different answer lengths. No batching, static batching and
// continuous batching are simulated step by step; throughput, latency and how much
// of each batch is padding are measured from the simulation.

export const STEP_BASE_MS = 25; // reading the weights once
export const STEP_PER_SEQ_MS = 0.6; // extra per sequence in the batch
export const MAX_BATCH = 32;
export const LENGTHS = [40, 120, 300, 60, 200, 500, 80, 150, 40, 260]; // output tokens, cycled through the arrivals
export const SIM_SECONDS = 60;

export type Mode = "none" | "static" | "continuous";
export const MODES: { id: Mode; label: string; one: string }[] = [
  { id: "none", label: "One at a time", one: "Finish one request before starting the next." },
  { id: "static", label: "Static batches", one: "Wait for up to 32 requests (or 200 ms), run them together until the longest one finishes, then take the next batch." },
  { id: "continuous", label: "Continuous batching", one: "Every step, finished sequences leave and waiting ones join, up to 32 at a time." },
];
export const RATES = [0.5, 2, 4]; // requests a second
const STATIC_WAIT_MS = 200;

export type Result = {
  completed: number;
  tokensPerSec: number;
  p50: number; // seconds from arrival to last token
  p95: number;
  avgBatch: number;
  paddingShare: number; // slots in a step spent on sequences that already finished (static) or empty
  queueAtEnd: number;
  stepMs: number;
};

type Req = { arrive: number; len: number; done?: number; left: number };

export function simulate(mode: Mode, rate: number): Result {
  const reqs: Req[] = [];
  const n = Math.floor(rate * SIM_SECONDS);
  for (let i = 0; i < n; i++) reqs.push({ arrive: (i / rate) * 1000, len: LENGTHS[i % LENGTHS.length], left: LENGTHS[i % LENGTHS.length] });
  let t = 0;
  let next = 0; // next request not yet admitted
  const queue: Req[] = [];
  let active: Req[] = [];
  let steps = 0;
  let batchSum = 0;
  let slotSteps = 0;
  let usefulSteps = 0;
  let tokens = 0;
  const end = SIM_SECONDS * 1000;
  const cap = mode === "none" ? 1 : MAX_BATCH;
  let staticBatchStart = 0;

  while (t < end) {
    while (next < reqs.length && reqs[next].arrive <= t) queue.push(reqs[next++]);
    if (mode === "continuous" || mode === "none") {
      while (active.length < cap && queue.length) active.push(queue.shift()!);
    } else if (active.length === 0 && queue.length) {
      // static: start a batch when full or when the oldest has waited long enough
      if (queue.length >= cap || t - queue[0].arrive >= STATIC_WAIT_MS) {
        active = queue.splice(0, cap);
        staticBatchStart = t;
      }
    }
    if (active.length === 0) {
      t = next < reqs.length ? Math.max(t + 1, Math.min(reqs[next].arrive, mode === "static" && queue.length ? queue[0].arrive + STATIC_WAIT_MS : Infinity)) : end;
      continue;
    }
    // one decode step
    const live = active.filter((r) => r.left > 0);
    const slots = mode === "static" ? active.length : live.length; // static keeps finished sequences in the batch as padding
    const stepMs = STEP_BASE_MS + STEP_PER_SEQ_MS * slots;
    t += stepMs;
    steps++;
    batchSum += live.length;
    slotSteps += slots;
    usefulSteps += live.length;
    for (const r of live) {
      r.left--;
      tokens++;
      if (r.left === 0) r.done = t;
    }
    if (mode === "static") {
      if (active.every((r) => r.left === 0)) active = [];
    } else active = active.filter((r) => r.left > 0);
    void staticBatchStart;
  }
  const done = reqs.filter((r) => r.done !== undefined).map((r) => (r.done! - r.arrive) / 1000).sort((a, b) => a - b);
  const pct = (p: number) => (done.length ? done[Math.min(done.length - 1, Math.floor(p * done.length))] : 0);
  return {
    completed: done.length,
    tokensPerSec: tokens / SIM_SECONDS,
    p50: pct(0.5),
    p95: pct(0.95),
    avgBatch: steps ? batchSum / steps : 0,
    paddingShare: slotSteps ? 1 - usefulSteps / slotSteps : 0,
    queueAtEnd: queue.length + reqs.length - next,
    stepMs: STEP_BASE_MS + STEP_PER_SEQ_MS * (steps ? slotSteps / steps : 1),
  };
}

export const MAX_TOKENS_PER_SEC = (MAX_BATCH * 1000) / (STEP_BASE_MS + STEP_PER_SEQ_MS * MAX_BATCH);
