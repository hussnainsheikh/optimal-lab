"use client";

import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { useState } from "react";
import { Choices, PlaybackControls, usePlayback } from "@/components/session/ui";
import { frames, type Mode } from "@/lib/cdcFlow";

const ACCENT = "var(--sys)";

export default function CdcDemo() {
  const [mode, setMode] = useState<Mode>("dual");
  return (
    <SessionPage>
      <SessionHeader kicker="System design · interactive" title="Change data capture" blurb="Data often lives in more than one place: the database, a search index, a cache, a warehouse. Writing to each from the app (dual writes) drifts apart on any crash. Change data capture reads the database's own log and streams every committed change out." />
      <div className="mt-6"><Run key={mode} mode={mode} setMode={setMode} /></div>
    </SessionPage>
  );
}

function Box({ title, items, hot, bad }: { title: string; items: string[]; hot: boolean; bad?: boolean }) {
  return (
    <div className="rounded-lg border-2 p-2" style={{ borderColor: bad ? "var(--bad)" : hot ? ACCENT : "var(--line)" }}>
      <p className="text-xs text-[var(--muted)]">{title}</p>
      <ul className="mt-1 space-y-0.5 font-mono text-xs">{items.length ? items.map((x, i) => <li key={i}>{x}</li>) : <li className="text-[var(--faint)]">—</li>}</ul>
    </div>
  );
}

function Run({ mode, setMode }: { mode: Mode; setMode: (m: Mode) => void }) {
  const fr = frames(mode);
  const playback = usePlayback(fr.length, 1700);
  const f = fr[playback.i];
  return (
    <SessionLayout
      visual={
        <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="Data flow">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Box title="Postgres" items={f.db} hot={f.actor === "app"} />
            <Box title="WAL (log)" items={mode === "cdc" ? f.log : ["(not used)"]} hot={f.actor === "cdc"} />
            <Box title="Kafka" items={mode === "cdc" ? f.bus : ["(not used)"]} hot={f.actor === "cdc"} />
            <Box title="Search index" items={f.search} hot={f.actor === "consumer" || (mode === "dual" && f.actor === "app")} bad={f.bad} />
          </div>
          <p className="mt-3 font-mono text-sm" style={{ color: f.bad ? "var(--bad)" : f.db.join() === f.search.join() ? "var(--good)" : "var(--auto)" }}>{f.bad ? "Out of sync, permanently" : f.db.join() === f.search.join() ? "In sync" : "Catching up…"}</p>
        </section>
      }
      panel={
        <SystemMapPanel caption={f.text}>
          <Choices label="Approach" accent={ACCENT} value={mode} onChange={setMode} options={[{ id: "dual", label: "Dual writes" }, { id: "cdc", label: "Change data capture" }]} />
          <PlaybackControls playback={playback} accent={ACCENT} nextLabel="Next step" status={`step ${playback.i + 1} of ${fr.length}`} />
        </SystemMapPanel>
      }
      detail={
        <>
          <FlowStep n={1} title="Dual writes can't be atomic" what="Two systems, two writes. A crash, timeout or bug between them leaves them disagreeing, with nothing to repair it." accent={ACCENT} active={mode === "dual"}><p className="text-sm text-[var(--muted)]">Retries can also reorder updates.</p></FlowStep>
          <FlowArrow label="one source of truth" accent={ACCENT} />
          <FlowStep n={2} title="The database log already has every change" what="Committed, in order. A CDC connector reads it like a replica would." accent={ACCENT} active={f.actor === "cdc"}><p className="text-sm text-[var(--muted)]">Postgres logical replication, MySQL binlog.</p></FlowStep>
          <FlowArrow label="stream" accent={ACCENT} />
          <FlowStep n={3} title="Publish change events" what="Each consumer (search, cache invalidation, analytics) reads at its own pace and resumes after crashes." accent={ACCENT} active={f.actor === "consumer"}><p className="text-sm text-[var(--muted)]">Consumers must be idempotent.</p></FlowStep>
          <FlowArrow label="trade-off" accent={ACCENT} />
          <FlowStep n={4} title="Eventually consistent, never lost" what="Copies lag by milliseconds to seconds. For business events (not raw row changes), use the outbox pattern feeding the same pipeline." accent={ACCENT}><p className="text-sm text-[var(--muted)]">Watch connector lag.</p></FlowStep>
        </>
      }
    />
  );
}
