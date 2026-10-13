"use client";

import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { useState } from "react";
import { Choices } from "@/components/session/ui";
import { REQUESTS, STAGES } from "@/lib/apiGateway";

const ACCENT = "var(--sys)";

export default function ApiGatewayDemo() {
  const [i, setI] = useState("0");
  const r = REQUESTS[Number(i)];
  const reached = r.stop === null ? STAGES.length : r.stop + 1;
  return (
    <SessionPage>
      <SessionHeader kicker="System design · interactive" title="API gateways" blurb="A gateway is the single front door to many services. It terminates TLS, checks auth, applies rate limits, serves cached responses and routes the rest, so each service doesn't have to. Send different requests and see where each one stops." />
      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="Gateway stages">
              <p className="font-mono text-sm">{r.label}</p>
              <ol className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-6">
                {STAGES.map((s, k) => { const passed = k < reached; const stop = r.stop === k; return <li key={s} className="rounded-lg border-2 p-2 text-center text-xs" style={{ borderColor: stop ? (r.status === 200 ? "var(--good)" : "var(--bad)") : passed ? ACCENT : "var(--line)", opacity: passed ? 1 : 0.4 }}>{s}{stop && <span className="block font-mono">{r.status === 200 ? "served" : r.status}</span>}</li>; })}
              </ol>
              <p className="mt-4 font-mono text-lg" style={{ color: r.status === 200 ? "var(--good)" : "var(--bad)" }}>{r.status}</p>
            </section>
          }
          panel={<SystemMapPanel caption={r.note}><Choices label="Request" accent={ACCENT} value={i} onChange={setI} options={REQUESTS.map((x, k) => ({ id: String(k), label: x.label }))} /></SystemMapPanel>}
          detail={
            <>
              <FlowStep n={1} title="One front door" what="Clients see one host. Behind it, routes map to many services that can move and change." accent={ACCENT}><p className="text-sm text-[var(--muted)]">/orders → orders service, /search → search.</p></FlowStep>
              <FlowArrow label="cross-cutting checks" accent={ACCENT} />
              <FlowStep n={2} title="Auth and quotas in one place" what="Validate tokens and scopes, enforce per-client rate limits, log every call, consistently." accent={ACCENT} active={r.stop === 1 || r.stop === 2}><p className="text-sm text-[var(--muted)]">Services still check their own permissions.</p></FlowStep>
              <FlowArrow label="save work" accent={ACCENT} />
              <FlowStep n={3} title="Cache and transform" what="Serve repeat GETs from cache, compress, rewrite paths, translate protocols." accent={ACCENT} active={r.stop === 3}><p className="text-sm text-[var(--muted)]">A BFF tailors responses per client.</p></FlowStep>
              <FlowArrow label="watch out" accent={ACCENT} />
              <FlowStep n={4} title="Keep it thin" what="It's on every request path: make it highly available, and keep business logic out of it." accent={ACCENT}><p className="text-sm text-[var(--muted)]">Kong, AWS API Gateway, Envoy.</p></FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
