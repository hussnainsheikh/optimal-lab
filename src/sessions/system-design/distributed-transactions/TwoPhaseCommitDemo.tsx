"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices, PlaybackControls, usePlayback } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMap, SystemMapPanel, type NodeState, type Packet } from "@/components/system/SystemMap";
import { SCENARIOS, frames, ms, type Frame, type ScenarioId } from "@/lib/twoPhaseCommit";

const ACCENT = "var(--sys)";

export default function TwoPhaseCommitDemo() {
  const [scenario, setScenario] = useState<ScenarioId>("happy");
  return (
    <SessionPage>
      <SessionHeader
        kicker="System design · interactive"
        title="Distributed transactions and two-phase commit"
        blurb="Placing an order must write to the orders database and charge the card in the payments database: both or neither. No single database can promise that across two machines, so a coordinator asks each to prepare, collects their votes, logs a decision, then tells them to commit. Step through it, then crash the parts."
      />
      <div className="mt-6">
        <Run key={scenario} scenario={scenario} setScenario={setScenario} />
      </div>
    </SessionPage>
  );
}

function Run({ scenario, setScenario }: { scenario: ScenarioId; setScenario: (s: ScenarioId) => void }) {
  const list = frames(scenario);
  const playback = usePlayback(list.length, 1500);
  const f = list[playback.i];
  const sc = SCENARIOS.find((s) => s.id === scenario)!;
  const dbState = (s: Frame["orders"]): NodeState => (s === "down" ? "bad" : s === "committed" ? "good" : s === "aborted" ? "bad" : s === "prepared" ? "wait" : "idle");
  // Nothing moves until the reader presses play, as in the other system maps.
  const started = playback.i > 0 || playback.playing;
  const packets: Packet[] = !started ? [] : f.hops.map((h, i) => ({ id: `${scenario}-${playback.i}-${i}`, from: h.from, to: h.to, label: h.label, tone: h.tone, delay: i * 0.35 }));
  const on = (phase: Frame["phase"]) => f.phase === phase;

  return (
    <SessionLayout
      visual={
        <SystemMap
          title="A client, a transaction coordinator with its log, and the orders and payments databases"
          accent={ACCENT}
          chrome="split"
          nodes={[
            { id: "client", label: "Client", sub: f.phase === "done" ? (f.decision === "commit" ? "OK" : "failed") : "waiting", at: [10, 50], mobileAt: [50, 10], state: f.phase === "done" ? (f.decision === "commit" ? "good" : "bad") : "wait" },
            { id: "coord", label: "Coordinator", sub: f.coord === "down" ? "crashed" : f.decision === "none" ? "no decision yet" : `decided: ${f.decision}`, at: [42, 50], mobileAt: [30, 45], state: f.coord === "down" ? "bad" : "active" },
            { id: "log", label: "Coordinator log", sub: f.decision === "none" ? "empty" : f.decision.toUpperCase(), at: [42, 10], mobileAt: [78, 45], state: f.decision === "none" ? "idle" : "good" },
            { id: "orders", label: "Orders DB", sub: f.orders, at: [82, 22], mobileAt: [25, 86], state: dbState(f.orders) },
            { id: "payments", label: "Payments DB", sub: f.payments, at: [82, 78], mobileAt: [75, 86], state: dbState(f.payments) },
          ]}
          links={[
            { from: "client", to: "coord", label: "order + charge" },
            { from: "coord", to: "log", label: "decision", dashed: true },
            { from: "coord", to: "orders", label: "prepare / commit" },
            { from: "coord", to: "payments", label: "prepare / commit" },
          ]}
          packets={packets}
          aspect={2.2}
          mobileAspect={1}
        />
      }
      panel={
        <SystemMapPanel caption={f.caption}>
          <div className="w-full">
            <Choices label="Scenario" accent={ACCENT} value={scenario} onChange={setScenario} options={SCENARIOS.map((s) => ({ id: s.id, label: s.label }))} />
          </div>
          <PlaybackControls playback={playback} accent={ACCENT} nextLabel="Next" status={`${playback.i + 1} of ${list.length}`} />
          <p className="w-full font-mono text-xs" style={{ color: f.locksHeldMs >= 1000 ? "var(--bad)" : "var(--muted)" }}>
            locks held: {ms(f.locksHeldMs)} · {sc.what}
          </p>
        </SystemMapPanel>
      }
      detail={
        <>
          <FlowStep n={1} title="Phase 1: prepare" what="The coordinator sends the work to every participant. Each writes it to its own log, takes locks on the rows, and gets to the point where committing is guaranteed to succeed." accent={ACCENT} active={on("prepare")}>
            <p className="font-mono text-xs">
              orders: {f.orders} · payments: {f.payments}
            </p>
          </FlowStep>
          <FlowArrow label="votes" accent={ACCENT} />

          <FlowStep n={2} title="Vote" what="Yes means “I can commit this no matter what happens to me now”: it survives a crash because it's in the participant's log. A no from anyone aborts everyone." accent={ACCENT} active={on("vote")}>
            <p className="text-xs text-[var(--muted)]">After voting yes, a participant may not change its mind. It can only wait to be told.</p>
          </FlowStep>
          <FlowArrow label="decide" accent={ACCENT} />

          <FlowStep n={3} title="Log the decision" what="All yes: commit; any no: abort. The coordinator writes the decision to its log before telling anyone. That write is the commit point: once it's on disk the outcome is fixed, even if the coordinator dies the next instant." accent={ACCENT} active={on("decide")}>
            <p className="font-mono text-xs">decision: {f.decision}</p>
          </FlowStep>
          <FlowArrow label="phase 2" accent={ACCENT} />

          <FlowStep n={4} title="Phase 2: commit or abort everywhere" what="The coordinator delivers the decision. Each participant applies it and releases its locks. A participant that crashed meanwhile asks the coordinator on restart and finishes the job." accent={ACCENT} active={on("commit") || on("recover")}>
            <p className="font-mono text-xs">locks held so far: {ms(f.locksHeldMs)}</p>
          </FlowStep>
          <FlowArrow label="what it costs" accent={ACCENT} />

          <FlowStep n={5} title="The price: blocking" what="Between a yes vote and the decision, a participant holds locks and can do nothing else with those rows. If the coordinator dies in that window, everyone waits until it comes back. That is why 2PC is used inside one system (XA, Spanner) and avoided across services, where sagas trade atomicity for availability." accent={ACCENT} active={on("blocked") || on("done")}>
            <ul className="space-y-0.5 font-mono text-xs">
              {SCENARIOS.map((s) => {
                const fr = frames(s.id);
                const max = Math.max(...fr.map((x) => x.locksHeldMs));
                return (
                  <li key={s.id} className="flex justify-between gap-2" style={{ fontWeight: s.id === scenario ? 700 : 400 }}>
                    <span className="font-sans">{s.label}</span>
                    <span style={{ color: max >= 1000 ? "var(--bad)" : "var(--text)" }}>{ms(max)} of locks</span>
                  </li>
                );
              })}
            </ul>
            <p className="mt-2 text-xs text-[var(--faint)]">Times are illustrative. The sagas session shows the alternative for work that spans services.</p>
          </FlowStep>
        </>
      }
    />
  );
}
