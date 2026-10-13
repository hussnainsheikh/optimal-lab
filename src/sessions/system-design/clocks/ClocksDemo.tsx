"use client";

import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { useState } from "react";
import { Choices } from "@/components/session/ui";
import { EVENTS, happenedBefore, lamport } from "@/lib/clocks";

const ACCENT = "var(--sys)";
const { L, V } = lamport();
type Mode = "wall" | "lamport" | "vector";
const X = (x: number) => 20 + x * 62;
const Y = (p: number) => 30 + p * 60;

export default function ClocksDemo() {
  const [mode, setMode] = useState<Mode>("wall");
  const label = (id: string) => { const e = EVENTS.find((x) => x.id === id)!; return mode === "wall" ? `${e.wall}ms` : mode === "lamport" ? String(L[id]) : `[${V[id].join(",")}]`; };
  const caption = mode === "wall" ? "P3's clock runs 40 ms slow, so by wall time g (100 ms) happened before e (130 ms), even though g is receiving e's message. Timestamps from different machines can't order events."
    : mode === "lamport" ? "Lamport: each event ticks the local counter; a receive jumps past the sender's value. Now e (4) < g (5). But h (3) < e (4) doesn't mean h came first: they're unrelated."
    : `Vector clocks keep a counter per process. a [1,0,0] and f [0,0,1] neither ≤ the other: concurrent. ${happenedBefore(V.e, V.g) ? "e ≤ g in every slot: e happened before g." : ""}`;
  return (
    <SessionPage>
      <SessionHeader kicker="System design · interactive" title="Clocks and ordering" blurb="Three servers exchange messages. Which events happened before which? Machine clocks drift, so their timestamps can contradict cause and effect. Logical clocks track causality instead of time." />
      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="Process timelines">
              <svg viewBox="0 0 400 170" className="w-full">
                <defs><marker id="m" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10z" fill={ACCENT} /></marker></defs>
                {[0, 1, 2].map((p) => <g key={p}><line x1="20" x2="390" y1={Y(p)} y2={Y(p)} stroke="var(--line)" /><text x="0" y={Y(p) + 4} fontSize="11" fill="var(--muted)">P{p + 1}</text></g>)}
                {EVENTS.filter((e) => e.kind === "send").map((e) => { const r = EVENTS.find((x) => x.id === e.peer)!; return <line key={e.id} x1={X(e.x)} y1={Y(e.p)} x2={X(r.x) - 4} y2={Y(r.p) - (r.p > e.p ? 7 : -7)} stroke={ACCENT} strokeWidth="1.5" markerEnd="url(#m)" />; })}
                {EVENTS.map((e) => {
                  const bad = mode === "wall" && e.id === "g";
                  return <g key={e.id}><circle cx={X(e.x)} cy={Y(e.p)} r="7" fill={bad ? "var(--bad)" : "var(--inset)"} stroke="var(--text)" /><text x={X(e.x)} y={Y(e.p) + 3.5} fontSize="9" textAnchor="middle" fill={bad ? "var(--on-accent)" : "var(--text)"}>{e.id}</text><text x={X(e.x)} y={Y(e.p) - 12} fontSize="10" textAnchor="middle" fill="var(--muted)" className="font-mono">{label(e.id)}</text></g>;
                })}
              </svg>
              <p className="mt-1 text-xs text-[var(--muted)]">Left to right is real time. Arrows are messages.</p>
              <p className="mt-3 font-mono text-xs">sorted by {mode === "wall" ? "wall clock" : mode === "lamport" ? "Lamport time" : "vector (partial order)"}: {mode === "vector" ? "a, c, f are concurrent; b → d → e → g" : [...EVENTS].sort((a, b) => (mode === "wall" ? a.wall - b.wall : L[a.id] - L[b.id])).map((e) => e.id).join(" ")}</p>
            </section>
          }
          panel={<SystemMapPanel caption={caption}><Choices label="Timestamps" accent={ACCENT} value={mode} onChange={setMode} options={[{ id: "wall", label: "Wall clocks" }, { id: "lamport", label: "Lamport clocks" }, { id: "vector", label: "Vector clocks" }]} /></SystemMapPanel>}
          detail={
            <>
              <FlowStep n={1} title="Physical clocks drift" what="NTP keeps them within milliseconds, not exactly. Last-write-wins with wall clocks can silently drop the newer write." accent={ACCENT} active={mode === "wall"}><p className="text-sm text-[var(--muted)]">Spanner uses GPS and atomic clocks plus waiting out the uncertainty.</p></FlowStep>
              <FlowArrow label="count instead" accent={ACCENT} />
              <FlowStep n={2} title="Lamport clocks" what="If A caused B, A's number is smaller. A single counter gives a total order everyone agrees on, but can't tell causal from coincidental." accent={ACCENT} active={mode === "lamport"}><p className="font-mono text-xs">on receive: t = max(t, msg.t) + 1</p></FlowStep>
              <FlowArrow label="detect concurrency" accent={ACCENT} />
              <FlowStep n={3} title="Vector clocks" what="One counter per node. Compare slot by slot: all ≤ means happened-before; mixed means concurrent, so you have a real conflict." accent={ACCENT} active={mode === "vector"}><p className="text-sm text-[var(--muted)]">Dynamo-style stores use them to spot conflicting writes.</p></FlowStep>
              <FlowArrow label="in practice" accent={ACCENT} />
              <FlowStep n={4} title="Hybrid logical clocks" what="Wall time plus a logical counter: close to real time, but never violating causality. CockroachDB and MongoDB use them." accent={ACCENT}><p className="text-sm text-[var(--muted)]">Ordering is a design decision.</p></FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
