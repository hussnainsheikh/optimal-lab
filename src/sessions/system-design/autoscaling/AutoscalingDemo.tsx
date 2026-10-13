"use client";

import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { useState } from "react";
import { Choices } from "@/components/session/ui";
import { CAP, POLICIES, simulate, type Policy } from "@/lib/autoscaling";

const ACCENT = "var(--sys)";
const MAX = 1300;

export default function AutoscalingDemo() {
  const [p, setP] = useState<Policy>("tuned");
  const r = simulate(p);
  const caption = p === "fixed" ? `Three servers handle normal traffic, then drop requests for the whole spike: ${(r.dropped / 1000).toFixed(0)}k lost.`
    : p === "reactive" ? `Scales every minute in both directions. Noise makes it add and remove servers constantly: ${r.events} scaling actions, and it still drops ${(r.dropped / 1000).toFixed(0)}k while new servers boot.`
    : `Scales out fast, keeps 30% headroom, and only scales in after 5 quiet minutes: ${r.events} actions, ${(r.dropped / 1000).toFixed(0)}k dropped while the first servers boot.`;
  return (
    <SessionPage>
      <SessionHeader kicker="System design · interactive" title="Autoscaling" blurb="Traffic jumps from about 180 to 650 requests a second for 18 minutes. Each server handles 100 req/s and takes 3 minutes to boot. Compare a fixed fleet with two scaling policies." />
      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="Load and capacity over an hour">
              <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">Load vs capacity, 60 minutes</p>
              <div className="relative mt-2 flex h-40 items-end gap-px">
                {r.minutes.map((x) => (
                  <span key={x.m} className="relative flex-1" style={{ height: "100%" }} title={`min ${x.m}: ${x.load} req/s, ${x.ready} ready, ${x.booting} booting`}>
                    <span className="absolute inset-x-0 bottom-0 rounded-t-sm" style={{ height: `${(Math.min(x.load, x.ready * CAP) / MAX) * 100}%`, background: ACCENT }} />
                    {x.dropped > 0 && <span className="absolute inset-x-0" style={{ bottom: `${((x.ready * CAP) / MAX) * 100}%`, height: `${(x.dropped / MAX) * 100}%`, background: "var(--bad)" }} />}
                    <span className="absolute inset-x-0 border-t-2 border-[var(--text)]" style={{ bottom: `${((x.ready * CAP) / MAX) * 100}%` }} />
                  </span>
                ))}
              </div>
              <div className="mt-1 flex justify-between font-mono text-[10px] text-[var(--faint)]"><span>0</span><span>spike 20–38</span><span>60 min</span></div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--muted)]">
                <span className="flex items-center gap-1.5"><span className="h-2 w-3 rounded-sm" style={{ background: ACCENT }} /> served</span>
                <span className="flex items-center gap-1.5"><span className="h-2 w-3 rounded-sm bg-[var(--bad)]" /> dropped</span>
                <span className="flex items-center gap-1.5"><span className="h-0.5 w-3 bg-[var(--text)]" /> capacity of ready servers</span>
              </div>
              <dl className="mt-4 grid grid-cols-3 gap-2">
                {[["Dropped", `${(r.dropped / 1000).toFixed(0)}k`], ["Server-minutes", r.cost], ["Scaling actions", r.events]].map(([k, v]) => <div key={String(k)} className="rounded-lg bg-[var(--inset)] p-2"><dt className="text-xs text-[var(--faint)]">{k}</dt><dd className="font-mono text-lg">{v}</dd></div>)}
              </dl>
            </section>
          }
          panel={<SystemMapPanel caption={caption}><Choices label="Policy" accent={ACCENT} value={p} onChange={setP} options={POLICIES} /></SystemMapPanel>}
          detail={
            <>
              <FlowStep n={1} title="Pick a signal" what="CPU, requests per server, or queue length. Requests and queue depth react before CPU saturates." accent={ACCENT}><p className="text-sm text-[var(--muted)]">Scale on what actually limits you.</p></FlowStep>
              <FlowArrow label="leave headroom" accent={ACCENT} />
              <FlowStep n={2} title="Target below 100%" what="Aim for ~70% so there's room to absorb growth while new servers boot." accent={ACCENT} active={p === "tuned"}><p className="text-sm text-[var(--muted)]">Boot time is the real enemy.</p></FlowStep>
              <FlowArrow label="avoid flapping" accent={ACCENT} />
              <FlowStep n={3} title="Scale out fast, in slowly" what="A cooldown before removing servers stops noise from causing add/remove churn." accent={ACCENT} active={p === "reactive"}><p className="text-sm text-[var(--muted)]">Each action has a cost: warm caches lost, connections reset.</p></FlowStep>
              <FlowArrow label="predictable peaks" accent={ACCENT} />
              <FlowStep n={4} title="Schedule or pre-warm known spikes" what="Daily peaks, launches and sales: scale ahead of time. Keep a minimum fleet for the first minutes of surprise." accent={ACCENT}><p className="text-sm text-[var(--muted)]">Reactive scaling can&apos;t beat boot time.</p></FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
