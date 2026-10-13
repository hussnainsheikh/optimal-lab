// Retry policies against different kinds of failure.
export type Failure = "transient" | "rate-limit" | "bad-request";
export type Policy = "none" | "immediate" | "backoff";
export const FAILURES: { id: Failure; label: string }[] = [
  { id: "transient", label: "503: server hiccup" },
  { id: "rate-limit", label: "429: rate limited" },
  { id: "bad-request", label: "400: bad input" },
];
export const POLICIES: { id: Policy; label: string }[] = [
  { id: "none", label: "No retries" },
  { id: "immediate", label: "Retry 5× immediately" },
  { id: "backoff", label: "Backoff + jitter, transient only" },
];

// Deterministic "jitter" so the demo doesn't change on every render.
const JITTER = [0.3, 0.8, 0.5, 0.1, 0.9, 0.6];

export function simulate(f: Failure, p: Policy) {
  const attempts: { t: number; ok: boolean; code: number }[] = [];
  let t = 0;
  const max = p === "none" ? 1 : 6;
  for (let i = 0; i < max; i++) {
    let ok = false;
    let code = 0;
    if (f === "transient") { ok = t >= 2.5; code = ok ? 200 : 503; }
    if (f === "rate-limit") { ok = t >= 10; code = ok ? 200 : 429; }
    if (f === "bad-request") { ok = false; code = 400; }
    attempts.push({ t: Math.round(t * 10) / 10, ok, code });
    if (ok) break;
    if (p === "backoff" && f === "bad-request") break;
    if (p === "immediate") t += 0.05;
    if (p === "backoff") t += f === "rate-limit" ? Math.max(10 - t, 1) : 2 ** i * (0.5 + JITTER[i]);
  }
  const last = attempts[attempts.length - 1];
  const outcome = last.ok ? "succeeded" : f === "bad-request" ? "failed: alert a human" : "gave up";
  return { attempts, ok: last.ok, outcome, wasted: attempts.filter((a) => !a.ok).length - (last.ok ? 0 : 1) };
}
