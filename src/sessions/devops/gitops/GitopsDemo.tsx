"use client";

import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { useState } from "react";
import { Choices, PlaybackControls, usePlayback } from "@/components/session/ui";
import { frames } from "@/lib/gitopsLoop";

const ACCENT = "var(--ops)";

export default function GitopsDemo() {
  const [heal, setHeal] = useState("on");
  return (
    <SessionPage>
      <SessionHeader kicker="DevOps · interactive" title="GitOps" blurb="Git holds the desired state of the cluster. A controller running inside the cluster keeps comparing the two and applies whatever Git says. Deploying becomes merging a pull request." />
      <div className="mt-6"><Run key={heal} heal={heal} setHeal={setHeal} /></div>
    </SessionPage>
  );
}

function Run({ heal, setHeal }: { heal: string; setHeal: (v: string) => void }) {
  const fr = frames(heal === "on");
  const playback = usePlayback(fr.length, 1700);
  const f = fr[playback.i];
  const pods = (n: number) => <div className="mt-1 flex flex-wrap gap-1">{Array.from({ length: n }, (_, i) => <span key={i} className="h-5 w-5 rounded" style={{ background: ACCENT }} />)}</div>;
  return (
    <SessionLayout
      visual={
        <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="Git and cluster">
          <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
            <div className="rounded-lg border-2 p-3" style={{ borderColor: f.actor === "dev" ? ACCENT : "var(--line)" }}>
              <p className="text-sm font-medium">Git repo</p>
              <pre className="overflow-x-auto mt-1 font-mono text-xs">replicas: {f.git}</pre>
            </div>
            <div className="rounded-lg border-2 p-2 text-center text-xs" style={{ borderColor: f.actor === "controller" ? ACCENT : "var(--line)" }}>controller<br /><span style={{ color: f.synced ? "var(--good)" : "var(--auto)" }}>{f.synced ? "Synced" : "OutOfSync"}</span></div>
            <div className="rounded-lg border-2 p-3" style={{ borderColor: f.actor === "human" ? "var(--bad)" : "var(--line)" }}>
              <p className="text-sm font-medium">Cluster</p>
              <p className="font-mono text-xs text-[var(--muted)]">{f.cluster} pods running</p>
              {pods(f.cluster)}
            </div>
          </div>
        </section>
      }
      panel={
        <SystemMapPanel caption={f.text}>
          <Choices label="Self-heal" accent={ACCENT} value={heal} onChange={setHeal} options={[{ id: "on", label: "On" }, { id: "off", label: "Off" }]} />
          <PlaybackControls playback={playback} accent={ACCENT} nextLabel="Next step" status={`step ${playback.i + 1} of ${fr.length}`} />
        </SystemMapPanel>
      }
      detail={
        <>
          <FlowStep n={1} title="Git is the source of truth" what="Manifests or Helm values live in a repo. Every change is a reviewed commit with an author and a way back." accent={ACCENT} active={f.actor === "dev"}><p className="text-sm text-[var(--muted)]">Rollback = git revert.</p></FlowStep>
          <FlowArrow label="pull, don't push" accent={ACCENT} />
          <FlowStep n={2} title="The controller pulls and applies" what="It runs in the cluster and reads Git, so CI never needs cluster admin credentials." accent={ACCENT} active={f.actor === "controller"}><p className="text-sm text-[var(--muted)]">Argo CD and Flux are the common ones.</p></FlowStep>
          <FlowArrow label="drift" accent={ACCENT} />
          <FlowStep n={3} title="Detect and undo drift" what="Manual kubectl changes show as OutOfSync. With self-heal, they're reverted automatically." accent={ACCENT} active={f.actor === "human" || (f.actor === "controller" && !f.synced)}><p className="text-sm text-[var(--muted)]">Emergencies: change Git, or pause sync deliberately.</p></FlowStep>
          <FlowArrow label="promote" accent={ACCENT} />
          <FlowStep n={4} title="Environments as folders or branches" what="Promote from staging to production by changing the image tag in the prod config, through a PR." accent={ACCENT}><p className="text-sm text-[var(--muted)]">Image updaters can open those PRs for you.</p></FlowStep>
        </>
      }
    />
  );
}
