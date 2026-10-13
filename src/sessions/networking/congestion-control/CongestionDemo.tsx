"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { sent, simulate, type Algo } from "@/lib/congestion";

const ACCENT = "var(--net)";

export default function CongestionDemo() {
  const [algo, setAlgo] = useState<Algo>("reno");
  const [loss, setLoss] = useState<"none" | "10">("10");
  const rounds = simulate(algo, loss === "none" ? null : 10);
  const max = Math.max(...rounds.map((r) => r.cwnd), 24);
  const W = 100;
  const H = 50;
  const x = (i: number) => 6 + (i / (rounds.length - 1)) * (W - 10);
  const y = (v: number) => H - 6 - (v / max) * (H - 12);

  return (
    <SessionPage>
      <SessionHeader kicker="Networking · interactive" title="TCP congestion control" blurb="TCP doesn't know how fast the path is, so it probes: start small, double every round trip, then grow slowly. A lost packet is the signal to back off. This is why a fresh connection starts slow." />
      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="Congestion window over time">
              <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">Congestion window (packets in flight) per round trip</p>
              <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 h-auto w-full" role="img" aria-label="cwnd chart">
                <line x1={6} y1={H - 6} x2={W - 4} y2={H - 6} strokeWidth={0.3} style={{ stroke: "var(--line-strong)" }} />
                <line x1={6} y1={y(16)} x2={W - 4} y2={y(16)} strokeWidth={0.3} strokeDasharray="1 1" style={{ stroke: "var(--faint)" }} />
                <text x={W - 4} y={y(16) - 1} fontSize={2.4} textAnchor="end" style={{ fill: "var(--faint)" }}>first threshold: 16</text>
                <polyline points={rounds.map((r, i) => `${x(i)},${y(r.cwnd)}`).join(" ")} fill="none" strokeWidth={0.8} style={{ stroke: ACCENT }} />
                {rounds.map((r, i) => (
                  <circle key={i} cx={x(i)} cy={y(r.cwnd)} r={r.phase === "loss" ? 1.4 : 0.7} style={{ fill: r.phase === "loss" ? "var(--bad)" : r.phase === "slow start" ? "var(--c3)" : ACCENT }} />
                ))}
              </svg>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--muted)]">
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: "var(--c3)" }} /> slow start (doubling)</span>
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: ACCENT }} /> congestion avoidance (+1)</span>
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[var(--bad)]" /> packet lost</span>
              </div>
              <p className="mt-3 text-sm">Packets sent in {rounds.length} round trips: <span className="font-mono">{sent(rounds)}</span></p>
            </section>
          }
          panel={
            <SystemMapPanel caption={loss === "none" ? "No loss: the window grows until something else limits it." : `A packet is lost at round trip 10. ${algo === "reno" ? "Reno halves the window and keeps going." : "Tahoe drops back to 1 and slow-starts again."}`}>
              <Choices label="Algorithm" accent={ACCENT} value={algo} onChange={setAlgo} options={[{ id: "reno", label: "Reno (halve on loss)" }, { id: "tahoe", label: "Tahoe (reset to 1)" }]} />
              <Choices label="Packet loss" accent={ACCENT} value={loss} onChange={setLoss} options={[{ id: "10", label: "Lose one at round trip 10" }, { id: "none", label: "No loss" }]} />
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Slow start: double every round trip" what="Start with 1 packet in flight. Each acknowledged round trip doubles it: 1, 2, 4, 8, 16. Fast growth, from a small start." accent={ACCENT}><p className="font-mono text-sm">{rounds.slice(0, 5).map((r) => r.cwnd).join(" → ")}</p></FlowStep>
              <FlowArrow label="reach the threshold" accent={ACCENT} />
              <FlowStep n={2} title="Congestion avoidance: add one" what="Past the threshold, grow by one packet per round trip, carefully probing for spare capacity." accent={ACCENT}><p className="text-sm text-[var(--muted)]">Additive increase.</p></FlowStep>
              <FlowArrow label="a packet goes missing" accent={ACCENT} />
              <FlowStep n={3} title="Loss means slow down" what="A lost packet probably means a full queue somewhere. Reno halves the window; the older Tahoe restarts from 1. Modern stacks use CUBIC or BBR, but the idea is the same." accent={ACCENT} active={loss !== "none"}><p className="text-sm text-[var(--muted)]">Multiplicative decrease.</p></FlowStep>
              <FlowArrow label="why it matters" accent={ACCENT} />
              <FlowStep n={4} title="New connections start slow" what="A short page load may finish before the window grows. That's why reusing connections and HTTP/2 multiplexing help." accent={ACCENT}><p className="font-mono text-sm">Reno: {sent(simulate("reno", 10))} · Tahoe: {sent(simulate("tahoe", 10))} packets</p></FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
