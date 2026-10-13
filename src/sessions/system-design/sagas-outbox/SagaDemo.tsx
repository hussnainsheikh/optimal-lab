"use client";

import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { useState } from "react";
import { Choices, PlaybackControls, usePlayback } from "@/components/session/ui";
import { FAILURES, publish, run, STEPS, type Failure, type Publish } from "@/lib/saga";

const ACCENT = "var(--sys)";
const COLOR = { do: "var(--good)", fail: "var(--bad)", undo: "var(--auto)", done: "var(--text)" };

export default function SagaDemo() {
  const [f, setF] = useState<Failure>("payment");
  const [pub, setPub] = useState<Publish>("outbox");
  return (
    <SessionPage>
      <SessionHeader kicker="System design · interactive" title="Sagas and the transactional outbox" blurb="Placing an order touches four services, each with its own database. There's no transaction across all of them. A saga runs the steps one by one and, if one fails, runs compensating steps to undo the earlier ones." />
      <div className="mt-6"><Run key={f} f={f} setF={setF} pub={pub} setPub={setPub} /></div>
    </SessionPage>
  );
}

function Run({ f, setF, pub, setPub }: { f: Failure; setF: (v: Failure) => void; pub: Publish; setPub: (v: Publish) => void }) {
  const evs = run(f);
  const playback = usePlayback(evs.length, 1100);
  const shown = evs.slice(0, playback.i + 1);
  const cur = evs[playback.i];
  const state = (svc: string) => { const last = [...shown].reverse().find((e) => e.svc === svc && e.kind !== "done"); return last ? last : null; };
  return (
    <SessionLayout
      visual={
        <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="Saga across services">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {STEPS.map((s) => { const st = state(s.svc); return (
              <div key={s.svc} className="rounded-lg border p-2" style={{ borderColor: st ? COLOR[st.kind] : "var(--line)", background: "var(--inset)" }}>
                <p className="text-sm font-medium">{s.svc}</p>
                <p className="mt-1 text-xs" style={{ color: st ? COLOR[st.kind] : "var(--faint)" }}>{st ? st.text : "not started"}</p>
              </div>
            ); })}
          </div>
          <ol className="mt-3 space-y-1 font-mono text-xs">
            {shown.map((e, i) => <li key={i} style={{ color: COLOR[e.kind] }}>{e.kind === "undo" ? "↩ " : e.kind === "fail" ? "✗ " : "→ "}{e.svc}: {e.text}</li>)}
          </ol>
          <p className="mt-5 font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">Publishing the OrderCreated event, with a crash</p>
          <ol className="mt-2 space-y-1 text-xs">
            {publish(pub).map((s, i) => <li key={i} className="rounded bg-[var(--inset)] px-2 py-1" style={{ color: s.ok ? "var(--good)" : "var(--bad)" }}>{s.text}</li>)}
          </ol>
        </section>
      }
      panel={
        <SystemMapPanel caption={cur.kind === "undo" ? `Compensating: ${cur.text}. Undo runs in reverse order.` : cur.kind === "fail" ? `${cur.svc} failed. Earlier steps already committed in their own databases, so they must be undone explicitly.` : cur.text}>
          <Choices label="What happens" accent={ACCENT} value={f} onChange={setF} options={FAILURES} />
          <Choices label="Publish events" accent={ACCENT} value={pub} onChange={setPub} options={[{ id: "direct", label: "After commit" }, { id: "outbox", label: "Outbox table" }]} />
          <PlaybackControls playback={playback} accent={ACCENT} nextLabel="Next step" status={`step ${playback.i + 1} of ${evs.length}`} />
        </SystemMapPanel>
      }
      detail={
        <>
          <FlowStep n={1} title="Local transactions, one per step" what="Each service commits its own change. The order is visible as pending while the saga runs." accent={ACCENT} active={cur.kind === "do"}><p className="text-sm text-[var(--muted)]">No locks held across services.</p></FlowStep>
          <FlowArrow label="a step fails" accent={ACCENT} />
          <FlowStep n={2} title="Compensate in reverse" what="Each step has an undo: release stock, refund, cancel. They must be safe to retry." accent={ACCENT} active={cur.kind === "undo" || cur.kind === "fail"}><p className="text-sm text-[var(--muted)]">A refund isn&apos;t a rollback: the customer may see both.</p></FlowStep>
          <FlowArrow label="who drives it" accent={ACCENT} />
          <FlowStep n={3} title="Orchestrated or choreographed" what="An orchestrator calls each step and tracks state, or services react to each other's events. Orchestration is easier to follow." accent={ACCENT}><p className="text-sm text-[var(--muted)]">Temporal and Step Functions are orchestrators.</p></FlowStep>
          <FlowArrow label="don't lose events" accent={ACCENT} />
          <FlowStep n={4} title="Use an outbox" what="Write the event to an outbox table in the same transaction as the data; a relay publishes it later. A crash can delay it, never lose it." accent={ACCENT} active={pub === "outbox"}><p className="text-sm text-[var(--muted)]">Consumers must dedupe: the relay is at-least-once.</p></FlowStep>
        </>
      }
    />
  );
}
