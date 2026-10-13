// An order saga across services, with compensations, and the outbox for publishing events.
export type Failure = "none" | "payment" | "shipping";
export const FAILURES: { id: Failure; label: string }[] = [
  { id: "none", label: "Everything works" },
  { id: "payment", label: "Card declined" },
  { id: "shipping", label: "No courier available" },
];
export const STEPS = [
  { svc: "Orders", act: "Create order (pending)", undo: "Cancel order" },
  { svc: "Inventory", act: "Reserve 1 × lamp", undo: "Release the lamp" },
  { svc: "Payments", act: "Charge $40", undo: "Refund $40" },
  { svc: "Shipping", act: "Book a courier", undo: "Cancel courier" },
];
export type Ev = { svc: string; text: string; kind: "do" | "fail" | "undo" | "done" };

export function run(f: Failure): Ev[] {
  const failAt = f === "payment" ? 2 : f === "shipping" ? 3 : -1;
  const out: Ev[] = [];
  for (let i = 0; i < STEPS.length; i++) {
    if (i === failAt) {
      out.push({ svc: STEPS[i].svc, text: `${STEPS[i].act} failed`, kind: "fail" });
      for (let j = i - 1; j >= 0; j--) out.push({ svc: STEPS[j].svc, text: STEPS[j].undo, kind: "undo" });
      out.push({ svc: "Orders", text: "Order marked failed. Every step was undone, in reverse.", kind: "done" });
      return out;
    }
    out.push({ svc: STEPS[i].svc, text: STEPS[i].act, kind: "do" });
  }
  out.push({ svc: "Orders", text: "Order confirmed", kind: "done" });
  return out;
}

export type Publish = "direct" | "outbox";
export function publish(p: Publish) {
  return p === "direct"
    ? [
        { text: "BEGIN; INSERT order; COMMIT", ok: true },
        { text: "process crashes", ok: false },
        { text: "publish OrderCreated: never happens", ok: false },
        { text: "Database says the order exists; no other service ever hears about it.", ok: false },
      ]
    : [
        { text: "BEGIN; INSERT order; INSERT outbox row; COMMIT", ok: true },
        { text: "process crashes", ok: false },
        { text: "relay reads unsent outbox rows and publishes OrderCreated", ok: true },
        { text: "The event is saved in the same transaction as the order, so it can't be lost.", ok: true },
      ];
}
