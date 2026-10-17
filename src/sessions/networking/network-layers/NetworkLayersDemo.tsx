"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { Choices, RunButton, useWalk } from "@/components/session/ui";
import { FAULTS, LAYERS, SCENARIOS, layerIndex, type FaultId, type ScenarioId } from "@/lib/networkLayers";

const ACCENT = "var(--net)";

export default function NetworkLayersDemo() {
  const [scenarioId, setScenarioId] = useState<ScenarioId>("web");
  const [faultId, setFaultId] = useState<FaultId>("none");
  const [picked, setPicked] = useState<number | null>(null);
  const { stage, busy, run, setStage } = useWalk(LAYERS.length, 900);
  const scenario = SCENARIOS.find((s) => s.id === scenarioId)!;
  const fault = FAULTS.find((f) => f.id === faultId)!;
  const faultAt = fault.layer ? layerIndex(fault.layer) : null;
  // One source of truth: a running walk wins, then the reader's click, then the fault.
  const focus = stage ?? picked ?? faultAt;
  const layer = focus === null ? null : LAYERS[focus];

  const caption =
    stage !== null
      ? `Going down: the ${LAYERS[stage].name.toLowerCase()} layer uses ${scenario.stack[LAYERS[stage].id]}.`
      : fault.layer
        ? `${fault.label}: look at the ${LAYERS[faultAt!].name.toLowerCase()} layer. ${fault.explain}`
        : layer
          ? `${layer.name}: ${layer.question}`
          : "Pick what you are doing, then send it down the stack. Or pick a symptom to see which layer is broken.";

  const step = (i: number) => {
    const l = LAYERS[i];
    const broken = faultAt !== null && faultAt === i;
    const blocked = faultAt !== null && i < faultAt; // everything above a broken layer fails too
    return (
      <div className="space-y-2 text-sm">
        <p className="font-mono text-xs" style={{ color: ACCENT }}>{scenario.stack[l.id]}</p>
        <dl className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-x-2 gap-y-1 text-xs">
          <dt className="text-[var(--faint)]">adds</dt><dd className="min-w-0">{l.adds}</dd>
          <dt className="text-[var(--faint)]">address</dt><dd className="min-w-0 font-mono">{l.address}</dd>
          <dt className="text-[var(--faint)]">called a</dt><dd className="min-w-0">{l.unit}</dd>
          <dt className="text-[var(--faint)]">works here</dt><dd className="min-w-0">{l.device}</dd>
        </dl>
        {broken && <p className="text-xs" style={{ color: "var(--bad)" }}>Broken here: {fault.explain}</p>}
        {blocked && <p className="text-xs text-[var(--faint)]">Fails too, because it sits on top of the broken {LAYERS[faultAt!].name.toLowerCase()} layer.</p>}
      </div>
    );
  };

  return (
    <SessionPage>
      <SessionHeader
        kicker="Networking · interactive"
        title="The network layers"
        blurb="Sending data over a network is split into layers. Each layer answers one question (which program? which machine? which box next?) and leaves the rest to the layers above and below. Pick a task and send it down the stack."
      />
      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="The layer stack">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">TCP/IP layers · {scenario.label}</p>
                <p className="font-mono text-[11px] text-[var(--faint)]">tap a layer</p>
              </div>
              <ol className="mt-3 space-y-1.5">
                {LAYERS.map((l, i) => {
                  const on = focus === i;
                  const broken = faultAt === i;
                  const blocked = faultAt !== null && i < faultAt;
                  return (
                    <li key={l.id}>
                      <button
                        type="button"
                        aria-pressed={on}
                        onClick={() => { setStage(null); setPicked(picked === i ? null : i); }}
                        className="grid min-h-11 w-full grid-cols-[1.75rem_minmax(0,1fr)] items-center gap-x-2 rounded-lg border px-2 py-2 text-left sm:grid-cols-[1.75rem_minmax(0,9rem)_minmax(0,1fr)_4.5rem]"
                        style={{
                          borderColor: broken ? "var(--bad)" : on ? ACCENT : "var(--line)",
                          background: on ? `color-mix(in srgb, ${ACCENT} 12%, transparent)` : "var(--inset)",
                          opacity: blocked ? 0.55 : 1,
                        }}
                      >
                        <span className="font-mono text-xs text-[var(--faint)]">{5 - i}</span>
                        <span className="min-w-0 text-sm font-semibold">{l.name}</span>
                        <span className="col-start-2 min-w-0 font-mono text-xs text-[var(--muted)] sm:col-start-3">{scenario.stack[l.id]}</span>
                        <span className="col-start-2 font-mono text-[10px] text-[var(--faint)] sm:col-start-4 sm:text-right">{l.osi}</span>
                      </button>
                    </li>
                  );
                })}
              </ol>
              <div className="mt-4 rounded-lg border border-[var(--line)] p-3 text-sm">
                {layer ? (
                  <>
                    <p className="font-medium">{layer.question}</p>
                    <p className="mt-1 text-[var(--muted)]">{layer.adds}</p>
                  </>
                ) : (
                  <p className="text-[var(--muted)]">Sending: data goes down the stack, each layer adding its part. Receiving: it goes back up, each layer reading and removing its part.</p>
                )}
              </div>
            </section>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <Choices label="What are you doing?" accent={ACCENT} value={scenarioId} onChange={(v) => { setScenarioId(v); setStage(null); }} options={SCENARIOS.map((s) => ({ id: s.id, label: s.label }))} />
              <Choices label="What's the symptom?" accent={ACCENT} value={faultId} onChange={(v) => { setFaultId(v); setPicked(null); setStage(null); }} options={FAULTS.map((f) => ({ id: f.id, label: f.label }))} />
              <RunButton busy={busy} onClick={() => { setPicked(null); run(); }} accent={ACCENT} running="Going down…">Send it down the stack</RunButton>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Say what the program wants" what="The application layer writes the request in its own format. It doesn't care how the bytes travel." accent={ACCENT} active={focus === 0}>{step(0)}</FlowStep>
              <FlowArrow label={scenario.passes[0]} accent={ACCENT} active={stage === 1} />
              <FlowStep n={2} title="Pick the program on the other machine" what="The transport layer adds port numbers, so the right program gets the data. TCP also numbers the bytes so it can resend lost ones." accent={ACCENT} active={focus === 1}>{step(1)}</FlowStep>
              <FlowArrow label={scenario.passes[1]} accent={ACCENT} active={stage === 2} />
              <FlowStep n={3} title="Address the machine across the internet" what="The network layer adds IP addresses. Routers read only this part to choose the next hop." accent={ACCENT} active={focus === 2}>{step(2)}</FlowStep>
              <FlowArrow label={scenario.passes[2]} accent={ACCENT} active={stage === 3} />
              <FlowStep n={4} title="Reach the next box on this link" what="The link layer adds MAC addresses for one hop only: your laptop to your router. Each router writes a new one." accent={ACCENT} active={focus === 3}>{step(3)}</FlowStep>
              <FlowArrow label={scenario.passes[3]} accent={ACCENT} active={stage === 4} />
              <FlowStep n={5} title="Turn bits into signals" what="The physical layer sends each bit as voltage, light or radio. The receiver reads them back up, from layer 1 to layer 5." accent={ACCENT} active={focus === 4}>
                {step(4)}
                <p className="mt-2 text-xs text-[var(--muted)]">Swap Wi-Fi for Ethernet and only the bottom two layers change. That independence is the point of layers.</p>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
