"use client";

import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { PlaybackControls, usePlayback } from "@/components/session/ui";
import { frames, NODES, PODS } from "@/lib/k8sScheduler";

const ACCENT = "var(--ops)";
const FRAMES = frames();

export default function SchedulerDemo() {
  const playback = usePlayback(FRAMES.length, 1800);
  const f = FRAMES[playback.i];
  return (
    <SessionPage>
      <SessionHeader kicker="DevOps · interactive" title="How Kubernetes schedules pods" blurb="Each pod declares how much CPU it needs. The scheduler filters out nodes that can't fit it (or that it isn't allowed on), scores the rest, and binds the pod to the best. Watch seven pods land on three 4-CPU nodes." />
      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="Nodes">
              <div className="grid gap-2 sm:grid-cols-3">
                {NODES.map((n) => {
                  const pods = f.placed.filter((p) => p.node === n.name);
                  const used = pods.reduce((a, p) => a + p.cpu, 0);
                  return (
                    <div key={n.name} className="rounded-lg border-2 p-2" style={{ borderColor: pods.some((p) => p.pod === f.cur) ? ACCENT : "var(--line)" }}>
                      <p className="flex justify-between text-sm"><span>{n.name}</span><span className="font-mono text-xs text-[var(--muted)]">{used}/{n.cpu} CPU</span></p>
                      {n.taint && <p className="text-[10px] text-[var(--auto)]">taint: {n.taint}</p>}
                      <div className="mt-1 flex h-40 flex-col-reverse overflow-hidden rounded bg-[var(--track)]">{pods.map((p) => <span key={p.pod} className="grid place-items-center border-t border-[var(--panel)] font-mono text-[10px]" style={{ height: `${(p.cpu / n.cpu) * 100}%`, background: p.pod === f.cur ? ACCENT : "var(--ghost)", color: p.pod === f.cur ? "var(--on-accent)" : undefined }}>{p.pod} {p.cpu}</span>)}</div>
                    </div>
                  );
                })}
              </div>
              <p className="mt-3 font-mono text-xs">queue: {PODS.map((p) => p.name).join(" → ")}</p>
              {f.pending.length > 0 && <p className="mt-1 font-mono text-sm text-[var(--bad)]">Pending: {f.pending.join(", ")}</p>}
            </section>
          }
          panel={<SystemMapPanel caption={f.text}><PlaybackControls playback={playback} accent={ACCENT} nextLabel="Next pod" status={`pod ${playback.i + 1} of ${FRAMES.length}`} /></SystemMapPanel>}
          detail={
            <>
              <FlowStep n={1} title="Requests, not real usage" what="The scheduler packs by what pods request. Requests too high waste nodes; too low and nodes get overcommitted." accent={ACCENT}><p className="text-sm text-[var(--muted)]">Set them from measured usage.</p></FlowStep>
              <FlowArrow label="filter" accent={ACCENT} />
              <FlowStep n={2} title="Filter: who can fit it?" what="Enough free CPU and memory, matching node selectors and affinity, and taints the pod tolerates." accent={ACCENT}><p className="text-sm text-[var(--muted)]">Taints keep ordinary pods off special nodes.</p></FlowStep>
              <FlowArrow label="score" accent={ACCENT} />
              <FlowStep n={3} title="Score: who fits best?" what="Spread load (least allocated), honour preferences, spread replicas across zones." accent={ACCENT}><p className="text-sm text-[var(--muted)]">topologySpreadConstraints for HA.</p></FlowStep>
              <FlowArrow label="nothing fits" accent={ACCENT} />
              <FlowStep n={4} title="Pending and fragmentation" what="Free capacity scattered across nodes can't host a pod that needs it in one place. kubectl describe pod shows why." accent={ACCENT} active={f.pending.length > 0}><p className="font-mono text-xs">0/3 nodes are available: Insufficient cpu</p></FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
