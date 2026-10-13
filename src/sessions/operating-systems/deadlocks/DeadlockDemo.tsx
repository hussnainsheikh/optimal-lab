"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices, PlaybackControls, usePlayback } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { runDeadlock } from "@/lib/deadlock";

const ACCENT = "var(--os)";
const T = ["T1", "T2"] as const;
const LOCKS = ["A", "B"];

export default function DeadlockDemo() {
  const [mode, setMode] = useState<"any" | "ordered">("any");
  const frames = runDeadlock(mode === "ordered");
  const playback = usePlayback(frames.length, 1300);
  const f = frames[playback.i];
  const holder = (l: string) => T.find((t) => f.holds[t].includes(l)) ?? null;

  return (
    <SessionPage>
      <SessionHeader kicker="Operating systems · interactive" title="Deadlocks" blurb="Two threads, two locks. Each grabs one and then waits for the other's. Nothing crashes; nothing happens, forever. The fix is a rule, not more code." />
      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="Threads, locks and who waits for whom">
              <div className="grid grid-cols-2 gap-3">
                {T.map((t) => (
                  <div key={t} className="rounded-lg border p-3" style={{ borderColor: f.stuck ? "var(--bad)" : "var(--line)", background: "var(--inset)" }}>
                    <p className="font-mono text-sm">Thread {t}</p>
                    <p className="mt-1 text-xs text-[var(--muted)]">holds: {f.holds[t].join(", ") || "nothing"}</p>
                    <p className="text-xs" style={{ color: f.waits[t] ? "var(--bad)" : "var(--muted)" }}>waits for: {f.waits[t] ?? "—"}</p>
                  </div>
                ))}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3">
                {LOCKS.map((l) => (
                  <div key={l} className="rounded-lg border-2 p-3 text-center" style={{ borderColor: holder(l) ? ACCENT : "var(--line)" }}>
                    <p className="font-mono text-lg">lock {l}</p>
                    <p className="text-xs text-[var(--muted)]">{holder(l) ? `held by ${holder(l)}` : "free"}</p>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-sm" style={{ color: f.stuck ? "var(--bad)" : f.done ? "var(--good)" : undefined }}>{f.stuck ? "Deadlock: T1 → waits for B (T2) → waits for A (T1). A cycle." : f.done ? "Both finished." : ""}</p>
            </section>
          }
          panel={
            <SystemMapPanel caption={f.text}>
              <Choices label="Lock order" accent={ACCENT} value={mode} onChange={(v) => { setMode(v); playback.reset(); }} options={[{ id: "any", label: "Each thread its own order" }, { id: "ordered", label: "Always A before B" }]} />
              <PlaybackControls playback={playback} accent={ACCENT} nextLabel="Next" status={`step ${playback.i + 1} of ${frames.length}`} />
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Hold one, wait for another" what="A thread keeps the lock it has while it waits for the next one." accent={ACCENT} active={playback.i <= 2}><p className="text-sm text-[var(--muted)]">Fine on its own.</p></FlowStep>
              <FlowArrow label="two threads do it" accent={ACCENT} />
              <FlowStep n={2} title="A cycle of waiting" what="T1 waits on T2, T2 waits on T1. Both are blocked; no timeout, no error, just a hang." accent={ACCENT} active={f.stuck}><p className="text-sm text-[var(--muted)]">Also in databases: two transactions locking rows in opposite order.</p></FlowStep>
              <FlowArrow label="break the cycle" accent={ACCENT} />
              <FlowStep n={3} title="Take locks in one global order" what="If everyone takes A before B, nobody can hold B while waiting for A. The cycle can't form." accent={ACCENT} active={mode === "ordered"}><p className="text-sm text-[var(--muted)]">Order by id, by address, by name: any fixed order.</p></FlowStep>
              <FlowArrow label="other options" accent={ACCENT} />
              <FlowStep n={4} title="Or detect and recover" what="Databases detect the cycle and abort one transaction. try_lock with a timeout lets a thread give up and retry." accent={ACCENT} active={playback.atEnd}><p className="text-sm text-[var(--muted)]">Prevention by ordering is the simplest.</p></FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
