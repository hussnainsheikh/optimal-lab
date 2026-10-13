"use client";

import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { useState } from "react";
import { Choices, PlaybackControls, usePlayback } from "@/components/session/ui";
import { DONE, firstFeedback, PATTERNS, view, type Pattern } from "@/lib/latencyUx";

const ACCENT = "var(--native)";
const TIMES = Array.from({ length: 15 }, (_, i) => i * 0.5);

export default function LatencyUxDemo() {
  const [p, setP] = useState<Pattern>("spinner");
  const playback = usePlayback(TIMES.length, 500);
  const t = TIMES[playback.i];
  const v = view(p, t);
  return (
    <SessionPage>
      <SessionHeader kicker="AI Native · interactive" title="Designing for slow responses" blurb={`The agent takes ${DONE} seconds to book a trip, whatever you do. What changes is how long the user waits for any sign of life, and whether they trust it's working. Press play and compare.`} />
      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="What the user sees">
              <p className="flex justify-between font-mono text-xs text-[var(--faint)]"><span>user&apos;s screen</span><span>t = {t.toFixed(1)} s</span></p>
              <div className="mt-2 min-h-40 rounded-lg border border-[var(--line)] bg-[var(--inset)] p-4">
                <p className="rounded-md bg-[var(--panel)] px-3 py-2 text-sm">Book me 3 nights in Lisbon next month, near the river.</p>
                <div className="mt-3 text-sm">
                  {v.kind === "spinner" && <p className="flex items-center gap-2 text-[var(--muted)]"><span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-[var(--line)] border-t-[var(--text)]" /> …</p>}
                  {v.kind === "steps" && <ul className="space-y-1">{v.steps.map((s, i) => <li key={s} className="flex items-center gap-2"><span style={{ color: i < v.steps.length - 1 ? "var(--good)" : ACCENT }}>{i < v.steps.length - 1 ? "✓" : "●"}</span>{s}…</li>)}</ul>}
                  {v.kind === "skeleton" && <div className="space-y-2"><span className="block h-3 w-3/4 animate-pulse rounded bg-[var(--track)]" /><span className="block h-3 w-1/2 animate-pulse rounded bg-[var(--track)]" /></div>}
                  {(v.kind === "stream" || v.kind === "answer") && <p>{v.text}</p>}
                  {v.kind === "optimistic" && <p className="text-[var(--muted)]">{v.text} <span className="ml-1 rounded bg-[var(--track)] px-1.5 py-0.5 text-[10px]">you can keep browsing</span></p>}
                </div>
              </div>
              <ul className="mt-4 space-y-1 font-mono text-xs">{PATTERNS.map((x) => <li key={x.id} className="flex justify-between" style={{ color: x.id === p ? ACCENT : "var(--muted)" }}><span>{x.label}</span><span>first feedback at {firstFeedback(x.id)} s</span></li>)}</ul>
            </section>
          }
          panel={
            <SystemMapPanel caption={p === "spinner" ? `Nothing meaningful for ${DONE} seconds. Users start wondering if it's stuck, and some click again.` : p === "steps" ? "Real progress, named. The wait feels shorter because the user can see work happening." : p === "stream" ? "A skeleton holds the layout, then words appear as they're generated. Reading starts long before the end." : "Show the expected result immediately and confirm later. The user moves on; failure is handled by a notification."}>
              <Choices label="Pattern" accent={ACCENT} value={p} onChange={setP} options={PATTERNS} />
              <PlaybackControls playback={playback} accent={ACCENT} nextLabel="+0.5 s" status={`${t.toFixed(1)} s`} />
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Acknowledge within 100 ms" what="Instantly show the request was received: echo the message, disable double-submit." accent={ACCENT}><p className="text-sm text-[var(--muted)]">Silence reads as broken.</p></FlowStep>
              <FlowArrow label="show real progress" accent={ACCENT} />
              <FlowStep n={2} title="Narrate what's happening" what="Agents have natural steps: searching, comparing, booking. Showing them builds trust and lets users catch mistakes early." accent={ACCENT} active={p === "steps"}><p className="text-sm text-[var(--muted)]">Don&apos;t fake progress bars.</p></FlowStep>
              <FlowArrow label="stream" accent={ACCENT} />
              <FlowStep n={3} title="Stream text into a stable layout" what="Skeletons stop the page jumping; streaming lets people read as it writes." accent={ACCENT} active={p === "stream"}><p className="text-sm text-[var(--muted)]">Let them stop generation.</p></FlowStep>
              <FlowArrow label="or don't block at all" accent={ACCENT} />
              <FlowStep n={4} title="Move long work to the background" what="For tasks over ~10 s, return immediately, run it as a job, and notify on completion. Keep a visible task list." accent={ACCENT} active={p === "optimistic"}><p className="text-sm text-[var(--muted)]">Be ready to undo optimistic results.</p></FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
