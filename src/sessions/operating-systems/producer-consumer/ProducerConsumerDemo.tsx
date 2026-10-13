"use client";

import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { useState } from "react";
import { Choices, PlaybackControls, usePlayback } from "@/components/session/ui";
import { run, SIZE, type Mode } from "@/lib/producerConsumer";

const ACCENT = "var(--os)";

export default function ProducerConsumerDemo() {
  const [mode, setMode] = useState<Mode>("unsafe");
  return (
    <SessionPage>
      <SessionHeader kicker="Operating systems · interactive" title="Producer–consumer" blurb={`A producer thread makes items and a consumer thread uses them, through a shared buffer with ${SIZE} slots. The producer is faster. Without coordination they overwrite and misread; with two semaphores and a lock, each waits its turn.`} />
      <div className="mt-6"><Run key={mode} mode={mode} setMode={setMode} /></div>
    </SessionPage>
  );
}

function Run({ mode, setMode }: { mode: Mode; setMode: (m: Mode) => void }) {
  const fr = run(mode);
  const playback = usePlayback(fr.length, 1100);
  const f = fr[playback.i];
  const problems = fr.slice(0, playback.i + 1).filter((x) => x.problem).length;
  return (
    <SessionLayout
      visual={
        <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="Buffer">
          <div className="flex items-center gap-3">
            <span className="rounded-lg border-2 px-3 py-2 text-sm" style={{ borderColor: f.who === "P" ? (f.blocked ? "var(--auto)" : ACCENT) : "var(--line)" }}>Producer{f.who === "P" && f.blocked ? " (asleep)" : ""}</span>
            <div className="flex flex-1 gap-1">{f.slots.map((s, i) => <span key={i} className="grid h-12 flex-1 place-items-center rounded-md border font-mono text-sm" style={{ borderColor: f.problem && f.who === "P" && s ? "var(--bad)" : "var(--line)", background: s ? "var(--inset)" : "transparent" }}>{s ?? "·"}</span>)}</div>
            <span className="rounded-lg border-2 px-3 py-2 text-sm" style={{ borderColor: f.who === "C" ? (f.blocked ? "var(--auto)" : f.problem ? "var(--bad)" : ACCENT) : "var(--line)" }}>Consumer{f.who === "C" && f.blocked ? " (asleep)" : ""}</span>
          </div>
          {mode === "semaphores" && <p className="mt-3 font-mono text-xs">empty = {f.empty} · full = {f.full} · mutex guards the indexes</p>}
          <p className="mt-3 font-mono text-sm" style={{ color: problems ? "var(--bad)" : "var(--good)" }}>{problems} corrupted operations so far</p>
        </section>
      }
      panel={
        <SystemMapPanel caption={f.text}>
          <Choices label="Coordination" accent={ACCENT} value={mode} onChange={setMode} options={[{ id: "unsafe", label: "None" }, { id: "semaphores", label: "Semaphores + mutex" }]} />
          <PlaybackControls playback={playback} accent={ACCENT} nextLabel="Next tick" status={`tick ${playback.i} of ${fr.length - 1}`} />
        </SystemMapPanel>
      }
      detail={
        <>
          <FlowStep n={1} title="A shared, bounded buffer" what="It decouples the two speeds, but both threads touch the same slots and counters." accent={ACCENT}><p className="text-sm text-[var(--muted)]">Logging, job queues, pipelines.</p></FlowStep>
          <FlowArrow label="without coordination" accent={ACCENT} />
          <FlowStep n={2} title="Overwrites and empty reads" what="A full buffer gets overwritten; an empty one gets read. Unsynchronised index updates can also race." accent={ACCENT} active={mode === "unsafe"}><p className="text-sm text-[var(--muted)]">Busy-waiting instead burns CPU.</p></FlowStep>
          <FlowArrow label="count the slots" accent={ACCENT} />
          <FlowStep n={3} title="Two semaphores and a lock" what="empty counts free slots, full counts items. Producers wait(empty) then signal(full); consumers the reverse. A mutex protects the indexes." accent={ACCENT} active={mode === "semaphores"}><p className="font-mono text-xs">wait(empty); lock; put; unlock; signal(full)</p></FlowStep>
          <FlowArrow label="in real code" accent={ACCENT} />
          <FlowStep n={4} title="Use a blocking queue" what="Languages ship this pattern ready-made: Java's BlockingQueue, Go's buffered channels, Python's queue.Queue." accent={ACCENT}><p className="text-sm text-[var(--muted)]">A full queue is backpressure.</p></FlowStep>
        </>
      }
    />
  );
}
