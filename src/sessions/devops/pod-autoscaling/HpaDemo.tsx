"use client";

import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { useState } from "react";
import { Slider } from "@/components/session/ui";
import { MAX, MIN, REQUEST_M, settle, TARGET } from "@/lib/hpa";

const ACCENT = "var(--ops)";

export default function HpaDemo() {
  const [load, setLoad] = useState(3000);
  const st = settle(load);
  const last = st[st.length - 1];
  const finalPods = last.desired;
  const finalUtil = (load / finalPods / REQUEST_M) * 100;
  return (
    <SessionPage>
      <SessionHeader kicker="DevOps · interactive" title="Pod autoscaling (HPA)" blurb={`The Horizontal Pod Autoscaler compares average CPU use with each pod's request (${REQUEST_M}m here) and aims for ${TARGET}%. Its rule is one line: desired = ceil(current pods × current% ÷ target%). Change the total CPU the app needs.`} />
      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="Scaling decisions">
              <ol className="space-y-1 font-mono text-xs">{st.map((x, i) => <li key={i} className="rounded bg-[var(--inset)] px-2 py-1">{x.cur} pods at {x.util.toFixed(0)}% → ceil({x.cur} × {x.util.toFixed(0)} ÷ {TARGET}) = {x.raw}{x.capped ? ` → capped at ${MAX}` : x.raw < MIN ? ` → min ${MIN}` : ""} → <b>{x.desired}</b></li>)}</ol>
              <div className="mt-4 flex flex-wrap gap-1.5">{Array.from({ length: MAX }, (_, i) => <span key={i} className="grid h-12 w-12 place-items-end overflow-hidden rounded border" style={{ borderColor: i < finalPods ? ACCENT : "var(--line)", opacity: i < finalPods ? 1 : 0.3 }}>{i < finalPods && <span className="block w-full" style={{ height: `${Math.min(100, finalUtil)}%`, background: finalUtil > 85 ? "var(--bad)" : ACCENT }} />}</span>)}</div>
              <p className="mt-2 font-mono text-sm">{finalPods} pods at ~{finalUtil.toFixed(0)}% of their CPU request</p>
            </section>
          }
          panel={<SystemMapPanel caption={last.capped ? `The formula wants ${last.raw} pods but maxReplicas is ${MAX}. Pods run hot at ${finalUtil.toFixed(0)}%: raise the max or make the app cheaper.` : `Settles at ${finalPods} pods, close to the ${TARGET}% target, leaving headroom for spikes.`}><Slider label="Total CPU the app needs" accent={ACCENT} value={load} min={300} max={8000} step={100} format={(v) => `${v}m`} onChange={setLoad} /></SystemMapPanel>}
          detail={
            <>
              <FlowStep n={1} title="Utilisation is relative to requests" what="60% means 60% of the CPU each pod requested. Without requests the HPA can't compute anything." accent={ACCENT}><p className="font-mono text-xs">resources.requests.cpu: 500m</p></FlowStep>
              <FlowArrow label="the rule" accent={ACCENT} />
              <FlowStep n={2} title="Proportional scaling" what="Twice the target utilisation means twice the pods, recomputed every 15 seconds from metrics-server." accent={ACCENT} active><p className="text-sm text-[var(--muted)]">Custom metrics (queue depth, RPS) work the same way.</p></FlowStep>
              <FlowArrow label="limits" accent={ACCENT} />
              <FlowStep n={3} title="Min, max and stabilisation" what="Bounds stop runaway scaling; a scale-down window (5 minutes by default) prevents flapping." accent={ACCENT} active={last.capped}><p className="text-sm text-[var(--muted)]">New pods take time to become ready.</p></FlowStep>
              <FlowArrow label="and nodes" accent={ACCENT} />
              <FlowStep n={4} title="Pods need somewhere to run" what="If nodes are full, new pods stay Pending until the cluster autoscaler adds a node, which takes minutes." accent={ACCENT}><p className="text-sm text-[var(--muted)]">See pod scheduling.</p></FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
