"use client";

import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { useState } from "react";
import { Choices } from "@/components/session/ui";
import { FLOWS } from "@/lib/vpcFlows";

const ACCENT = "var(--ops)";

export default function VpcDemo() {
  const [id, setId] = useState("in-web");
  const f = FLOWS.find((x) => x.id === id)!;
  const lit = (s: string) => f.path.some((p) => p.toLowerCase().includes(s));
  const zone = (title: string, key: string, items: string[]) => (
    <div className="rounded-lg border-2 p-2" style={{ borderColor: lit(key) ? ACCENT : "var(--line)" }}>
      <p className="text-xs text-[var(--muted)]">{title}</p>
      <div className="mt-1 flex flex-wrap gap-1">{items.map((x) => <span key={x} className="rounded px-2 py-1 text-xs" style={{ background: lit(x.split(" ")[0].toLowerCase()) ? ACCENT : "var(--inset)", color: lit(x.split(" ")[0].toLowerCase()) ? "var(--on-accent)" : undefined }}>{x}</span>)}</div>
    </div>
  );
  return (
    <SessionPage>
      <SessionHeader kicker="DevOps · interactive" title="VPCs, subnets and security groups" blurb="A VPC is your private network in the cloud. Public subnets route to the internet gateway; private subnets don't, and reach out only through a NAT gateway. Security groups then allow specific ports from specific sources. Trace five flows." />
      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="VPC diagram">
              <div className="grid gap-2 sm:grid-cols-[auto_1fr]">
                <div className="rounded-lg border border-dashed border-[var(--line-strong)] p-2 text-center text-xs" style={{ borderColor: lit("internet") ? ACCENT : undefined }}>Internet<br />Internet gateway</div>
                <div className="space-y-2 rounded-lg border border-[var(--line-strong)] p-2">
                  <p className="font-mono text-[11px] text-[var(--faint)]">VPC 10.0.0.0/16</p>
                  {zone("Public subnet 10.0.1.0/24 · route 0.0.0.0/0 → IGW", "public", ["web server", "NAT gateway"])}
                  {zone("Private subnet 10.0.2.0/24 · route 0.0.0.0/0 → NAT", "private", ["database"])}
                </div>
              </div>
              <ol className="mt-4 flex flex-wrap items-center gap-1 text-xs">{f.path.map((p, k) => <li key={k} className="flex items-center gap-1"><span className="rounded px-2 py-1" style={{ background: p.startsWith("✗") ? "var(--bad)" : "var(--inset)", color: p.startsWith("✗") ? "var(--on-accent)" : undefined }}>{p}</span>{k < f.path.length - 1 && <span className="text-[var(--faint)]">→</span>}</li>)}</ol>
              <p className="mt-3 font-mono text-sm" style={{ color: f.ok ? "var(--good)" : "var(--bad)" }}>{f.ok ? "Allowed" : "Blocked"}</p>
            </section>
          }
          panel={<SystemMapPanel caption={f.note}><Choices label="Traffic" accent={ACCENT} value={id} onChange={setId} options={FLOWS.map((x) => ({ id: x.id, label: x.label }))} /></SystemMapPanel>}
          detail={
            <>
              <FlowStep n={1} title="Route tables make subnets public or private" what="A subnet is public only if its route table sends internet traffic to an internet gateway." accent={ACCENT}><p className="text-sm text-[var(--muted)]">Spread subnets across availability zones.</p></FlowStep>
              <FlowArrow label="outbound only" accent={ACCENT} />
              <FlowStep n={2} title="NAT for private subnets" what="Private resources can start connections out (updates, APIs) but can't be reached from outside." accent={ACCENT} active={id === "db-out"}><p className="text-sm text-[var(--muted)]">NAT gateways cost per GB: watch the bill.</p></FlowStep>
              <FlowArrow label="per resource" accent={ACCENT} />
              <FlowStep n={3} title="Security groups are stateful firewalls" what="Allow rules by port and source. Referencing another security group (web SG) beats hard-coding IPs." accent={ACCENT} active={id === "web-db" || id === "laptop-db"}><p className="text-sm text-[var(--muted)]">Replies to allowed traffic are automatic.</p></FlowStep>
              <FlowArrow label="admin access" accent={ACCENT} />
              <FlowStep n={4} title="No open database ports" what="Reach private hosts through SSM Session Manager or a bastion, never by opening 5432 to the world." accent={ACCENT}><p className="text-sm text-[var(--muted)]">VPC flow logs show what was rejected.</p></FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
