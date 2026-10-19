"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices, RunButton, useWalk } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMap, SystemMapPanel, hops, type Packet } from "@/components/system/SystemMap";
import { AMOUNT, DEFAULT, ON_TIMEOUT, PEAK_TPS, PROVIDER_MS, SCENARIOS, STATES, reconcile, run, type Design, type OnTimeout, type Scenario } from "@/lib/paymentSystem";

const ACCENT = "var(--sys)";

export default function PaymentSystemDemo() {
  const [scenario, setScenario] = useState<Scenario>("timeout");
  const [d, setD] = useState<Design>(DEFAULT);
  const { stage, busy, run: walk } = useWalk(5, 1100);
  const at = (i: number) => stage === i;
  const set = (p: Partial<Design>) => setD((c) => ({ ...c, ...p }));
  const o = run(scenario, d);
  const rec = reconcile(d);
  const lost = scenario === "timeout" && d.onTimeout !== "fail";

  const packets: Packet[] =
    stage === 0 ? hops("p", ["browser", "pay"], { label: d.clientKey ? "POST · key order-7731" : "POST /payments", tone: scenario === "doubleClick" && !d.clientKey ? "bad" : "accent" })
    : stage === 1 ? (d.persistFirst ? hops("db", ["pay", "db"], { label: "status=pending" }) : [])
    : stage === 2 ? hops("c", ["pay", "psp"], { label: `charge €${AMOUNT}` })
    : stage === 3 ? (scenario === "timeout" ? hops("t", ["pay", "psp"], { label: d.onTimeout === "query" ? "GET by key" : d.onTimeout === "retry" ? "charge again" : "give up", tone: o.correct ? "good" : "bad" }) : hops("a", ["psp", "pay", "db"], { label: scenario === "crash" ? "server dies" : "authorized", tone: scenario === "crash" && !o.correct ? "bad" : "good" }))
    : stage === 4 ? hops("r", ["psp", "recon"], { label: "settlement report" }).concat(hops("r2", ["db", "recon"], { label: "our records", start: 0.2 }))
    : [];

  const captions = [
    `Step 1: ${SCENARIOS.find((x) => x.id === scenario)!.one}`,
    d.persistFirst ? "Step 2: the attempt is saved as pending, with its key, before the provider is called." : "Step 2: nothing is saved before calling the provider.",
    `Step 3: the provider charges €${AMOUNT}${d.providerKey ? ", keyed so a repeat returns the same charge" : ""}.`,
    `Step 4: ${o.steps[o.steps.length - 1]}.`,
    `Step 5: reconciliation against the provider's report finds ${rec} charge${rec === 1 ? "" : "s"} across the four scenarios that the app got wrong.`,
  ];
  const caption = stage !== null ? captions[stage] : `${SCENARIOS.find((x) => x.id === scenario)!.label}: ${o.charges} charge${o.charges === 1 ? "" : "s"}, customer pays €${o.charged}, order ${o.order} · ${o.correct ? "correct" : "wrong"}.`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="System design · case study"
        title="Design a payment system"
        blurb={`Charge a card €${AMOUNT} for an order exactly once. Customers double-click, the payment provider can charge the card and then time out, and servers die between the charge and saving it. Each design choice below fixes one of those; run all four scenarios against your design.`}
      />

      <div className="mt-6">
        <SessionLayout
          visual={
            <div className="space-y-3">
              <SystemMap
                title="Checkout, payment service, payments database, provider and reconciliation"
                accent={ACCENT}
                chrome="split"
                nodes={[
                  { id: "browser", label: "Checkout", sub: d.clientKey ? "sends a key" : "no key", at: [12, 28], mobileAt: [22, 9], state: "active" },
                  { id: "pay", label: "Payment service", sub: `${PEAK_TPS.toLocaleString("en-US")}/s peak`, at: [46, 28], mobileAt: [50, 40], state: o.correct ? "good" : "bad" },
                  { id: "db", label: "Payments DB", sub: d.persistFirst ? "pending first" : "after the answer", at: [46, 82], mobileAt: [22, 72], state: "idle" },
                  { id: "psp", label: "Provider", sub: `${PROVIDER_MS[0]}–${PROVIDER_MS[1]} ms`, at: [84, 28], mobileAt: [78, 9], state: lost ? "wait" : "active" },
                  { id: "recon", label: "Reconciliation", sub: rec ? `${rec} mismatches` : "all match", at: [84, 82], mobileAt: [78, 90], state: rec ? "bad" : "good" },
                ]}
                links={[
                  { from: "browser", to: "pay", label: "pay" },
                  { from: "pay", to: "db", label: "record" },
                  { from: "pay", to: "psp", label: "charge" },
                  { from: "psp", to: "recon", label: "report", dashed: true },
                  { from: "db", to: "recon", label: "records", dashed: true },
                ]}
                packets={packets}
                aspect={2}
                mobileAspect={0.95}
              />
              <Outcomes d={d} scenario={scenario} />
            </div>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <div className="w-full">
                <Choices label="Scenario" accent={ACCENT} value={scenario} onChange={setScenario} options={SCENARIOS.map((x) => ({ id: x.id, label: x.label }))} />
              </div>
              <RunButton busy={busy} onClick={walk} accent={ACCENT} running="Charging…">
                {`Pay €${AMOUNT}`}
              </RunButton>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Give every payment an idempotency key" what="The checkout makes one key per order and sends it with the request. A second request with the same key gets the first payment back instead of creating another: double clicks, refreshes and client retries are all safe." accent={ACCENT} active={at(0)}>
                <Toggle on={d.clientKey} set={(v) => set({ clientKey: v })} label="Checkout sends an idempotency key per order" />
              </FlowStep>
              <FlowArrow label="record it" accent={ACCENT} active={at(1)} />

              <FlowStep n={2} title="Record the attempt before calling the provider" what="Write a pending payment row first. If the server dies after the provider charges the card, a recovery job finds the pending row and asks the provider what happened; without the row, the charge exists only on the provider's side." accent={ACCENT} active={at(1)}>
                <Toggle on={d.persistFirst} set={(v) => set({ persistFirst: v })} label="Save a pending payment before charging" />
              </FlowStep>
              <FlowArrow label="charge" accent={ACCENT} active={at(2)} />

              <FlowStep n={3} title="Pass the key to the provider" what="Payment providers accept an idempotency key too. Sending the same key on any repeat of the same charge means the provider can never charge twice for one attempt, whatever our side gets wrong." accent={ACCENT} active={at(2)}>
                <Toggle on={d.providerKey} set={(v) => set({ providerKey: v })} label="Send the key to the provider" />
              </FlowStep>
              <FlowArrow label="no answer" accent={ACCENT} active={at(3)} />

              <FlowStep n={4} title="Treat a timeout as unknown, not failed" what="A timeout says nothing about whether the card was charged. Failing the order loses a paid sale; retrying blindly charges twice. Ask the provider for the attempt by its key, or wait for its webhook, then decide." accent={ACCENT} active={at(3)}>
                <Choices label="On timeout" accent={ACCENT} value={d.onTimeout} onChange={(v: OnTimeout) => set({ onTimeout: v })} options={ON_TIMEOUT.map((x) => ({ id: x.id, label: x.label }))} />
                <p className="mt-2 text-xs">{ON_TIMEOUT.find((x) => x.id === d.onTimeout)!.one}</p>
                <ul className="mt-2 space-y-0.5 font-mono text-[11px]" style={{ color: o.correct ? "var(--muted)" : "var(--bad)" }}>
                  {o.steps.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </FlowStep>
              <FlowArrow label="every day" accent={ACCENT} active={at(4)} />

              <FlowStep n={5} title="Move through states, then reconcile" what="A payment moves forward through explicit states, each change written once: authorized when the bank approves, captured when the order ships, settled when the money arrives. Every day, match each record against the provider's settlement report; whatever the app got wrong shows up there." accent={ACCENT} active={at(4)}>
                <p className="font-mono text-xs">{STATES.join(" → ")}</p>
                <p className="mt-1 font-mono text-xs" style={{ color: rec ? "var(--bad)" : "var(--good)" }}>
                  {rec ? `${rec} charge${rec === 1 ? "" : "s"} across the four scenarios don't match an order` : "every charge matches exactly one paid order"}
                </p>
                <p className="mt-2 text-[11px] text-[var(--faint)]">The ledger behind these states is its own session: Payments and ledgers. Provider latency is a typical range.</p>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}

function Toggle({ on, set, label }: { on: boolean; set: (v: boolean) => void; label: string }) {
  return (
    <label className="flex min-h-11 items-center gap-2 text-sm">
      <input type="checkbox" checked={on} onChange={(e) => set(e.target.checked)} className="h-4 w-4" style={{ accentColor: ACCENT }} />
      {label}
    </label>
  );
}

// Every scenario against the current design.
function Outcomes({ d, scenario }: { d: Design; scenario: Scenario }) {
  return (
    <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4" aria-label="Each scenario's outcome with this design">
      <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">this design, four scenarios</p>
      <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto_auto_auto] gap-x-3 gap-y-1 text-xs">
        <span />
        <span className="text-right font-mono text-[var(--faint)]">charged</span>
        <span className="text-right font-mono text-[var(--faint)]">order</span>
        <span className="text-right font-mono text-[var(--faint)]" />
        {SCENARIOS.map((s) => {
          const o = run(s.id, d);
          return <Line key={s.id} label={s.label} charged={`€${o.charged}`} order={o.order} ok={o.correct} on={s.id === scenario} />;
        })}
      </div>
    </section>
  );
}

function Line({ label, charged, order, ok, on }: { label: string; charged: string; order: string; ok: boolean; on: boolean }) {
  return (
    <>
      <span style={{ fontWeight: on ? 600 : 400 }}>{label}</span>
      <span className="text-right font-mono">{charged}</span>
      <span className="text-right font-mono">{order}</span>
      <span className="text-right font-mono" style={{ color: ok ? "var(--good)" : "var(--bad)" }}>
        {ok ? "✓" : "✗"}
      </span>
    </>
  );
}
