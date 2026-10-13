"use client";

import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { useState } from "react";
import { Choices } from "@/components/session/ui";
import { run, STRATEGIES, type Strategy } from "@/lib/deployStrategies";

const ACCENT = "var(--sys)";

export default function DeployDemo() {
  const [s, setS] = useState<Strategy>("canary");
  const r = run(s);
  const caption = s === "rolling" ? `Instances switch two at a time and the bad version spreads until a human notices: ${r.bad.toLocaleString()} failed requests.`
    : s === "blue-green" ? `Everyone moves to v2 at once, so the bug hits all traffic, but switching back is instant: ${r.bad} failed requests.`
    : `Only 10% of traffic sees v2. Its error rate is compared with the old version and it's rolled back automatically: ${r.bad} failed requests.`;
  return (
    <SessionPage>
      <SessionHeader kicker="System design · interactive" title="Deployment strategies" blurb="Version 2 has a bug that fails 30% of requests. You don't know that yet. How many users get hurt depends on how you roll it out. Ten instances, 1,000 requests per step." />
      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="Rollout steps">
              <ol className="space-y-2">
                {r.steps.map((st) => (
                  <li key={st.step} className="grid grid-cols-[3rem_minmax(0,1fr)] items-center gap-2 sm:grid-cols-[3rem_12rem_minmax(0,1fr)]">
                    <span className="font-mono text-xs text-[var(--faint)]">step {st.step}</span>
                    <span className="flex gap-0.5">{Array.from({ length: 10 }, (_, i) => <span key={i} className="h-5 flex-1 rounded-sm" style={{ background: i < st.v2 ? "var(--bad)" : ACCENT, opacity: i < st.v2 ? 0.85 : 0.6 }} />)}</span>
                    <span className="col-span-2 text-xs text-[var(--muted)] sm:col-span-1">{st.note}{st.bad ? <span className="font-mono text-[var(--bad)]"> · {st.bad} failed</span> : null}</span>
                  </li>
                ))}
              </ol>
              <div className="mt-3 flex gap-4 text-xs text-[var(--muted)]"><span className="flex items-center gap-1.5"><span className="h-2 w-3 rounded-sm" style={{ background: ACCENT, opacity: 0.6 }} /> v1</span><span className="flex items-center gap-1.5"><span className="h-2 w-3 rounded-sm bg-[var(--bad)]" /> v2 (buggy)</span></div>
              <p className="mt-3 font-mono text-sm">{r.bad.toLocaleString()} failed requests in total</p>
            </section>
          }
          panel={<SystemMapPanel caption={caption}><Choices label="Strategy" accent={ACCENT} value={s} onChange={setS} options={STRATEGIES} /></SystemMapPanel>}
          detail={
            <>
              <FlowStep n={1} title="Rolling: replace a few at a time" what="No extra servers needed, and Kubernetes does it by default. But old and new run side by side, and a bug spreads gradually." accent={ACCENT} active={s === "rolling"}><p className="font-mono text-xs">maxSurge: 25% · maxUnavailable: 0</p></FlowStep>
              <FlowArrow label="two full environments" accent={ACCENT} />
              <FlowStep n={2} title="Blue-green: flip all traffic" what="Warm up a complete copy, switch the router, keep the old one for instant rollback. Costs double capacity during the switch." accent={ACCENT} active={s === "blue-green"}><p className="text-sm text-[var(--muted)]">Database changes still need care.</p></FlowStep>
              <FlowArrow label="test on a slice" accent={ACCENT} />
              <FlowStep n={3} title="Canary: a small slice first" what="Send a few percent of traffic to the new version, compare error rate and latency with the old, then widen or roll back automatically." accent={ACCENT} active={s === "canary"}><p className="text-sm text-[var(--muted)]">Argo Rollouts and Flagger automate the analysis.</p></FlowStep>
              <FlowArrow label="decouple deploy from release" accent={ACCENT} />
              <FlowStep n={4} title="Feature flags" what="Ship the code switched off and turn it on per user or percentage. Rolling back is flipping a flag." accent={ACCENT}><p className="text-sm text-[var(--muted)]">Make database migrations backwards-compatible first.</p></FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
