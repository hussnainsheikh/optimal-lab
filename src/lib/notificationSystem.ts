// Design a notification system. A marketing campaign goes to every user, on every
// channel they allow, while password-reset emails keep arriving. Providers cap how
// fast you may send; queues decide who waits for whom.

export const AUDIENCES = [1e6, 10e6, 50e6];

// Share of users who allow each channel for marketing, after the global opt-out.
export const OPTED_OUT = 0.15;
export const QUIET = 0.2; // in quiet hours right now: deferred, not dropped
export const CHANNELS = [
  { id: "push", label: "Push", provider: "APNs / FCM", allow: 0.6, rate: 20000, cost: 0 },
  { id: "email", label: "Email", provider: "Email provider", allow: 0.8, rate: 3000, cost: 0.0001 },
  { id: "sms", label: "SMS", provider: "SMS provider", allow: 0.05, rate: 100, cost: 0.0079 },
] as const;
export type Channel = (typeof CHANNELS)[number]["id"];

export function audience(users: number) {
  const reachable = users * (1 - OPTED_OUT);
  const now = reachable * (1 - QUIET);
  const per = Object.fromEntries(CHANNELS.map((c) => [c.id, Math.round(now * c.allow)])) as Record<Channel, number>;
  const deferred = Math.round(reachable * QUIET);
  const total = CHANNELS.reduce((s, c) => s + per[c.id], 0);
  const cost = CHANNELS.reduce((s, c) => s + per[c.id] * c.cost, 0);
  return { users, optedOut: Math.round(users * OPTED_OUT), deferred, per, total, cost };
}

export type QueueDesign = "shared" | "channel" | "priority";
export const QUEUES: { id: QueueDesign; label: string; one: string }[] = [
  { id: "shared", label: "One queue", one: "Every notification goes on one FIFO queue; workers take them in order." },
  { id: "channel", label: "Queue per channel", one: "Push, email and SMS each get their own queue and workers, paced to their provider's limit." },
  { id: "priority", label: "Per channel + priority", one: "Per-channel queues, plus a separate transactional queue per channel that workers always drain first." },
];

// Seconds until each channel's share of the campaign is sent.
export function drain(users: number, q: QueueDesign) {
  const a = audience(users);
  if (q === "shared") {
    // Messages are interleaved in one FIFO; a worker holding an SMS waits for the SMS
    // limit, so the whole queue moves at the pace its slowest channel allows.
    const rate = Math.min(...CHANNELS.map((c) => (a.per[c.id] ? c.rate / (a.per[c.id] / a.total) : Infinity)));
    const t = a.total / rate;
    return Object.fromEntries(CHANNELS.map((c) => [c.id, t])) as Record<Channel, number>;
  }
  return Object.fromEntries(CHANNELS.map((c) => [c.id, a.per[c.id] / c.rate])) as Record<Channel, number>;
}

// A password-reset email requested one minute into the campaign: how long it waits.
export const RESET_AT = 60;
export function resetWait(users: number, q: QueueDesign) {
  const d = drain(users, q);
  const a = audience(users);
  if (q === "priority") return 0.05;
  if (q === "shared") {
    const left = Math.max(0, d.email - RESET_AT);
    return left;
  }
  const email = CHANNELS.find((c) => c.id === "email")!;
  const backlog = Math.max(0, a.per.email - RESET_AT * email.rate);
  return backlog / email.rate;
}

// Provider errors: 2% get a 5xx and are retried with backoff; 0.3% time out after the
// provider already accepted the message. Retrying those without an idempotency key
// sends a second copy.
export const ERROR_5XX = 0.02;
export const TIMEOUT_DELIVERED = 0.003;
export function retries(users: number, dedupe: boolean) {
  const a = audience(users);
  const retried = Math.round(a.total * (ERROR_5XX + TIMEOUT_DELIVERED));
  const duplicates = dedupe ? 0 : Math.round(a.total * TIMEOUT_DELIVERED);
  const smsDupCost = dedupe ? 0 : a.per.sms * TIMEOUT_DELIVERED * 0.0079;
  return { retried, duplicates, smsDupCost };
}

export const dur = (s: number) => (s < 1 ? `${Math.round(s * 1000)} ms` : s < 120 ? `${Math.round(s)} s` : s < 7200 ? `${Math.round(s / 60)} min` : `${(s / 3600).toFixed(1)} h`);
export const fmt = (n: number) => (n >= 1e6 ? `${+(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${+(n / 1e3).toFixed(1)}k` : `${Math.round(n)}`);
