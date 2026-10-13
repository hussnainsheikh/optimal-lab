"use client";

import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { useState } from "react";
import { Slider } from "@/components/session/ui";
import { at, CAPACITY, curve, SERVICE_MS, WORKERS } from "@/lib/littlesLaw";

const ACCENT = "var(--sys)";
const C = curve();
const X = (r: number) => 30 + (r / CAPACITY) * 350;
const Y = (ms: number) => 190 - (Math.min(ms, 400) / 400) * 170;

export default function LittlesLawDemo() {
  const [rps, setRps] = useState(120);
  const r = at(rps);
  return (
    <SessionPage>
      <SessionHeader kicker="System design · interactive" title="Latency, throughput and Little's law" blurb={`A service has ${WORKERS} workers and each request takes ${SERVICE_MS} ms, so it can handle at most ${CAPACITY} requests a second. Latency stays flat for a long time, then shoots up as you approach that limit.`} />
      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="Latency against load">
              <svg viewBox="0 0 400 210" className="w-full">
                <line x1="30" x2="380" y1="190" y2="190" stroke="var(--line)" />
                <line x1={X(CAPACITY * 0.8)} x2={X(CAPACITY * 0.8)} y1="15" y2="190" stroke="var(--line)" strokeDasharray="3 3" />
                <text x={X(CAPACITY * 0.8) + 3} y="25" fontSize="10" fill="var(--faint)">80% busy</text>
                <path d={C.map((p, i) => `${i ? "L" : "M"}${X(p.rps).toFixed(1)} ${Y(p.latency).toFixed(1)}`).join(" ")} fill="none" stroke={ACCENT} strokeWidth="2.5" />
                <circle cx={X(rps)} cy={Y(r.latency)} r="6" fill={r.rho > 0.85 ? "var(--bad)" : ACCENT} />
                <text x="30" y="205" fontSize="10" fill="var(--faint)">0 rps</text><text x="380" y="205" fontSize="10" textAnchor="end" fill="var(--faint)">{CAPACITY} rps</text>
              </svg>
              <dl className="mt-2 grid grid-cols-3 gap-2">
                {[["Utilisation", `${Math.round(r.rho * 100)}%`], ["Latency", `${Math.round(r.latency)} ms`], ["In flight", r.inFlight.toFixed(1)]].map(([k, v]) => <div key={k} className="rounded-lg bg-[var(--inset)] p-2"><dt className="text-xs text-[var(--faint)]">{k}</dt><dd className="font-mono text-lg">{v}</dd></div>)}
              </dl>
              <p className="mt-2 font-mono text-xs text-[var(--muted)]">Little&apos;s law: in flight = {rps} req/s × {(r.latency / 1000).toFixed(3)} s = {r.inFlight.toFixed(1)}</p>
            </section>
          }
          panel={<SystemMapPanel caption={r.rho < 0.7 ? "Plenty of idle workers: requests rarely wait, so latency is just the 40 ms of work." : r.rho < 0.9 ? "Workers are often all busy, so requests start queueing. Latency is creeping up." : "Near saturation, the queue grows explosively. A few percent more traffic multiplies latency."}><Slider label="Incoming requests" accent={ACCENT} value={rps} min={10} max={198} step={2} format={(v) => `${v} req/s`} onChange={setRps} /></SystemMapPanel>}
          detail={
            <>
              <FlowStep n={1} title="Throughput has a ceiling" what="Workers ÷ time per request. Past it, requests can only wait." accent={ACCENT}><p className="font-mono text-xs">8 ÷ 0.040 s = 200 req/s</p></FlowStep>
              <FlowArrow label="queueing" accent={ACCENT} />
              <FlowStep n={2} title="Latency explodes near the limit" what="Waiting time grows like 1 ÷ (1 − utilisation). At 50% it's nothing; at 95% it dominates." accent={ACCENT} active={r.rho > 0.85}><p className="text-sm text-[var(--muted)]">Why 100% CPU is not a goal.</p></FlowStep>
              <FlowArrow label="Little's law" accent={ACCENT} />
              <FlowStep n={3} title="In flight = rate × latency" what="Works for any stable system. Slow responses mean more concurrent requests, more connections, more memory." accent={ACCENT}><p className="text-sm text-[var(--muted)]">Size pools and threads with it.</p></FlowStep>
              <FlowArrow label="so" accent={ACCENT} />
              <FlowStep n={4} title="Plan for ~70–80% at peak" what="Leave headroom for bursts, and shed or slow down traffic before the cliff instead of after." accent={ACCENT}><p className="text-sm text-[var(--muted)]">See backpressure and autoscaling.</p></FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
