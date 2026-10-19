// An app calls an LLM provider with a limit of 400,000 tokens a minute. Traffic is
// steady, then a ten-minute burst from a marketing email. Each request uses ~2,000
// tokens. Minute by minute, the simulation counts requests sent, rejected with 429,
// retried, queued, served by a fallback, and dropped, under each strategy.

export const TPM = 400_000;
export const TOKENS_PER_REQ = 2000;
export const PER_MIN_CAPACITY = TPM / TOKENS_PER_REQ; // 200 requests a minute
export const MINUTES = 20;
export const BASE = 150; // requests a minute
export const BURST = 420; // during the burst
export const BURST_FROM = 5;
export const BURST_TO = 15;
export const BACKGROUND_SHARE = 0.4; // of traffic: summaries and tagging that can wait
export const FALLBACK_CAPACITY = 150; // requests a minute a second provider/region can take
export const MAX_QUEUE_WAIT = 5; // minutes interactive users will wait before giving up

export type Strategy = "naive" | "retry" | "bucket" | "priority" | "fallback";
export const STRATEGIES: { id: Strategy; label: string; one: string }[] = [
  { id: "naive", label: "Send everything", one: "Every request goes straight to the provider; 429s become errors for users." },
  { id: "retry", label: "Retry immediately", one: "On a 429, retry at once, up to three times." },
  { id: "bucket", label: "Token bucket + queue", one: "A shared limiter releases at most 400k tokens a minute; the rest wait in a queue." },
  { id: "priority", label: "Bucket + priority", one: "Interactive requests go first; background jobs fill whatever is left, even hours later." },
  { id: "fallback", label: "Priority + fallback", one: "When the main limit is used up, interactive requests overflow to a second provider or region." },
];

export const arrivals = (m: number) => (m >= BURST_FROM && m < BURST_TO ? BURST : BASE);

export type Minute = { m: number; arrived: number; sent: number; ok: number; rejected: number; queued: number; fallback: number; dropped: number };
export type Result = { minutes: Minute[]; interactiveFailed: number; backgroundLeft: number; totalRejected: number; maxWait: number; fallbackUsed: number };

export function run(s: Strategy): Result {
  const minutes: Minute[] = [];
  let interactiveFailed = 0;
  let totalRejected = 0;
  let fallbackUsed = 0;
  let qInteractive: number[] = []; // arrival minute of each waiting interactive request
  let qBackground = 0;
  let maxWait = 0;
  for (let m = 0; m < MINUTES; m++) {
    const arrived = arrivals(m);
    const inter = Math.round(arrived * (1 - BACKGROUND_SHARE));
    const bg = arrived - inter;
    let sent = 0;
    let ok = 0;
    let rejected = 0;
    let fallback = 0;
    let dropped = 0;
    if (s === "naive" || s === "retry") {
      // retries multiply attempts; the provider accepts up to its capacity and rejects the rest
      const attempts = s === "retry" ? Math.min(arrived * 4, arrived + 3 * Math.max(0, arrived - PER_MIN_CAPACITY)) : arrived;
      sent = attempts;
      ok = Math.min(arrived, PER_MIN_CAPACITY);
      rejected = attempts - ok;
      const failed = arrived - ok;
      dropped = failed;
      interactiveFailed += Math.round(failed * (1 - BACKGROUND_SHARE));
    } else {
      // a shared limiter: send at most PER_MIN_CAPACITY a minute
      for (let i = 0; i < inter; i++) qInteractive.push(m);
      qBackground += bg;
      let budget = PER_MIN_CAPACITY;
      if (s === "bucket") {
        // FIFO across both kinds: interactive and background share the queue in arrival proportion
        const total = qInteractive.length + qBackground;
        const take = Math.min(budget, total);
        const takeI = total ? Math.round((take * qInteractive.length) / total) : 0;
        const served = qInteractive.splice(0, takeI);
        for (const a of served) maxWait = Math.max(maxWait, m - a);
        qBackground -= take - takeI;
        ok = take;
      } else {
        const takeI = Math.min(budget, qInteractive.length);
        const served = qInteractive.splice(0, takeI);
        for (const a of served) maxWait = Math.max(maxWait, m - a);
        budget -= takeI;
        if (s === "fallback" && qInteractive.length) {
          fallback = Math.min(FALLBACK_CAPACITY, qInteractive.length);
          qInteractive.splice(0, fallback);
          fallbackUsed += fallback;
        }
        const takeB = Math.min(budget, qBackground);
        qBackground -= takeB;
        ok = takeI + takeB;
      }
      sent = ok;
      // interactive users give up after MAX_QUEUE_WAIT minutes
      const before = qInteractive.length;
      qInteractive = qInteractive.filter((a) => m - a < MAX_QUEUE_WAIT);
      dropped = before - qInteractive.length;
      interactiveFailed += dropped;
    }
    totalRejected += rejected;
    minutes.push({ m, arrived, sent, ok, rejected, queued: qInteractive.length + qBackground, fallback, dropped });
  }
  return { minutes, interactiveFailed, backgroundLeft: qBackground, totalRejected, maxWait, fallbackUsed };
}
