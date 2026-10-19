// An order is placed. Inventory, shipping and email each have to react. Either
// checkout calls each of them, or checkout publishes one OrderPlaced event and
// each of them subscribes. The dependency graph, the calls per order and what
// happens when one of them is down are computed from the chosen design.

export type Mode = "calls" | "events";
export type Payload = "notification" | "state";
export type ConsumerId = "inventory" | "shipping" | "email" | "fraud";

export type Settings = { mode: Mode; payload: Payload; fraud: boolean; shippingDown: boolean };
export const START: Settings = { mode: "calls", payload: "notification", fraud: false, shippingDown: false };

export const CONSUMERS: { id: ConsumerId; label: string; does: string }[] = [
  { id: "inventory", label: "Inventory", does: "reserves the stock" },
  { id: "shipping", label: "Shipping", does: "books the courier" },
  { id: "email", label: "Email", does: "sends the confirmation" },
  { id: "fraud", label: "Fraud check", does: "scores the order and can hold it" },
];

export const ORDERS_PER_SEC = 100;
export const ORDER_BYTES = 1180; // the full order as JSON: customer, address, items, totals
export const NOTIFICATION_BYTES = 58; // { "type": "OrderPlaced", "order_id": 9001, "at": "…" }
export const CALLBACK_BYTES = 40; // GET /orders/9001
export const OUTAGE_MIN = 5;

export type Edge = { from: string; to: string; kind: "call" | "event" | "callback"; label: string };

export type Result = {
  consumers: ConsumerId[];
  edges: Edge[];
  checkoutKnows: number; // services checkout's code names
  toAddFraud: string[]; // what changes to add the fraud check
  callsPerOrder: number; // synchronous HTTP calls checkout or the consumers make per order
  callbacksPerSec: number;
  bytesPerOrder: number; // over the wire per order, all hops
  shippingEffect: string;
  eventsWaiting: number;
  stale: string; // what a consumer holds a copy of, with carried state
};

export function run(s: Settings): Result {
  const consumers = CONSUMERS.filter((c) => c.id !== "fraud" || s.fraud).map((c) => c.id);
  const n = consumers.length;
  const edges: Edge[] = [];
  if (s.mode === "calls") {
    for (const c of consumers) edges.push({ from: "checkout", to: c, kind: "call", label: `POST /${c}` });
  } else {
    edges.push({ from: "checkout", to: "broker", kind: "event", label: "OrderPlaced" });
    for (const c of consumers) edges.push({ from: "broker", to: c, kind: "event", label: "OrderPlaced" });
    if (s.payload === "notification") for (const c of consumers) edges.push({ from: c, to: "checkout", kind: "callback", label: "GET /orders/9001" });
  }

  const checkoutKnows = s.mode === "calls" ? n : 0;
  const toAddFraud =
    s.mode === "calls"
      ? ["Write the fraud service", "Change checkout: call it, handle its timeout, decide what to do when it's slow", "Deploy checkout again"]
      : ["Write the fraud service", "Subscribe it to OrderPlaced", "Checkout is not touched"];

  const callsPerOrder = s.mode === "calls" ? n : s.payload === "notification" ? n : 0;
  const callbacksPerSec = s.mode === "events" && s.payload === "notification" ? n * ORDERS_PER_SEC : 0;
  const bytesPerOrder =
    s.mode === "calls"
      ? n * ORDER_BYTES
      : s.payload === "notification"
        ? NOTIFICATION_BYTES * (1 + n) + n * (CALLBACK_BYTES + ORDER_BYTES)
        : ORDER_BYTES * (1 + n);

  const shippingEffect = !s.shippingDown
    ? "Every service is up."
    : s.mode === "calls"
      ? "Checkout's call to shipping fails. Either the order fails for the customer, or checkout has code to carry on without shipping and remember to retry: that code is the coupling."
      : `Checkout publishes and answers as before. Shipping's events wait in its subscription; after ${OUTAGE_MIN} minutes ${(ORDERS_PER_SEC * OUTAGE_MIN * 60).toLocaleString("en-US")} orders are waiting to be booked. Inventory and email never noticed.`;
  const eventsWaiting = s.shippingDown && s.mode === "events" ? ORDERS_PER_SEC * OUTAGE_MIN * 60 : 0;

  const stale =
    s.mode === "events" && s.payload === "state"
      ? "Email keeps the address as it was when the order was placed. If the customer fixes a typo a minute later, email already sent to the old one. Usually right; sometimes the reason for a second event."
      : s.mode === "events"
        ? "Consumers fetch the order when they handle the event, so they see the latest version, and checkout must stay up and keep /orders fast for them."
        : "Checkout passes the order in each call.";

  return { consumers, edges, checkoutKnows, toAddFraud, callsPerOrder, callbacksPerSec, bytesPerOrder, shippingEffect, eventsWaiting, stale };
}

export function kb(bytes: number): string {
  return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`;
}
