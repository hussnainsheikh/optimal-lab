"use client";

import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { useState } from "react";
import { Choices, PlaybackControls, usePlayback } from "@/components/session/ui";
import { steps, type Mode } from "@/lib/schemaMigration";

const ACCENT = "var(--sys)";

export default function SchemaMigrationDemo() {
  const [mode, setMode] = useState<Mode>("rename");
  return (
    <SessionPage>
      <SessionHeader kicker="System design · interactive" title="Zero-downtime schema migrations" blurb="You want to rename users.name to full_name. During a rolling deploy, old and new app versions run at the same time against one database, so every schema change must work with both. Compare a one-step rename with expand and contract." />
      <div className="mt-6"><Run key={mode} mode={mode} setMode={setMode} /></div>
    </SessionPage>
  );
}

function Run({ mode, setMode }: { mode: Mode; setMode: (m: Mode) => void }) {
  const st = steps(mode);
  const playback = usePlayback(st.length, 1800);
  const s = st[playback.i];
  return (
    <SessionLayout
      visual={
        <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="Schema and servers">
          <ol className="flex flex-wrap gap-1">{st.map((x, i) => <li key={x.phase} className="rounded px-2 py-1 text-xs" style={{ background: i === playback.i ? ACCENT : "var(--inset)", color: i === playback.i ? "var(--on-accent)" : i < playback.i ? undefined : "var(--faint)" }}>{x.phase}</li>)}</ol>
          <div className="mt-4 rounded-lg border border-[var(--line)] p-3">
            <p className="text-xs text-[var(--muted)]">users table columns</p>
            <div className="mt-1 flex gap-1">{s.schema.split(" + ").map((c) => <span key={c} className="rounded px-2 py-1 font-mono text-sm" style={{ background: "var(--inset)" }}>{c}</span>)}</div>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">{s.apps.split(" ").map((v, i) => <div key={i} className="rounded-lg border-2 p-2 text-center" style={{ borderColor: s.errors && v === "v1" ? "var(--bad)" : "var(--line)" }}><p className="text-xs text-[var(--muted)]">server {i + 1}</p><p className="font-mono">{v}</p>{s.errors && v === "v1" && <p className="text-[10px] text-[var(--bad)]">500 errors</p>}</div>)}</div>
        </section>
      }
      panel={
        <SystemMapPanel caption={s.text}>
          <Choices label="Approach" accent={ACCENT} value={mode} onChange={setMode} options={[{ id: "rename", label: "Rename in one step" }, { id: "expand", label: "Expand and contract" }]} />
          <PlaybackControls playback={playback} accent={ACCENT} nextLabel="Next phase" status={`${playback.i + 1} of ${st.length}`} />
        </SystemMapPanel>
      }
      detail={
        <>
          <FlowStep n={1} title="Old and new code overlap" what="Rolling deploys, canaries and rollbacks mean several versions hit the same schema at once." accent={ACCENT}><p className="text-sm text-[var(--muted)]">So each step must be compatible both ways.</p></FlowStep>
          <FlowArrow label="expand" accent={ACCENT} />
          <FlowStep n={2} title="Expand: only add" what="New columns are nullable or have defaults; old code ignores them." accent={ACCENT} active={s.phase === "expand"}><p className="text-sm text-[var(--muted)]">Big-table changes need online tools.</p></FlowStep>
          <FlowArrow label="migrate" accent={ACCENT} />
          <FlowStep n={3} title="Dual write, backfill, switch reads" what="Each is its own deploy, and each can be rolled back on its own." accent={ACCENT} active={["dual write", "backfill", "switch reads"].includes(s.phase)}><p className="text-sm text-[var(--muted)]">Backfill in batches to avoid locking.</p></FlowStep>
          <FlowArrow label="contract" accent={ACCENT} />
          <FlowStep n={4} title="Contract: remove the old" what="Once nothing reads or writes it, drop the old column in a later release." accent={ACCENT} active={s.phase === "contract"}><p className="text-sm text-[var(--muted)]">Slower, but nothing breaks.</p></FlowStep>
        </>
      }
    />
  );
}
