"use client";

import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { useState } from "react";
import { Choices, PlaybackControls, usePlayback } from "@/components/session/ui";
import { frames, SCENARIOS, type Scenario } from "@/lib/processTree";

const ACCENT = "var(--ops)";
const STATE = { running: "var(--good)", stopping: "var(--auto)", gone: "var(--faint)", zombie: "var(--bad)" };

export default function ProcessTreeDemo() {
  const [s, setS] = useState<Scenario>("sigterm");
  return (
    <SessionPage>
      <SessionHeader kicker="DevOps · interactive" title="Processes, signals and the process tree" blurb="Every Linux process has a parent, back to PID 1. Stopping a process means sending it a signal, and what happens next depends on which signal and on whether parents clean up after their children." />
      <div className="mt-6"><Run key={s} s={s} setS={setS} /></div>
    </SessionPage>
  );
}

function Run({ s, setS }: { s: Scenario; setS: (v: Scenario) => void }) {
  const fr = frames(s);
  const playback = usePlayback(fr.length, 1800);
  const f = fr[playback.i];
  const depth = (pid: number): number => { const p = f.procs.find((x) => x.pid === pid)!; return p.ppid === 0 ? 0 : 1 + depth(p.ppid); };
  return (
    <SessionLayout
      visual={
        <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="Process tree">
          <p className="font-mono text-xs text-[var(--faint)]">$ ps -eo pid,ppid,stat,cmd --forest</p>
          <ul className="mt-2 space-y-1 font-mono text-sm">
            {[...f.procs].sort((a, b) => depth(a.pid) - depth(b.pid) || a.pid - b.pid).map((p) => (
              <li key={p.pid} className="flex items-center gap-2 rounded px-2 py-1" style={{ marginLeft: depth(p.pid) * 20, background: "var(--inset)", opacity: p.state === "gone" ? 0.4 : 1 }}>
                <span className="h-2 w-2 rounded-full" style={{ background: STATE[p.state] }} />
                <span className="w-10 text-[var(--muted)]">{p.pid}</span>
                <span className="w-14 text-[11px] text-[var(--faint)]">ppid {p.ppid}</span>
                <span className="flex-1" style={{ textDecoration: p.state === "gone" ? "line-through" : undefined }}>{p.name}{p.state === "zombie" ? " <defunct>" : ""}</span>
                <span className="text-[11px]" style={{ color: STATE[p.state] }}>{p.state}</span>
              </li>
            ))}
          </ul>
        </section>
      }
      panel={
        <SystemMapPanel caption={f.text}>
          <Choices label="What happens" accent={ACCENT} value={s} onChange={setS} options={SCENARIOS} />
          <PlaybackControls playback={playback} accent={ACCENT} nextLabel="Next step" status={`step ${playback.i + 1} of ${fr.length}`} />
        </SystemMapPanel>
      }
      detail={
        <>
          <FlowStep n={1} title="fork, exec, wait" what="A process forks a copy of itself, the copy execs a new program, and the parent waits to collect its exit code." accent={ACCENT}><p className="font-mono text-xs">pstree -p</p></FlowStep>
          <FlowArrow label="stopping" accent={ACCENT} />
          <FlowStep n={2} title="SIGTERM first, SIGKILL last" what="SIGTERM can be handled: finish work and exit cleanly. SIGKILL can't: the process just disappears." accent={ACCENT} active={s === "sigterm" || s === "sigkill"}><p className="text-sm text-[var(--muted)]">Kubernetes waits 30 s between them.</p></FlowStep>
          <FlowArrow label="lost parents" accent={ACCENT} />
          <FlowStep n={3} title="Orphans go to PID 1" what="If a parent dies, init adopts the children and reaps them later." accent={ACCENT} active={s === "orphan"}><p className="text-sm text-[var(--muted)]">Containers need a real init for this.</p></FlowStep>
          <FlowArrow label="lazy parents" accent={ACCENT} />
          <FlowStep n={4} title="Zombies wait to be reaped" what="A finished child stays as a zombie until its parent calls wait(). Harmless one at a time; a leak in bulk." accent={ACCENT} active={s === "zombie"}><p className="text-sm text-[var(--muted)]">STAT column shows Z.</p></FlowStep>
        </>
      }
    />
  );
}
