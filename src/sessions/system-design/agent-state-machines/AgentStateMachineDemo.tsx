"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices, PlaybackControls, usePlayback } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { SESSION, STATES, TRANSITIONS, replay, type Mode, type State } from "@/lib/agentStateMachine";

const ACCENT = "var(--sys)";
const MODES: { id: Mode; label: string }[] = [
  { id: "loop", label: "Free agent loop" },
  { id: "machine", label: "Explicit state machine" },
];
const FLOW: State[] = ["gather", "check", "approval", "refund", "notify", "done"];

export default function AgentStateMachineDemo() {
  const [mode, setMode] = useState<Mode>("loop");
  const [persist, setPersist] = useState(false);
  return (
    <SessionPage>
      <SessionHeader
        kicker="System design · interactive"
        title="Agent loops and state machines"
        blurb="A refund agent: look up the order, check the policy, get a manager's approval for anything over €200, refund, tell the customer. Run it as a free loop where the model picks each next action, or as a state machine where the code knows the current step and only offers what's allowed. Replay the same session, with a model that tries to skip ahead and a server restart overnight."
      />
      <div className="mt-6">
        <Run key={`${mode}-${persist}`} mode={mode} setMode={setMode} persist={persist} setPersist={setPersist} />
      </div>
    </SessionPage>
  );
}

function Run({ mode, setMode, persist, setPersist }: { mode: Mode; setMode: (m: Mode) => void; persist: boolean; setPersist: (v: boolean) => void }) {
  const r = replay(mode, persist);
  const playback = usePlayback(SESSION.length, 1600);
  const step = r.steps[playback.i];
  const current = step.state;
  const other = replay(mode === "loop" ? "machine" : "loop", persist);

  return (
    <SessionLayout
      visual={
        <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="The refund flow's states and the session so far">
          <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">{mode === "machine" ? "state machine" : "free loop: no state, only chat history"}</p>
          <div className="mt-3 flex flex-wrap items-center gap-1">
            {FLOW.map((s, i) => (
              <span key={s} className="flex items-center gap-1">
                <span
                  className="rounded-md border px-2 py-1 font-mono text-[11px]"
                  style={{
                    borderColor: mode === "machine" && current === s ? ACCENT : "var(--line-strong)",
                    background: mode === "machine" && current === s ? `color-mix(in srgb, ${ACCENT} 18%, transparent)` : "transparent",
                    opacity: mode === "machine" ? 1 : 0.4,
                  }}
                >
                  {STATES.find((x) => x.id === s)!.label}
                </span>
                {i < FLOW.length - 1 && <span className="text-[var(--faint)]">→</span>}
              </span>
            ))}
          </div>
          <ol className="mt-4 space-y-1.5">
            {r.steps.map((s, i) => (
              <li key={i} className="text-xs" style={{ opacity: i <= playback.i ? 1 : 0.35 }}>
                <span className="font-semibold">{s.event.label}</span>
                <span className="block" style={{ color: s.bad ? "var(--bad)" : !s.allowed ? "var(--good)" : "var(--muted)" }}>
                  {!s.allowed ? "✋ " : s.bad ? "✗ " : ""}
                  {s.result}
                </span>
              </li>
            ))}
          </ol>
          <p className="mt-3 font-mono text-xs" style={{ color: r.invalid || r.lost ? "var(--bad)" : "var(--good)" }}>
            outcome: {r.final}
          </p>
        </section>
      }
      panel={
        <SystemMapPanel caption={`${step.event.label}. ${step.result}`}>
          <div className="w-full">
            <Choices label="Agent" accent={ACCENT} value={mode} onChange={setMode} options={MODES} />
          </div>
          <PlaybackControls playback={playback} accent={ACCENT} nextLabel="Next event" status={`${playback.i + 1} of ${SESSION.length}`} />
        </SystemMapPanel>
      }
      detail={
        <>
          <FlowStep n={1} title="Name the states and the moves between them" what="Write the process down as states (gathering, checking, waiting for approval, refunding, notifying) and the transitions allowed between them. That is the part of the agent that shouldn't be up to the model." accent={ACCENT} active={playback.i <= 1}>
            <ul className="space-y-0.5 font-mono text-[11px]">
              {FLOW.slice(0, -1).map((s) => (
                <li key={s}>
                  {s} → {TRANSITIONS[s].join(" | ")} · actions: {STATES.find((x) => x.id === s)!.actions.join(", ")}
                </li>
              ))}
            </ul>
          </FlowStep>
          <FlowArrow label="the model proposes" accent={ACCENT} />

          <FlowStep n={2} title="Let the model choose only among allowed actions" what="Inside a state the model still does the thinking: what to ask, what to write. But it can only call the tools that state offers. When it tries to refund before approval, the code says no and shows it what it can do." accent={ACCENT} active={playback.i === 2}>
            <p className="text-xs" style={{ color: r.steps[2].allowed ? "var(--bad)" : "var(--good)" }}>
              {r.steps[2].result}
            </p>
          </FlowStep>
          <FlowArrow label="the process waits" accent={ACCENT} />

          <FlowStep n={3} title="Persist the state, not just the chat" what="Waiting for a person can take a day. Store the state and its data in a database so a restart, a deploy or a new worker picks up exactly where it was. A chat history records what was said, not what step the process is on." accent={ACCENT} active={playback.i === 4}>
            <label className="flex min-h-11 items-center gap-2 text-sm">
              <input type="checkbox" checked={persist} onChange={(e) => setPersist(e.target.checked)} className="h-4 w-4" style={{ accentColor: ACCENT }} />
              Save to a database after every step
            </label>
            <p className="text-xs" style={{ color: r.steps[4].bad ? "var(--bad)" : "var(--text)" }}>
              {r.steps[4].result}
            </p>
          </FlowStep>
          <FlowArrow label="an event arrives" accent={ACCENT} />

          <FlowStep n={4} title="Resume on events" what="The manager's approval is an event that moves the machine from approval to refund. Whoever handles it, a day later on a different server, knows what to do next, and that the refund hasn't happened yet." accent={ACCENT} active={playback.i === 5}>
            <p className="text-xs" style={{ color: r.steps[5].bad ? "var(--bad)" : "var(--good)" }}>
              {r.steps[5].result}
            </p>
          </FlowStep>
          <FlowArrow label="the outcome" accent={ACCENT} />

          <FlowStep n={5} title="Make it inspectable" what="With explicit states you can list every refund waiting for approval, see where a stuck one stopped, and test each transition. A free loop is easier to start and harder to trust with anything that moves money." accent={ACCENT} active={playback.atEnd}>
            <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-0.5 font-mono text-xs">
              {[{ m: mode, x: r }, { m: mode === "loop" ? "machine" : "loop", x: other }].map(({ m, x }) => (
                <Row key={m} a={MODES.find((y) => y.id === m)!.label} b={x.final} bad={x.invalid > 0 || x.lost} bold={m === mode} />
              ))}
            </div>
          </FlowStep>
        </>
      }
    />
  );
}

function Row({ a, b, bad, bold }: { a: string; b: string; bad: boolean; bold: boolean }) {
  return (
    <>
      <span className="font-sans" style={{ fontWeight: bold ? 700 : 400 }}>
        {a}
      </span>
      <span className="text-right" style={{ fontWeight: bold ? 700 : 400, color: bad ? "var(--bad)" : "var(--good)" }}>
        {b}
      </span>
    </>
  );
}
