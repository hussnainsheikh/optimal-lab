"use client";

import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { useState } from "react";
import { Choices } from "@/components/session/ui";
import { budget, INCIDENTS, TARGETS } from "@/lib/sloBudget";

const ACCENT = "var(--ops)";
const fmt = (m: number) => (m >= 60 ? `${(m / 60).toFixed(1)} h` : `${m.toFixed(1)} min`);

export default function SloDemo() {
  const [target, setTarget] = useState("99.9");
  const b = budget(Number(target));
  return (
    <SessionPage>
      <SessionHeader kicker="DevOps · interactive" title="SLIs, SLOs and error budgets" blurb="No service is 100% up. An SLO picks a target, like 99.9% of minutes healthy over 30 days, and whatever is left over is the error budget you're allowed to spend. The same four incidents, against three targets." />
      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="Error budget remaining over 30 days">
              <p className="flex flex-wrap justify-between gap-2 font-mono text-xs"><span className="uppercase tracking-[0.16em] text-[var(--faint)]">Budget left, day by day</span><span>budget {fmt(b.total)} · used {fmt(b.used)}</span></p>
              <div className="relative mt-2 flex h-36 items-end gap-px border-b border-[var(--line)]">
                {b.days.map((d) => (
                  <span key={d.day} className="flex-1 rounded-t-sm" title={`day ${d.day}: ${fmt(Math.max(0, d.left))} left`} style={{ height: `${Math.max(2, d.pct * 100)}%`, background: d.left < 0 ? "var(--bad)" : d.pct < 0.25 ? "var(--auto)" : ACCENT }} />
                ))}
              </div>
              <div className="flex justify-between font-mono text-[10px] text-[var(--faint)]"><span>day 1</span><span>day 30</span></div>
              <ul className="mt-3 space-y-1 text-xs">
                {INCIDENTS.map((x) => <li key={x.day} className="flex justify-between gap-2"><span>Day {x.day}: {x.what}</span><span className="font-mono text-[var(--muted)]">{x.minutes} min</span></li>)}
              </ul>
              <p className="mt-3 font-mono text-sm" style={{ color: b.exhaustedOn ? "var(--bad)" : "var(--good)" }}>
                {b.exhaustedOn ? `Budget gone on day ${b.exhaustedOn}: freeze risky releases` : `${fmt(b.left)} left: keep shipping`}
              </p>
            </section>
          }
          panel={
            <SystemMapPanel caption={`${target}% over 30 days allows ${fmt(b.total)} of downtime. Measured availability was ${b.availability.toFixed(3)}%.`}>
              <Choices label="SLO target" accent={ACCENT} value={target} onChange={setTarget} options={TARGETS.map((t) => ({ id: String(t), label: `${t}%` }))} />
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="SLI: measure what users feel" what="A ratio of good events to all events: requests under 300 ms without a 5xx, say." accent={ACCENT}><p className="font-mono text-xs">good requests / all requests</p></FlowStep>
              <FlowArrow label="pick a target" accent={ACCENT} />
              <FlowStep n={2} title="SLO: how good is good enough" what="Each extra nine costs a lot more and leaves ten times less room. Pick what users actually need." accent={ACCENT} active><p className="text-sm text-[var(--muted)]">99.99% is 4.3 minutes a month.</p></FlowStep>
              <FlowArrow label="the rest is budget" accent={ACCENT} />
              <FlowStep n={3} title="The error budget is permission to take risks" what="Budget left: ship features and experiment. Budget burning fast: alert on the burn rate, not on every error." accent={ACCENT} active={!b.exhaustedOn}><p className="text-sm text-[var(--muted)]">Burn-rate alerts page only when it matters.</p></FlowStep>
              <FlowArrow label="when it runs out" accent={ACCENT} />
              <FlowStep n={4} title="Spent? Slow down and fix" what="Freeze risky releases and spend the time on reliability until the window rolls forward." accent={ACCENT} active={!!b.exhaustedOn}><p className="text-sm text-[var(--muted)]">Agreed in advance, so it isn&apos;t an argument.</p></FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
