// Design a payment system: charge a card exactly once for an order, even when the
// customer double-clicks, the provider times out after charging, or the server dies
// between the charge and saving it. Four scenarios run against the design choices.

export type OnTimeout = "fail" | "retry" | "query";
export type Design = { clientKey: boolean; persistFirst: boolean; providerKey: boolean; onTimeout: OnTimeout };
export const ON_TIMEOUT: { id: OnTimeout; label: string; one: string }[] = [
  { id: "fail", label: "Mark it failed", one: "Treat a timeout as a decline and tell the customer to try again." },
  { id: "retry", label: "Retry the charge", one: "Send the charge again; it probably didn't go through." },
  { id: "query", label: "Ask the provider", one: "Look the attempt up by its key, or wait for the webhook, before deciding anything." },
];

export type Scenario = "happy" | "doubleClick" | "timeout" | "crash";
export const SCENARIOS: { id: Scenario; label: string; one: string }[] = [
  { id: "happy", label: "Everything works", one: "One click, a fast answer from the provider." },
  { id: "doubleClick", label: "Double click", one: "The customer clicks Pay twice; two requests arrive 300 ms apart." },
  { id: "timeout", label: "Provider times out", one: "The provider charges the card, but its answer never reaches us within 10 s." },
  { id: "crash", label: "Crash after charging", one: "The provider charges the card and answers, and our server dies before saving the result." },
];

export const AMOUNT = 84;

export type Outcome = { charges: number; charged: number; order: "paid" | "failed" | "unpaid" | "stuck"; correct: boolean; steps: string[] };

export function run(s: Scenario, d: Design): Outcome {
  const steps: string[] = [];
  let charges = 0;
  let order: Outcome["order"] = "unpaid";

  // one or two requests from the browser
  const requests = s === "doubleClick" && !d.clientKey ? 2 : 1;

  for (let r = 0; r < requests; r++) {
    if (d.persistFirst) steps.push(`INSERT payment ${r ? "#2" : "#1"} status=pending, key=${d.clientKey ? "order-7731" : `rand-${r}`}`);
    // the provider charges the card
    charges++;
    steps.push(`provider: charge €${AMOUNT}${d.providerKey ? " (Idempotency-Key sent)" : ""}`);

    if (s === "timeout") {
      steps.push("no answer after 10 s");
      if (d.onTimeout === "fail") {
        order = "failed";
        steps.push("order marked failed; the card was charged anyway");
      } else if (d.onTimeout === "retry") {
        if (d.providerKey) steps.push("retry with the same key: the provider returns the first charge");
        else {
          charges++;
          steps.push(`retry without a key: a second €${AMOUNT} charge`);
        }
        order = "paid";
      } else {
        steps.push("GET charge by key: succeeded → order paid");
        order = "paid";
      }
      continue;
    }
    if (s === "crash") {
      steps.push("server dies before saving the answer");
      if (d.persistFirst) {
        steps.push(d.providerKey ? "recovery job finds the pending row, asks the provider by key: succeeded" : "recovery job finds the pending row, but without a key can't find the charge");
        order = d.providerKey ? "paid" : "stuck";
      } else {
        steps.push("no record of the attempt: the charge exists only at the provider");
        order = "unpaid";
      }
      continue;
    }
    order = "paid";
    steps.push(`UPDATE payment status=authorized · order paid`);
  }

  if (s === "doubleClick") steps.push(d.clientKey ? "2nd click: same idempotency key, gets the first payment back" : "2nd click was a second payment with its own charge");
  const charged = charges * AMOUNT;
  const correct = charges === 1 && order === "paid";
  return { charges, charged, order, correct, steps };
}

export const DEFAULT: Design = { clientKey: false, persistFirst: false, providerKey: false, onTimeout: "retry" };
export const SAFE: Design = { clientKey: true, persistFirst: true, providerKey: true, onTimeout: "query" };

// The payment's life after authorization.
export const STATES = ["created", "pending", "authorized", "captured", "settled"] as const;

// Daily reconciliation against the provider's report finds what the app missed.
export function reconcile(d: Design) {
  const missing = SCENARIOS.map((s) => run(s.id, d)).reduce((n, o) => n + Math.max(0, o.charges - (o.order === "paid" ? 1 : 0)), 0);
  return missing;
}

export const PEAK_TPS = 2000;
export const PROVIDER_MS = [300, 800];
