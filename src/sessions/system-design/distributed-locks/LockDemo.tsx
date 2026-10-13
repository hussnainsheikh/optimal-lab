"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices, PlaybackControls, usePlayback } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { runLock } from "@/lib/distributedLock";

const ACCENT = "var(--sys)";

export default function LockDemo() {
  const [mode, setMode] = useState<"lease" | "fencing">("lease");
  const frames = runLock(mode === "fencing");
  const playback = usePlayback(frames.length, 1400);
  const f = frames[playback.i];
  const bad = playback.atEnd && mode === "lease";

  return (
    <SessionPage>
      <SessionHeader kicker="System Design · interactive" title="Distributed locks" blurb="A lock across machines needs a timeout, or a crashed holder would keep it forever. But a holder that merely pauses doesn't know its time ran out. Watch two clients both believe they hold the lock." />
      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="Timeline of the lock">
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-[var(--inset)] p-3"><p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--faint)]">Lock held by</p><p className="mt-1 font-mono">{f.holder}</p></div>
                <div className="rounded-lg bg-[var(--inset)] p-3"><p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--faint)]">Storage holds</p><p className="mt-1 font-mono" style={{ color: bad ? "var(--bad)" : undefined }}>{f.storage}</p></div>
              </div>
              <ol className="mt-4 space-y-1.5">
                {frames.slice(0, playback.i + 1).map((x, i) => (
                  <li key={i} className="grid grid-cols-[3rem_6.5rem_minmax(0,1fr)] gap-2 rounded-md border px-2 py-1.5 text-sm" style={{ borderColor: i === playback.i ? ACCENT : "var(--line)", background: "var(--inset)" }}>
                    <span className="font-mono text-xs text-[var(--faint)]">t={x.t}s</span>
                    <span className="font-mono text-xs">{x.who}</span>
                    <span style={{ color: x.rejected ? "var(--good)" : undefined }}>{x.text}</span>
                  </li>
                ))}
              </ol>
            </section>
          }
          panel={
            <SystemMapPanel caption={f.text}>
              <Choices label="Protection" accent={ACCENT} value={mode} onChange={(v) => { setMode(v); playback.reset(); }} options={[{ id: "lease", label: "Lease only" }, { id: "fencing", label: "Lease + fencing token" }]} />
              <PlaybackControls playback={playback} accent={ACCENT} nextLabel="Next" status={`t = ${f.t} s`} />
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Take the lock with a lease" what="The lock service grants it for 10 seconds. If the holder crashes, the lock frees itself." accent={ACCENT} active={playback.i === 0}><p className="font-mono text-sm">SET lock client1 NX PX 10000</p></FlowStep>
              <FlowArrow label="the holder pauses" accent={ACCENT} />
              <FlowStep n={2} title="A pause outlives the lease" what="GC pauses, a slow disk, a laptop lid closing: the client can't notice time passing while it's frozen." accent={ACCENT} active={playback.i === 1 || playback.i === 2}><p className="text-sm text-[var(--muted)]">Frozen from t=1 s to t=16 s; the lease ends at t=10 s.</p></FlowStep>
              <FlowArrow label="someone else takes it" accent={ACCENT} />
              <FlowStep n={3} title="Two clients think they hold it" what="Client 2 takes the lock legitimately. Client 1 wakes up and carries on as if nothing happened." accent={ACCENT} active={playback.i >= 3 && !playback.atEnd}><p className="text-sm text-[var(--muted)]">The lock service did nothing wrong. Time-based locks can&apos;t stop this alone.</p></FlowStep>
              <FlowArrow label="the fix" accent={ACCENT} />
              <FlowStep n={4} title="Fencing tokens: storage checks the number" what="Every grant comes with a number that only goes up. Storage remembers the highest it has seen and rejects anything lower." accent={ACCENT} active={playback.atEnd}>
                <p className="text-sm" style={{ color: playback.atEnd ? (bad ? "var(--bad)" : "var(--good)") : undefined }}>{playback.atEnd ? (bad ? "Client 1 overwrote client 2's work." : "Token 33 rejected: client 2's data is safe.") : "Keep stepping."}</p>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
