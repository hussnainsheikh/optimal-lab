"use client";

import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { PlaybackControls, usePlayback } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { CODE, run } from "@/lib/browserLoop";

const ACCENT = "var(--web)";
const FRAMES = run();

export default function BrowserLoopDemo() {
  const playback = usePlayback(FRAMES.length, 1200);
  const f = FRAMES[playback.i];
  return (
    <SessionPage>
      <SessionHeader kicker="Frontend · interactive" title="The browser event loop" blurb="Predict the output before you press play. One thread runs your script, then every queued microtask, then (maybe) a render, then the next task. A promise callback always beats a zero-millisecond timer." />
      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="Call stack, queues and console">
              <pre className="overflow-x-auto rounded-md bg-[var(--inset)] p-2 font-mono text-xs">{CODE.join("\n")}</pre>
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                <Box title="Call stack" items={f.stack} hot={f.stack.length > 0} />
                <Box title="Microtasks" items={f.micro} hot={f.micro.length > 0} />
                <Box title="Tasks" items={f.tasks} />
              </div>
              <div className="mt-3 rounded-lg border p-2.5" style={{ borderColor: f.rendering ? "var(--good)" : "var(--line)" }}>
                <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--faint)]">Render step</p>
                <p className="text-xs" style={{ color: f.rendering ? "var(--good)" : "var(--faint)" }}>{f.rendering ? "rendering a frame" : "waiting for an empty stack and microtask queue"}</p>
              </div>
              <p className="mt-3 font-mono text-sm">console: {f.output.join(" ") || "—"}</p>
            </section>
          }
          panel={<SystemMapPanel caption={f.text}><PlaybackControls playback={playback} accent={ACCENT} nextLabel="Next" status={`step ${playback.i + 1} of ${FRAMES.length}`} /></SystemMapPanel>}
          detail={
            <>
              <FlowStep n={1} title="Run the script to the end" what="Synchronous code runs first, start to finish. Timers and promises only queue callbacks." accent={ACCENT} active={f.stack.length > 0}><p className="font-mono text-sm">A, E</p></FlowStep>
              <FlowArrow label="stack empty" accent={ACCENT} />
              <FlowStep n={2} title="Drain every microtask" what="Promise callbacks and queueMicrotask run next, all of them, including any they add. Loop forever here and the page freezes." accent={ACCENT} active={f.micro.length > 0 && f.stack.length === 0}><p className="font-mono text-sm">C, D</p></FlowStep>
              <FlowArrow label="maybe render" accent={ACCENT} />
              <FlowStep n={3} title="Render if a frame is due" what="Style, layout and paint happen between tasks, about every 16 ms. Long tasks delay them: that's jank." accent={ACCENT} active={f.rendering}><p className="text-sm text-[var(--muted)]">requestAnimationFrame callbacks run here.</p></FlowStep>
              <FlowArrow label="next task" accent={ACCENT} />
              <FlowStep n={4} title="Take one task from the queue" what="Timers, clicks and network callbacks are tasks. One runs, then microtasks again, then maybe a render." accent={ACCENT} active={playback.atEnd}><p className="font-mono text-sm">Output: A E C D B</p></FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}

function Box({ title, items, hot }: { title: string; items: string[]; hot?: boolean }) {
  return (
    <div className="rounded-lg border p-2.5" style={{ borderColor: hot ? ACCENT : "var(--line)", background: "var(--inset)" }}>
      <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--faint)]">{title}</p>
      <ul className="mt-1 min-h-6 space-y-1">{items.length ? items.map((x, i) => <li key={i} className="rounded bg-[var(--panel)] px-1.5 py-0.5 font-mono text-xs">{x}</li>) : <li className="text-xs text-[var(--faint)]">empty</li>}</ul>
    </div>
  );
}
