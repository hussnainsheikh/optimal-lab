"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { PROCS, schedule, type Policy } from "@/lib/scheduling";

const ACCENT = "var(--os)";
const COLORS: Record<string, string> = { P1: "var(--c1)", P2: "var(--c2)", P3: "var(--c3)", P4: "var(--c4)" };
const POLICIES: { id: Policy; label: string }[] = [
  { id: "fcfs", label: "First come, first served" },
  { id: "sjf", label: "Shortest job first" },
  { id: "rr", label: "Round robin" },
];

export default function SchedulingDemo() {
  const [policy, setPolicy] = useState<Policy>("fcfs");
  const [q, setQ] = useState("2");
  const r = schedule(policy, Number(q));
  const pct = (t: number) => `${(t / r.end) * 100}%`;
  return (
    <SessionPage>
      <SessionHeader kicker="Operating systems · interactive" title="CPU scheduling" blurb="One core, four programs that want it. The scheduler decides who runs next, and that choice changes how long each one waits, even though the total work is identical." />
      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="Which process runs when">
              <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">The core over time (0–{r.end})</p>
              <div className="relative mt-2 h-10 rounded bg-[var(--track)]">
                {r.slices.map((s, i) => (
                  <span key={i} className="absolute inset-y-0 grid place-items-center border-r border-[var(--panel)] font-mono text-[10px]" style={{ left: pct(s.from), width: pct(s.to - s.from), background: COLORS[s.id], color: "var(--on-accent)" }}>{s.to - s.from >= 2 ? s.id : ""}</span>
                ))}
              </div>
              <table className="mt-4 w-full text-sm">
                <thead><tr className="text-left font-mono text-[11px] text-[var(--faint)]"><th className="font-normal">process</th><th className="font-normal">arrives</th><th className="font-normal">needs</th><th className="font-normal">done at</th><th className="text-right font-normal">waited</th></tr></thead>
                <tbody>{r.rows.map((p) => <tr key={p.id} className="font-mono"><td className="py-1" style={{ color: COLORS[p.id] }}>{p.id}</td><td>{p.arrive}</td><td>{p.burst}</td><td>{p.finish}</td><td className="text-right">{p.waiting}</td></tr>)}</tbody>
              </table>
              <p className="mt-3 text-sm">Average wait <span className="font-mono">{r.avgWait.toFixed(2)}</span> · average turnaround <span className="font-mono">{r.avgTurnaround.toFixed(2)}</span> · context switches <span className="font-mono">{r.switches}</span></p>
            </section>
          }
          panel={
            <SystemMapPanel caption={`${POLICIES.find((p) => p.id === policy)!.label}: average wait ${r.avgWait.toFixed(2)} time units.`}>
              <Choices label="Policy" accent={ACCENT} value={policy} onChange={setPolicy} options={POLICIES.map((p) => ({ id: p.id, label: p.label }))} />
              {policy === "rr" && <Choices label="Time slice" accent={ACCENT} value={q} onChange={setQ} options={["1", "2", "4"].map((x) => ({ id: x, label: x }))} />}
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="First come, first served" what="Simple and fair in order of arrival. A long job at the front makes everyone behind it wait." accent={ACCENT} active={policy === "fcfs"}><p className="font-mono text-sm">avg wait {schedule("fcfs").avgWait.toFixed(2)}</p></FlowStep>
              <FlowArrow label="pick the shortest" accent={ACCENT} />
              <FlowStep n={2} title="Shortest job first" what="Run the quickest ready job next. Lowest average wait, but the OS rarely knows job lengths, and long jobs can starve." accent={ACCENT} active={policy === "sjf"}><p className="font-mono text-sm">avg wait {schedule("sjf").avgWait.toFixed(2)}</p></FlowStep>
              <FlowArrow label="take turns" accent={ACCENT} />
              <FlowStep n={3} title="Round robin" what="Everyone gets a short time slice in turn. Nobody waits long to start, which keeps a desktop responsive, at the cost of more switching." accent={ACCENT} active={policy === "rr"}><p className="font-mono text-sm">{PROCS.length} processes, slice {q}: {schedule("rr", Number(q)).switches} switches</p></FlowStep>
              <FlowArrow label="real schedulers" accent={ACCENT} />
              <FlowStep n={4} title="Real schedulers mix these" what="Linux's scheduler gives each process a fair share of CPU time weighted by priority, and favors tasks that mostly wait on I/O so they feel responsive." accent={ACCENT}><p className="text-sm text-[var(--muted)]">Same work, different waits.</p></FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
