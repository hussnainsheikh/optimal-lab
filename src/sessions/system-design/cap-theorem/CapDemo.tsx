"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices, PlaybackControls, usePlayback } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { runCap, type Mode, type Node } from "@/lib/cap";

const ACCENT = "var(--sys)";
const NODES: Node[] = ["A", "B", "C"];

export default function CapDemo() {
  const [mode, setMode] = useState<Mode>("CP");
  const frames = runCap(mode);
  const playback = usePlayback(frames.length, 1500);
  const f = frames[playback.i];
  const latest = Math.max(...NODES.map((n) => f.values[n]));

  return (
    <SessionPage>
      <SessionHeader
        kicker="System Design · interactive"
        title="CAP: consistency or availability"
        blurb="Networks split. When one replica can't reach the others, it has two choices for a request: refuse it, or answer with what it has, which may be out of date. You have to pick one. Try both."
      />

      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="Three replicas and a network partition">
              <div className="relative grid grid-cols-3 gap-3">
                {NODES.map((n) => {
                  const stale = f.values[n] < latest;
                  const target = f.request?.to === n;
                  return (
                    <div key={n} className="rounded-lg border-2 p-3 text-center" style={{ borderColor: target ? ACCENT : "var(--line)", background: "var(--inset)" }}>
                      <p className="font-mono text-sm text-[var(--muted)]">Replica {n}</p>
                      <p className="mt-1 font-mono text-2xl tabular-nums" style={{ color: stale ? "var(--bad)" : "var(--text)" }}>x = {f.values[n]}</p>
                      <p className="text-[11px] text-[var(--faint)]">{stale ? "behind" : "up to date"}</p>
                    </div>
                  );
                })}
                {f.partitioned && (
                  <div className="pointer-events-none absolute inset-y-[-6px] left-[66.6%] flex w-0 justify-center">
                    <span className="h-full border-l-2 border-dashed" style={{ borderColor: "var(--bad)" }} />
                  </div>
                )}
              </div>
              <p className="mt-2 text-center text-xs" style={{ color: f.partitioned ? "var(--bad)" : "var(--good)" }}>
                {f.partitioned ? "Network partition: C is cut off from A and B" : "Network healthy"}
              </p>

              {f.request && (
                <div className="mt-4 rounded-lg border p-3 text-sm" style={{ borderColor: f.result?.ok ? "var(--good)" : "var(--bad)" }}>
                  <p>
                    <span className="font-mono">{f.request.from}</span> → replica {f.request.to}: <span className="font-mono">{f.request.op}</span>
                  </p>
                  <p className="mt-1 font-mono" style={{ color: f.result?.ok ? (f.result.text.includes("stale") ? "var(--bad)" : "var(--good)") : "var(--bad)" }}>{f.result?.text}</p>
                </div>
              )}
            </section>
          }
          panel={
            <SystemMapPanel caption={f.title}>
              <Choices label="During a partition, prefer" accent={ACCENT} value={mode} onChange={(v) => { setMode(v); playback.reset(); }} options={[{ id: "CP", label: "Consistency (CP)" }, { id: "AP", label: "Availability (AP)" }]} />
              <PlaybackControls playback={playback} accent={ACCENT} nextLabel="Next" status={`step ${playback.i + 1} of ${frames.length}`} />
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Replicas copy every write" what="Three copies of the data, so one machine can fail without losing it." accent={ACCENT} active={playback.i === 0}>
                <p className="font-mono text-sm">A, B and C all hold x = 1</p>
              </FlowStep>
              <FlowArrow label="the network splits" accent={ACCENT} />

              <FlowStep n={2} title="A partition cuts some replicas off" what="Every machine is still running; they just can't talk. Partitions happen, so the real choice is what to do during one." accent={ACCENT} active={playback.i === 1 || playback.i === 2}>
                <p className="text-sm text-[var(--muted)]">{mode === "CP" ? "Writes need a majority (2 of 3): A and B have one, C doesn't." : "Every replica keeps accepting requests on its own."}</p>
              </FlowStep>
              <FlowArrow label="a request hits the cut-off side" accent={ACCENT} />

              <FlowStep n={3} title="Refuse, or answer stale" what="CP: C refuses, so no one ever reads an old value, but some requests fail. AP: C answers, so nothing fails, but the answer can be out of date." accent={ACCENT} active={playback.i === 3}>
                <p className="font-mono text-sm" style={{ color: playback.i >= 3 ? "var(--bad)" : undefined }}>{mode === "CP" ? "read at C → error: unavailable" : "read at C → x = 1 (stale)"}</p>
              </FlowStep>
              <FlowArrow label="the network heals" accent={ACCENT} />

              <FlowStep n={4} title="Pick per feature" what="Bank balances and inventory counts usually choose CP. Likes, feeds and shopping carts often choose AP and reconcile later." accent={ACCENT} active={playback.atEnd}>
                <p className="text-sm text-[var(--muted)]">After healing, C copies the missing write and all three agree again.</p>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
