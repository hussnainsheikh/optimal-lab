"use client";

import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { PlaybackControls, usePlayback } from "@/components/session/ui";
import { INPUT, run } from "@/lib/mergeIntervals";

const ACCENT = "var(--dsa)";
const FRAMES = run();
const MAX = 20;
const pct = (x: number) => `${(x / MAX) * 100}%`;

export default function MergeIntervalsDemo() {
  const playback = usePlayback(FRAMES.length, 1200);
  const f = FRAMES[playback.i];
  const list = playback.i === 0 ? INPUT : f.sorted;
  return (
    <SessionPage>
      <SessionHeader kicker="DSA · interactive" title="Merge overlapping intervals" blurb="Meetings, bookings, time ranges: combine the ones that overlap. Comparing every pair is slow. Sort by start time first, and then each interval only needs to be compared with the last merged one." />
      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="Intervals on a number line">
              <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">{playback.i === 0 ? "Input, sorted by start" : "Sorted input"}</p>
              <ul className="mt-2 space-y-1">
                {list.map((iv, i) => (
                  <li key={i} className="relative h-6 rounded bg-[var(--inset)]">
                    <span className="absolute inset-y-0.5 grid place-items-center rounded font-mono text-[10px]" style={{ left: pct(iv[0]), width: pct(iv[1] - iv[0]), background: i === f.i ? ACCENT : i < f.i ? "var(--ghost)" : "var(--line-strong)", color: i === f.i ? "var(--on-accent)" : undefined }}>{iv[0]}–{iv[1]}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-4 font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">Merged</p>
              <div className="relative mt-2 h-8 rounded bg-[var(--inset)]">
                {f.merged.map((iv, i) => <span key={i} className="absolute inset-y-1 grid place-items-center rounded font-mono text-[11px]" style={{ left: pct(iv[0]), width: pct(Math.max(iv[1] - iv[0], 0.6)), background: "var(--good)", color: "var(--on-accent)" }}>{iv[0]}–{iv[1]}</span>)}
              </div>
              <div className="mt-1 flex justify-between font-mono text-[10px] text-[var(--faint)]"><span>0</span><span>10</span><span>20</span></div>
            </section>
          }
          panel={<SystemMapPanel caption={f.text}><PlaybackControls playback={playback} accent={ACCENT} nextLabel="Next interval" status={`step ${playback.i + 1} of ${FRAMES.length}`} /></SystemMapPanel>}
          detail={
            <>
              <FlowStep n={1} title="Sort by start" what="After sorting, an interval can only overlap the one directly before it (or the merged block it joined)." accent={ACCENT} active={playback.i === 0}><p className="font-mono text-xs">intervals.sort((a, b) =&gt; a[0] - b[0])</p></FlowStep>
              <FlowArrow label="sweep left to right" accent={ACCENT} />
              <FlowStep n={2} title="Overlap: extend the end" what="If it starts before the last merged one ends, take the larger end." accent={ACCENT} active={f.text.includes("Merge")}><p className="font-mono text-xs">last[1] = max(last[1], cur[1])</p></FlowStep>
              <FlowArrow label="gap" accent={ACCENT} />
              <FlowStep n={3} title="Gap: start a new block" what="If it starts after the last end, nothing earlier can touch it either." accent={ACCENT} active={f.text.includes("gap")}><p className="text-sm text-[var(--muted)]">Push a copy, not the original.</p></FlowStep>
              <FlowArrow label="related" accent={ACCENT} />
              <FlowStep n={4} title="Same idea, other problems" what="Insert an interval, count meeting rooms (sort starts and ends), free time across calendars." accent={ACCENT} active={playback.atEnd}><p className="text-sm text-[var(--muted)]">O(n log n) for the sort, O(n) for the sweep.</p></FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
