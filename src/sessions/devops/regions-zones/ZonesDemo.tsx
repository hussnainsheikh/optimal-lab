"use client";

import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { useState } from "react";
import { Choices } from "@/components/session/ui";
import { FAILURES, LAYOUTS, survives, type Layout } from "@/lib/zonesRegions";

const ACCENT = "var(--ops)";

export default function ZonesDemo() {
  const [l, setL] = useState<Layout>("multiaz");
  const [f, setF] = useState("az");
  const lay = LAYOUTS.find((x) => x.id === l)!;
  const ok = survives(l, f).startsWith("yes");
  const regions = l === "multiregion" ? 2 : 1;
  const zones = l === "one" ? 1 : 3;
  const dead = (r: number, z: number) => (f === "region" && r === 0) || (f === "az" && r === 0 && z === 0);
  return (
    <SessionPage>
      <SessionHeader kicker="DevOps · interactive" title="Regions and availability zones" blurb="A cloud region is a metro area; inside it, availability zones are separate data centres with their own power and network, a few milliseconds apart. Where you place copies decides which failures you ride out." />
      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="Deployment map">
              <div className="grid gap-2 sm:grid-cols-2">
                {Array.from({ length: regions }, (_, r) => (
                  <div key={r} className="rounded-lg border border-[var(--line-strong)] p-2" style={{ opacity: f === "region" && r === 0 ? 0.5 : 1 }}>
                    <p className="text-xs text-[var(--muted)]">{r === 0 ? "eu-west-1 (Ireland)" : "eu-central-1 (Frankfurt)"}</p>
                    <div className="mt-1 grid grid-cols-3 gap-1">{Array.from({ length: 3 }, (_, z) => <div key={z} className="rounded border p-1 text-center text-[10px]" style={{ borderColor: dead(r, z) ? "var(--bad)" : "var(--line)", opacity: z < zones ? 1 : 0.3 }}>zone {String.fromCharCode(97 + z)}<div className="mt-1 flex justify-center gap-0.5">{z < zones && Array.from({ length: 2 }, (_, k) => <span key={k} className="h-3 w-3 rounded-sm" style={{ background: dead(r, z) ? "var(--bad)" : ACCENT }} />)}</div></div>)}</div>
                  </div>
                ))}
              </div>
              <p className="mt-4 font-mono text-sm" style={{ color: ok ? "var(--good)" : "var(--bad)" }}>{FAILURES.find((x) => x.id === f)!.label}: {ok ? "still serving" : "down"}</p>
              <p className="mt-1 text-xs text-[var(--muted)]">Cost {lay.cost} · latency {lay.latency}</p>
            </section>
          }
          panel={
            <SystemMapPanel caption={`${survives(l, f).replace(/^./, (ch) => ch.toUpperCase())}. ${l === "multiaz" ? "Multi-zone is the sweet spot for most apps: cheap and covers the common failures." : l === "one" ? "One zone is fine for dev, risky for production." : "Two regions survive almost anything, but data replication and failover get much harder."}`}>
              <Choices label="Deployment" accent={ACCENT} value={l} onChange={setL} options={LAYOUTS.map((x) => ({ id: x.id, label: x.label }))} />
              <Choices label="Failure" accent={ACCENT} value={f} onChange={setF} options={FAILURES.map((x) => ({ id: x.id, label: x.label }))} />
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Zones: separate buildings, same city" what="Independent power and cooling, connected by fast links. Most managed services already span zones." accent={ACCENT}><p className="text-sm text-[var(--muted)]">Zone names differ per account.</p></FlowStep>
              <FlowArrow label="default" accent={ACCENT} />
              <FlowStep n={2} title="Spread across at least two zones" what="Run instances in several zones behind a load balancer, with a multi-AZ database." accent={ACCENT} active={l === "multiaz"}><p className="text-sm text-[var(--muted)]">Cross-zone traffic is billed: keep chatty services together.</p></FlowStep>
              <FlowArrow label="beyond" accent={ACCENT} />
              <FlowStep n={3} title="Regions for disaster recovery or latency" what="A second region protects against regional outages and serves far-away users faster, at real cost and complexity." accent={ACCENT} active={l === "multiregion"}><p className="text-sm text-[var(--muted)]">See failover and DR.</p></FlowStep>
              <FlowArrow label="also" accent={ACCENT} />
              <FlowStep n={4} title="Data residency" what="Laws may require data to stay in a country or region. Pick regions for compliance as well as resilience." accent={ACCENT}><p className="text-sm text-[var(--muted)]">GDPR, data localisation rules.</p></FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
