"use client";

import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { useState } from "react";
import { Choices, PlaybackControls, usePlayback } from "@/components/session/ui";
import { DIRECT, REACT, TOOLS, type Step } from "@/lib/reactLoop";

const ACCENT = "var(--ai)";
const KIND: Record<Step["kind"], { label: string; color: string }> = {
  question: { label: "Question", color: "var(--muted)" },
  thought: { label: "Thought", color: "var(--ai)" },
  action: { label: "Action", color: "var(--auto)" },
  observation: { label: "Observation", color: "var(--good)" },
  answer: { label: "Answer", color: "var(--text)" },
};
type Mode = "react" | "direct";

export default function ReactLoopDemo() {
  const [mode, setMode] = useState<Mode>("react");
  return (
    <SessionPage>
      <SessionHeader kicker="AI · interactive" title="The ReAct loop" blurb="An agent alternates between reasoning and acting: think about what's missing, call a tool, read the result, and think again. It stops when it can answer. Compare it with a model that just answers from memory." />
      <div className="mt-6"><Loop key={mode} mode={mode} setMode={setMode} /></div>
    </SessionPage>
  );
}

function Loop({ mode, setMode }: { mode: Mode; setMode: (m: Mode) => void }) {
  const steps = mode === "react" ? REACT : DIRECT;
  const playback = usePlayback(steps.length, 1500);
  const shown = steps.slice(0, playback.i + 1);
  const cur = steps[playback.i];
  const calls = shown.filter((s) => s.kind === "action").length;
  const caption = mode === "direct"
    ? "No tools: the model guesses from training data. It sounds sure, but it can't know today's weather. 72 °F is made up."
    : cur.kind === "thought" ? "Thought: the model writes down what it still needs." : cur.kind === "action" ? `Action: the model asks to call ${cur.tool}. Your code runs it, not the model.` : cur.kind === "observation" ? "Observation: the tool result is added to the context for the next turn." : cur.kind === "answer" ? `Done after ${calls} tool calls. Every fact came from a tool.` : "The question goes in with a list of tools the model may use.";
  return (
    <SessionLayout
      visual={
        <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="Agent transcript">
          <div className="flex flex-wrap gap-1.5">
            {TOOLS.map((t) => <span key={t} className="rounded border px-2 py-0.5 font-mono text-xs" style={{ borderColor: cur.tool === t ? "var(--auto)" : "var(--line)", color: cur.tool === t ? "var(--auto)" : "var(--muted)" }}>{t}()</span>)}
          </div>
          <ol className="mt-3 space-y-1.5">
            {shown.map((s, i) => (
              <li key={i} className="rounded-md border-l-2 bg-[var(--inset)] px-2.5 py-1.5 text-sm" style={{ borderColor: KIND[s.kind].color, opacity: i === playback.i ? 1 : 0.75 }}>
                <span className="font-mono text-[11px] uppercase tracking-[0.12em]" style={{ color: KIND[s.kind].color }}>{KIND[s.kind].label}</span>
                <p className={s.kind === "action" ? "font-mono text-xs" : ""} style={{ color: s.kind === "answer" && mode === "direct" ? "var(--bad)" : undefined }}>{s.text}</p>
              </li>
            ))}
          </ol>
        </section>
      }
      panel={
        <SystemMapPanel caption={caption}>
          <Choices label="Agent" accent={ACCENT} value={mode} onChange={setMode} options={[{ id: "react", label: "ReAct with tools" }, { id: "direct", label: "Answer directly" }]} />
          <PlaybackControls playback={playback} accent={ACCENT} nextLabel="Next step" status={`step ${playback.i + 1} of ${steps.length}`} />
        </SystemMapPanel>
      }
      detail={
        <>
          <FlowStep n={1} title="Think" what="The model reasons about what it knows and what it still needs." accent={ACCENT} active={cur.kind === "thought"}><p className="text-sm text-[var(--muted)]">Writing the plan down makes the next step better.</p></FlowStep>
          <FlowArrow label="pick a tool" accent={ACCENT} />
          <FlowStep n={2} title="Act" what="It emits a tool call with arguments. Your code validates and runs it." accent={ACCENT} active={cur.kind === "action"}><p className="font-mono text-xs">{"{ tool: \"weather\", args: { city: \"Paris\" } }"}</p></FlowStep>
          <FlowArrow label="feed back the result" accent={ACCENT} />
          <FlowStep n={3} title="Observe" what="The tool output goes back into the context. The model now knows something it couldn't have guessed." accent={ACCENT} active={cur.kind === "observation"}><p className="text-sm text-[var(--muted)]">Errors are observations too: the model can retry.</p></FlowStep>
          <FlowArrow label="repeat until done" accent={ACCENT} />
          <FlowStep n={4} title="Answer, or stop at a limit" what="When nothing is missing, it answers. Always cap the number of steps and the spend, or a confused agent loops forever." accent={ACCENT} active={cur.kind === "answer"}><p className="text-sm text-[var(--muted)]">max_steps = 10</p></FlowStep>
        </>
      }
    />
  );
}
