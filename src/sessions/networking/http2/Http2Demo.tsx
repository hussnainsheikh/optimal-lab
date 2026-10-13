"use client";

import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { useState } from "react";
import { Choices } from "@/components/session/ui";
import { PROTOS, run, type Proto } from "@/lib/http2";

const ACCENT = "var(--net)";
const SPAN = 54;

export default function Http2Demo() {
  const [p, setP] = useState<Proto>("h2");
  const [loss, setLoss] = useState("no");
  const r = run(p, loss === "yes");
  const all = PROTOS.map((x) => ({ ...x, total: run(x.id, loss === "yes").total }));
  const caption = p === "h1-one" ? `One request at a time per connection: each file waits for the one before it. ${r.total} ticks.`
    : p === "h1-six" ? `Browsers open up to 6 connections per site to work around that, each with its own handshake. ${r.total} ticks.${loss === "yes" ? " A lost packet only stalls the connection it was on." : ""}`
    : p === "h2" ? `One connection, every file interleaved as separate streams, so small files finish early. ${loss === "yes" ? "But one lost TCP packet stalls every stream until it's resent: head-of-line blocking." : `${r.total} ticks.`}`
    : `Streams over QUIC (UDP) recover from loss independently: only the stream that lost data waits. ${r.total} ticks.`;
  return (
    <SessionPage>
      <SessionHeader kicker="Networking · interactive" title="HTTP/1.1, HTTP/2 and HTTP/3" blurb="A page needs ten files. How they share the connection decides when each one arrives. The link carries one chunk per tick; a handshake and each request's round trip cost time too." />
      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="When each file loads">
              <ul className="space-y-1">
                {r.res.map((f) => (
                  <li key={f.name} className="grid grid-cols-[5.5rem_minmax(0,1fr)] items-center gap-2 text-xs">
                    <span className="truncate font-mono">{f.name}{r.conns > 1 ? <span className="text-[var(--faint)]"> c{f.conn + 1}</span> : null}</span>
                    <span className="relative h-4 rounded bg-[var(--track)]"><span className="absolute inset-y-0 rounded" style={{ left: `${(f.start / SPAN) * 100}%`, width: `${((f.end - f.start) / SPAN) * 100}%`, background: f.stalled ? "var(--auto)" : ACCENT }} /></span>
                  </li>
                ))}
              </ul>
              <div className="mt-1 flex justify-between font-mono text-[10px] text-[var(--faint)]"><span>0</span><span>{SPAN} ticks</span></div>
              <p className="mt-2 text-xs text-[var(--muted)]">Amber: delayed by the lost packet.</p>
              <ul className="mt-3 space-y-1 text-xs">{all.map((x) => <li key={x.id} className="flex justify-between font-mono" style={{ color: x.id === p ? ACCENT : "var(--muted)" }}><span>{x.label}</span><span>{x.total} ticks</span></li>)}</ul>
            </section>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <Choices label="Protocol" accent={ACCENT} value={p} onChange={setP} options={PROTOS} />
              <Choices label="Packet loss" accent={ACCENT} value={loss} onChange={setLoss} options={[{ id: "no", label: "None" }, { id: "yes", label: "Lose one packet" }]} />
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="HTTP/1.1: one at a time" what="A connection carries one request and response at a time, so browsers open several connections." accent={ACCENT} active={p.startsWith("h1")}><p className="text-sm text-[var(--muted)]">Hence old tricks: sprites, bundling, domain sharding.</p></FlowStep>
              <FlowArrow label="multiplex" accent={ACCENT} />
              <FlowStep n={2} title="HTTP/2: streams on one connection" what="Requests become numbered streams whose frames interleave. Headers are compressed. One handshake." accent={ACCENT} active={p === "h2"}><p className="text-sm text-[var(--muted)]">Bundling matters much less.</p></FlowStep>
              <FlowArrow label="but TCP" accent={ACCENT} />
              <FlowStep n={3} title="TCP head-of-line blocking" what="TCP delivers bytes strictly in order. If one packet is lost, everything after it waits, even for other streams." accent={ACCENT} active={p === "h2" && loss === "yes"}><p className="text-sm text-[var(--muted)]">Worse on lossy mobile networks.</p></FlowStep>
              <FlowArrow label="move to QUIC" accent={ACCENT} />
              <FlowStep n={4} title="HTTP/3 over QUIC" what="QUIC runs on UDP with its own per-stream reliability and a combined transport+TLS handshake. Loss only stalls the affected stream." accent={ACCENT} active={p === "h3"}><p className="text-sm text-[var(--muted)]">Connections also survive switching networks.</p></FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
