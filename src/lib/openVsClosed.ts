// Hosted API vs open weights on your own GPUs: the monthly bill as traffic grows.
//  - Hosted: you pay per token, so the bill is a straight line in traffic.
//  - Self-hosted: you pay for GPUs by the hour whether or not they are busy. Capacity
//    comes in whole replicas, sized for the peak, so the bill is a staircase, and the
//    utilization (average traffic ÷ peak capacity) decides how much of it you use.
// Prices are typical published rates; throughput is a typical batched-serving figure.

export const HOSTED = [
  { id: "frontier", label: "Frontier API", input: 3, output: 15, quality: 0.9 },
  { id: "mid", label: "Mid-size API", input: 0.4, output: 1.6, quality: 0.82 },
] as const;
export type HostedId = (typeof HOSTED)[number]["id"];

export const OPEN = [
  { id: "open8", label: "Open 8B on 1 GPU", gpus: 1, tps: 2500, quality: 0.74 },
  { id: "open70", label: "Open 70B on 4 GPUs", gpus: 4, tps: 1800, quality: 0.84 },
] as const;
export type OpenId = (typeof OPEN)[number]["id"];

export const GPU_HOUR = 3; // $ per GPU-hour, rented
export const HOURS = 730; // in a month
export const ENGINEER = 4000; // $ a month of someone's time to run it
export const MIN_REPLICAS = 2; // one can be down

export const TOKENS = { input: 700, output: 300 }; // per request
export const VOLUMES = [1_000, 10_000, 100_000, 1_000_000]; // requests a day
export const PEAKS = [2, 5, 10]; // peak traffic ÷ average traffic

export function hostedMonthly(id: HostedId, perDay: number): number {
  const h = HOSTED.find((x) => x.id === id)!;
  return (perDay * 30 * (TOKENS.input * h.input + TOKENS.output * h.output)) / 1e6;
}

export type SelfHosted = { replicas: number; utilization: number; gpuBill: number; total: number; perReplicaTps: number };

export function selfHostedMonthly(id: OpenId, perDay: number, peak: number): SelfHosted {
  const o = OPEN.find((x) => x.id === id)!;
  const avgTps = (perDay * (TOKENS.input + TOKENS.output)) / 86400;
  const peakTps = avgTps * peak;
  const replicas = Math.max(MIN_REPLICAS, Math.ceil(peakTps / o.tps));
  const utilization = Math.min(1, avgTps / (replicas * o.tps));
  const gpuBill = replicas * o.gpus * GPU_HOUR * HOURS;
  return { replicas, utilization, gpuBill, total: gpuBill + ENGINEER, perReplicaTps: o.tps };
}

// The daily volume at which self-hosting becomes cheaper, or null if it never does in range.
export function breakEven(h: HostedId, o: OpenId, peak: number): number | null {
  for (let v = 100; v <= 10_000_000; v = Math.round(v * 1.1)) if (selfHostedMonthly(o, v, peak).total < hostedMonthly(h, v)) return v;
  return null;
}

export type Need = { id: string; label: string; favours: "open" | "hosted"; why: string };

export const NEEDS: Need[] = [
  { id: "residency", label: "Data can't leave our infrastructure", favours: "open", why: "Open weights run wherever you run them; a hosted API sends every prompt to the provider." },
  { id: "pin", label: "Model must not change under us", favours: "open", why: "A file of weights never changes; hosted models are updated and retired on the provider's schedule." },
  { id: "tune", label: "We'll fine-tune heavily", favours: "open", why: "Full control over training, adapters and serving; hosted fine-tuning is limited to what the API offers." },
  { id: "quality", label: "We need the best quality available", favours: "hosted", why: "The strongest models are usually hosted first; open weights follow months later." },
  { id: "team", label: "No one to run GPUs", favours: "hosted", why: "Serving, scaling, upgrades and on-call are the provider's problem." },
  { id: "spiky", label: "Traffic is spiky or tiny", favours: "hosted", why: "Per-token pricing costs nothing when idle; rented GPUs cost the same at 3 a.m." },
];

export const usd = (x: number) => `$${Math.round(x).toLocaleString("en-US")}`;
export const pct = (x: number) => `${Math.round(x * 100)}%`;
