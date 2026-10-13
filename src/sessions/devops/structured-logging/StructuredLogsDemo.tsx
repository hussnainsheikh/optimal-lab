"use client";

import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { useState } from "react";
import { Choices } from "@/components/session/ui";
import { GREP, JSONL, jsonHits, PLAIN, plainHits, QUERY } from "@/lib/structuredLogs";

const ACCENT = "var(--ops)";

export default function StructuredLogsDemo() {
  const [f, setF] = useState("plain");
  const hits = f === "plain" ? plainHits() : jsonHits();
  return (
    <SessionPage>
      <SessionHeader kicker="DevOps · interactive" title="Structured logging" blurb="A customer says checkout failed. Find every error for user 42. With free-text logs, each developer wrote it differently, so the search misses. With structured logs, every event has the same named fields, and the question is a query." />
      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="Logs and search">
              <p className="rounded-md bg-[var(--inset)] p-2 font-mono text-xs">{f === "plain" ? `$ ${GREP}` : `query: ${QUERY}`}</p>
              <ol className="mt-3 space-y-1">
                {(f === "plain" ? PLAIN : JSONL.map((j) => JSON.stringify(j))).map((l, i) => (
                  <li key={i} className="break-all rounded px-2 py-1 font-mono text-[11px]" style={{ background: hits.includes(i) ? ACCENT : "var(--inset)", color: hits.includes(i) ? "var(--on-accent)" : undefined }}>{l}</li>
                ))}
              </ol>
              <p className="mt-3 font-mono text-sm" style={{ color: hits.length ? "var(--good)" : "var(--bad)" }}>{hits.length} matches{hits.length === 0 ? " (but there are two real errors for user 42)" : ""}</p>
            </section>
          }
          panel={<SystemMapPanel caption={f === "plain" ? "The errors say “customer #42” and “user_id: 42”, not “user 42”. Free text forces you to guess every spelling, and you'll miss some." : "Same fields everywhere: filter on level and user_id, then follow request_id a91f across both services to see the whole failed checkout."}><Choices label="Log format" accent={ACCENT} value={f} onChange={setF} options={[{ id: "plain", label: "Free text" }, { id: "json", label: "Structured JSON" }]} /></SystemMapPanel>}
          detail={
            <>
              <FlowStep n={1} title="Log events, not sentences" what="A message plus key-value fields: level, service, user_id, request_id, error code." accent={ACCENT}><p className="font-mono text-xs">logger.error({"{ user_id, reason }"}, &quot;payment failed&quot;)</p></FlowStep>
              <FlowArrow label="connect" accent={ACCENT} />
              <FlowStep n={2} title="Pass a request id everywhere" what="Generate it at the edge and include it in every log line and downstream call. One id finds the whole story." accent={ACCENT} active={f === "json"}><p className="text-sm text-[var(--muted)]">Trace ids from OpenTelemetry work too.</p></FlowStep>
              <FlowArrow label="query" accent={ACCENT} />
              <FlowStep n={3} title="Ship to a searchable store" what="Loki, Elasticsearch, CloudWatch or Datadog index the fields, so filters and counts are instant." accent={ACCENT}><p className="text-sm text-[var(--muted)]">Dashboards and alerts on log fields too.</p></FlowStep>
              <FlowArrow label="hygiene" accent={ACCENT} />
              <FlowStep n={4} title="Levels, sampling, no secrets" what="Keep debug off in production, sample noisy logs, and never log passwords, tokens or full card numbers." accent={ACCENT}><p className="text-sm text-[var(--muted)]">Redact at the logger.</p></FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
