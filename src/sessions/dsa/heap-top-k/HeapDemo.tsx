"use client";

import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { useState } from "react";
import { Choices, PlaybackControls, usePlayback } from "@/components/session/ui";
import { STREAM, topK } from "@/lib/heapTopK";

const ACCENT = "var(--dsa)";
const POS = [[50, 18], [27, 52], [73, 52], [15, 86]];

export default function HeapDemo() {
  const [k, setK] = useState("3");
  return (
    <SessionPage>
      <SessionHeader kicker="DSA · interactive" title="Heap: top k of a stream" blurb="To keep the k largest numbers, hold them in a min-heap. The smallest of the winners sits at the root, so each new number needs one comparison to be rejected, or log k swaps to get in." />
      <div className="mt-6"><Run key={k} k={Number(k)} setK={setK} /></div>
    </SessionPage>
  );
}

function Run({ k, setK }: { k: number; setK: (v: string) => void }) {
  const frames = topK(k);
  const playback = usePlayback(frames.length, 1100);
  const f = frames[playback.i];
  const seen = f.incoming === null ? (playback.i === 0 ? 0 : STREAM.length) : STREAM.indexOf(f.incoming);
  return (
    <SessionLayout
      visual={
        <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="The stream and the heap">
          <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">Stream</p>
          <ol className="mt-2 flex flex-wrap gap-1.5">
            {STREAM.map((x, i) => <li key={i} className="grid h-9 w-9 place-items-center rounded-md border font-mono text-sm" style={{ borderColor: i === seen && f.incoming !== null ? ACCENT : "var(--line)", opacity: i < seen || (f.incoming === null && playback.i > 0) ? 0.4 : 1, background: i === seen && f.incoming !== null ? "var(--inset)" : undefined }}>{x}</li>)}
          </ol>
          <p className="mt-4 font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">Min-heap (size {k})</p>
          <div className="relative mt-2 h-44">
            <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
              {f.heap.map((_, i) => i > 0 && <line key={i} x1={POS[(i - 1) >> 1][0]} y1={POS[(i - 1) >> 1][1]} x2={POS[i][0]} y2={POS[i][1]} stroke="var(--line-strong)" strokeWidth="0.6" vectorEffect="non-scaling-stroke" />)}
            </svg>
            {f.heap.map((x, i) => (
              <span key={i} className="absolute grid h-10 w-10 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 font-mono text-sm" style={{ left: `${POS[i][0]}%`, top: `${POS[i][1]}%`, borderColor: f.hot.includes(i) ? ACCENT : "var(--line)", background: i === 0 ? "var(--inset)" : "var(--panel)" }}>{x}</span>
            ))}
          </div>
          <p className="font-mono text-xs text-[var(--muted)]">array: [{f.heap.join(", ")}] · root = smallest of the top {k}</p>
        </section>
      }
      panel={
        <SystemMapPanel caption={f.text}>
          <Choices label="k" accent={ACCENT} value={String(k)} onChange={setK} options={[{ id: "3", label: "Top 3" }, { id: "4", label: "Top 4" }]} />
          <PlaybackControls playback={playback} accent={ACCENT} nextLabel="Next step" status={`step ${playback.i + 1} of ${frames.length}`} />
        </SystemMapPanel>
      }
      detail={
        <>
          <FlowStep n={1} title="A heap is a tree in an array" what="Children of index i live at 2i+1 and 2i+2. Every parent is smaller than its children, so the minimum is always at index 0." accent={ACCENT}><p className="font-mono text-xs">parent(i) = (i - 1) &gt;&gt; 1</p></FlowStep>
          <FlowArrow label="compare with the root" accent={ACCENT} />
          <FlowStep n={2} title="Reject quickly" what="If the new number isn't bigger than the root, it can't be in the top k." accent={ACCENT} active={f.text.includes("Skip")}><p className="text-sm text-[var(--muted)]">One comparison.</p></FlowStep>
          <FlowArrow label="or replace the root" accent={ACCENT} />
          <FlowStep n={3} title="Replace and sift down" what="Put the newcomer at the root, then swap it down with its smaller child until the order is restored." accent={ACCENT} active={f.hot.length === 2}><p className="text-sm text-[var(--muted)]">At most log k swaps.</p></FlowStep>
          <FlowArrow label="total cost" accent={ACCENT} />
          <FlowStep n={4} title="O(n log k), O(k) memory" what="Better than sorting everything (n log n), and it works on a stream you can't hold in memory." accent={ACCENT} active={playback.atEnd}><p className="text-sm text-[var(--muted)]">Also: k closest points, merge k sorted lists, running median.</p></FlowStep>
        </>
      }
    />
  );
}
