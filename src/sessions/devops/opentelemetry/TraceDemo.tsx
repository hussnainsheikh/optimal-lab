"use client";

import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { useState } from "react";
import { Choices } from "@/components/session/ui";
import { SCENARIOS, trace, type Scenario } from "@/lib/traceSpans";

const ACCENT = "var(--ops)";

export default function TraceDemo() {
  const [s, setS] = useState<Scenario>("normal");
  const spans = trace(s);
  const total = spans[0].ms;
  const span = Math.max(total, 220);
  return (
    <SessionPage>
      <SessionHeader kicker="DevOps · interactive" title="Distributed tracing with OpenTelemetry" blurb="One click on Checkout passes through a gateway, auth, the checkout service, a database, a payments service and an external API. A trace records each step as a span with a start time and duration, all sharing one trace id, so you can see where the time went." />
      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="Trace waterfall">
              <p className="font-mono text-xs text-[var(--faint)]">trace 4bf92f35… · {spans.length} spans · {total} ms</p>
              <ul className="mt-2 space-y-0.5">
                {spans.map((sp, i) => (
                  <li key={i} className="grid grid-cols-[minmax(0,11rem)_minmax(0,1fr)] items-center gap-2 text-[11px]">
                    <span className="truncate" style={{ paddingLeft: sp.depth * 10 }}><span className="text-[var(--faint)]">{sp.service}</span> {sp.name}</span>
                    <span className="relative h-3.5 rounded bg-[var(--inset)]"><span className="absolute inset-y-0 rounded" style={{ left: `${(sp.start / span) * 100}%`, width: `${Math.max(0.6, (sp.ms / span) * 100)}%`, background: sp.error ? "var(--bad)" : sp.service === "postgres" ? "var(--c4)" : ACCENT }} /></span>
                  </li>
                ))}
              </ul>
            </section>
          }
          panel={<SystemMapPanel caption={s === "normal" ? `${total} ms end to end. Most of it is the external card charge, which is expected.` : s === "slow" ? "The waterfall points straight at the culprit: the external payments API took 1.4 s. Nothing in your own code is slow." : "Twelve tiny queries in a row, one per cart item: the N+1 pattern. Each is fast, together they add up. One query with IN (…) fixes it."}><Choices label="Scenario" accent={ACCENT} value={s} onChange={setS} options={SCENARIOS} /></SystemMapPanel>}
          detail={
            <>
              <FlowStep n={1} title="Spans nest into a trace" what="Each operation is a span with a parent. Together they form a tree for one request." accent={ACCENT}><p className="text-sm text-[var(--muted)]">Attributes add context: user, route, SQL.</p></FlowStep>
              <FlowArrow label="propagate" accent={ACCENT} />
              <FlowStep n={2} title="Context travels with calls" what="The trace id rides along in a traceparent header, so spans from different services join up." accent={ACCENT}><p className="font-mono text-xs">traceparent: 00-4bf92f35…-00f067aa…-01</p></FlowStep>
              <FlowArrow label="read it" accent={ACCENT} />
              <FlowStep n={3} title="Find the long bar" what="Waterfalls show slow dependencies, sequential calls that could be parallel, and N+1 queries." accent={ACCENT} active={s !== "normal"}><p className="text-sm text-[var(--muted)]">Link traces to logs by trace id.</p></FlowStep>
              <FlowArrow label="standard" accent={ACCENT} />
              <FlowStep n={4} title="OpenTelemetry is vendor-neutral" what="Instrument once with OTel SDKs (much is automatic), then export to Jaeger, Tempo, Honeycomb or Datadog." accent={ACCENT}><p className="text-sm text-[var(--muted)]">Sample to control volume.</p></FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
