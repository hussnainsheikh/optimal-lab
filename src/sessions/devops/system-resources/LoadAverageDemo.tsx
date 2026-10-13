"use client";

import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { useState } from "react";
import { Choices } from "@/components/session/ui";
import { CASES, CORES, snapshot, type Case } from "@/lib/loadAverage";

const ACCENT = "var(--ops)";

export default function LoadAverageDemo() {
  const [c, setC] = useState<Case>("io");
  const s = snapshot(c);
  const bar = (label: string, v: number, color: string) => <div className="grid grid-cols-[3rem_minmax(0,1fr)_3rem] items-center gap-2 text-xs"><span className="font-mono">{label}</span><span className="h-3 rounded bg-[var(--track)]"><span className="block h-full rounded" style={{ width: `${v}%`, background: color }} /></span><span className="text-right font-mono">{v}%</span></div>;
  return (
    <SessionPage>
      <SessionHeader kicker="DevOps · interactive" title="Reading load, CPU and I/O wait" blurb={`top shows a load average and a CPU breakdown. On this ${CORES}-core machine, load means “tasks running or waiting”, so compare it with the core count, and check whether the CPU or the disk is the real bottleneck.`} />
      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="top output">
              <p className="font-mono text-sm">load average: <span style={{ color: s.load[0] > CORES ? "var(--bad)" : "var(--good)" }}>{s.load.join(", ")}</span></p>
              <p className="font-mono text-[11px] text-[var(--faint)]">1, 5 and 15 minute averages · {CORES} cores</p>
              <div className="mt-3 space-y-1.5">{bar("us", s.us, ACCENT)}{bar("sy", s.sy, "var(--c4)")}{bar("wa", s.wa, "var(--bad)")}{bar("id", s.id, "var(--good)")}</div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-[var(--inset)] p-2"><p className="text-xs text-[var(--faint)]">Runnable (R)</p><div className="mt-1 flex flex-wrap gap-1">{Array.from({ length: s.running }, (_, i) => <span key={i} className="h-4 w-4 rounded-sm" style={{ background: i < CORES ? ACCENT : "var(--auto)" }} />)}</div></div>
                <div className="rounded-lg bg-[var(--inset)] p-2"><p className="text-xs text-[var(--faint)]">Waiting on disk (D)</p><div className="mt-1 flex flex-wrap gap-1">{Array.from({ length: s.blocked }, (_, i) => <span key={i} className="h-4 w-4 rounded-sm bg-[var(--bad)]" />)}{!s.blocked && <span className="text-xs text-[var(--faint)]">none</span>}</div></div>
              </div>
              <p className="mt-2 text-xs text-[var(--muted)]">us user · sy kernel · wa I/O wait · id idle. Amber squares: runnable tasks with no free core.</p>
            </section>
          }
          panel={<SystemMapPanel caption={s.verdict}><Choices label="Situation" accent={ACCENT} value={c} onChange={setC} options={CASES} /></SystemMapPanel>}
          detail={
            <>
              <FlowStep n={1} title="Load = demand, not usage" what="The average number of tasks running or waiting. Divide by cores: under 1 per core is fine." accent={ACCENT}><p className="text-sm text-[var(--muted)]">Compare the 1- and 15-minute numbers for trend.</p></FlowStep>
              <FlowArrow label="CPU-bound" accent={ACCENT} />
              <FlowStep n={2} title="High load, high us/sy" what="Tasks queue for a core. Profile the hot code or add CPUs." accent={ACCENT} active={c === "queue"}><p className="font-mono text-xs">top · htop · mpstat 1</p></FlowStep>
              <FlowArrow label="I/O-bound" accent={ACCENT} />
              <FlowStep n={3} title="High load, high wa, idle CPU" what="Tasks are blocked on disk or network storage. More CPUs won't help; look at the disk." accent={ACCENT} active={c === "io"}><p className="font-mono text-xs">iostat -x 1 · iotop</p></FlowStep>
              <FlowArrow label="and memory" accent={ACCENT} />
              <FlowStep n={4} title="Check memory too" what="Swapping turns memory pressure into disk I/O. In containers, look at limits and throttling, not just the host." accent={ACCENT}><p className="font-mono text-xs">free -h · vmstat 1</p></FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
