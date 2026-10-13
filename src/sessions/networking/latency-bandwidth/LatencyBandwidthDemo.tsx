"use client";

import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { useState } from "react";
import { Slider } from "@/components/session/ui";
import { SIZES, time } from "@/lib/bandwidthDelay";

const ACCENT = "var(--net)";
const BWS = [5, 10, 25, 50, 100, 250, 500, 1000];
const fmt = (ms: number) => (ms >= 10000 ? `${(ms / 1000).toFixed(0)} s` : ms >= 1000 ? `${(ms / 1000).toFixed(1)} s` : `${Math.round(ms)} ms`);

export default function LatencyBandwidthDemo() {
  const [bwI, setBwI] = useState(3);
  const [rtt, setRtt] = useState(100);
  const bw = BWS[bwI];
  const rows = SIZES.map((s) => ({ ...s, ...time(s.kb, bw, rtt) }));
  return (
    <SessionPage>
      <SessionHeader kicker="Networking · interactive" title="Latency vs bandwidth" blurb="Bandwidth is how wide the pipe is; latency is how long it is. Before a byte arrives you pay round trips for the TCP and TLS handshakes, and TCP starts slow and speeds up each round trip. For small transfers, latency is nearly everything." />
      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="Time breakdown">
              {rows.map((r) => (
                <div key={r.name} className="mt-4 first:mt-0">
                  <p className="flex justify-between text-sm"><span>{r.name}</span><span className="font-mono">{fmt(r.total)}</span></p>
                  <div className="mt-1 flex h-4 overflow-hidden rounded bg-[var(--track)]">
                    <span style={{ width: `${(r.setup / r.total) * 100}%`, background: "var(--c4)" }} />
                    <span style={{ width: `${(r.rampup / r.total) * 100}%`, background: "var(--auto)" }} />
                    <span style={{ width: `${(r.transfer / r.total) * 100}%`, background: ACCENT }} />
                  </div>
                  <p className="mt-0.5 font-mono text-[10px] text-[var(--faint)]">handshakes {fmt(r.setup)} · slow start {fmt(r.rampup)} · transfer {fmt(r.transfer)}</p>
                </div>
              ))}
              <div className="mt-3 flex flex-wrap gap-x-4 text-xs text-[var(--muted)]"><span className="flex items-center gap-1.5"><span className="h-2 w-3 rounded-sm bg-[var(--c4)]" /> handshakes (latency)</span><span className="flex items-center gap-1.5"><span className="h-2 w-3 rounded-sm bg-[var(--auto)]" /> ramp-up (latency)</span><span className="flex items-center gap-1.5"><span className="h-2 w-3 rounded-sm" style={{ background: ACCENT }} /> transfer (bandwidth)</span></div>
              <p className="mt-3 font-mono text-xs">bandwidth × delay = {Math.round(rows[0].bdpKb)} KB in flight to fill the pipe</p>
            </section>
          }
          panel={
            <SystemMapPanel caption={`At ${bw} Mbps and ${rtt} ms, the API call is ${Math.round(((rows[0].setup + rows[0].rampup) / rows[0].total) * 100)}% waiting on round trips. Try 10× the bandwidth: it barely changes. Halve the latency: it halves.`}>
              <Slider label="Bandwidth" accent={ACCENT} value={bwI} min={0} max={BWS.length - 1} step={1} format={(i) => `${BWS[i]} Mbps`} onChange={setBwI} />
              <Slider label="Round-trip time" accent={ACCENT} value={rtt} min={10} max={300} step={10} format={(v) => `${v} ms`} onChange={setRtt} />
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Latency: limited by distance" what="Light in fibre covers about 200 km per millisecond. London to Sydney is ~250 ms round trip no matter what you pay." accent={ACCENT}><p className="text-sm text-[var(--muted)]">You can&apos;t buy lower latency, only move closer.</p></FlowStep>
              <FlowArrow label="setup" accent={ACCENT} />
              <FlowStep n={2} title="Handshakes cost round trips" what="TCP needs one, TLS 1.3 another, before the request. Reusing connections skips them; HTTP/3 merges them." accent={ACCENT}><p className="text-sm text-[var(--muted)]">Keep-alive and connection pools matter.</p></FlowStep>
              <FlowArrow label="ramp up" accent={ACCENT} />
              <FlowStep n={3} title="Slow start" what="TCP sends ~14 KB first, then doubles each round trip until it fills the pipe. A 500 KB page needs several round trips just to reach full speed." accent={ACCENT}><p className="text-sm text-[var(--muted)]">Fewer, smaller requests help.</p></FlowStep>
              <FlowArrow label="so" accent={ACCENT} />
              <FlowStep n={4} title="Fix latency first for web apps" what="CDNs, edge servers, fewer round trips and preconnect hints beat a faster link. Bandwidth wins only for big transfers." accent={ACCENT}><p className="text-sm text-[var(--muted)]">Bandwidth × RTT says how much data must be in flight.</p></FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
