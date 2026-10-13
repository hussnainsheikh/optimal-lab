"use client";

import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { useState } from "react";
import { Choices, PlaybackControls, usePlayback } from "@/components/session/ui";
import { frames, type Mode } from "@/lib/wal";

const ACCENT = "var(--db)";

export default function WalDemo() {
  const [mode, setMode] = useState<Mode>("wal");
  return (
    <SessionPage>
      <SessionHeader kicker="Databases · interactive" title="The write-ahead log" blurb="A transaction moves $50 from A to B and commits. Then the power goes out before the changed pages reach disk. Does the money survive? The rule: write what you're about to do to a log first." />
      <div className="mt-6"><Run key={mode} mode={mode} setMode={setMode} /></div>
    </SessionPage>
  );
}

function Run({ mode, setMode }: { mode: Mode; setMode: (m: Mode) => void }) {
  const fr = frames(mode);
  const playback = usePlayback(fr.length, 1700);
  const f = fr[playback.i];
  const box = (title: string, vals: Record<string, number>, dead?: boolean) => (
    <div className="rounded-lg border p-2.5" style={{ borderColor: dead ? "var(--bad)" : "var(--line)", background: "var(--inset)" }}>
      <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--faint)]">{title}</p>
      <p className="mt-1 font-mono text-sm">{dead ? <span className="text-[var(--bad)]">lost</span> : `A=${vals.A} · B=${vals.B}`}</p>
    </div>
  );
  const sum = f.disk.A + f.disk.B;
  return (
    <SessionLayout
      visual={
        <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="Memory, log and disk">
          <div className="grid gap-2 sm:grid-cols-3">
            {box("Memory (buffer pool)", f.memory, Number.isNaN(f.memory.A))}
            <div className="rounded-lg border border-[var(--line)] bg-[var(--inset)] p-2.5">
              <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--faint)]">Write-ahead log</p>
              {mode === "no-wal" ? <p className="mt-1 text-xs text-[var(--faint)]">none</p> : <ul className="mt-1 space-y-0.5 font-mono text-xs">{f.log.length ? f.log.map((l) => <li key={l} style={{ color: l.includes("COMMIT") ? "var(--good)" : undefined }}>{l}</li>) : <li className="text-[var(--faint)]">empty</li>}</ul>}
            </div>
            {box("Data files on disk", f.disk)}
          </div>
          <p className="mt-3 font-mono text-sm" style={{ color: sum === 100 ? "var(--good)" : "var(--bad)" }}>money on disk: {sum}{sum !== 100 ? " (should be 100)" : ""}</p>
        </section>
      }
      panel={
        <SystemMapPanel caption={f.text}>
          <Choices label="Database" accent={ACCENT} value={mode} onChange={setMode} options={[{ id: "no-wal", label: "No log" }, { id: "wal", label: "Write-ahead log" }]} />
          <PlaybackControls playback={playback} accent={ACCENT} nextLabel="Next step" status={`step ${playback.i + 1} of ${fr.length}`} />
        </SystemMapPanel>
      }
      detail={
        <>
          <FlowStep n={1} title="Changes happen in memory" what="Writing whole pages to random places on disk for every commit would be far too slow." accent={ACCENT} active={f.step === "update"}><p className="text-sm text-[var(--muted)]">Dirty pages are flushed later.</p></FlowStep>
          <FlowArrow label="log first" accent={ACCENT} />
          <FlowStep n={2} title="Append to the log, fsync, then commit" what="A small sequential write that describes the change. Once it's on disk, the commit is durable." accent={ACCENT} active={f.step === "log"}><p className="font-mono text-xs">synchronous_commit = on</p></FlowStep>
          <FlowArrow label="crash" accent={ACCENT} />
          <FlowStep n={3} title="Recovery replays the log" what="Redo every committed change not yet in the data files; undo anything uncommitted. Checkpoints limit how far back it must go." accent={ACCENT} active={f.step === "redo"}><p className="text-sm text-[var(--muted)]">ARIES is the classic algorithm.</p></FlowStep>
          <FlowArrow label="bonus" accent={ACCENT} />
          <FlowStep n={4} title="The log feeds everything else" what="Replicas apply it, point-in-time restore replays it, and change data capture streams it to other systems." accent={ACCENT}><p className="text-sm text-[var(--muted)]">Postgres WAL, MySQL redo/binlog.</p></FlowStep>
        </>
      }
    />
  );
}
