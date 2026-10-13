"use client";

import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { useState } from "react";
import { Choices, PlaybackControls, usePlayback } from "@/components/session/ui";
import { rows, STEPS, STORAGES, type Storage } from "@/lib/dockerVolumes";

const ACCENT = "var(--ops)";

export default function VolumesDemo() {
  const [s, setS] = useState<Storage>("container");
  const playback = usePlayback(STEPS.length, 1500);
  const n = rows(s, playback.i);
  const st = STORAGES.find((x) => x.id === s)!;
  const lost = playback.i > 0 && n === 0;
  return (
    <SessionPage>
      <SessionHeader kicker="DevOps · interactive" title="Docker volumes" blurb="A container's own filesystem is a thin writable layer that's deleted with the container. Databases, uploads and anything else you want to keep belongs in a volume or a bind mount. Run the same steps with each." />
      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="Steps and data">
              <pre className="whitespace-pre-wrap rounded-md bg-[var(--inset)] p-2 font-mono text-xs">{st.flag}</pre>
              <ol className="mt-3 space-y-1">{STEPS.map((x, k) => <li key={x} className="flex justify-between rounded px-2 py-1 text-sm" style={{ background: k === playback.i ? "var(--inset)" : undefined, color: k <= playback.i ? undefined : "var(--faint)", outline: k === playback.i ? `1px solid ${ACCENT}` : undefined }}><span>{x}</span><span className="font-mono text-xs">{k <= playback.i ? `${rows(s, k)} rows` : ""}</span></li>)}</ol>
              <div className="mt-3 flex gap-1">{Array.from({ length: 3 }, (_, k) => <span key={k} className="h-8 flex-1 rounded" style={{ background: k < n ? ACCENT : "var(--track)" }} />)}</div>
              <p className="mt-2 font-mono text-sm" style={{ color: lost ? "var(--bad)" : "var(--good)" }}>{lost ? "Data gone" : `${n} rows`}</p>
            </section>
          }
          panel={
            <SystemMapPanel caption={playback.i === 3 ? (s === "container" ? "docker rm deleted the container's writable layer, and the database files with it." : "The new container mounts the same storage and finds the data.") : playback.i === 4 ? (s === "volume" ? "down -v removes named volumes too: easy to do by accident." : s === "bind" ? "Bind-mounted host folders are never touched by Docker." : "Already gone.") : "Restarting keeps the container and its data; removing it is what matters."}>
              <Choices label="Where data lives" accent={ACCENT} value={s} onChange={setS} options={STORAGES.map((x) => ({ id: x.id, label: x.label }))} />
              <PlaybackControls playback={playback} accent={ACCENT} nextLabel="Next step" status={`step ${playback.i + 1} of ${STEPS.length}`} />
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Containers are disposable" what="Upgrading means replacing the container. Anything written inside it disappears with it." accent={ACCENT} active={s === "container"}><p className="text-sm text-[var(--muted)]">That&apos;s a feature for stateless apps.</p></FlowStep>
              <FlowArrow label="managed by Docker" accent={ACCENT} />
              <FlowStep n={2} title="Named volumes" what="Docker stores them and they outlive containers. Best default for databases in development." accent={ACCENT} active={s === "volume"}><p className="font-mono text-xs">docker volume ls</p></FlowStep>
              <FlowArrow label="your folder" accent={ACCENT} />
              <FlowStep n={3} title="Bind mounts" what="Mount a host directory: great for live-reloading source code; watch file ownership and permissions." accent={ACCENT} active={s === "bind"}><p className="text-sm text-[var(--muted)]">Paths differ between machines.</p></FlowStep>
              <FlowArrow label="production" accent={ACCENT} />
              <FlowStep n={4} title="Back them up, or don't keep state there" what="In production, prefer managed databases and object storage; in Kubernetes, PersistentVolumes." accent={ACCENT}><p className="text-sm text-[var(--muted)]">A volume isn&apos;t a backup.</p></FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
