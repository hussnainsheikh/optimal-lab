"use client";

import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { useState } from "react";
import { Slider } from "@/components/session/ui";
import { nines, PARTS, system } from "@/lib/availabilityNines";

const ACCENT = "var(--sys)";
const pct = (a: number) => `${(a * 100).toFixed(a > 0.9999 ? 4 : 3)}%`;
const dur = (m: number) => (m >= 60 ? `${(m / 60).toFixed(1)} h` : `${m.toFixed(m < 10 ? 1 : 0)} min`);

export default function NinesDemo() {
  const [apps, setApps] = useState(1);
  const [dbs, setDbs] = useState(1);
  const s = system(apps, dbs);
  const box = (label: string, a: number, n: number) => (
    <div className="flex-1 rounded-lg border border-[var(--line)] p-2 text-center">
      <p className="text-xs text-[var(--muted)]">{label}</p>
      <div className="my-1 flex justify-center gap-1">{Array.from({ length: n }, (_, i) => <span key={i} className="h-6 w-6 rounded" style={{ background: ACCENT }} />)}</div>
      <p className="font-mono text-xs">{pct(a)}</p>
    </div>
  );
  return (
    <SessionPage>
      <SessionHeader kicker="System design · interactive" title="Availability and the nines" blurb="A request needs the load balancer, an app server and the database all working. Availabilities in a chain multiply, so the whole is worse than any part. Redundant copies in parallel multiply the failure chances instead, which buys back the nines." />
      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="System availability">
              <div className="flex items-center gap-2">{box("Load balancer", PARTS.lb, 1)}<span className="text-[var(--faint)]">→</span>{box(`App ×${apps}`, s.app, apps)}<span className="text-[var(--faint)]">→</span>{box(`Database ×${dbs}`, s.db, dbs)}</div>
              <dl className="mt-4 grid grid-cols-3 gap-2">
                {[["Availability", pct(s.total)], ["Nines", nines(s.total).toFixed(1)], ["Down per year", dur(s.downMinYear)]].map(([k, v]) => <div key={k} className="rounded-lg bg-[var(--inset)] p-2"><dt className="text-xs text-[var(--faint)]">{k}</dt><dd className="font-mono text-lg">{v}</dd></div>)}
              </dl>
              <p className="mt-2 font-mono text-xs text-[var(--muted)]">{dur(s.downMinMonth)} a month · single parts: app 99.9%, db 99.95%, LB 99.99%</p>
            </section>
          }
          panel={
            <SystemMapPanel caption={apps === 1 && dbs === 1 ? `Three parts in a chain: 99.99% × 99.9% × 99.95% = ${pct(s.total)}, worse than every one of them. Over 14 hours of downtime a year.` : `Redundancy turns 0.1% failure into (0.1%)^n. Now ${pct(s.total)}: the load balancer is the weakest link.`}>
              <Slider label="App servers" accent={ACCENT} value={apps} min={1} max={3} step={1} format={String} onChange={setApps} />
              <Slider label="Database replicas with failover" accent={ACCENT} value={dbs} min={1} max={2} step={1} format={String} onChange={setDbs} />
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Each nine is 10× less downtime" what="99% is 3.65 days a year; 99.9% is 8.8 hours; 99.99% is 53 minutes; 99.999% is 5 minutes." accent={ACCENT}><p className="text-sm text-[var(--muted)]">Every nine costs much more.</p></FlowStep>
              <FlowArrow label="in series" accent={ACCENT} />
              <FlowStep n={2} title="Chains multiply down" what="Ten 99.9% services in a request path give about 99%. Every hard dependency counts." accent={ACCENT} active={apps === 1}><p className="font-mono text-xs">A = a₁ × a₂ × a₃</p></FlowStep>
              <FlowArrow label="in parallel" accent={ACCENT} />
              <FlowStep n={3} title="Redundancy multiplies failures" what="Two copies that fail independently are both down only (0.1%)² of the time, if failover works." accent={ACCENT} active={apps > 1 || dbs > 1}><p className="font-mono text-xs">A = 1 − (1 − a)ⁿ</p></FlowStep>
              <FlowArrow label="reality" accent={ACCENT} />
              <FlowStep n={4} title="Failures aren't independent" what="Shared zones, configs and deploys fail together. Spread across zones, and remember most outages are changes." accent={ACCENT}><p className="text-sm text-[var(--muted)]">Measure user-facing availability with SLOs.</p></FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
