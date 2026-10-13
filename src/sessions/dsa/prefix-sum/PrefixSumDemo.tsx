"use client";

import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { useState } from "react";
import { Slider } from "@/components/session/ui";
import { NUMS, PREFIX, rangeSum } from "@/lib/prefixSum";

const ACCENT = "var(--dsa)";

export default function PrefixSumDemo() {
  const [l, setL] = useState(2);
  const [r, setR] = useState(6);
  const lo = Math.min(l, r), hi = Math.max(l, r);
  const cell = "grid h-10 place-items-center rounded font-mono text-sm";
  return (
    <SessionPage>
      <SessionHeader kicker="DSA · interactive" title="Prefix sums: range sums in O(1)" blurb="Add up the array once from the left, storing the running total. Then the sum of any range is one subtraction: the total up to the end minus the total before the start. Drag the range." />
      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="The array and its prefix sums">
              <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">nums</p>
              <div className="mt-1 grid grid-cols-[repeat(11,minmax(0,1fr))] gap-1">
                <span />
                {NUMS.map((x, i) => <span key={i} className={cell} style={{ background: i >= lo && i <= hi ? ACCENT : "var(--inset)", color: i >= lo && i <= hi ? "var(--on-accent)" : undefined }}>{x}</span>)}
              </div>
              <p className="mt-4 font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">prefix <span className="normal-case tracking-normal">(P[i] = sum of the first i numbers)</span></p>
              <div className="mt-1 grid grid-cols-[repeat(11,minmax(0,1fr))] gap-1">
                {PREFIX.map((x, i) => <span key={i} className={cell} style={{ background: "var(--inset)", outline: i === hi + 1 ? "2px solid var(--good)" : i === lo ? "2px solid var(--bad)" : undefined }}>{x}</span>)}
              </div>
              <div className="mt-1 grid grid-cols-[repeat(11,minmax(0,1fr))] gap-1 font-mono text-[10px] text-[var(--faint)]">{PREFIX.map((_, i) => <span key={i} className="text-center">P{i}</span>)}</div>
              <p className="mt-4 font-mono text-sm">sum(nums[{lo}..{hi}]) = <span className="text-[var(--good)]">P[{hi + 1}]</span> − <span className="text-[var(--bad)]">P[{lo}]</span> = {PREFIX[hi + 1]} − {PREFIX[lo]} = <b>{rangeSum(lo, hi)}</b></p>
              <p className="mt-1 text-xs text-[var(--muted)]">Adding them one by one: {hi - lo + 1} additions. With prefix sums: 1 subtraction, for any range.</p>
            </section>
          }
          panel={
            <SystemMapPanel caption={`Everything in P[${hi + 1}] minus everything before index ${lo} leaves exactly the highlighted range.`}>
              <Slider label="Range start" accent={ACCENT} value={l} min={0} max={NUMS.length - 1} step={1} format={(v) => `index ${v}`} onChange={setL} />
              <Slider label="Range end" accent={ACCENT} value={r} min={0} max={NUMS.length - 1} step={1} format={(v) => `index ${v}`} onChange={setR} />
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="One pass to build" what="P[0] = 0, and each P[i+1] = P[i] + nums[i]. The extra 0 at the front avoids special cases." accent={ACCENT}><p className="font-mono text-xs">P[i + 1] = P[i] + nums[i]</p></FlowStep>
              <FlowArrow label="any range" accent={ACCENT} />
              <FlowStep n={2} title="Subtract two totals" what="The sum from l to r is P[r+1] − P[l]: everything up to r, minus everything before l." accent={ACCENT} active><p className="text-sm text-[var(--muted)]">O(1) per query after O(n) setup.</p></FlowStep>
              <FlowArrow label="the clever bit" accent={ACCENT} />
              <FlowStep n={3} title="Count subarrays with a hash map" what="“How many subarrays sum to k?” Store how often each prefix total appeared; at each P[j], look up P[j] − k." accent={ACCENT}><p className="text-sm text-[var(--muted)]">Turns O(n²) into O(n).</p></FlowStep>
              <FlowArrow label="in 2D" accent={ACCENT} />
              <FlowStep n={4} title="It works in 2D too" what="A summed-area table answers any rectangle sum with four lookups. Image filters use it." accent={ACCENT}><p className="text-sm text-[var(--muted)]">Only for data that doesn&apos;t change; use a Fenwick tree if it does.</p></FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
