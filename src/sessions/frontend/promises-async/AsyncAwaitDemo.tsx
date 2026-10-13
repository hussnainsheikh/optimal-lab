"use client";

import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { useState } from "react";
import { Choices, PlaybackControls, usePlayback } from "@/components/session/ui";
import { CODE, STEPS, timing } from "@/lib/asyncAwait";

const ACCENT = "var(--web)";

export default function AsyncAwaitDemo() {
  const [view, setView] = useState("order");
  const playback = usePlayback(STEPS.length, 1500);
  const s = STEPS[playback.i];
  const out = STEPS.slice(0, playback.i + 1).map((x) => x.out).filter(Boolean);
  const seq = timing(false), par = timing(true);
  return (
    <SessionPage>
      <SessionHeader kicker="Frontend · interactive" title="Promises and async/await" blurb="await pauses only the async function it's in. The caller, and the rest of the page, keep running. Step through the order things happen, then see why awaiting one call after another is often slower than it needs to be." />
      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label={view === "order" ? "Code and output" : "Request timing"}>
              {view === "order" ? (
                <>
                  <ol className="overflow-x-auto rounded-md bg-[var(--inset)] p-2 font-mono text-xs">
                    {CODE.map((l, i) => <li key={i} className="whitespace-pre rounded px-1" style={{ background: i === s.line ? ACCENT : undefined, color: i === s.line ? "var(--on-accent)" : undefined }}>{l}</li>)}
                  </ol>
                  <p className="mt-3 font-mono text-sm">output: {out.join(" ") || "—"}</p>
                </>
              ) : (
                <>
                  {[["await one after another", seq], ["await Promise.all([...])", par]].map(([label, t]) => {
                    const tt = t as typeof seq;
                    return (
                      <div key={String(label)} className="mt-4 first:mt-0">
                        <p className="flex justify-between font-mono text-xs"><span>{String(label)}</span><span>{tt.total} ms</span></p>
                        <ul className="mt-1 space-y-1">{tt.bars.map((b) => <li key={b.name} className="relative h-5 rounded bg-[var(--track)]"><span className="absolute inset-y-0 rounded px-1 font-mono text-[10px] leading-5" style={{ left: `${(b.start / 1000) * 100}%`, width: `${(b.ms / 1000) * 100}%`, background: ACCENT, color: "var(--on-accent)" }}>{b.name}</span></li>)}</ul>
                      </div>
                    );
                  })}
                </>
              )}
            </section>
          }
          panel={
            <SystemMapPanel caption={view === "order" ? s.text : `Three independent requests: ${seq.total} ms one at a time, ${par.total} ms together. Promise.all waits for the slowest.`}>
              <Choices label="Show" accent={ACCENT} value={view} onChange={setView} options={[{ id: "order", label: "Execution order" }, { id: "timing", label: "Sequential vs parallel" }]} />
              {view === "order" && <PlaybackControls playback={playback} accent={ACCENT} nextLabel="Next step" status={`step ${playback.i + 1} of ${STEPS.length}`} />}
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="An async function returns a promise at once" what="Its body runs synchronously until the first await, then the caller gets a pending promise back." accent={ACCENT} active={view === "order" && playback.i <= 4}><p className="text-sm text-[var(--muted)]">Output so far: A B C.</p></FlowStep>
              <FlowArrow label="await" accent={ACCENT} />
              <FlowStep n={2} title="await parks the rest of the function" what="The code after await becomes a callback for when the promise settles. Nothing blocks." accent={ACCENT} active={view === "order" && playback.i >= 7}><p className="text-sm text-[var(--muted)]">Resumes as a microtask, before timers.</p></FlowStep>
              <FlowArrow label="independent work" accent={ACCENT} />
              <FlowStep n={3} title="Start together, await together" what="If calls don't depend on each other, start them all and await Promise.all. Total time is the slowest, not the sum." accent={ACCENT} active={view === "timing"}><p className="font-mono text-xs">await Promise.all([getUser(), getOrders()])</p></FlowStep>
              <FlowArrow label="errors" accent={ACCENT} />
              <FlowStep n={4} title="Handle rejections" what="Wrap awaits in try/catch. Promise.all rejects on the first failure; use Promise.allSettled when you want every result." accent={ACCENT}><p className="text-sm text-[var(--muted)]">An unhandled rejection is a silent bug.</p></FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
