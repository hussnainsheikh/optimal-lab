"use client";

import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { useState } from "react";
import { Choices } from "@/components/session/ui";
import { STRATS, type StratId } from "@/lib/failover";

const ACCENT = "var(--sys)";
const fmt = (m: number) => (m >= 60 ? `${(m / 60).toFixed(m % 60 ? 1 : 0)} h` : m >= 1 ? `${m} min` : "~0");

export default function FailoverDemo() {
  const [s, setS] = useState<StratId>("warm");
  const st = STRATS.find((x) => x.id === s)!;
  return (
    <SessionPage>
      <SessionHeader kicker="System design · interactive" title="Failover and disaster recovery" blurb="Your whole primary region goes dark. How long until you're back (RTO), and how much recent data is gone (RPO)? Faster recovery means paying to keep more running in a second region all the time. Figures are typical, not exact." />
      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="Strategies">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-xs text-[var(--faint)]"><th className="font-normal">strategy</th><th className="font-normal">RTO</th><th className="font-normal">RPO</th><th className="font-normal">cost</th></tr></thead>
                <tbody>{STRATS.map((x) => <tr key={x.id} style={{ background: x.id === s ? "var(--inset)" : undefined, color: x.id === s ? undefined : "var(--muted)" }}><td className="py-1.5 pl-1">{x.label}</td><td className="font-mono">{fmt(x.rtoMin)}</td><td className="font-mono">{fmt(x.rpoMin)}</td><td className="font-mono">{x.cost}×</td></tr>)}</tbody>
              </table>
              <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--faint)]">Recovery steps</p>
              <ol className="mt-1 space-y-1">{st.steps.map((x, i) => <li key={x} className="flex gap-2 text-sm"><span className="grid h-5 w-5 shrink-0 place-items-center rounded-full font-mono text-[10px]" style={{ background: ACCENT, color: "var(--on-accent)" }}>{i + 1}</span>{x}</li>)}</ol>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <div className="rounded-lg border border-[var(--line)] p-2"><p className="text-xs text-[var(--muted)]">Primary region</p><p className="font-mono text-sm text-[var(--bad)]">down</p></div>
                <div className="rounded-lg border-2 p-2" style={{ borderColor: ACCENT }}><p className="text-xs text-[var(--muted)]">Second region normally runs</p><p className="font-mono text-sm">{s === "backup" ? "nothing (backups only)" : s === "pilot" ? "database replica only" : s === "warm" ? "small full copy" : "full copy, serving traffic"}</p></div>
              </div>
            </section>
          }
          panel={<SystemMapPanel caption={`${st.label}: back in about ${fmt(st.rtoMin)}, losing up to ${fmt(st.rpoMin)} of data, for about ${st.cost}× the cost of a single region.`}><Choices label="Strategy" accent={ACCENT} value={s} onChange={setS} options={STRATS.map((x) => ({ id: x.id, label: x.label }))} /></SystemMapPanel>}
          detail={
            <>
              <FlowStep n={1} title="Agree RTO and RPO first" what="How long can the business be down, and how much data can it lose? The answers pick the strategy." accent={ACCENT}><p className="text-sm text-[var(--muted)]">Different systems get different targets.</p></FlowStep>
              <FlowArrow label="cheap" accent={ACCENT} />
              <FlowStep n={2} title="Backups and pilot light" what="Little runs in the second region; you rebuild during the disaster. Fine for internal tools." accent={ACCENT} active={s === "backup" || s === "pilot"}><p className="text-sm text-[var(--muted)]">Infrastructure as code makes rebuilding possible.</p></FlowStep>
              <FlowArrow label="faster" accent={ACCENT} />
              <FlowStep n={3} title="Warm standby and active-active" what="A running copy takes over in minutes or instantly. Active-active needs data replicated both ways and conflict handling." accent={ACCENT} active={s === "warm" || s === "active"}><p className="text-sm text-[var(--muted)]">Much more complex to build.</p></FlowStep>
              <FlowArrow label="prove it" accent={ACCENT} />
              <FlowStep n={4} title="Run failover drills" what="Untested DR plans fail. Practise regularly and time it: that's your real RTO." accent={ACCENT}><p className="text-sm text-[var(--muted)]">Game days, region evacuation tests.</p></FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
