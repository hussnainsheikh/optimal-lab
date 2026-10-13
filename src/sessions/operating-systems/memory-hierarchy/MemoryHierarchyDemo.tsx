"use client";

import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { useState } from "react";
import { Choices } from "@/components/session/ui";
import { human, LEVELS, real } from "@/lib/memoryHierarchy";

const ACCENT = "var(--os)";

export default function MemoryHierarchyDemo() {
  const [scale, setScale] = useState("human");
  const max = Math.log10(LEVELS[LEVELS.length - 1].ns / 0.3);
  return (
    <SessionPage>
      <SessionHeader kicker="Operating systems · interactive" title="The memory hierarchy" blurb="Fast memory is small and expensive; big memory is slow. Real numbers like 1 ns and 100 µs are hard to feel, so switch to human scale: pretend one CPU cycle takes one second." />
      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="Access times">
              <ul className="space-y-2">
                {LEVELS.map((l) => (
                  <li key={l.name}>
                    <p className="flex flex-wrap justify-between gap-2 text-sm"><span>{l.name} <span className="text-xs text-[var(--faint)]">{l.size}</span></span><span className="font-mono" style={{ color: ACCENT }}>{scale === "human" ? human(l.ns) : real(l.ns)}</span></p>
                    <span className="mt-0.5 block h-2 rounded bg-[var(--track)]"><span className="block h-full rounded" style={{ width: `${Math.max(2, (Math.log10(l.ns / 0.3 + 1) / max) * 100)}%`, background: ACCENT }} /></span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-[var(--muted)]">Bars use a log scale: each step right is 10× slower.</p>
            </section>
          }
          panel={
            <SystemMapPanel caption={scale === "human" ? "If a cycle were a second, fetching from RAM is a 6-minute wait, a disk seek over a year, and a round trip to another continent 8 years." : "Each level is roughly 3–100× slower than the one above, and much bigger."}>
              <Choices label="Show times as" accent={ACCENT} value={scale} onChange={setScale} options={[{ id: "real", label: "Real" }, { id: "human", label: "1 cycle = 1 second" }]} />
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Caches hide RAM's slowness" what="The CPU keeps recently used data in small, fast caches. A hit costs a few cycles; a miss costs hundreds." accent={ACCENT}><p className="text-sm text-[var(--muted)]">Locality decides your hit rate.</p></FlowStep>
              <FlowArrow label="leave the chip" accent={ACCENT} />
              <FlowStep n={2} title="Storage is another world" what="An SSD read is a thousand RAM accesses; a spinning disk seek, a hundred thousand." accent={ACCENT}><p className="text-sm text-[var(--muted)]">Why databases cache pages in memory.</p></FlowStep>
              <FlowArrow label="leave the machine" accent={ACCENT} />
              <FlowStep n={3} title="The network is slowest of all" what="Even a fast datacenter round trip costs more than an SSD read. Cross-continent trips are limited by the speed of light." accent={ACCENT}><p className="text-sm text-[var(--muted)]">Batch calls, keep data close.</p></FlowStep>
              <FlowArrow label="so" accent={ACCENT} />
              <FlowStep n={4} title="Design around the gaps" what="Cache hot data a level up, read sequentially, avoid round trips in loops. Knowing these numbers lets you estimate before you build." accent={ACCENT}><p className="text-sm text-[var(--muted)]">“Latency numbers every programmer should know.”</p></FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
