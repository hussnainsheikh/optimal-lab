"use client";

import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { useState } from "react";
import { bill, FIXES, LINES } from "@/lib/cloudBill";

const ACCENT = "var(--ops)";
const before = LINES.reduce((a, l) => a + l.usd, 0);

export default function CloudCostsDemo() {
  const [on, setOn] = useState<Set<string>>(new Set());
  const b = bill(on);
  const now = b.reduce((a, l) => a + l.now, 0);
  const toggle = (id: string) => setOn((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const max = Math.max(...LINES.map((l) => l.usd));
  return (
    <SessionPage>
      <SessionHeader kicker="DevOps · interactive" title="Understanding the cloud bill" blurb="A typical monthly bill, line by line. Compute is the obvious cost, but networking (NAT gateways, data transfer out) and logs often surprise people. Apply common fixes and watch what moves. Figures are illustrative." />
      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="Bill">
              <ul className="space-y-2">{b.map((l) => <li key={l.id}><p className="flex justify-between text-sm"><span>{l.label}</span><span className="font-mono">${l.now.toLocaleString()}{l.now < l.usd && <span className="ml-1 text-xs text-[var(--faint)] line-through">${l.usd.toLocaleString()}</span>}</span></p><span className="relative mt-0.5 block h-2.5 rounded bg-[var(--track)]"><span className="absolute inset-y-0 left-0 rounded" style={{ width: `${(l.usd / max) * 100}%`, background: "var(--ghost)" }} /><span className="absolute inset-y-0 left-0 rounded" style={{ width: `${(l.now / max) * 100}%`, background: ACCENT }} /></span></li>)}</ul>
              <p className="mt-4 font-mono text-lg">${now.toLocaleString()}/mo <span className="text-sm" style={{ color: "var(--good)" }}>{now < before ? `−${Math.round((1 - now / before) * 100)}%` : ""}</span></p>
            </section>
          }
          panel={
            <SystemMapPanel caption={on.size ? `Saving $${(before - now).toLocaleString()} a month ($${((before - now) * 12).toLocaleString()} a year) without changing what the app does.` : "Before optimising anything, tag resources by team and service so you can see who spends what."}>
              <div className="w-full space-y-1.5">{FIXES.map((f) => <label key={f.id} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-md border border-[var(--line)] px-2 text-sm"><input type="checkbox" checked={on.has(f.id)} onChange={() => toggle(f.id)} style={{ accentColor: ACCENT }} /><span className="flex-1">{f.label}</span><span className="font-mono text-[10px] text-[var(--faint)]">−{Math.round(f.cut * 100)}%</span></label>)}</div>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="See it first" what="Tag everything by team, service and environment; review the bill by tag monthly." accent={ACCENT}><p className="text-sm text-[var(--muted)]">Cost Explorer, Kubecost, Infracost in PRs.</p></FlowStep>
              <FlowArrow label="compute" accent={ACCENT} />
              <FlowStep n={2} title="Right-size, then commit" what="Shrink instances that idle at 10% CPU, then buy savings plans for the steady base. Spot instances for interruptible work." accent={ACCENT} active={on.has("rightsize") || on.has("commit")}><p className="text-sm text-[var(--muted)]">Turn off dev environments at night.</p></FlowStep>
              <FlowArrow label="networking" accent={ACCENT} />
              <FlowStep n={3} title="Data movement is billed" what="NAT gateways charge per GB, egress to the internet per GB. VPC endpoints and CDNs cut both." accent={ACCENT} active={on.has("endpoints") || on.has("cdn")}><p className="text-sm text-[var(--muted)]">Cross-zone and cross-region traffic too.</p></FlowStep>
              <FlowArrow label="storage and logs" accent={ACCENT} />
              <FlowStep n={4} title="Retention policies" what="Lifecycle rules move old objects to cheaper tiers; drop debug logs and keep logs only as long as you use them." accent={ACCENT} active={on.has("lifecycle") || on.has("retention")}><p className="text-sm text-[var(--muted)]">Delete orphaned disks and snapshots.</p></FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
