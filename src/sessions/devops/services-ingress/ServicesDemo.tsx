"use client";

import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { useState } from "react";
import { Choices } from "@/components/session/ui";
import { cluster, route, RULES, SCENARIOS, type Scenario } from "@/lib/k8sServices";

const ACCENT = "var(--ops)";

export default function ServicesDemo() {
  const [s, setS] = useState<Scenario>("healthy");
  const c = cluster(s);
  const rs = route(s);
  return (
    <SessionPage>
      <SessionHeader kicker="DevOps · interactive" title="Services and Ingress" blurb="Pods come and go with new IPs. A Service gives a stable name and load-balances to whichever pods match its label selector and are ready. An Ingress maps hostnames and paths from outside to Services." />
      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="Ingress, Services and Pods">
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--faint)]">Ingress rules</p>
                  <ul className="mt-1 space-y-1 font-mono text-[11px]">{RULES.map((r) => <li key={r.path} className="rounded bg-[var(--inset)] px-2 py-1">{r.host}{r.path} → {r.service}</li>)}</ul>
                </div>
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--faint)]">Services</p>
                  <ul className="mt-1 space-y-1 font-mono text-[11px]">{c.services.map((sv) => <li key={sv.name} className="rounded border px-2 py-1" style={{ borderColor: c.endpoints[sv.name].length ? "var(--line)" : "var(--bad)" }}>{sv.name} · selector <span style={{ color: s === "selector" && sv.name === "api" ? "var(--bad)" : undefined }}>{sv.selector}</span><br /><span className="text-[var(--muted)]">endpoints: {c.endpoints[sv.name].length}</span></li>)}</ul>
                </div>
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--faint)]">Pods</p>
                  <ul className="mt-1 space-y-1 font-mono text-[11px]">{c.pods.map((p) => <li key={p.name} className="rounded bg-[var(--inset)] px-2 py-1" style={{ opacity: p.ready ? 1 : 0.5 }}>{p.name} <span className="text-[var(--muted)]">{p.labels}</span>{!p.ready && <span className="text-[var(--auto)]"> not ready</span>}</li>)}</ul>
                </div>
              </div>
              <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--faint)]">Requests</p>
              <ul className="mt-1 space-y-1">{rs.map((r, i) => <li key={i} className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 rounded px-2 py-1 text-xs" style={{ background: "var(--inset)" }}><span className="truncate font-mono">{r.url}</span><span className="font-mono" style={{ color: r.status === 200 ? "var(--good)" : "var(--bad)" }}>{r.status} {r.pod ?? ""}</span></li>)}</ul>
            </section>
          }
          panel={<SystemMapPanel caption={s === "healthy" ? "Each path maps to a Service; the Service round-robins across its ready pods. The unknown host gets a 404 from the Ingress." : s === "selector" ? "The api Service selects app=apii, which matches no pods. Pods are healthy, yet every /api request gets a 503. Check kubectl get endpoints first." : "The unready pod is quietly dropped from the Service's endpoints. Traffic goes to the other two; no errors."}><Choices label="Cluster state" accent={ACCENT} value={s} onChange={setS} options={SCENARIOS} /></SystemMapPanel>}
          detail={
            <>
              <FlowStep n={1} title="Pods are disposable" what="They get new names and IPs whenever they restart or scale. Nothing should talk to a pod IP directly." accent={ACCENT}><p className="text-sm text-[var(--muted)]">Deployments create and replace them.</p></FlowStep>
              <FlowArrow label="stable front" accent={ACCENT} />
              <FlowStep n={2} title="A Service selects pods by label" what="It gets a stable virtual IP and DNS name (api.default.svc). Its endpoints are the ready pods whose labels match." accent={ACCENT} active={s !== "healthy"}><p className="font-mono text-xs">kubectl get endpoints api</p></FlowStep>
              <FlowArrow label="from outside" accent={ACCENT} />
              <FlowStep n={3} title="Ingress routes HTTP by host and path" what="One load balancer, many services. An Ingress controller (nginx, Traefik, a cloud LB) implements the rules and terminates TLS." accent={ACCENT}><p className="text-sm text-[var(--muted)]">Gateway API is the newer, richer version.</p></FlowStep>
              <FlowArrow label="debugging" accent={ACCENT} />
              <FlowStep n={4} title="Work inward" what="404 means no Ingress rule; 503 usually means no endpoints, so check the selector and readiness; then logs." accent={ACCENT}><p className="text-sm text-[var(--muted)]">Labels are the glue; typos are silent.</p></FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
