"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices, RunButton, useWalk } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMap, SystemMapPanel, hops, type NodeState, type Packet } from "@/components/system/SystemMap";
import { BROKER_AVAILABILITY, CHECKOUT_MS, DB_MS, DEPS, EMAIL_WORKER_PER_SEC, HOURS_PER_MONTH, MODES, ORDERS_PER_SEC, OUTAGE_MIN, PUBLISH_MS, TIMEOUT_MS, pct, queueCurve, run, type DepId, type Down, type Mode } from "@/lib/syncAsync";

const ACCENT = "var(--sys)";
const DOWNS: { id: Down; label: string }[] = [{ id: "none", label: "All up" }, ...DEPS.map((d) => ({ id: d.id, label: `${d.label} down` }))];

export default function SyncAsyncDemo() {
  const [mode, setMode] = useState<Mode>("chain");
  const [down, setDown] = useState<Down>("none");
  const { stage, busy, run: walk } = useWalk(5, 1100);
  const r = run(mode, down);
  const at = (i: number) => stage === i;
  const isSync = (d: DepId) => r.syncDeps.includes(d);
  const depState = (d: DepId): NodeState => (d === down ? "bad" : isSync(d) ? "active" : "idle");
  const all = Object.fromEntries(MODES.map((m) => [m.id, run(m.id, down)])) as Record<Mode, ReturnType<typeof run>>;

  const packets: Packet[] =
    stage === 0 ? hops("order", ["client", "checkout"], { label: "order" })
    : stage === 1 ?
      mode === "chain" ? r.syncDeps.flatMap((d, i) => hops(`call-${d}`, ["checkout", d], { label: d === "email" ? "send" : d === "payment" ? "charge" : "reserve", start: i * 0.5 }))
      : [
          ...r.syncDeps.flatMap((d) => hops(`call-${d}`, ["checkout", d], { label: d === "email" ? "send" : d === "payment" ? "charge" : "reserve" })),
          ...(mode === "async" ? hops("pub", ["checkout", "queue"], { label: "OrderPlaced", tone: "good" }) : []),
        ]
    : stage === 2 ?
      down === "none" ? r.syncDeps.flatMap((d) => hops(`ok-${d}`, [d, "checkout"], { label: "ok", tone: "good" }))
      : isSync(down) ? hops("fail", [down, "checkout"], { label: "timeout", tone: "bad" })
      : hops("ok2", ["payment", "checkout"], { label: "ok", tone: "good" })
    : stage === 3 ? hops("reply", ["checkout", "client"], { label: r.ok ? "order placed" : "error", tone: r.ok ? "good" : "bad" })
    : stage === 4 && mode === "async" ? hops("deliver", ["queue", "email"], { label: down === "email" ? "waiting" : "send", tone: down === "email" ? "bad" : "good" })
    : [];

  const captions = [
    "Step 1: an order arrives. Before saying “order placed”, what has to be true?",
    `Step 2: ${MODES.find((m) => m.id === mode)!.one}`,
    down === "none" ? "Step 3: every service answers." : `Step 3: ${DEPS.find((d) => d.id === down)!.label} is down. ${isSync(down) ? `Checkout waits ${TIMEOUT_MS / 1000} s for it, then gives up.` : "Its message waits in the queue; checkout doesn't notice."}`,
    `Step 4: ${r.userSees}`,
    mode === "async" ? (down === "email" ? `Step 5: ${r.queued.toLocaleString("en-US")} emails queue up in ${OUTAGE_MIN} minutes and drain in ${r.drainSec} s when email is back.` : "Step 5: the email goes out from the queue a moment later.") : "Step 5: nothing was deferred, so nothing is left to do, and nothing could be.",
  ];
  const caption = stage !== null ? captions[stage] : `${r.userSees} Over a month, this design is down about ${r.downHoursPerMonth.toFixed(1)} hours.`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="System design · interactive"
        title="Synchronous vs asynchronous communication"
        blurb={`Placing an order needs inventory (${DEPS[0].ms} ms), payment (${DEPS[1].ms} ms) and a confirmation email (${DEPS[2].ms} ms). Call them and wait, in a chain or all at once, or do only what the answer depends on and hand the rest to a queue. Then take one of them down and see what the customer sees.`}
      />

      <div className="mt-6">
        <SessionLayout
          visual={
            <SystemMap
              title="A client, the checkout service, the inventory, payment and email services, and a queue between checkout and email"
              accent={ACCENT}
              chrome="split"
              nodes={[
                { id: "client", label: "Customer", sub: stage === null || stage >= 3 ? (r.ok ? "order placed" : "error") : "waiting", at: [8, 50], mobileAt: [50, 8], state: stage !== null && stage >= 3 ? (r.ok ? "good" : "bad") : "wait" },
                { id: "checkout", label: "Checkout", sub: `${r.syncDeps.length} sync call${r.syncDeps.length === 1 ? "" : "s"}`, at: [32, 50], mobileAt: [50, 32], state: "active" },
                { id: "inventory", label: "Inventory", sub: down === "inventory" ? "down" : `${DEPS[0].ms} ms`, at: [60, 16], mobileAt: [18, 58], state: depState("inventory") },
                { id: "payment", label: "Payment", sub: down === "payment" ? "down" : `${DEPS[1].ms} ms`, at: [60, 50], mobileAt: [50, 58], state: depState("payment") },
                { id: "queue", label: "Queue", sub: mode === "async" ? (r.queued ? `${r.queued.toLocaleString("en-US")} waiting` : "OrderPlaced") : "unused", at: [60, 84], mobileAt: [82, 58], state: mode === "async" ? "active" : "dim" },
                { id: "email", label: "Email", sub: down === "email" ? "down" : `${DEPS[2].ms} ms`, at: [88, 84], mobileAt: [82, 88], state: depState("email") },
              ]}
              links={[
                { from: "client", to: "checkout", label: "order" },
                { from: "checkout", to: "inventory", label: "reserve" },
                { from: "checkout", to: "payment", label: "charge" },
                { from: "checkout", to: "email", label: "send", dim: mode === "async" },
                { from: "checkout", to: "queue", label: "publish", dashed: true, dim: mode !== "async" },
                { from: "queue", to: "email", label: "deliver", dashed: true, dim: mode !== "async" },
              ]}
              packets={packets}
              aspect={2.2}
              mobileAspect={1}
            />
          }
          panel={
            <SystemMapPanel caption={caption}>
              <div className="w-full">
                <Choices label="Which service is down" accent={ACCENT} value={down} onChange={setDown} options={DOWNS} />
              </div>
              <RunButton busy={busy} onClick={walk} accent={ACCENT} running="Placing…">
                Place an order
              </RunButton>
              <p className="w-full font-mono text-sm" style={{ color: r.ok ? (r.responseMs > 300 ? "var(--text)" : "var(--good)") : "var(--bad)" }}>
                {r.ok ? `answer in ${r.responseMs} ms` : `error after ${(r.responseMs / 1000).toFixed(1)} s`} · {pct(r.availability)} available
              </p>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Decide what the answer depends on" what="“Order placed” is a promise. It needs the stock and the charge; it doesn't need the email to have been sent. That line decides what can be asynchronous." accent={ACCENT} active={at(0)}>
                <ul className="space-y-1 text-xs">
                  {DEPS.map((d) => (
                    <li key={d.id} className="grid grid-cols-[5rem_minmax(0,1fr)] gap-2">
                      <span className="font-mono" style={{ color: d.needed ? "var(--text)" : "var(--muted)" }}>
                        {d.label}
                      </span>
                      <span className="text-[var(--muted)]">
                        {d.needed ? "needed first: " : "can wait: "}
                        {d.why}
                      </span>
                    </li>
                  ))}
                </ul>
              </FlowStep>
              <FlowArrow label="the order" accent={ACCENT} active={at(1)} />

              <FlowStep n={2} title="Call the other services" what="In a chain each call starts when the last one ends. In parallel they all start at once and checkout waits for the slowest. Asynchronously, checkout writes the order, publishes an event, and only waits for the calls the answer needs." accent={ACCENT} active={at(1)}>
                <Choices label="How checkout talks to them" accent={ACCENT} value={mode} onChange={setMode} options={MODES.map((m) => ({ id: m.id, label: m.label }))} />
                <Timeline mode={mode} down={down} />
              </FlowStep>
              <FlowArrow label="one answer each" accent={ACCENT} active={at(2)} />

              <FlowStep n={3} title="One of them goes down" what={`A synchronous call to a dead service waits for the timeout (${TIMEOUT_MS / 1000} s here) and then fails, and the work the other services already did has to be undone. A message to a dead service waits in the queue.`} accent={ACCENT} active={at(2)}>
                <p className="font-mono text-xs" style={{ color: r.ok ? "var(--good)" : "var(--bad)" }}>
                  {r.userSees}
                </p>
                <p className="mt-1 text-xs text-[var(--muted)]">{r.sideEffects}</p>
                <p className="mt-2 text-xs text-[var(--faint)]">Payment down fails every design: the answer depends on it. Async is not a way around that, only around waiting for things the answer doesn’t need.</p>
              </FlowStep>
              <FlowArrow label="the response" accent={ACCENT} active={at(3)} />

              <FlowStep n={4} title="Answer the customer" what="The response time is the sum of the chain, the slowest of the fan-out, or the needed calls plus a publish. Availability multiplies: every service you wait for is one more that can take the order down with it." accent={ACCENT} active={at(3)}>
                <div className="grid grid-cols-[minmax(0,1fr)_auto_auto_auto] gap-x-3 gap-y-0.5 font-mono text-xs">
                  <span />
                  <span className="text-right text-[var(--faint)]">answer</span>
                  <span className="text-right text-[var(--faint)]">available</span>
                  <span className="text-right text-[var(--faint)]">down/month</span>
                  {MODES.map((m) => {
                    const x = all[m.id];
                    const w = m.id === mode ? 700 : 400;
                    return (
                      <Row key={m.id} w={w} cells={[m.label, x.ok ? `${x.responseMs} ms` : "error", pct(x.availability), `${x.downHoursPerMonth.toFixed(1)} h`]} />
                    );
                  })}
                </div>
                <p className="mt-2 text-xs text-[var(--muted)]">
                  Checkout and its database {pct(1 - (1 - 0.9995))}, inventory and payment {pct(DEPS[0].availability)} each, email {pct(DEPS[2].availability)}, the queue {pct(BROKER_AVAILABILITY)}; {HOURS_PER_MONTH} hours in a month.
                </p>
              </FlowStep>
              <FlowArrow label="later" accent={ACCENT} active={at(4)} />

              <FlowStep n={5} title="Pay for the queue" what={`The email is now eventually sent, not sent. If the email service is down for ${OUTAGE_MIN} minutes at ${ORDERS_PER_SEC} orders a second, ${(ORDERS_PER_SEC * OUTAGE_MIN * 60).toLocaleString("en-US")} messages wait; a worker doing ${EMAIL_WORKER_PER_SEC} a second drains them in ${Math.ceil((ORDERS_PER_SEC * OUTAGE_MIN * 60) / (EMAIL_WORKER_PER_SEC - ORDERS_PER_SEC))} s. The queue must be as reliable as the thing it replaces, and the worker must cope with the same message twice.`} accent={ACCENT} active={at(4)}>
                <QueueChart />
                <ul className="mt-2 space-y-0.5 text-xs text-[var(--muted)]">
                  <li>Idempotent consumers: a redelivered “send the email” must not send it twice.</li>
                  <li>Something has to watch the queue depth; the customer won’t tell you the email is late.</li>
                  <li>Two things to keep up instead of one: the queue (above) and the worker.</li>
                </ul>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}

function Row({ cells, w }: { cells: string[]; w: number }) {
  return (
    <>
      {cells.map((c, i) => (
        <span key={i} className={i === 0 ? "font-sans" : "text-right"} style={{ fontWeight: w }}>
          {c}
        </span>
      ))}
    </>
  );
}

// When each call starts and ends, as bars on one time axis.
function Timeline({ mode, down }: { mode: Mode; down: Down }) {
  const r = run(mode, down);
  const bars: { label: string; start: number; end: number; bad?: boolean; faded?: boolean }[] = [{ label: "write order", start: CHECKOUT_MS, end: CHECKOUT_MS + DB_MS }];
  let t = CHECKOUT_MS + DB_MS;
  const dur = (d: DepId) => (d === down ? TIMEOUT_MS : DEPS.find((x) => x.id === d)!.ms);
  if (mode === "chain") {
    for (const d of r.syncDeps) {
      bars.push({ label: d, start: t, end: t + dur(d), bad: d === down });
      t += dur(d);
      if (d === down) break;
    }
  } else {
    for (const d of r.syncDeps) bars.push({ label: d, start: t, end: t + dur(d), bad: d === down });
    if (mode === "async") {
      bars.push({ label: "publish", start: t, end: t + PUBLISH_MS });
      bars.push({ label: "email (from queue)", start: r.responseMs + 40, end: r.responseMs + 40 + dur("email"), bad: down === "email", faded: true });
    }
  }
  const max = Math.max(r.responseMs, ...bars.map((b) => b.end)) * 1.05;
  return (
    <div className="mt-3 space-y-1">
      {bars.map((b) => (
        <div key={b.label} className="grid grid-cols-[6.5rem_minmax(0,1fr)] items-center gap-2 text-[11px]">
          <span className="truncate font-mono" style={{ color: b.faded ? "var(--faint)" : "var(--text)" }}>
            {b.label}
          </span>
          <span className="relative h-3 rounded bg-[var(--track)]">
            <span className="absolute inset-y-0 rounded" style={{ left: `${(b.start / max) * 100}%`, width: `${Math.max(0.8, ((b.end - b.start) / max) * 100)}%`, background: b.bad ? "var(--bad)" : ACCENT, opacity: b.faded ? 0.45 : 1 }} />
          </span>
        </div>
      ))}
      <div className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-2 text-[10px] text-[var(--faint)]">
        <span className="font-mono">answer at</span>
        <span className="relative h-3">
          <span className="absolute -translate-x-1/2 font-mono" style={{ left: `${(r.responseMs / max) * 100}%`, color: r.ok ? "var(--text)" : "var(--bad)" }}>
            {r.responseMs >= 1000 ? `${(r.responseMs / 1000).toFixed(1)} s` : `${r.responseMs} ms`}
          </span>
        </span>
      </div>
    </div>
  );
}

function QueueChart() {
  const pts = queueCurve();
  const max = Math.max(...pts.map((p) => p.depth));
  const W = 100;
  const H = 36;
  const x = (m: number) => (m / (pts.length - 1)) * W;
  const y = (d: number) => H - 4 - (d / max) * (H - 8);
  const path = pts.map((p, i) => `${i === 0 ? "M" : "L"}${x(p.min).toFixed(1)},${y(p.depth).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-lg" role="img" aria-label={`Queue depth over ${pts.length - 1} minutes: it climbs to ${max.toLocaleString("en-US")} while the email service is down, then drains.`}>
      <rect x={x(0)} y={2} width={x(OUTAGE_MIN) - x(0)} height={H - 4} fill="var(--bad)" opacity={0.12} />
      <path d={path} fill="none" stroke={ACCENT} strokeWidth={1.2} />
      <text x={x(OUTAGE_MIN / 2)} y={6} textAnchor="middle" fontSize={3.2} fill="var(--bad)">
        email down
      </text>
      <text x={x(OUTAGE_MIN)} y={y(max) - 1.5} textAnchor="middle" fontSize={3.2} fill="var(--text)">
        {max.toLocaleString("en-US")} waiting
      </text>
      <text x={0} y={H - 0.5} fontSize={3} fill="var(--faint)">
        0 min
      </text>
      <text x={W} y={H - 0.5} textAnchor="end" fontSize={3} fill="var(--faint)">
        {pts.length - 1} min
      </text>
    </svg>
  );
}
