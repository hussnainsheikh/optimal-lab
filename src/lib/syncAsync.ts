// Placing an order needs three other services: inventory, payment and email.
// Call them and wait (in a chain, or all at once), or do only what the answer
// depends on now and hand the rest to a queue. Response time, what the user sees
// when one of them is down, and the availability of the whole are computed from
// each service's latency and uptime.

export type Mode = "chain" | "fanout" | "async";
export type DepId = "inventory" | "payment" | "email";
export type Down = "none" | DepId;

export const MODES: { id: Mode; label: string; one: string }[] = [
  { id: "chain", label: "Sync, one after another", one: "Call inventory, then payment, then email; answer when the last one answers." },
  { id: "fanout", label: "Sync, all at once", one: "Call all three in parallel; answer when the slowest answers." },
  { id: "async", label: "Sync only what the answer needs", one: "Reserve stock and charge the card now; put the email on a queue and answer." },
];

export type Dep = { id: DepId; label: string; ms: number; availability: number; needed: boolean; why: string };
export const DEPS: Dep[] = [
  { id: "inventory", label: "Inventory", ms: 20, availability: 0.999, needed: true, why: "The answer is wrong if the item is out of stock." },
  { id: "payment", label: "Payment", ms: 120, availability: 0.999, needed: true, why: "“Order placed” without a charge is a promise you can't keep." },
  { id: "email", label: "Email", ms: 300, availability: 0.995, needed: false, why: "The confirmation can arrive a minute later; the order doesn't depend on it." },
];

export const CHECKOUT_MS = 5;
export const DB_MS = 10;
export const PUBLISH_MS = 5;
export const TIMEOUT_MS = 2000;
export const BROKER_AVAILABILITY = 0.9999;
export const CHECKOUT_AVAILABILITY = 0.9995; // the checkout service and its database together
export const ORDERS_PER_SEC = 50;
export const EMAIL_WORKER_PER_SEC = 200;
export const OUTAGE_MIN = 10;
export const HOURS_PER_MONTH = 730;

export type Result = {
  responseMs: number;
  ok: boolean; // did the user get "order placed"?
  userSees: string;
  syncDeps: DepId[];
  asyncDeps: DepId[];
  availability: number;
  downHoursPerMonth: number;
  queued: number; // emails waiting after the outage (async only)
  drainSec: number;
  sideEffects: string; // what happened to the work that wasn't done
};

export function run(mode: Mode, down: Down): Result {
  const syncDeps: DepId[] = mode === "async" ? DEPS.filter((d) => d.needed).map((d) => d.id) : DEPS.map((d) => d.id);
  const asyncDeps: DepId[] = mode === "async" ? DEPS.filter((d) => !d.needed).map((d) => d.id) : [];
  const sync = DEPS.filter((d) => syncDeps.includes(d.id));
  const time = (d: Dep) => (d.id === down ? TIMEOUT_MS : d.ms);

  let responseMs: number;
  if (mode === "chain") {
    // stops at the first failure
    responseMs = CHECKOUT_MS + DB_MS;
    for (const d of sync) {
      responseMs += time(d);
      if (d.id === down) break;
    }
  } else {
    responseMs = CHECKOUT_MS + DB_MS + Math.max(...sync.map(time)) + (mode === "async" ? PUBLISH_MS : 0);
  }

  const failed = syncDeps.includes(down as DepId);
  const ok = !failed;
  const availability = (mode === "async" ? BROKER_AVAILABILITY : 1) * CHECKOUT_AVAILABILITY * sync.reduce((p, d) => p * d.availability, 1);
  const downHoursPerMonth = (1 - availability) * HOURS_PER_MONTH;

  const downDep = DEPS.find((d) => d.id === down);
  let userSees: string;
  let sideEffects: string;
  if (down === "none") {
    userSees = `“Order placed” after ${responseMs} ms.`;
    sideEffects = mode === "async" ? "The email goes out a moment later from the queue." : "Everything happened before the answer.";
  } else if (failed) {
    userSees = `An error after ${(responseMs / 1000).toFixed(1)} s: ${downDep!.label} timed out.`;
    sideEffects =
      mode === "chain"
        ? down === "email"
          ? "Stock was reserved and the card was charged, then the order failed. Someone has to undo that, or the customer pays for nothing."
          : down === "payment"
            ? "Stock was reserved for an order that failed; it comes back when the reservation expires."
            : "Nothing else ran. The customer can try again."
        : "All three were called. The ones that answered did their work for an order that failed, and have to be undone.";
  } else {
    userSees = `“Order placed” after ${responseMs} ms. The email waits in the queue.`;
    sideEffects = `${downDep!.label} is down, so its messages pile up; they're delivered when it's back.`;
  }

  const queued = asyncDeps.includes(down as DepId) ? ORDERS_PER_SEC * OUTAGE_MIN * 60 : 0;
  const drainSec = queued ? Math.ceil(queued / (EMAIL_WORKER_PER_SEC - ORDERS_PER_SEC)) : 0;

  return { responseMs, ok, userSees, syncDeps, asyncDeps, availability, downHoursPerMonth, queued, drainSec, sideEffects };
}

// Queue depth minute by minute while the email service is down for OUTAGE_MIN
// minutes, then drains at the worker rate.
export function queueCurve(): { min: number; depth: number }[] {
  const out: { min: number; depth: number }[] = [];
  let depth = 0;
  for (let m = 0; m <= OUTAGE_MIN + 4; m++) {
    out.push({ min: m, depth });
    depth = m < OUTAGE_MIN ? depth + ORDERS_PER_SEC * 60 : Math.max(0, depth - (EMAIL_WORKER_PER_SEC - ORDERS_PER_SEC) * 60);
  }
  return out;
}

export function pct(v: number): string {
  return `${(v * 100).toFixed(2)}%`;
}
