"use client";

import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { useState } from "react";
import { Slider } from "@/components/session/ui";
import { horizontal, PER_VCPU, vertical } from "@/lib/scaleOut";

const ACCENT = "var(--sys)";
const LOADS = [200, 500, 1000, 3000, 8000, 15000, 30000, 60000];

export default function ScaleOutDemo() {
  const [li, setLi] = useState(2);
  const load = LOADS[li];
  const v = vertical(load), h = horizontal(load);
  return (
    <SessionPage>
      <SessionHeader kicker="System design · interactive" title="Scaling up vs scaling out" blurb={`Traffic grows. You can buy a bigger machine (vertical) or add more machines behind a load balancer (horizontal). Each vCPU handles about ${PER_VCPU} requests a second. Prices are illustrative.`} />
      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="Two ways to scale">
              <p className="font-mono text-sm">{load.toLocaleString()} requests / second</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border-2 p-3" style={{ borderColor: v.ok ? "var(--line)" : "var(--bad)" }}>
                  <p className="text-sm font-medium">Vertical</p>
                  <div className="mt-2 grid place-items-center rounded-md" style={{ height: 90, background: "var(--inset)" }}><span className="grid place-items-center rounded font-mono text-xs" style={{ width: `${20 + (v.size / 96) * 75}%`, height: `${20 + (v.size / 96) * 70}%`, background: v.ok ? ACCENT : "var(--bad)", color: "var(--on-accent)" }}>{v.size} vCPU</span></div>
                  <p className="mt-2 font-mono text-xs">${v.cost.toLocaleString()}/mo · capacity {v.cap.toLocaleString()}</p>
                  <p className="text-xs" style={{ color: v.ok ? "var(--muted)" : "var(--bad)" }}>{v.ok ? "One machine fails: 100% down" : "No machine is big enough"}</p>
                </div>
                <div className="rounded-lg border-2 border-[var(--line)] p-3">
                  <p className="text-sm font-medium">Horizontal</p>
                  <div className="mt-2 flex flex-wrap content-center gap-1 rounded-md p-2" style={{ minHeight: 90, background: "var(--inset)" }}>{Array.from({ length: Math.min(h.nodes, 40) }, (_, i) => <span key={i} className="h-5 w-5 rounded-sm" style={{ background: ACCENT }} />)}</div>
                  <p className="mt-2 font-mono text-xs">{h.nodes} × 4 vCPU + LB · ${h.cost.toLocaleString()}/mo</p>
                  <p className="text-xs text-[var(--muted)]">One machine fails: {h.lossOnFailure}% of capacity lost</p>
                </div>
              </div>
            </section>
          }
          panel={<SystemMapPanel caption={load <= 1000 ? "At low traffic, one bigger box is cheaper and far simpler. Just keep a standby for failures." : v.ok ? "Costs are similar now, but big machines carry a price premium and every failure is total." : "Past the biggest machine you can buy, scaling out is the only option."}><Slider label="Traffic" accent={ACCENT} value={li} min={0} max={LOADS.length - 1} step={1} format={(i) => `${LOADS[i].toLocaleString()} rps`} onChange={setLi} /></SystemMapPanel>}
          detail={
            <>
              <FlowStep n={1} title="Scale up first" what="A bigger instance needs no code changes. Databases in particular go a long way vertically." accent={ACCENT} active={load <= 1000}><p className="text-sm text-[var(--muted)]">Simple beats clever until it doesn&apos;t.</p></FlowStep>
              <FlowArrow label="limits" accent={ACCENT} />
              <FlowStep n={2} title="The ceiling and the single point of failure" what="There's a largest machine, the top sizes cost extra, and one box means one failure takes everything down." accent={ACCENT} active={!v.ok}><p className="text-sm text-[var(--muted)]">Upgrades usually mean downtime too.</p></FlowStep>
              <FlowArrow label="scale out" accent={ACCENT} />
              <FlowStep n={3} title="Many small, identical servers" what="A load balancer spreads requests. Losing one costs a slice of capacity, and you can add servers without downtime." accent={ACCENT} active={load > 1000}><p className="text-sm text-[var(--muted)]">Keep headroom for a node failure.</p></FlowStep>
              <FlowArrow label="the price" accent={ACCENT} />
              <FlowStep n={4} title="Servers must be stateless" what="Sessions, uploads and caches move out to shared stores so any server can handle any request. State is what's hard to scale out." accent={ACCENT}><p className="text-sm text-[var(--muted)]">Then autoscaling becomes possible.</p></FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
