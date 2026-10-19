"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices, RunButton, useWalk } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMap, SystemMapPanel, hops, type MapLink, type Packet } from "@/components/system/SystemMap";
import { CONSUMERS, NOTIFICATION_BYTES, ORDERS_PER_SEC, ORDER_BYTES, OUTAGE_MIN, START, kb, run, type ConsumerId, type Mode, type Payload, type Settings } from "@/lib/eventDriven";

const ACCENT = "var(--sys)";
const MODES: { id: Mode; label: string }[] = [
  { id: "calls", label: "Checkout calls each service" },
  { id: "events", label: "Checkout publishes an event" },
];
const PAYLOADS: { id: Payload; label: string }[] = [
  { id: "notification", label: "Just the id (notification)" },
  { id: "state", label: "The whole order (carried state)" },
];

export default function EventDrivenDemo() {
  const [s, setS] = useState<Settings>(START);
  const { stage, busy, run: walk } = useWalk(5, 1100);
  const r = run(s);
  const set = (patch: Partial<Settings>) => setS((cur) => ({ ...cur, ...patch }));
  const at = (i: number) => stage === i;
  const events = s.mode === "events";
  const has = (c: ConsumerId) => r.consumers.includes(c);

  const fanOut = (label: string, tone?: "good" | "bad"): Packet[] =>
    events
      ? [...hops("pub", ["checkout", "broker"], { label }), ...r.consumers.flatMap((c) => hops(`ev-${c}`, ["broker", c], { label, start: 0.45, tone: c === "shipping" && s.shippingDown ? "bad" : tone }))]
      : r.consumers.flatMap((c) => hops(`call-${c}`, ["checkout", c], { label: `POST /${c}`, tone: c === "shipping" && s.shippingDown ? "bad" : tone }));

  const packets: Packet[] =
    stage === 0 ? fanOut(events ? "OrderPlaced" : "the order")
    : stage === 1 ? fanOut("OrderPlaced")
    : stage === 2 ? (s.fraud ? (events ? hops("fr", ["broker", "fraud"], { label: "OrderPlaced", tone: "good" }) : hops("fr", ["checkout", "fraud"], { label: "POST /fraud" })) : [])
    : stage === 3 ? (events && s.payload === "notification" ? r.consumers.flatMap((c, i) => hops(`cb-${c}`, [c, "checkout"], { label: "GET /orders/9001", start: i * 0.15 })) : fanOut(events ? `${kb(ORDER_BYTES)} event` : `${kb(ORDER_BYTES)} body`))
    : stage === 4 ? fanOut(events ? "OrderPlaced" : "the order")
    : [];

  const links: MapLink[] = [
    ...CONSUMERS.map((c) => ({ from: "checkout", to: c.id, label: `POST /${c.id}`, dim: events || !has(c.id) })),
    { from: "checkout", to: "broker", label: "OrderPlaced", dim: !events },
    ...CONSUMERS.map((c) => ({ from: "broker", to: c.id, label: "subscribed", dashed: true, dim: !events || !has(c.id) })),
  ];

  const captions = [
    events ? `Step 1: checkout publishes OrderPlaced and answers the customer. ${r.consumers.length} services are subscribed; checkout doesn't know which.` : `Step 1: checkout calls ${r.consumers.length} services, one after another, and knows every one of them by name.`,
    events ? "Step 2: one event, delivered to every subscriber by the broker. Checkout's code mentions none of them." : "Step 2: switch to an event and the arrows reverse: consumers ask for the event; checkout stops naming them.",
    s.fraud ? (events ? "Step 3: fraud check subscribed to OrderPlaced. Checkout was not changed or redeployed." : "Step 3: to add fraud check, checkout's code gains a call, a timeout and a decision about what to do when it's slow. Then it's redeployed.") : "Step 3: no fraud check yet. Add it and see what has to change.",
    events ? (s.payload === "notification" ? `Step 4: the event is ${NOTIFICATION_BYTES} bytes, so every consumer calls checkout back for the order: ${r.callbacksPerSec} calls a second at ${ORDERS_PER_SEC} orders a second.` : `Step 4: the event carries the whole order (${kb(ORDER_BYTES)}); consumers keep their own copy and never call back.`) : "Step 4: with direct calls, checkout sends the order in each request; the question only arises with events.",
    s.shippingDown ? `Step 5: ${r.shippingEffect}` : "Step 5: everything is up. Take shipping down to see who notices.",
  ];
  const caption = stage !== null ? captions[stage] : `Checkout knows ${r.checkoutKnows} downstream service${r.checkoutKnows === 1 ? "" : "s"} · ${r.callsPerOrder} HTTP call${r.callsPerOrder === 1 ? "" : "s"} per order · ${kb(r.bytesPerOrder)} on the wire per order${r.eventsWaiting ? ` · ${r.eventsWaiting.toLocaleString("en-US")} events waiting for shipping` : ""}.`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="System design · interactive"
        title="Event-driven architecture"
        blurb="When an order is placed, inventory reserves stock, shipping books a courier and email sends the confirmation. Either checkout calls each of them, or it publishes one OrderPlaced event and they subscribe. Add a service, change what the event carries, and take a service down; count what each design has to know and do."
      />

      <div className="mt-6">
        <SessionLayout
          visual={
            <SystemMap
              title="Checkout, a message broker, and the inventory, shipping, email and fraud services"
              accent={ACCENT}
              chrome="split"
              nodes={[
                { id: "checkout", label: "Checkout", sub: `knows ${r.checkoutKnows}`, at: [10, 50], mobileAt: [50, 8], state: "active" },
                { id: "broker", label: "Broker", sub: events ? "OrderPlaced" : "unused", at: [42, 50], mobileAt: [50, 34], state: events ? "active" : "dim" },
                { id: "inventory", label: "Inventory", sub: "reserves stock", at: [82, 10], mobileAt: [18, 64], state: "idle" },
                { id: "shipping", label: "Shipping", sub: s.shippingDown ? (r.eventsWaiting ? `down · ${r.eventsWaiting.toLocaleString("en-US")} waiting` : "down") : "books courier", at: [82, 37], mobileAt: [50, 64], state: s.shippingDown ? "bad" : "idle" },
                { id: "email", label: "Email", sub: "confirmation", at: [82, 64], mobileAt: [82, 64], state: "idle" },
                { id: "fraud", label: "Fraud check", sub: s.fraud ? "new" : "not yet", at: [82, 91], mobileAt: [50, 92], state: s.fraud ? "good" : "dim" },
              ]}
              links={links}
              packets={packets}
              aspect={2.2}
              mobileAspect={1}
            />
          }
          panel={
            <SystemMapPanel caption={caption}>
              <div className="w-full">
                <Choices label="Design" accent={ACCENT} value={s.mode} onChange={(v) => set({ mode: v })} options={MODES} />
              </div>
              <RunButton busy={busy} onClick={walk} accent={ACCENT} running="Placing…">
                Place an order
              </RunButton>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Checkout calls each service" what="The obvious design: after saving the order, checkout calls inventory, shipping and email. It has their addresses, their request formats, their timeouts and their failure modes in its own code. Every new reaction to an order is a change to checkout." accent={ACCENT} active={at(0)}>
                <p className="font-mono text-xs">
                  checkout knows {r.checkoutKnows} service{r.checkoutKnows === 1 ? "" : "s"} · {r.callsPerOrder} call{r.callsPerOrder === 1 ? "" : "s"} per order
                </p>
              </FlowStep>
              <FlowArrow label="turn it around" accent={ACCENT} active={at(1)} />

              <FlowStep n={2} title="Publish one event instead" what="Checkout records what happened, OrderPlaced, on a broker and moves on. Services that care subscribe. The dependency points the other way: consumers depend on the event's shape; checkout depends on nobody." accent={ACCENT} active={at(1)}>
                <ul className="space-y-0.5 font-mono text-xs">
                  {CONSUMERS.filter((c) => has(c.id)).map((c) => (
                    <li key={c.id}>
                      {events ? `${c.label} ← OrderPlaced` : `checkout → POST /${c.id}`} <span className="text-[var(--muted)]">({c.does})</span>
                    </li>
                  ))}
                </ul>
              </FlowStep>
              <FlowArrow label="a new requirement" accent={ACCENT} active={at(2)} />

              <FlowStep n={3} title="Add a service without touching checkout" what="Fraud wants to score every order. With calls, that is a change to checkout: a new call, a new timeout, a new decision about what to do when fraud is slow. With events, fraud subscribes." accent={ACCENT} active={at(2)}>
                <Toggle checked={s.fraud} onChange={(v) => set({ fraud: v })} label="Add the fraud check" />
                {s.fraud && (
                  <ol className="list-decimal space-y-0.5 pl-5 text-xs">
                    {r.toAddFraud.map((t) => (
                      <li key={t} style={{ color: t.startsWith("Change checkout") ? "var(--bad)" : t.startsWith("Checkout is not") ? "var(--good)" : "var(--text)" }}>
                        {t}
                      </li>
                    ))}
                  </ol>
                )}
              </FlowStep>
              <FlowArrow label="what's in the event?" accent={ACCENT} active={at(3)} />

              <FlowStep n={4} title="Decide what the event carries" what={`A notification says only that order 9001 was placed; each consumer fetches what it needs, so checkout must stay up and fast for them. Carried state puts the whole order (${kb(ORDER_BYTES)}) in the event; consumers keep a copy and need nothing from checkout, at the price of copies that can go stale.`} accent={ACCENT} active={at(3)}>
                <Choices label="Payload" accent={ACCENT} value={s.payload} onChange={(v) => set({ payload: v })} options={PAYLOADS} />
                <p className="mt-2 font-mono text-xs">
                  {events ? `${r.callbacksPerSec} callbacks/s to checkout · ${kb(r.bytesPerOrder)} per order over the wire` : `direct calls carry the order: ${kb(r.bytesPerOrder)} per order`}
                </p>
                <p className="mt-1 text-xs text-[var(--muted)]">{r.stale}</p>
              </FlowStep>
              <FlowArrow label="when something breaks" accent={ACCENT} active={at(4)} />

              <FlowStep n={5} title="Pay for the decoupling" what={`Take shipping down for ${OUTAGE_MIN} minutes. With events, nothing upstream notices and the orders wait on the broker, which is the good news and the bad: nobody is told, and the flow is now spread across services that no single file describes. Changing the event's shape is a change to every consumer.`} accent={ACCENT} active={at(4)}>
                <Toggle checked={s.shippingDown} onChange={(v) => set({ shippingDown: v })} label="Shipping is down" />
                <p className="text-xs" style={{ color: s.shippingDown ? (events ? "var(--text)" : "var(--bad)") : "var(--muted)" }}>
                  {r.shippingEffect}
                </p>
                <p className="mt-2 text-xs text-[var(--muted)]">
                  Who handles OrderPlaced? {events ? `${r.consumers.length} subscribers: ${r.consumers.join(", ")}. You find that out from the broker, not from checkout's code.` : `Checkout's code lists them: ${r.consumers.join(", ")}.`}
                </p>
                <p className="mt-2 text-xs text-[var(--faint)]">Sizes are from a typical order record. The sagas session covers what happens when a consumer must undo work; CQRS and event sourcing cover events as the record itself.</p>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex min-h-11 items-center gap-2 text-sm">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4" style={{ accentColor: ACCENT }} />
      {label}
    </label>
  );
}
