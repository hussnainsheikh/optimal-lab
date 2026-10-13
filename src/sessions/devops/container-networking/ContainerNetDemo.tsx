"use client";

import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { useState } from "react";
import { Choices } from "@/components/session/ui";
import { CONTAINERS, TRIES } from "@/lib/containerNet";

const ACCENT = "var(--ops)";

export default function ContainerNetDemo() {
  const [i, setI] = useState("1");
  const t = TRIES[Number(i)];
  const hot = (n: string) => t.from === n || t.to.startsWith(n + ":");
  return (
    <SessionPage>
      <SessionHeader kicker="DevOps · interactive" title="Container networking" blurb="Each container has its own network namespace, its own localhost and its own IP on a Docker network. Containers on the same user-defined network find each other by name; the host only sees ports you publish." />
      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="Network diagram">
              <div className="rounded-lg border border-[var(--line-strong)] p-3">
                <p className="text-xs text-[var(--muted)]">Your laptop (host) {t.from.startsWith("your") ? <span style={{ color: ACCENT }}>← {t.from}</span> : null}</p>
                <div className="mt-2 rounded-lg border border-dashed border-[var(--line-strong)] p-2">
                  <p className="font-mono text-[11px] text-[var(--faint)]">docker network: app (172.18.0.0/16)</p>
                  <div className="mt-2 grid grid-cols-3 gap-2">{CONTAINERS.map((c) => <div key={c.name} className="rounded-md border-2 p-2 text-center" style={{ borderColor: hot(c.name) ? ACCENT : "var(--line)" }}><p className="font-medium">{c.name}</p><p className="font-mono text-[10px] text-[var(--muted)]">{c.ip}</p><p className="font-mono text-[10px]">{c.publish ? `-p ${c.publish}` : "not published"}</p></div>)}</div>
                </div>
              </div>
              <p className="mt-4 font-mono text-sm">{t.from} → {t.to}: <span style={{ color: t.ok ? "var(--good)" : "var(--bad)" }}>{t.ok ? "connected" : "connection refused"}</span></p>
            </section>
          }
          panel={<SystemMapPanel caption={t.note}><Choices label="Connection" accent={ACCENT} value={i} onChange={setI} options={TRIES.map((x, k) => ({ id: String(k), label: `${x.from} → ${x.to}` }))} /></SystemMapPanel>}
          detail={
            <>
              <FlowStep n={1} title="localhost means this container" what="The most common mistake: an app in a container connecting to localhost for a database in another container." accent={ACCENT} active={Number(i) === 1}><p className="text-sm text-[var(--muted)]">Use the service name instead.</p></FlowStep>
              <FlowArrow label="by name" accent={ACCENT} />
              <FlowStep n={2} title="Names resolve on user networks" what="Docker's embedded DNS (and Compose service names) map container names to IPs, which change on restart." accent={ACCENT} active={Number(i) === 2 || Number(i) === 4}><p className="font-mono text-xs">DATABASE_URL=postgres://db:5432/app</p></FlowStep>
              <FlowArrow label="from outside" accent={ACCENT} />
              <FlowStep n={3} title="Publish only what users need" what="-p host:container opens a port on the host. Keep databases unpublished in production." accent={ACCENT} active={Number(i) === 0 || Number(i) === 3}><p className="text-sm text-[var(--muted)]">-p 127.0.0.1:5432:5432 limits it to your machine.</p></FlowStep>
              <FlowArrow label="Kubernetes" accent={ACCENT} />
              <FlowStep n={4} title="Same idea, bigger" what="In Kubernetes, containers in a pod share localhost, pods talk via Service names, and Ingress publishes to the outside." accent={ACCENT}><p className="text-sm text-[var(--muted)]">See Services and Ingress.</p></FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
