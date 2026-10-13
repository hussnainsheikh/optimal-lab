"use client";

import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { useState } from "react";
import { Slider } from "@/components/session/ui";
import { EVENTS, project } from "@/lib/eventSourcing";

const ACCENT = "var(--sys)";

export default function EventSourcingDemo() {
  const [upto, setUpto] = useState(EVENTS.length - 1);
  const p = project(upto);
  return (
    <SessionPage>
      <SessionHeader kicker="System design · interactive" title="CQRS and event sourcing" blurb="Instead of storing the current balance and overwriting it, store every change as an event that never changes. Current state is what you get by replaying them. Different read models can be built from the same events. Drag back in time." />
      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="Event log and projections">
              <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--faint)]">Event store (append-only)</p>
              <ol className="mt-1 space-y-1">{EVENTS.map((e, i) => <li key={i} className="grid grid-cols-[3rem_minmax(0,1fr)_4rem] gap-2 rounded px-2 py-1 font-mono text-xs" style={{ background: i <= upto ? "var(--inset)" : undefined, color: i <= upto ? undefined : "var(--faint)", outline: i === upto ? `1px solid ${ACCENT}` : undefined }}><span>{e.at}</span><span>{e.type}</span><span className="text-right">{e.data}</span></li>)}</ol>
              <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--faint)]">Read models, rebuilt from the events</p>
              <div className="mt-1 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[["Balance", `$${p.balance}`], ["Deposits", String(p.deposits)], ["Total withdrawn", `$${p.withdrawals}`], ["Address", p.address]].map(([k, v]) => <div key={k} className="rounded-lg border-2 p-2" style={{ borderColor: ACCENT }}><p className="text-[11px] text-[var(--muted)]">{k}</p><p className="font-mono">{v}</p></div>)}
              </div>
            </section>
          }
          panel={<SystemMapPanel caption={`Replaying ${upto + 1} event${upto ? "s" : ""}, the account stood at $${p.balance} on ${EVENTS[upto].at}. Nothing was overwritten, so any past state can be rebuilt and every change is audited.`}><Slider label="Replay up to" accent={ACCENT} value={upto} min={0} max={EVENTS.length - 1} step={1} format={(i) => EVENTS[i].at} onChange={setUpto} /></SystemMapPanel>}
          detail={
            <>
              <FlowStep n={1} title="Store facts, not current state" what="Each event records something that happened. Events are never updated or deleted." accent={ACCENT}><p className="text-sm text-[var(--muted)]">A full audit log for free.</p></FlowStep>
              <FlowArrow label="replay" accent={ACCENT} />
              <FlowStep n={2} title="State is a fold" what="Apply events in order to get the current state, or stop early to see the past." accent={ACCENT} active={upto < EVENTS.length - 1}><p className="font-mono text-xs">balance = events.reduce(apply, 0)</p></FlowStep>
              <FlowArrow label="CQRS" accent={ACCENT} />
              <FlowStep n={3} title="Separate write and read models" what="Commands append events; projections build whatever query shapes you need, updated asynchronously." accent={ACCENT}><p className="text-sm text-[var(--muted)]">New view? Replay history into it.</p></FlowStep>
              <FlowArrow label="costs" accent={ACCENT} />
              <FlowStep n={4} title="Snapshots, versioning, lag" what="Snapshot long streams, plan for event schema changes, and accept read models that lag slightly. Use it where history matters, not everywhere." accent={ACCENT}><p className="text-sm text-[var(--muted)]">Ledgers, orders, workflows.</p></FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
