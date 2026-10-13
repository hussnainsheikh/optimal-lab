"use client";

import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { useState } from "react";
import { Choices, PlaybackControls, usePlayback } from "@/components/session/ui";
import { CYCLE_TO, N, run } from "@/lib/fastSlow";

const ACCENT = "var(--dsa)";

export default function FastSlowDemo() {
  const [mode, setMode] = useState("cycle");
  return (
    <SessionPage>
      <SessionHeader kicker="DSA · interactive" title="Fast and slow pointers" blurb="Does this linked list loop back on itself? Send two pointers along it, one twice as fast. If there's a loop, the fast one laps the slow one and they meet. No extra memory needed." />
      <div className="mt-6"><Run key={mode} cycle={mode === "cycle"} setMode={setMode} mode={mode} /></div>
    </SessionPage>
  );
}

function Run({ cycle, mode, setMode }: { cycle: boolean; mode: string; setMode: (m: string) => void }) {
  const frames = run(cycle);
  const playback = usePlayback(frames.length, 1000);
  const f = frames[playback.i];
  return (
    <SessionLayout
      visual={
        <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="The linked list">
          <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">Phase {f.phase}: {f.phase === 1 ? "is there a cycle?" : "where does it start?"}</p>
          <ol className="mt-4 flex flex-wrap items-center gap-y-6">
            {Array.from({ length: N }, (_, i) => (
              <li key={i} className="flex items-center">
                <span className="relative grid h-11 w-11 place-items-center rounded-lg border-2 font-mono text-sm" style={{ borderColor: f.done && f.slow === i ? "var(--good)" : f.slow === i || f.fast === i ? ACCENT : "var(--line)", background: cycle && i === CYCLE_TO ? "var(--inset)" : undefined }}>
                  {i}
                  {f.slow === i && <span className="absolute -top-5 font-mono text-[10px] text-[var(--c1)]">{f.phase === 1 ? "slow" : "head"}</span>}
                  {f.fast === i && <span className="absolute -bottom-5 font-mono text-[10px] text-[var(--c3)]">{f.phase === 1 ? "fast" : "meet"}</span>}
                </span>
                {i < N - 1 && <span className="px-1 text-[var(--faint)]">→</span>}
              </li>
            ))}
            <li className="ml-2 font-mono text-xs text-[var(--muted)]">{cycle ? `→ back to ${CYCLE_TO}` : "→ null"}</li>
          </ol>
        </section>
      }
      panel={
        <SystemMapPanel caption={f.text}>
          <Choices label="The list" accent={ACCENT} value={mode} onChange={setMode} options={[{ id: "cycle", label: `Node 7 links to ${CYCLE_TO}` }, { id: "line", label: "Ends at null" }]} />
          <PlaybackControls playback={playback} accent={ACCENT} nextLabel="Next move" status={`move ${playback.i} of ${frames.length - 1}`} />
        </SystemMapPanel>
      }
      detail={
        <>
          <FlowStep n={1} title="Move at two speeds" what="Slow takes one step, fast takes two, every round." accent={ACCENT} active={f.phase === 1 && !f.done}><p className="font-mono text-xs">slow = slow.next; fast = fast.next.next</p></FlowStep>
          <FlowArrow label="no loop" accent={ACCENT} />
          <FlowStep n={2} title="Fast hits null: no cycle" what="If there's an end, the fast pointer reaches it first." accent={ACCENT} active={!cycle && !!f.done}><p className="text-sm text-[var(--muted)]">O(n) time, O(1) memory. A hash set would need O(n) memory.</p></FlowStep>
          <FlowArrow label="loop" accent={ACCENT} />
          <FlowStep n={3} title="They meet inside the loop" what="Each round the gap closes by one, so fast can't jump over slow." accent={ACCENT} active={cycle && f.phase === 1 && f.slow === f.fast && playback.i > 0}><p className="text-sm text-[var(--muted)]">Within one lap of the loop.</p></FlowStep>
          <FlowArrow label="find the entry" accent={ACCENT} />
          <FlowStep n={4} title="Reset one to the head" what="Move both one step at a time. The distances work out so they meet exactly at the start of the loop." accent={ACCENT} active={f.phase === 2}><p className="text-sm text-[var(--muted)]">Same trick finds the middle of a list, or a duplicate number.</p></FlowStep>
        </>
      }
    />
  );
}
