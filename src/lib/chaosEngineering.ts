// A shop: a load balancer, three app instances (one per zone), a Redis cache, a
// Postgres primary, and a recommendations service on the product page. Three weak
// spots hide in it. Run an experiment, inject a fault into part of the traffic, and
// the error rate second by second shows whether the steady state held. An abort
// rule stops the experiment when the cohort's errors pass a threshold.

export type FaultId = "instance" | "latency" | "cache";
export type FixId = "fastHealth" | "timeout" | "replica";

export const FAULTS: { id: FaultId; label: string; does: string; hypothesis: string }[] = [
  { id: "instance", label: "Kill one app instance", does: "Terminate the instance in zone a.", hypothesis: "The load balancer stops sending to it and the other two carry the load." },
  { id: "latency", label: "Slow recommendations by 2 s", does: "Add 2 seconds to every call to the recommendations service.", hypothesis: "Product pages load without recommendations; nothing else changes." },
  { id: "cache", label: "Kill the cache node", does: "Stop the Redis node.", hypothesis: "Reads fall through to Postgres for a moment; errors stay under 0.5%." },
];

export const FIXES: { id: FixId; label: string; for: FaultId; text: string }[] = [
  { id: "fastHealth", label: "5 s health checks and a retry on another instance", for: "instance", text: "The load balancer retries a failed request on a healthy instance, and pulls the dead one in 5 s instead of 30." },
  { id: "timeout", label: "300 ms timeout and a fallback on recommendations", for: "latency", text: "A slow dependency costs 300 ms and an empty carousel, not a thread." },
  { id: "replica", label: "A Redis replica with automatic failover", for: "cache", text: "A replica is promoted in about 10 s, already warm." },
];

export const RPS = 1000;
export const DURATION = 90; // seconds shown
export const FAULT_START = 10;
export const FAULT_END = 70;
export const STEADY_ERROR = 0.002; // 0.2%: the steady state
export const SLO_ERROR = 0.005; // the hypothesis: stay under 0.5%
export const ABORT_ERROR = 0.05; // stop if the cohort's errors pass 5%…
export const ABORT_SECONDS = 5; // …for this many seconds in a row
export const BLASTS = [0.01, 0.1, 1];

export type Settings = { fault: FaultId; blast: number; abort: boolean; fixes: Record<FixId, boolean> };
export const START: Settings = { fault: "instance", blast: 0.1, abort: true, fixes: { fastHealth: false, timeout: false, replica: false } };

// Error rate inside the experiment cohort, t seconds after the fault started.
function cohortError(fault: FaultId, t: number, fixes: Record<FixId, boolean>): number {
  if (fault === "instance") {
    if (fixes.fastHealth) return t < 5 ? 0.003 : 0; // retried on a healthy instance; a few non-retryable requests fail
    return t < 30 ? 1 / 3 : 0; // a third of requests land on the dead instance until it's pulled
  }
  if (fault === "latency") {
    if (fixes.timeout) return 0;
    // Each slow call holds a worker thread for 2 s; the pool fills in about 8 s and requests queue and fail.
    return Math.min(0.6, Math.max(0, (t - 3) * 0.08));
  }
  if (fixes.replica) return t < 10 ? 0.004 : 0; // the replica serves reads while it is promoted
  // Cold reads stampede Postgres; it saturates and stays saturated while the cache is down.
  return t < 5 ? 0.1 : 0.4;
}

export type Second = { t: number; error: number; cohort: number; inFault: boolean };
export type Run = { seconds: Second[]; abortedAt: number | null; failed: number; held: boolean; peakCohort: number; verdict: string };

export function run(s: Settings): Run {
  const seconds: Second[] = [];
  let abortedAt: number | null = null;
  let streak = 0;
  let failed = 0;
  let peakCohort = 0;
  for (let t = 0; t <= DURATION; t++) {
    const inFault = t >= FAULT_START && t < FAULT_END && abortedAt === null;
    const cohort = inFault ? cohortError(s.fault, t - FAULT_START, s.fixes) : 0;
    peakCohort = Math.max(peakCohort, cohort);
    const error = STEADY_ERROR + s.blast * cohort;
    failed += RPS * s.blast * cohort;
    seconds.push({ t, error, cohort, inFault });
    if (inFault && s.abort) {
      streak = cohort > ABORT_ERROR ? streak + 1 : 0;
      if (streak >= ABORT_SECONDS) abortedAt = t + 1;
    }
  }
  const held = peakCohort <= SLO_ERROR;
  const fix = FIXES.find((f) => f.for === s.fault)!;
  const verdict = held
    ? "The hypothesis held: the steady state survived the fault. Widen the blast radius, or try the next fault."
    : abortedAt !== null
      ? `The hypothesis was wrong, and the abort rule stopped the experiment at ${abortedAt} s. That's a finding: ${fix.label.toLowerCase()}.`
      : `The hypothesis was wrong and nothing stopped it: ${Math.round(failed).toLocaleString("en-US")} requests failed. Add an abort rule, and ${fix.label.toLowerCase()}.`;
  return { seconds, abortedAt, failed, held, peakCohort, verdict };
}

export const pct = (v: number) => `${(v * 100).toFixed(v < 0.01 ? 1 : 0)}%`;
