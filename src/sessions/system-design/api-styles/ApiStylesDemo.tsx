"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { ITEM, ORDER, PRODUCT, SCENARIOS, STYLES, USER, jsonBytes, kb, ms, run, type ScenarioId, type StyleId } from "@/lib/apiStyles";

const ACCENT = "var(--sys)";
const VERDICT = { good: "var(--good)", ok: "var(--text)", bad: "var(--bad)" } as const;
const VERDICT_WORD = { good: "a good fit", ok: "works", bad: "a poor fit" } as const;

export default function ApiStylesDemo() {
  const [style, setStyle] = useState<StyleId>("rest");
  const [sc, setSc] = useState<ScenarioId>("profile");
  const scenario = SCENARIOS.find((s) => s.id === sc)!;
  const r = run(style, sc);
  const all = Object.fromEntries(STYLES.map((s) => [s.id, run(s.id, sc)])) as Record<StyleId, ReturnType<typeof run>>;
  const maxBytes = Math.max(...r.exchange.map((m) => m.bytes * m.count));

  return (
    <SessionPage>
      <SessionHeader
        kicker="System design · interactive"
        title="REST, GraphQL, gRPC and WebSockets"
        blurb={`Four ways to shape an API, given three real jobs. For each one, count the requests, the round trips, the bytes on the wire and how many of the fields the screen asked for. The byte counts are measured from real sample records: a user is ${jsonBytes(USER)} bytes of JSON, an order ${jsonBytes(ORDER)}, an item ${jsonBytes(ITEM)}, a product ${jsonBytes(PRODUCT)}.`}
      />

      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="What goes over the wire, and the totals">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">
                  {STYLES.find((s) => s.id === style)!.label} · {scenario.label.toLowerCase()}
                </p>
                <p className="font-mono text-sm" style={{ color: VERDICT[r.verdict] }}>
                  {VERDICT_WORD[r.verdict]}
                </p>
              </div>
              <ol className="mt-3 space-y-1.5">
                {r.exchange.map((m, i) => (
                  <li key={i} className="grid grid-cols-[1.25rem_minmax(0,1fr)_4.5rem] items-center gap-2 text-xs">
                    <span className="font-mono" style={{ color: m.dir === "up" ? ACCENT : "var(--c3)" }} aria-label={m.dir === "up" ? "client to server" : "server to client"}>
                      {m.dir === "up" ? "→" : "←"}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-mono">{m.label}</span>
                      <span className="mt-0.5 block h-1.5 rounded bg-[var(--track)]">
                        <span className="block h-full rounded" style={{ width: `${Math.max(1.5, ((m.bytes * m.count) / maxBytes) * 100)}%`, background: m.dir === "up" ? ACCENT : "var(--c3)" }} />
                      </span>
                    </span>
                    <span className="text-right font-mono text-[var(--muted)]">{kb(m.bytes * m.count)}</span>
                  </li>
                ))}
              </ol>
              <dl className="mt-4 grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
                <Stat label="requests" value={r.requests.toLocaleString("en-US")} />
                <Stat label="round trips first" value={String(r.rounds)} />
                <Stat label="bytes down" value={kb(r.received)} />
                <Stat label="fields got / needed" value={`${r.fieldsReceived.toLocaleString("en-US")} / ${r.fieldsNeeded.toLocaleString("en-US")}`} bad={r.fieldsReceived > r.fieldsNeeded * 2} />
              </dl>
              <p className="mt-2 font-mono text-xs text-[var(--muted)]">
                {sc === "live" ? `first update after ${ms(r.latencyMs)}, then each one ${ms(r.delayMs!)} old on average` : `screen complete after ${ms(r.latencyMs)} at ${scenario.rttMs} ms round trip`}
              </p>
            </section>
          }
          panel={
            <SystemMapPanel caption={r.why}>
              <div className="w-full">
                <Choices label="The job" accent={ACCENT} value={sc} onChange={setSc} options={SCENARIOS.map((s) => ({ id: s.id, label: s.label }))} />
              </div>
              <p className="w-full text-xs text-[var(--muted)]">{scenario.text}</p>
              <div className="w-full">
                <Choices label="API style" accent={ACCENT} value={style} onChange={setStyle} options={STYLES.map((s) => ({ id: s.id, label: s.label }))} />
              </div>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="REST: resources at URLs" what="GET /users/42 returns the whole user; the orders are another URL. Every proxy, cache and browser understands it. The screen gets what the resource has, not what it needs: too much per record, too many requests per screen." accent={ACCENT} active={style === "rest"}>
                <Line r={all.rest} />
              </FlowStep>
              <FlowArrow label="ask for the fields" accent={ACCENT} />

              <FlowStep n={2} title="GraphQL: one query names the fields" what="The client sends the shape of the data it wants, nested, and gets exactly that in one round trip. The work moves to the server: a resolver per field, and the N+1 problem returns there unless the server batches." accent={ACCENT} active={style === "graphql"}>
                <Line r={all.graphql} />
              </FlowStep>
              <FlowArrow label="add a contract and types" accent={ACCENT} />

              <FlowStep n={3} title="gRPC: typed calls over HTTP/2" what="A .proto file defines the messages and the procedures; clients and servers are generated from it. Protobuf is binary and small, HTTP/2 multiplexes calls, and streaming is built in. Browsers can't call it directly." accent={ACCENT} active={style === "grpc"}>
                <Line r={all.grpc} />
              </FlowStep>
              <FlowArrow label="keep the connection open" accent={ACCENT} />

              <FlowStep n={4} title="WebSockets: an open connection" what="After one HTTP upgrade the connection stays; either side sends frames whenever it likes. Perfect for pushes and chat. For request and response it gives you nothing but a protocol to invent." accent={ACCENT} active={style === "ws"}>
                <Line r={all.ws} />
                <p className="mt-2 text-xs text-[var(--faint)]">Payload bytes only. HTTP/2 headers add tens of bytes per message; a WebSocket frame adds 2 to 6.</p>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}

function Line({ r }: { r: ReturnType<typeof run> }) {
  return (
    <p className="font-mono text-xs" style={{ color: VERDICT[r.verdict] }}>
      this job: {r.requests.toLocaleString("en-US")} {r.requests === 1 ? "request" : "requests"} · {kb(r.sent + r.received)} · {r.fieldsReceived.toLocaleString("en-US")} fields for {r.fieldsNeeded.toLocaleString("en-US")} · {VERDICT_WORD[r.verdict]}
    </p>
  );
}

function Stat({ label, value, bad }: { label: string; value: string; bad?: boolean }) {
  return (
    <div className="flex flex-col-reverse rounded-md bg-[var(--inset)] px-2 py-2">
      <dt className="text-[11px] text-[var(--muted)]">{label}</dt>
      <dd className="font-mono text-sm" style={{ color: bad ? "var(--bad)" : "var(--text)" }}>
        {value}
      </dd>
    </div>
  );
}
