"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices, RunButton, useWalk } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMap, SystemMapPanel, hops, type Packet } from "@/components/system/SystemMap";
import { CRASHES, DESIGNS, STEPS, TOKEN_PRICE, recover, type CrashPoint, type Design } from "@/lib/durableExecution";

const ACCENT = "var(--sys)";

export default function DurableExecutionDemo() {
  const [d, setD] = useState<Design>("none");
  const [c, setC] = useState<CrashPoint>("duringCharge");
  const { stage, busy, run } = useWalk(5, 1100);
  const at = (i: number) => stage === i;
  const o = recover(d, c);
  const crash = CRASHES.find((x) => x.id === c)!;
  const label = DESIGNS.find((x) => x.id === d)!.label;

  const packets: Packet[] =
    stage === 0 ? hops("run", ["worker", "llm"], { label: "extract fields" })
    : stage === 1 ? hops("pay", ["worker", "payments"], { label: "charge €150" })
    : stage === 2 ? (d === "none" ? [] : hops("rec", ["worker", "history"], { label: crash.between && d !== "durable" ? "never written" : "step done", tone: crash.between && d === "checkpoint" ? "bad" : "good" }))
    : stage === 3 ? hops("restart", ["history", "worker"], { label: d === "none" ? "nothing to resume" : "resume", tone: d === "none" ? "bad" : "good" })
    : stage === 4 ? hops("again", ["worker", "payments"], { label: o.doubleCharged ? "charge €150 again" : o.reran.some((s) => s.startsWith("Charge")) ? "same idempotency key" : "skipped", tone: o.doubleCharged ? "bad" : "good" })
    : [];

  const captions = [
    "Step 1: the claim workflow starts: read documents, then an LLM call to extract the fields.",
    "Step 2: the excess is charged to the customer's card.",
    `Step 3: the worker crashes ${crash.label.toLowerCase()}.`,
    d === "none" ? "Step 4: a new worker starts the whole workflow from the top." : "Step 4: a new worker reads what was recorded and resumes from there.",
    `Step 5: ${o.note}`,
  ];
  const caption = stage !== null ? captions[stage] : `${label}, crash ${crash.label.toLowerCase()}: ${o.reran.length} step${o.reran.length === 1 ? "" : "s"} run again${o.doubleCharged ? ", customer charged twice" : ""}${o.doubleBooked ? ", repair booked twice" : ""}${o.wastedTokens ? `, ${(o.wastedTokens / 1000).toFixed(0)}k tokens spent again` : ""}.`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="System design · interactive"
        title="Durable execution and recovery"
        blurb={`An agent handles an insurance claim in ${STEPS.length} steps: read the documents, extract the fields with an LLM, charge the €150 excess, book a repair, write a summary, email the customer. Halfway through, the worker crashes. What happens next depends on what the workflow wrote down before it died.`}
      />

      <div className="mt-6">
        <SessionLayout
          visual={
            <div className="space-y-3">
              <SystemMap
                title="A workflow worker, its recorded history, the LLM, the payment provider and the repair shop's API"
                accent={ACCENT}
                chrome="split"
                nodes={[
                  { id: "worker", label: "Worker", sub: stage === 2 ? "crashed" : "running", at: [36, 50], mobileAt: [50, 40], state: stage === 2 ? "bad" : "active" },
                  { id: "history", label: d === "durable" ? "Event history" : d === "checkpoint" ? "Checkpoints" : "Nothing", sub: d === "none" ? "no record" : "per step", at: [10, 50], mobileAt: [50, 8], state: d === "none" ? "dim" : "good" },
                  { id: "llm", label: "LLM", sub: "65k tokens", at: [72, 14], mobileAt: [18, 78], state: "idle" },
                  { id: "payments", label: "Payments", sub: o.doubleCharged ? "charged twice" : "charged once", at: [90, 50], mobileAt: [50, 92], state: o.doubleCharged ? "bad" : "good" },
                  { id: "repair", label: "Repair shop", sub: o.doubleBooked ? "booked twice" : "booked once", at: [72, 86], mobileAt: [82, 78], state: o.doubleBooked ? "bad" : "good" },
                ]}
                links={[
                  { from: "worker", to: "history", label: "record", dashed: true, dim: d === "none" },
                  { from: "worker", to: "llm", label: "prompt" },
                  { from: "worker", to: "payments", label: "charge" },
                  { from: "worker", to: "repair", label: "book" },
                ]}
                packets={packets}
                aspect={2}
                mobileAspect={0.95}
              />
              <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3" aria-label="The workflow's steps, the crash, and what runs again">
                <ol className="space-y-1 text-[11px]">
                  {STEPS.map((s, i) => {
                    const again = o.reran.includes(s.label);
                    const crashedHere = i === crash.index;
                    return (
                      <li key={s.id} className="grid grid-cols-[1.25rem_minmax(0,1fr)_5.5rem] gap-2">
                        <span className="font-mono text-[var(--faint)]">{i + 1}</span>
                        <span>
                          {s.label}
                          {crashedHere && <span style={{ color: "var(--bad)" }}> · crash {crash.between ? "before recording" : "after"}</span>}
                        </span>
                        <span className="text-right font-mono" style={{ color: again ? (s.kind === "payment" || s.kind === "external" ? (d === "durable" ? "var(--good)" : "var(--bad)") : "var(--text)") : "var(--muted)" }}>
                          {i > crash.index ? "then runs" : again ? (d === "durable" ? "retried, deduped" : "runs again") : "skipped"}
                        </span>
                      </li>
                    );
                  })}
                </ol>
              </section>
            </div>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <div className="w-full">
                <Choices label="What's recorded" accent={ACCENT} value={d} onChange={setD} options={DESIGNS.map((x) => ({ id: x.id, label: x.label }))} />
              </div>
              <RunButton busy={busy} onClick={run} accent={ACCENT} running="Running…">
                Crash it
              </RunButton>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Long agent tasks will be interrupted" what="Deploys, out-of-memory kills, a lost node, a rate-limited provider: a workflow that takes minutes, or waits days for a person, will not finish in one process lifetime." accent={ACCENT} active={at(0)}>
                <Choices label="Crash" accent={ACCENT} value={c} onChange={setC} options={CRASHES.map((x) => ({ id: x.id, label: x.label }))} />
              </FlowStep>
              <FlowArrow label="side effects" accent={ACCENT} active={at(1)} />

              <FlowStep n={2} title="Know which steps can't simply repeat" what="Rereading documents is harmless. Re-calling the LLM costs tokens and may give a different answer. Charging a card or booking a repair twice is a real-world mistake." accent={ACCENT} active={at(1)}>
                <ul className="space-y-0.5 font-mono text-[11px]">
                  {STEPS.map((s) => (
                    <li key={s.id} style={{ color: s.kind === "payment" || s.kind === "external" || s.kind === "email" ? "var(--bad)" : "var(--text)" }}>
                      {s.label}: {s.kind === "llm" ? `${(s.tokens / 1000).toFixed(0)}k tokens` : s.kind === "read" ? "safe to repeat" : "external side effect"}
                    </li>
                  ))}
                </ul>
              </FlowStep>
              <FlowArrow label="record progress" accent={ACCENT} active={at(2)} />

              <FlowStep n={3} title="Record each step's result" what="Checkpoints after each step let a restart skip finished work. But there's always a moment between doing a step and recording it; a crash there means the step runs again." accent={ACCENT} active={at(2)}>
                <Choices label="What's recorded" accent={ACCENT} value={d} onChange={setD} options={DESIGNS.map((x) => ({ id: x.id, label: x.label }))} />
                <p className="mt-2 text-xs">{DESIGNS.find((x) => x.id === d)!.one}</p>
              </FlowStep>
              <FlowArrow label="restart" accent={ACCENT} active={at(3)} />

              <FlowStep n={4} title="Replay the history to resume" what="A durable execution engine (Temporal, Restate, AWS Step Functions) stores every step's result as an event. A new worker replays the history to rebuild the workflow's state without calling anything again, then continues from the first step with no result." accent={ACCENT} active={at(3)}>
                <p className="font-mono text-xs">
                  steps run again: {o.reran.length ? o.reran.join(", ") : "none"}
                </p>
              </FlowStep>
              <FlowArrow label="close the gap" accent={ACCENT} active={at(4)} />

              <FlowStep n={5} title="Make side effects idempotent" what="To close the gap between doing and recording, give each side effect a key derived from the workflow and step: claim-8812-charge. If the step runs again, the payment provider recognises the key and returns the first result." accent={ACCENT} active={at(4)}>
                <div className="grid grid-cols-[minmax(0,1fr)_auto_auto_auto] gap-x-3 gap-y-0.5 font-mono text-xs">
                  <span />
                  <span className="text-right text-[var(--faint)]">reruns</span>
                  <span className="text-right text-[var(--faint)]">2× charge</span>
                  <span className="text-right text-[var(--faint)]">tokens again</span>
                  {DESIGNS.map((x) => {
                    const y = recover(x.id, c);
                    return <Row key={x.id} cells={[x.label, String(y.reran.length), y.doubleCharged ? "yes" : "no", `$${(y.wastedTokens * TOKEN_PRICE).toFixed(2)}`]} bad={y.doubleCharged} bold={x.id === d} />;
                  })}
                </div>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}

function Row({ cells, bad, bold }: { cells: string[]; bad: boolean; bold: boolean }) {
  return (
    <>
      {cells.map((c, i) => (
        <span key={i} className={i === 0 ? "font-sans" : "text-right"} style={{ fontWeight: bold ? 700 : 400, color: i === 2 ? (bad ? "var(--bad)" : "var(--good)") : "var(--text)" }}>
          {c}
        </span>
      ))}
    </>
  );
}
